import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';

class HopeSavedSearch {
  const HopeSavedSearch({
    required this.id,
    required this.name,
    required this.query,
    required this.kind,
    required this.visibility,
    required this.city,
    required this.category,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String query;
  final String kind;
  final String visibility;
  final String city;
  final String category;
  final String updatedAt;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'query': query,
        'kind': kind,
        'visibility': visibility,
        'city': city,
        'category': category,
        'updatedAt': updatedAt,
      };

  factory HopeSavedSearch.fromMap(Map<String, dynamic> map) => HopeSavedSearch(
        id: '${map['id'] ?? ''}',
        name: '${map['name'] ?? ''}'.trim(),
        query: '${map['query'] ?? ''}',
        kind: '${map['kind'] ?? 'ALL'}',
        visibility: '${map['visibility'] ?? 'ALL'}',
        city: '${map['city'] ?? 'AUTO'}',
        category: '${map['category'] ?? 'ALL'}',
        updatedAt: '${map['updatedAt'] ?? ''}',
      );

  bool get isUsable => id.isNotEmpty && name.isNotEmpty;
}

abstract interface class SavedSearchRepository {
  Future<List<HopeSavedSearch>> list();
  Future<HopeSavedSearch> upsert(HopeSavedSearch search);
  Future<void> delete(String id);
}

class SharedPreferencesSavedSearchRepository implements SavedSearchRepository {
  SharedPreferencesSavedSearchRepository(this._loadPreferences);

  final Future<SharedPreferences> Function() _loadPreferences;
  static const _key = 'hope.v2.saved_searches';
  static const _pendingUpsertsKey = 'hope.v2.saved_searches.pending_upserts';
  static const _pendingDeletesKey = 'hope.v2.saved_searches.pending_deletes';
  static const _limit = 20;

  @override
  Future<List<HopeSavedSearch>> list() async {
    final prefs = await _loadPreferences();
    final raw = prefs.getString(_key);
    if (raw == null || raw.trim().isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((item) => HopeSavedSearch.fromMap(Map<String, dynamic>.from(item)))
          .where((item) => item.isUsable)
          .toList(growable: false);
    } catch (_) {
      await prefs.remove(_key);
      return const [];
    }
  }

  @override
  Future<HopeSavedSearch> upsert(HopeSavedSearch search) async {
    final prefs = await _loadPreferences();
    final current = (await list()).toList();
    current.removeWhere((item) => item.name.trim().toLowerCase() == search.name.trim().toLowerCase() || item.id == search.id);
    current.insert(0, search);
    if (current.length > _limit) current.removeRange(_limit, current.length);
    await prefs.setString(_key, jsonEncode(current.map((item) => item.toMap()).toList(growable: false)));
    return search;
  }

  @override
  Future<void> delete(String id) async {
    final prefs = await _loadPreferences();
    final current = await list();
    current.removeWhere((item) => item.id == id);
    await prefs.setString(_key, jsonEncode(current.map((item) => item.toMap()).toList(growable: false)));
  }
}


class SyncedSavedSearchRepository implements SavedSearchRepository {
  SyncedSavedSearchRepository({
    required this.local,
    required this.api,
  });

  final SharedPreferencesSavedSearchRepository local;
  final ApiClient api;

  Future<List<HopeSavedSearch>> _pendingUpserts() async {
    final prefs = await local._loadPreferences();
    final raw = prefs.getString(SharedPreferencesSavedSearchRepository._pendingUpsertsKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded.whereType<Map>()
          .map((item) => HopeSavedSearch.fromMap(Map<String, dynamic>.from(item)))
          .where((item) => item.isUsable)
          .toList(growable: false);
    } catch (_) {
      await prefs.remove(SharedPreferencesSavedSearchRepository._pendingUpsertsKey);
      return const [];
    }
  }

  Future<Set<String>> _pendingDeletes() async {
    final prefs = await local._loadPreferences();
    final raw = prefs.getString(SharedPreferencesSavedSearchRepository._pendingDeletesKey);
    if (raw == null || raw.isEmpty) return <String>{};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return <String>{};
      return decoded.whereType<String>().where((id) => id.isNotEmpty).toSet();
    } catch (_) {
      await prefs.remove(SharedPreferencesSavedSearchRepository._pendingDeletesKey);
      return <String>{};
    }
  }

  Future<void> _savePending(List<HopeSavedSearch> upserts, Set<String> deletes) async {
    final prefs = await local._loadPreferences();
    await prefs.setString(SharedPreferencesSavedSearchRepository._pendingUpsertsKey, jsonEncode(upserts.map((x) => x.toMap()).toList(growable: false)));
    await prefs.setString(SharedPreferencesSavedSearchRepository._pendingDeletesKey, jsonEncode(deletes.toList(growable: false)));
  }

  Future<void> _flushPending() async {
    if (!await _hasSession) return;
    final upserts = (await _pendingUpserts()).toList();
    final deletes = await _pendingDeletes();
    final remainingUpserts = <HopeSavedSearch>[];
    final remainingDeletes = <String>{};
    for (final item in upserts) {
      try {
        await api.request('PUT', '/saved-searches', auth: true, body: item.toMap());
      } catch (_) {
        remainingUpserts.add(item);
      }
    }
    for (final id in deletes) {
      try {
        await api.request('DELETE', '/saved-searches/${Uri.encodeComponent(id)}', auth: true);
      } catch (_) {
        remainingDeletes.add(id);
      }
    }
    await _savePending(remainingUpserts, remainingDeletes);
  }

  Future<bool> get _hasSession async {
    final token = await api.store.accessToken;
    return token != null && token.isNotEmpty;
  }

  List<HopeSavedSearch> _merge(List<HopeSavedSearch> localItems, List<HopeSavedSearch> remoteItems) {
    final byKey = <String, HopeSavedSearch>{};
    for (final item in [...remoteItems, ...localItems]) {
      if (!item.isUsable) continue;
      final key = item.name.trim().toLowerCase();
      final existing = byKey[key];
      if (existing == null || item.updatedAt.compareTo(existing.updatedAt) >= 0) {
        byKey[key] = item;
      }
    }
    final merged = byKey.values.toList(growable: true)
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return merged.take(20).toList(growable: false);
  }

  @override
  Future<List<HopeSavedSearch>> list() async {
    final localItems = await local.list();
    final pendingDeletes = await _pendingDeletes();
    final pendingUpserts = await _pendingUpserts();
    final locallyEffective = _merge(localItems, pendingUpserts)
        .where((item) => !pendingDeletes.contains(item.id))
        .toList(growable: false);
    if (!await _hasSession) return locallyEffective;
    try {
      await _flushPending();
      final remainingDeletes = await _pendingDeletes();
      final raw = await api.request('GET', '/saved-searches', auth: true);
      final remote = raw is Map && raw['items'] is List
          ? (raw['items'] as List)
              .whereType<Map>()
              .map((item) => HopeSavedSearch.fromMap(Map<String, dynamic>.from(item)))
              .where((item) => item.isUsable)
              .toList(growable: false)
          : <HopeSavedSearch>[];
      final merged = _merge(locallyEffective, remote)
          .where((item) => !remainingDeletes.contains(item.id))
          .take(20)
          .toList(growable: false);
      for (final item in merged) {
        await local.upsert(item);
      }
      return merged;
    } catch (_) {
      return locallyEffective;
    }
  }

  @override
  Future<HopeSavedSearch> upsert(HopeSavedSearch search) async {
    await local.upsert(search);
    final upserts = (await _pendingUpserts()).where((item) => item.id != search.id && item.name.trim().toLowerCase() != search.name.trim().toLowerCase()).toList();
    final deletes = await _pendingDeletes();
    deletes.remove(search.id);
    if (!await _hasSession) {
      upserts.insert(0, search);
      await _savePending(upserts.take(20).toList(growable: false), deletes);
      return search;
    }
    try {
      final raw = await api.request('PUT', '/saved-searches', auth: true, body: search.toMap());
      if (raw is Map) {
        final remote = HopeSavedSearch.fromMap(Map<String, dynamic>.from(raw));
        if (remote.isUsable) {
          await local.upsert(remote);
          await _savePending(upserts, deletes);
          return remote;
        }
      }
      upserts.insert(0, search);
    } catch (_) {
      upserts.insert(0, search);
    }
    await _savePending(upserts.take(20).toList(growable: false), deletes);
    return search;
  }

  @override
  Future<void> delete(String id) async {
    await local.delete(id);
    final upserts = (await _pendingUpserts()).where((item) => item.id != id).toList();
    final deletes = await _pendingDeletes();
    deletes.add(id);
    if (await _hasSession) {
      try {
        await api.request('DELETE', '/saved-searches/${Uri.encodeComponent(id)}', auth: true);
        deletes.remove(id);
      } catch (_) {}
    }
    await _savePending(upserts, deletes);
  }
}
