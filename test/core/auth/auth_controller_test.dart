import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

/// Scripted loopback HTTP server standing in for the HOPE backend's auth
/// routes. Each test configures [handlers] for the paths it cares about.
class _FakeAuthServer {
  _FakeAuthServer._(this._server);
  final HttpServer _server;
  final Map<String, Future<void> Function(HttpRequest request, Map body)>
      handlers = {};

  static Future<_FakeAuthServer> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final fake = _FakeAuthServer._(server);
    fake._serve();
    return fake;
  }

  String get baseUrl => 'http://127.0.0.1:${_server.port}';

  void _serve() {
    _server.listen((request) async {
      final raw = await utf8.decoder.bind(request).join();
      final body = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map;
      final handler = handlers[request.uri.path];
      if (handler == null) {
        request.response.statusCode = 404;
        await request.response.close();
        return;
      }
      await handler(request, Map<String, dynamic>.from(body));
    });
  }

  Future<void> close() => _server.close(force: true);
}

Future<void> _respondJson(
    HttpRequest request, int status, Map<String, dynamic> body) async {
  request.response.statusCode = status;
  request.response.headers.contentType = ContentType.json;
  request.response.write(jsonEncode(body));
  await request.response.close();
}

/// In-memory stand-in for the platform's secure storage channel.
void _installFakeSecureStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final backing = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (MethodCall call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    switch (call.method) {
      case 'write':
        final key = args['key'] as String;
        final value = args['value'] as String?;
        if (value == null) {
          backing.remove(key);
        } else {
          backing[key] = value;
        }
        return null;
      case 'read':
        return backing[args['key'] as String];
      case 'delete':
        backing.remove(args['key'] as String);
        return null;
      case 'deleteAll':
        backing.clear();
        return null;
      case 'readAll':
        return backing;
      default:
        return null;
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  HttpOverrides? savedHttpOverrides;

  setUp(() {
    savedHttpOverrides = HttpOverrides.current;
    HttpOverrides.global =
        null; // Allow real loopback connections for fake server
    _installFakeSecureStorage();
  });

  tearDown(() {
    HttpOverrides.global = savedHttpOverrides;
    savedHttpOverrides = null;
  });

  test('login persists the session and flips the controller to authenticated',
      () async {
    final server = await _FakeAuthServer.start();
    addTearDown(server.close);
    server.handlers['/auth/login'] = (request, body) async {
      expect(body['email'], 'user@example.com');
      await _respondJson(request, 200, {
        'data': {
          'user': {
            'id': 'u1',
            'email': 'user@example.com',
            'displayName': 'کاربر'
          },
          'accessToken': 'access-1',
          'refreshToken': 'refresh-1',
        }
      });
    };

    final store = SecureStore();
    final api = ApiClient(store, baseUrl: server.baseUrl);
    final auth = AuthController(ApiAuthRepository(api), store);

    await auth.login('user@example.com', 'super-secret');

    expect(auth.isAuthenticated, isTrue);
    expect(auth.isGuest, isFalse);
    expect(auth.error, isNull);
    expect(auth.user?['email'], 'user@example.com');
    expect(await store.accessToken, 'access-1');
    expect(await store.refreshToken, 'refresh-1');
  });

  test('login surfaces the backend error and keeps the controller a guest',
      () async {
    final server = await _FakeAuthServer.start();
    addTearDown(server.close);
    server.handlers['/auth/login'] = (request, body) async {
      await _respondJson(request, 401, {
        'error': {
          'code': 'INVALID_CREDENTIALS',
          'message': 'رمز عبور نادرست است.'
        }
      });
    };

    final store = SecureStore();
    final api = ApiClient(store, baseUrl: server.baseUrl);
    final auth = AuthController(ApiAuthRepository(api), store);

    await expectLater(
      auth.login('user@example.com', 'wrong-password'),
      throwsA(isA<ApiException>()),
    );

    expect(auth.isAuthenticated, isFalse);
    expect(auth.error, isNotNull);
    expect(await store.accessToken, isNull);
  });

  test('register applies the returned session the same way login does',
      () async {
    final server = await _FakeAuthServer.start();
    addTearDown(server.close);
    server.handlers['/auth/register'] = (request, body) async {
      expect(body['displayName'], 'کاربر تازه');
      await _respondJson(request, 200, {
        'data': {
          'user': {
            'id': 'u2',
            'email': 'new@example.com',
            'displayName': 'کاربر تازه'
          },
          'accessToken': 'access-2',
          'refreshToken': 'refresh-2',
        }
      });
    };

    final store = SecureStore();
    final api = ApiClient(store, baseUrl: server.baseUrl);
    final auth = AuthController(ApiAuthRepository(api), store);

    await auth.register('new@example.com', 'super-secret', 'کاربر تازه');

    expect(auth.isAuthenticated, isTrue);
    expect(auth.user?['id'], 'u2');
  });

  test('restoreSession rehydrates a previously saved session', () async {
    final store = SecureStore();
    await store.saveTokens(access: 'access-3', refresh: 'refresh-3');
    await store.saveUser({'id': 'u3', 'email': 'saved@example.com'});

    final api = ApiClient(store, baseUrl: 'http://127.0.0.1:9');
    final auth = AuthController(ApiAuthRepository(api), store);

    await auth.restoreSession();

    expect(auth.initialized, isTrue);
    expect(auth.isAuthenticated, isTrue);
    expect(auth.user?['id'], 'u3');
  });

  test('restoreSession falls back to guest mode when nothing was saved',
      () async {
    final store = SecureStore();
    final api = ApiClient(store, baseUrl: 'http://127.0.0.1:9');
    final auth = AuthController(ApiAuthRepository(api), store);

    await auth.restoreSession();

    expect(auth.initialized, isTrue);
    expect(auth.isAuthenticated, isFalse);
    expect(auth.isGuest, isTrue);
  });

  test('logout clears the local session even if the server call fails',
      () async {
    final server = await _FakeAuthServer.start();
    addTearDown(server.close);
    server.handlers['/auth/login'] = (request, body) async {
      await _respondJson(request, 200, {
        'data': {
          'user': {'id': 'u4', 'email': 'logout@example.com'},
          'accessToken': 'access-4',
          'refreshToken': 'refresh-4',
        }
      });
    };
    server.handlers['/auth/logout'] = (request, body) async {
      await _respondJson(request, 500, {
        'error': {'code': 'INTERNAL', 'message': 'boom'}
      });
    };

    final store = SecureStore();
    final api = ApiClient(store, baseUrl: server.baseUrl);
    final auth = AuthController(ApiAuthRepository(api), store);
    await auth.login('logout@example.com', 'super-secret');
    expect(auth.isAuthenticated, isTrue);

    await auth.logout();

    expect(auth.isAuthenticated, isFalse);
    expect(auth.isGuest, isTrue);
    expect(await store.accessToken, isNull);
  });

  test('continueAsGuest marks the app usable without an account', () {
    final store = SecureStore();
    final api = ApiClient(store, baseUrl: 'http://127.0.0.1:9');
    final auth = AuthController(ApiAuthRepository(api), store);

    auth.continueAsGuest();

    expect(auth.isGuest, isTrue);
    expect(auth.isAuthenticated, isFalse);
  });
}
