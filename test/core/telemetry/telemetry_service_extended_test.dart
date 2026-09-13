import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/telemetry/telemetry_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final values = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    switch (call.method) {
      case 'read':
        return values[args['key'] as String];
      case 'write':
        values[args['key'] as String] = args['value'] as String;
        return null;
      case 'delete':
        values.remove(args['key'] as String);
        return null;
      case 'readAll':
        return values;
      case 'deleteAll':
        values.clear();
        return null;
      default:
        return null;
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    _installStorage();
  });

  test('consent defaults to disabled', () async {
    final telemetry =
        TelemetryService(SecureStore(), baseUrl: 'http://127.0.0.1:9');
    expect(await telemetry.telemetryConsent, isFalse);
  });

  test('enabling consent persists the setting', () async {
    final telemetry =
        TelemetryService(SecureStore(), baseUrl: 'http://127.0.0.1:9');
    await telemetry.setTelemetryConsent(true);
    expect(await telemetry.telemetryConsent, isTrue);
  });

  test('disabling consent removes the anonymous id', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hope.telemetry.anonymous_id', 'anon');
    final telemetry =
        TelemetryService(SecureStore(), baseUrl: 'http://127.0.0.1:9');
    await telemetry.setTelemetryConsent(false);
    expect(prefs.containsKey('hope.telemetry.anonymous_id'), isFalse);
  });

  test('tracking is fail-safe when telemetry endpoint is unavailable',
      () async {
    final telemetry =
        TelemetryService(SecureStore(), baseUrl: 'http://127.0.0.1:1');
    await telemetry.setTelemetryConsent(true);
    await telemetry.track('runtime_probe', properties: {'screen': 'home'});
    expect(await telemetry.telemetryConsent, isTrue);
  });
}
