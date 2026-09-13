import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late SecureStore store;
  late ApiClient api;

  setUp(() async {
    installFakeSecureStorage();
    store = SecureStore();
    server = await FakeApiServer.start();
    api = ApiClient(store, baseUrl: server.baseUrl);
  });

  tearDown(() => server.close());

  test(
      '401 causes one refresh and retries the original request with new tokens',
      () async {
    await store.saveTokens(access: 'old-access', refresh: 'old-refresh');
    var calls = 0;
    server.handlers['/protected'] = (request, body) async {
      calls++;
      if (calls == 1) {
        await respondJson(request, 401, {
          'error': {'code': 'INVALID_TOKEN', 'message': 'expired'}
        });
      } else {
        expect(request.headers.value('authorization'), 'Bearer new-access');
        await respondJson(request, 200, {
          'data': {'ok': true}
        });
      }
    };
    server.handlers['/auth/refresh'] = (request, body) async {
      expect(body['refreshToken'], 'old-refresh');
      await respondJson(request, 200, {
        'data': {
          'accessToken': 'new-access',
          'refreshToken': 'new-refresh',
          'user': {'id': 'u1'}
        },
      });
    };

    final result = await api.request('GET', '/protected', auth: true);

    expect(result, {'ok': true});
    expect(await store.accessToken, 'new-access');
    expect(await store.refreshToken, 'new-refresh');
    expect(calls, 2);
  });

  test('concurrent 401s share a single refresh request', () async {
    await store.saveTokens(access: 'old-access', refresh: 'old-refresh');
    var protectedCalls = 0;
    var refreshCalls = 0;
    final refreshBarrier = Completer<void>();
    server.handlers['/protected-a'] = (request, body) async {
      protectedCalls++;
      await respondJson(
          request,
          protectedCalls <= 2 ? 401 : 200,
          protectedCalls <= 2
              ? {
                  'error': {'code': 'INVALID_TOKEN', 'message': 'expired'}
                }
              : {
                  'data': {'id': 'a'}
                });
    };
    server.handlers['/protected-b'] = (request, body) async {
      await respondJson(request, 401, {
        'error': {'code': 'INVALID_TOKEN', 'message': 'expired'}
      });
    };
    server.handlers['/auth/refresh'] = (request, body) async {
      refreshCalls++;
      if (!refreshBarrier.isCompleted) {
        await refreshBarrier.future;
      }
      await respondJson(request, 200, {
        'data': {
          'accessToken': 'new-access',
          'refreshToken': 'new-refresh',
          'user': {'id': 'u1'}
        },
      });
    };

    final f1 = api.request('GET', '/protected-a', auth: true);
    final f2 = api.request('GET', '/protected-a', auth: true);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    refreshBarrier.complete();
    await expectLater(Future.wait([f1, f2]), completion(isNotEmpty));
    expect(refreshCalls, 1);
    expect(await store.accessToken, 'new-access');
  });

  test('a failed refresh escalates to onUnauthorized and does not loop forever',
      () async {
    await store.saveTokens(access: 'old-access', refresh: 'bad-refresh');
    var unauthorizedCalls = 0;
    api.onUnauthorized = () async {
      unauthorizedCalls++;
    };
    server.handlers['/protected'] = (request, body) async => respondJson(
          request,
          401,
          {
            'error': {'code': 'INVALID_TOKEN', 'message': 'expired'}
          },
        );
    server.handlers['/auth/refresh'] = (request, body) async => respondJson(
          request,
          401,
          {
            'error': {'code': 'INVALID_REFRESH_TOKEN', 'message': 'bad'}
          },
        );

    await expectLater(
      api.request('GET', '/protected', auth: true),
      throwsA(isA<ApiException>()),
    );
    expect(unauthorizedCalls, 1);
  });

  test('unsupported HTTP methods fail locally before opening a request',
      () async {
    await expectLater(
      api.request('TRACE', '/anything'),
      throwsA(isA<UnsupportedError>()),
    );
    expect(server.received, isEmpty);
  });
}
