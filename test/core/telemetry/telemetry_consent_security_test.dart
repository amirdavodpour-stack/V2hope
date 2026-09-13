import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/telemetry/telemetry_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late TelemetryService telemetry;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    installFakeSecureStorage();
    server = await FakeApiServer.start();
    telemetry = TelemetryService(SecureStore(), baseUrl: server.baseUrl);
  });
  tearDown(() => server.close());

  test('telemetry is opt-in by default and emits no request without consent',
      () async {
    await telemetry.track('app_opened');
    expect(server.received, isEmpty);
  });

  test(
      'analytics tracking sends platform, event, timestamp and bounded payload after consent',
      () async {
    await telemetry.setTelemetryConsent(true);
    server.handlers['/analytics/events'] = (request, body) async {
      expect(request.method, 'POST');
      expect(body['eventName'], 'opportunity_viewed');
      expect(body['platform'], 'ANDROID');
      expect(body['occurredAt'], isA<String>());
      expect(body['anonymousId'], isA<String>());
      expect(body['properties']['screen'], 'home');
      await respondJson(request, 201, {
        'data': {'ok': true}
      });
    };
    await telemetry.track('opportunity_viewed', properties: {'screen': 'home'});
    expect(server.received, hasLength(1));
  });

  test(
      'disabling consent removes the persisted anonymous identity and suppresses errors too',
      () async {
    await telemetry.setTelemetryConsent(true);
    server.handlers['/analytics/events'] =
        (request, body) async => respondJson(request, 201, {'data': {}});
    await telemetry.track('search_viewed');
    expect(server.received, hasLength(1));

    await telemetry.setTelemetryConsent(false);
    await telemetry.track('search_viewed');
    await telemetry.recordError(StateError('x'), StackTrace.current,
        fingerprint: 'error-1234');
    expect(server.received, hasLength(1));
  });

  test('recordError is fail-safe when the endpoint is unavailable', () async {
    final broken =
        TelemetryService(SecureStore(), baseUrl: 'http://127.0.0.1:1');
    await broken.setTelemetryConsent(true);
    await expectLater(
      broken.recordError(StateError('boom'), StackTrace.current,
          fingerprint: 'error-1234'),
      completes,
    );
  });
}
