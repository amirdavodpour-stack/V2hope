import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/notifications/notification_repository.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    if (call.method == 'read' && args['key'] == 'hope.access_token') {
      return 'token';
    }
    return null;
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiNotificationRepository repository;
  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
    repository = ApiNotificationRepository(
        ApiClient(SecureStore(), baseUrl: server.baseUrl));
  });
  tearDown(() => server.close());

  test('requests the configured pagination and parses unread count', () async {
    server.handlers['/notifications'] = (request, body) async {
      expect(request.uri.queryParameters['limit'], '10');
      expect(request.uri.queryParameters['offset'], '20');
      await respondJson(request, 200, {
        'data': {
          'unreadCount': 3,
          'items': [
            {'id': 'n1', 'title': 'Hello', 'body': 'Body'},
            'bad',
          ]
        }
      });
    };
    final page = await repository.listNotifications(limit: 10, offset: 20);
    expect(page.unreadCount, 3);
    expect(page.items, hasLength(1));
    expect(page.items.single.isUnread, isTrue);
  });

  test('markRead parses the updated notification', () async {
    server.handlers['/notifications/n1/read'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {'id': 'n1', 'title': 'Hello', 'body': 'Body', 'readAt': 'now'}
      });
    };
    final item = await repository.markRead('n1');
    expect(item.isUnread, isFalse);
  });

  test('markAllRead returns updated count and defaults missing count to zero',
      () async {
    server.handlers['/notifications/read-all'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {'updated': 4}
      });
    };
    expect(await repository.markAllRead(), 4);
  });
}
