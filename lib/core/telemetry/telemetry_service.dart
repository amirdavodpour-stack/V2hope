import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../storage/secure_store.dart';

class TelemetryService {
  TelemetryService(this.store, {required this.baseUrl});
  final SecureStore store;
  final String baseUrl;
  static const _anonKey = 'hope.telemetry.anonymous_id';
  static const _consentKey = 'hope.telemetry.consent';
  static const _version =
      String.fromEnvironment('HOPE_VERSION', defaultValue: '0.0.0');

  Future<String> _anonymousId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_anonKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final seed =
        '${DateTime.now().microsecondsSinceEpoch}-${Object.hash(this, DateTime.now())}';
    final value = base64Url.encode(utf8.encode(seed)).replaceAll('=', '');
    await prefs.setString(_anonKey, value);
    return value;
  }

  String get _platform {
    if (kIsWeb) return 'WEB';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'ANDROID';
      case TargetPlatform.iOS:
        return 'IOS';
      default:
        return 'UNKNOWN';
    }
  }

  Future<bool> get telemetryConsent async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_consentKey) ?? false;
  }

  Future<void> setTelemetryConsent(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_consentKey, enabled);
    if (!enabled) await prefs.remove(_anonKey);
  }

  Future<void> track(String eventName,
      {Map<String, Object?> properties = const {}, String? sessionId}) async {
    try {
      if (!await telemetryConsent) return;
      final token = await store.accessToken;
      final body = <String, dynamic>{
        'eventName': eventName,
        'anonymousId': await _anonymousId(),
        'sessionId': sessionId,
        'appVersion': _version,
        'platform': _platform,
        'properties': properties,
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
      };
      await http
          .post(Uri.parse('$baseUrl/analytics/events'),
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                if (token != null && token.isNotEmpty)
                  'Authorization': 'Bearer $token',
              },
              body: jsonEncode(body))
          .timeout(const Duration(seconds: 4));
    } catch (_) {
      // Telemetry must never affect the product request path.
    }
  }

  Future<void> recordError(Object error, StackTrace stack,
      {String? fingerprint, Map<String, Object?> context = const {}}) async {
    try {
      if (!await telemetryConsent) return;
      final token = await store.accessToken;
      final body = <String, dynamic>{
        'anonymousId': await _anonymousId(),
        'appVersion': _version,
        'platform': _platform,
        'releaseChannel': kReleaseMode ? 'production' : 'debug',
        'fingerprint': fingerprint ?? _fingerprint(error),
        'message': error.toString(),
        'stack': stack.toString(),
        'context': context,
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
      };
      await http
          .post(Uri.parse('$baseUrl/analytics/crashes'),
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                if (token != null && token.isNotEmpty)
                  'Authorization': 'Bearer $token',
              },
              body: jsonEncode(body))
          .timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  String _fingerprint(Object error) {
    final raw = error.runtimeType.toString();
    return raw.length >= 8 ? raw : '${raw}_error';
  }
}
