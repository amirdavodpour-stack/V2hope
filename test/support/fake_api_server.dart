import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Scripted loopback HTTP server standing in for the HOPE backend. Each test
/// configures [handlers] for the paths it cares about. Shared across the repo
/// / controller test suites so each of them doesn't have to reimplement a
/// tiny HTTP server just to exercise an [ApiClient].
/// Restores real socket HTTP for the duration of a test. Flutter's test
/// binding replaces `HttpOverrides.global` with a mock HttpClient that answers
/// every request with HTTP 400, which silently blocks the loopback server
/// below. Installing a real override here (and restoring the previous one in
/// [FakeApiServer.close]) lets the scripted server actually receive requests.
class _RealHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    // The HttpClient(...) factory constructor itself routes through
    // HttpOverrides.current, so constructing it directly here would recurse
    // forever. Temporarily clear the override to reach the real dart:_http
    // implementation, then restore it.
    final previous = HttpOverrides.current;
    HttpOverrides.global = null;
    try {
      return HttpClient(context: context);
    } finally {
      HttpOverrides.global = previous;
    }
  }
}

class FakeApiServer {
  FakeApiServer._(this._server, this._previousOverrides);
  final HttpServer _server;
  final HttpOverrides? _previousOverrides;
  final Map<String, Future<void> Function(HttpRequest request, dynamic body)>
      handlers = {};

  /// Requests received, in order, for assertions on query strings / method.
  final List<HttpRequest> received = [];

  static Future<FakeApiServer> start() async {
    final previousOverrides = HttpOverrides.current;
    HttpOverrides.global = _RealHttpOverrides();
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final fake = FakeApiServer._(server, previousOverrides);
    fake._serve();
    return fake;
  }

  String get baseUrl => 'http://127.0.0.1:${_server.port}';

  void _serve() {
    _server.listen((request) async {
      received.add(request);
      dynamic body;
      if (request.headers.contentType?.mimeType == 'application/json') {
        final raw = await utf8.decoder.bind(request).join();
        if (raw.isNotEmpty) {
          try {
            body = jsonDecode(raw);
          } catch (_) {
            body = raw;
          }
        }
      }
      final handler = handlers[request.uri.path];
      if (handler == null) {
        request.response.statusCode = 404;
        await request.response.close();
        return;
      }
      await handler(request, body);
    });
  }

  Future<void> close() async {
    await _server.close(force: true);
    HttpOverrides.global = _previousOverrides;
  }
}

Future<void> respondJson(
  HttpRequest request,
  int status,
  Object? body,
) async {
  request.response.statusCode = status;
  request.response.headers.contentType = ContentType.json;
  request.response.write(jsonEncode(body));
  await request.response.close();
}

/// In-memory stand-in for the platform's secure storage channel, matching
/// the plugin `flutter_secure_storage` talks to at runtime.
void installFakeSecureStorage() {
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
