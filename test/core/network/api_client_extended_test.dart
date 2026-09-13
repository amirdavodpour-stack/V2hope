import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';
import 'test_fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late SecureStore store;

  setUp(() async {
    installFakeSecureStorageForTests();
    server = await FakeApiServer.start();
    store = SecureStore();
  });

  tearDown(() => server.close());

  test('normalizes whitespace and trailing slashes in baseUrl', () {
    final api = ApiClient(store, baseUrl: '  ${server.baseUrl}///  ');
    expect(api.baseUrl, server.baseUrl);
  });

  test('rejects relative API urls', () {
    expect(() => ApiClient(store, baseUrl: '/api/v1'), throwsArgumentError);
  });

  test('sends bearer token when auth is requested', () async {
    await store.saveTokens(access: 'token-1', refresh: 'refresh-1');
    server.handlers['/secure'] = (request, body) async {
      expect(request.headers.value('authorization'), 'Bearer token-1');
      await respondJson(request, 200, {
        'data': {'ok': true}
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    final data = await api.request('GET', '/secure', auth: true);

    expect(data, {'ok': true});
  });

  test('does not invent an Authorization header without a token', () async {
    server.handlers['/public'] = (request, body) async {
      expect(request.headers.value('authorization'), isNull);
      await respondJson(request, 200, {
        'data': {'ok': true}
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    expect(await api.request('GET', '/public'), {'ok': true});
  });

  test('supports GET POST PUT PATCH and DELETE through the common client',
      () async {
    final methods = <String>[];
    server.handlers['/methods'] = (request, body) async {
      methods.add(request.method);
      await respondJson(request, 200, {'data': request.method});
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    expect(await api.request('GET', '/methods'), 'GET');
    expect(await api.request('POST', '/methods', body: {'x': 1}), 'POST');
    expect(await api.request('PUT', '/methods', body: {'x': 1}), 'PUT');
    expect(await api.request('PATCH', '/methods', body: {'x': 1}), 'PATCH');
    expect(await api.request('DELETE', '/methods'), 'DELETE');
    expect(methods, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });

  test('rejects unsupported HTTP methods locally', () async {
    final api = ApiClient(store, baseUrl: server.baseUrl);
    await expectLater(
      api.request('TRACE', '/x'),
      throwsA(isA<UnsupportedError>()),
    );
    expect(server.received, isEmpty);
  });

  test('returns a raw JSON list instead of requiring a data envelope',
      () async {
    server.handlers['/list'] = (request, body) async {
      request.response.statusCode = 200;
      request.response.headers.contentType = ContentType.json;
      request.response.write('[1,2,3]');
      await request.response.close();
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    expect(await api.request('GET', '/list'), [1, 2, 3]);
  });

  test('preserves a non-JSON successful body as a string', () async {
    server.handlers['/text'] = (request, body) async {
      request.response.statusCode = 200;
      request.response.headers.contentType = ContentType.text;
      request.response.write('plain');
      await request.response.close();
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    expect(await api.request('GET', '/text'), 'plain');
  });

  test('maps structured backend errors into ApiException', () async {
    server.handlers['/bad'] = (request, body) async {
      await respondJson(request, 422, {
        'error': {'code': 'VALIDATION_ERROR', 'message': 'bad data'}
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    await expectLater(
        api.request('GET', '/bad'),
        throwsA(predicate<ApiException>(
          (e) =>
              e.status == 422 &&
              e.code == 'VALIDATION_ERROR' &&
              e.message == 'bad data',
        )));
  });

  test('maps unstructured HTTP errors to the HTTP status code', () async {
    server.handlers['/bad'] = (request, body) async {
      await respondJson(request, 500, {'message': 'boom'});
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    await expectLater(
        api.request('GET', '/bad'),
        throwsA(predicate<ApiException>(
          (e) => e.status == 500 && e.code == 'HTTP_500',
        )));
  });

  test('fires onError exactly once for a final failed request', () async {
    server.handlers['/bad'] = (request, body) async {
      await respondJson(request, 400, {
        'error': {'code': 'VALIDATION_ERROR', 'message': 'bad'}
      });
    };
    final errors = <Object>[];
    final api = ApiClient(store, baseUrl: server.baseUrl)..onError = errors.add;

    await expectLater(api.request('GET', '/bad'), throwsA(isA<ApiException>()));

    expect(errors, hasLength(1));
  });

  test('refreshes an expired authenticated request and retries once', () async {
    await store.saveTokens(access: 'old', refresh: 'refresh-1');
    var protectedCalls = 0;
    server.handlers['/protected'] = (request, body) async {
      protectedCalls++;
      expect(request.headers.value('authorization'),
          protectedCalls == 1 ? 'Bearer old' : 'Bearer fresh');
      await respondJson(request, protectedCalls == 1 ? 401 : 200, {
        if (protectedCalls == 1)
          'error': {'code': 'INVALID_TOKEN', 'message': 'expired'},
        if (protectedCalls > 1) 'data': {'ok': true},
      });
    };
    server.handlers['/auth/refresh'] = (request, body) async {
      expect((body as Map)['refreshToken'], 'refresh-1');
      await respondJson(request, 200, {
        'data': {
          'accessToken': 'fresh',
          'refreshToken': 'refresh-2',
          'user': {'id': 'u1'},
        }
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    expect(await api.request('GET', '/protected', auth: true), {'ok': true});
    expect(await store.accessToken, 'fresh');
    expect(await store.refreshToken, 'refresh-2');
  });

  test('coalesces concurrent refresh calls into one refresh request', () async {
    await store.saveTokens(access: 'old', refresh: 'refresh');
    var refreshCalls = 0;
    var protectedCalls = 0;
    server.handlers['/auth/refresh'] = (request, body) async {
      refreshCalls++;
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await respondJson(request, 200, {
        'data': {'accessToken': 'new', 'refreshToken': 'new-refresh'}
      });
    };
    server.handlers['/a'] = (request, body) async {
      protectedCalls++;
      await respondJson(
          request,
          protectedCalls <= 2 ? 401 : 200,
          protectedCalls <= 2
              ? {
                  'error': {'code': 'INVALID_TOKEN'}
                }
              : {
                  'data': {'ok': true}
                });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    final first = api.request('GET', '/a', auth: true);
    final second = api.request('GET', '/a', auth: true);
    await Future.wait([first, second]);
    expect(refreshCalls, 1);
  });

  test('calls onUnauthorized when refresh cannot recover a 401', () async {
    await store.saveTokens(access: 'old', refresh: 'expired-refresh');
    var unauthorized = 0;
    server.handlers['/protected'] = (request, body) async {
      await respondJson(request, 401, {
        'error': {'code': 'INVALID_TOKEN', 'message': 'expired'}
      });
    };
    server.handlers['/auth/refresh'] = (request, body) async {
      await respondJson(request, 401, {
        'error': {'code': 'INVALID_REFRESH_TOKEN'}
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl)
      ..onUnauthorized = () async => unauthorized++;

    await expectLater(
      api.request('GET', '/protected', auth: true),
      throwsA(isA<ApiException>()),
    );
    expect(unauthorized, 1);
  });

  test('does not loop forever when a refreshed token is rejected', () async {
    await store.saveTokens(access: 'old', refresh: 'refresh');
    var calls = 0;
    server.handlers['/protected'] = (request, body) async {
      calls++;
      await respondJson(request, 401, {
        'error': {'code': 'INVALID_TOKEN'}
      });
    };
    server.handlers['/auth/refresh'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {'accessToken': 'still-bad', 'refreshToken': 'refresh-2'}
      });
    };
    final api = ApiClient(store, baseUrl: server.baseUrl);

    await expectLater(
      api.request('GET', '/protected', auth: true),
      throwsA(isA<ApiException>()),
    );
    expect(calls, 2);
  });
}
