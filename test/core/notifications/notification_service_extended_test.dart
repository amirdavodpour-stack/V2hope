import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/notifications/notification_service.dart';
import 'package:hope_mobile/core/notifications/push_token_provider.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

class _TokenProvider implements PushTokenProvider {
  _TokenProvider(this.value);
  final String? value;
  @override
  Future<String?> getToken() async => value;
}

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final values = <String, String>{'hope.access_token': 'token'};
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
  late FakeApiServer server;

  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
  });
  tearDown(() => server.close());

  test('initialize is a no-op when no push provider is available', () async {
    final service =
        NotificationService(ApiClient(SecureStore(), baseUrl: server.baseUrl));
    server.handlers['/notifications/devices'] = (request, body) async {
      fail('must not register without a provider');
    };
    await service.initialize();
    await service.dispose();
  });

  test('initialize trims token and registers it as Android', () async {
    String? captured;
    server.handlers['/notifications/devices'] = (request, body) async {
      captured = body['token'] as String?;
      expect(body['platform'], 'ANDROID');
      await respondJson(request, 200, {'id': 'd1'});
    };
    final service = NotificationService(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      pushProvider: _TokenProvider('  token-abc  '),
    );
    await service.initialize();
    expect(captured, 'token-abc');
    await service.dispose();
  });

  test('initialize ignores blank provider tokens', () async {
    server.handlers['/notifications/devices'] = (request, body) async {
      fail('blank tokens must not reach the server');
    };
    final service = NotificationService(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      pushProvider: _TokenProvider('   '),
    );
    await service.initialize();
    await service.dispose();
  });

  test('publishLocal emits events in order', () async {
    final service =
        NotificationService(ApiClient(SecureStore(), baseUrl: server.baseUrl));
    final events = <String>[];
    final subscription = service.events.listen(events.add);
    service.publishLocal('a');
    service.publishLocal('b');
    await Future<void>.delayed(Duration.zero);
    expect(events, ['a', 'b']);
    await subscription.cancel();
    await service.dispose();
  });
}
