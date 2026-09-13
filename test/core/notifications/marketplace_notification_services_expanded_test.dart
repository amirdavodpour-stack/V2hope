import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/job_detail_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/notifications/notification_repository.dart';
import 'package:hope_mobile/core/notifications/notification_service.dart';
import 'package:hope_mobile/core/notifications/push_token_provider.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

class _TokenProvider implements PushTokenProvider {
  _TokenProvider(this.token);
  String? token;
  int calls = 0;
  @override
  Future<String?> getToken() async {
    calls++;
    return token;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiClient api;

  setUp(() async {
    installFakeSecureStorage();
    server = await FakeApiServer.start();
    api = ApiClient(SecureStore(), baseUrl: server.baseUrl);
  });
  tearDown(() => server.close());

  test('job detail repository URL-encodes job and candidate identifiers',
      () async {
    final rawPathSeen = Completer<String>();
    final rawServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    rawServer.listen((request) async {
      rawPathSeen.complete(request.requestedUri.path);
      request.response.statusCode = 200;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({}));
      await request.response.close();
    });
    final rawApi =
        ApiClient(SecureStore(), baseUrl: 'http://127.0.0.1:${rawServer.port}');
    final repo = ApiJobDetailRepository(rawApi);
    await repo.candidateAction('a/b', 'c d', 'OFFER');
    expect(await rawPathSeen.future, '/jobs/a%2Fb/candidates/c%20d/OFFER');
    await rawServer.close(force: true);
  });

  test('candidate parser supplies safe defaults for missing status and text',
      () async {
    final repo = ApiJobDetailRepository(api);
    server.handlers['/jobs/j1/candidates'] =
        (request, body) async => respondJson(request, 200, [
              {'id': 'c1'},
              'bad',
            ]);
    final candidates = await repo.listCandidates('j1');
    expect(candidates, hasLength(1));
    expect(candidates.single.id, 'c1');
    expect(candidates.single.status, 'FORWARDED');
    expect(candidates.single.skills, '');
  });

  test('notification repository preserves query pagination and typed values',
      () async {
    final repo = ApiNotificationRepository(api);
    server.handlers['/notifications'] = (request, body) async {
      expect(request.uri.queryParameters['limit'], '7');
      expect(request.uri.queryParameters['offset'], '14');
      await respondJson(request, 200, {
        'items': [
          {'id': 'n1', 'type': 'PAYMENT_UPDATE', 'title': 'T', 'body': 'B'}
        ],
        'unreadCount': 3,
      });
    };
    final page = await repo.listNotifications(limit: 7, offset: 14);
    expect(page.items.single.id, 'n1');
    expect(page.unreadCount, 3);
  });

  test(
      'notification service does not call provider registration when token is null or blank',
      () async {
    final provider = _TokenProvider('   ');
    final service = NotificationService(api, pushProvider: provider);
    await service.initialize();
    expect(provider.calls, 1);
    expect(server.received, isEmpty);
    await service.dispose();
  });

  test(
      'notification service registers a non-empty push token and lists devices',
      () async {
    final provider = _TokenProvider('device-token-123');
    final service = NotificationService(api, pushProvider: provider);
    server.handlers['/notifications/devices'] = (request, body) async {
      if (request.method == 'POST') {
        expect(body, {'platform': 'ANDROID', 'token': 'device-token-123'});
        await respondJson(request, 200, {'id': 'd1'});
      } else {
        await respondJson(request, 200, {
          'items': [
            {'id': 'd1'}
          ]
        });
      }
    };
    await service.initialize();
    final devices = await service.listDevices();
    expect(devices.single['id'], 'd1');
    expect(provider.calls, 1);
    await service.dispose();
  });

  test('local notification event stream publishes in order and closes cleanly',
      () async {
    final service = NotificationService(api);
    final received = <String>[];
    final subscription = service.events.listen(received.add);
    service.publishLocal('first');
    service.publishLocal('second');
    await Future<void>.delayed(Duration.zero);
    expect(received, ['first', 'second']);
    await subscription.cancel();
    await service.dispose();
  });
}
