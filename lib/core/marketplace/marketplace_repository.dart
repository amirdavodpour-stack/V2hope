import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import 'category.dart';
import 'job.dart';

/// Application-facing boundary for marketplace data.
///
/// Features depend on this contract instead of knowing HTTP paths, response
/// envelopes, or authentication flags. The concrete implementation remains
/// replaceable for tests and for future local/cache-backed data sources.
abstract interface class MarketplaceRepository {
  Future<List<HopeCategory>> listCategories();
  Future<HopeJob> getOpportunity(String id);

  /// [city] is matched *exactly* by the server (`GET /jobs`) when it lists
  /// non-personalized opportunities, so pass `null` (never a sentinel like
  /// "all") to mean "every city" -- a non-null value that doesn't match any
  /// job's stored city silently returns an empty list.
  Future<List<HopeJob>> listOpportunities({
    required String? city,
    required bool personalizedRecommendations,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  });

  Future<HopeJob> createOpportunity(Map<String, dynamic> body);

  Future<void> publishOpportunity(String id);
}

class ApiMarketplaceRepository implements MarketplaceRepository {
  ApiMarketplaceRepository(this._api);

  final ApiClient _api;

  @override
  Future<HopeJob> getOpportunity(String id) async {
    if (id.trim().isEmpty) throw const FormatException('Opportunity id is required');
    final raw = await _api.request('GET', '/jobs/${Uri.encodeComponent(id)}');
    if (raw is! Map) throw const FormatException('Missing opportunity payload');
    return HopeJob.fromMap(Map<String, dynamic>.from(raw));
  }

  @override
  Future<List<HopeCategory>> listCategories() async {
    final raw = await _api.request('GET', '/categories');
    final list = _asList(raw);
    return flattenCategories(
      list
          .whereType<Map>()
          .map((item) => HopeCategory.fromMap(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }

  @override
  Future<List<HopeJob>> listOpportunities({
    required String? city,
    required bool personalizedRecommendations,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  }) async {
    // Omit the query param entirely for "all cities" -- sending
    // `city=<anything>` makes the server's exact-match filter drop every
    // job, since no job's `city` field equals a sentinel like "all".
    final query = <String>[
      if (city != null && city.isNotEmpty)
        'city=${Uri.encodeQueryComponent(city)}',
      if (search != null && search.trim().isNotEmpty)
        'q=${Uri.encodeQueryComponent(search.trim())}',
      if (kind != null && kind != 'ALL' && kind.isNotEmpty)
        'kind=${Uri.encodeQueryComponent(kind)}',
      if (visibility != null && visibility != 'ALL' && visibility.isNotEmpty)
        'visibility=${Uri.encodeQueryComponent(visibility)}',
      if (categoryId != null && categoryId != 'ALL' && categoryId.isNotEmpty)
        'categoryId=${Uri.encodeQueryComponent(categoryId)}',
    ];
    final path = personalizedRecommendations ? '/jobs/recommended' : '/jobs';
    if (personalizedRecommendations && latitude != null && longitude != null) {
      query.add('lat=$latitude');
      query.add('lng=$longitude');
    }

    final raw = await _api.request(
        'GET', query.isEmpty ? path : '$path?${query.join('&')}');
    return _asList(raw)
        .whereType<Map>()
        .map((item) => HopeJob.fromMap(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<HopeJob> createOpportunity(Map<String, dynamic> body) async {
    final raw = await _api.request('POST', '/jobs', auth: true, body: body);
    if (raw is! Map) {
      throw const FormatException('Missing opportunity payload');
    }
    final job = HopeJob.fromMap(Map<String, dynamic>.from(raw));
    if (job.id.isEmpty) {
      throw const FormatException('Missing opportunity id');
    }
    return job;
  }

  @override
  Future<void> publishOpportunity(String id) async {
    if (id.trim().isEmpty) {
      throw const FormatException('Opportunity id is required');
    }
    await _api.request('POST', '/jobs/${Uri.encodeComponent(id)}/publish',
        auth: true);
  }

  static List<dynamic> _asList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map && raw['data'] is List) return raw['data'] as List;
    return const <dynamic>[];
  }
}


/// Offline-first decorator for read-only marketplace requests.
///
/// Fresh results are cached for quick repeat loads. When the network is
/// unavailable, a bounded stale result can be returned so Discovery remains
/// useful instead of collapsing to an error state. Mutations intentionally
/// bypass the cache and invalidate affected opportunity entries.
class OfflineMarketplaceRepository implements MarketplaceRepository {
  OfflineMarketplaceRepository(
    this._remote, {
    Future<SharedPreferences> Function()? loadPreferences,
    this.freshFor = const Duration(minutes: 5),
    this.staleFor = const Duration(hours: 24),
  }) : _loadPreferences = loadPreferences ?? SharedPreferences.getInstance;

  final MarketplaceRepository _remote;
  final Future<SharedPreferences> Function() _loadPreferences;
  final Duration freshFor;
  final Duration staleFor;
  static const int maxCachedEntries = 30;
  static const String _indexKey = 'hope.v2.cache.index';

  String _key(String prefix, String value) => 'hope.v2.cache.$prefix.${base64UrlEncode(utf8.encode(value)).replaceAll('=', '')}';

  String _opportunitiesKey({
    required String? city,
    required bool personalizedRecommendations,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  }) => _key('opportunities', jsonEncode({
        'city': city,
        'personalized': personalizedRecommendations,
        'lat': latitude,
        'lng': longitude,
        'search': search,
        'kind': kind,
        'visibility': visibility,
        'categoryId': categoryId,
      }));

  Future<List<HopeJob>?> _readJobs(String key, {required bool allowStale}) async {
    final prefs = await _loadPreferences();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final savedAt = DateTime.parse('${decoded['savedAt'] ?? ''}');
      final age = DateTime.now().toUtc().difference(savedAt.toUtc());
      final ttl = allowStale ? staleFor : freshFor;
      if (age.isNegative || age > ttl) return null;
      final items = decoded['items'];
      if (items is! List) return null;
      return items
          .whereType<Map>()
          .map((item) => HopeJob.fromMap(Map<String, dynamic>.from(item)))
          .toList(growable: false);
    } catch (_) {
      await _removeCachedKey(key);
      return null;
    }
  }

  Future<void> _writeJobs(String key, List<HopeJob> jobs) async {
    final prefs = await _loadPreferences();
    final now = DateTime.now().toUtc().toIso8601String();
    await prefs.setString(key, jsonEncode({
      'savedAt': now,
      'items': jobs.map((j) => j.raw).toList(growable: false),
    }));

    final rawIndex = prefs.getString(_indexKey);
    final entries = <String, String>{};
    if (rawIndex != null && rawIndex.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawIndex);
        if (decoded is Map) {
          for (final entry in decoded.entries) {
            if (entry.key is String && entry.value is String) {
              entries[entry.key as String] = entry.value as String;
            }
          }
        }
      } catch (_) {
        entries.clear();
      }
    }
    entries[key] = now;
    final ordered = entries.entries.toList()..sort((a, b) => a.value.compareTo(b.value));
    while (ordered.length > maxCachedEntries) {
      final evicted = ordered.removeAt(0);
      entries.remove(evicted.key);
      await prefs.remove(evicted.key);
    }
    await prefs.setString(_indexKey, jsonEncode(entries));
  }

  Future<void> _removeCachedKey(String key) async {
    final prefs = await _loadPreferences();
    await prefs.remove(key);
    final rawIndex = prefs.getString(_indexKey);
    if (rawIndex == null || rawIndex.isEmpty) return;
    try {
      final decoded = jsonDecode(rawIndex);
      if (decoded is Map && decoded.remove(key) != null) {
        await prefs.setString(_indexKey, jsonEncode(decoded));
      }
    } catch (_) {
      await prefs.remove(_indexKey);
    }
  }

  Future<void> _invalidateOpportunityListCaches() async {
    final prefs = await _loadPreferences();
    final rawIndex = prefs.getString(_indexKey);
    if (rawIndex == null || rawIndex.isEmpty) return;
    try {
      final decoded = jsonDecode(rawIndex);
      if (decoded is! Map) return;
      final index = Map<String, dynamic>.from(decoded);
      final staleKeys = index.keys.where((key) => key.startsWith('hope.v2.cache.opportunities.')).toList(growable: false);
      for (final key in staleKeys) {
        await prefs.remove(key);
        index.remove(key);
      }
      await prefs.setString(_indexKey, jsonEncode(index));
    } catch (_) {
      await prefs.remove(_indexKey);
    }
  }

  @override
  Future<List<HopeCategory>> listCategories() => _remote.listCategories();

  @override
  Future<HopeJob> getOpportunity(String id) async {
    try {
      final job = await _remote.getOpportunity(id);
      await _writeJobs(_key('opportunity', id), [job]);
      return job;
    } catch (error) {
      final cached = await _readJobs(_key('opportunity', id), allowStale: true);
      if (cached != null && cached.isNotEmpty) return cached.first;
      rethrow;
    }
  }

  @override
  Future<List<HopeJob>> listOpportunities({
    required String? city,
    required bool personalizedRecommendations,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  }) async {
    // Personalized results are user-specific. Do not persist them in an
    // unscoped device cache because logout/login could otherwise expose the
    // previous account's recommendations.
    if (personalizedRecommendations) {
      return _remote.listOpportunities(
        city: city,
        personalizedRecommendations: personalizedRecommendations,
        latitude: latitude,
        longitude: longitude,
        search: search,
        kind: kind,
        visibility: visibility,
        categoryId: categoryId,
      );
    }

    final key = _opportunitiesKey(
      city: city,
      personalizedRecommendations: personalizedRecommendations,
      latitude: latitude,
      longitude: longitude,
      search: search,
      kind: kind,
      visibility: visibility,
      categoryId: categoryId,
    );
    try {
      final result = await _remote.listOpportunities(
        city: city,
        personalizedRecommendations: personalizedRecommendations,
        latitude: latitude,
        longitude: longitude,
        search: search,
        kind: kind,
        visibility: visibility,
        categoryId: categoryId,
      );
      await _writeJobs(key, result);
      return result;
    } catch (_) {
      final cached = await _readJobs(key, allowStale: true);
      if (cached != null) return cached;
      rethrow;
    }
  }

  @override
  Future<HopeJob> createOpportunity(Map<String, dynamic> body) async {
    final created = await _remote.createOpportunity(body);
    await _invalidateOpportunityListCaches();
    return created;
  }

  @override
  Future<void> publishOpportunity(String id) async {
    await _remote.publishOpportunity(id);
    final opportunityKey = _key('opportunity', id);
    await _removeCachedKey(opportunityKey);
    await _invalidateOpportunityListCaches();
  }
}
