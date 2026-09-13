import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/uploads/upload_queue.dart';

/// A minimal loopback HTTP server used as a test double for the backend.
/// Avoids pulling in a mocking framework: real sockets, real HTTP, only the
/// response for each request is scripted by the test.
class _FakeServer {
  _FakeServer._(this._server);

  final HttpServer _server;
  int requestCount = 0;
  List<int> statusScript = [200];

  static Future<_FakeServer> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final fake = _FakeServer._(server);
    fake._serve();
    return fake;
  }

  String get baseUrl => 'http://127.0.0.1:${_server.port}';

  void _serve() {
    _server.listen((request) async {
      requestCount++;
      await request.drain();
      final index = requestCount - 1;
      final status =
          index < statusScript.length ? statusScript[index] : statusScript.last;
      request.response.statusCode = status;
      request.response.headers.contentType = ContentType.json;
      if (status >= 200 && status < 300) {
        request.response.write(jsonEncode({
          'data': {'id': 'upload-$requestCount'}
        }));
      } else {
        request.response.write(jsonEncode({
          'error': {'code': 'UPLOAD_FAILED', 'message': 'simulated failure'}
        }));
      }
      await request.response.close();
    });
  }

  Future<void> close() => _server.close(force: true);

}

/// In-memory stand-in for the platform's secure storage channel, so
/// SecureStore can be exercised without a real device/emulator.
Map<String, String> _installFakeSecureStorage() {
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
  return backing;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late File sampleFile;

  HttpOverrides? savedOverrides;

  setUpAll(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    tempDir = Directory.systemTemp.createTempSync('hope_upload_test');
    sampleFile = File('${tempDir.path}/evidence.txt')
      ..writeAsStringSync('evidence contents');
  });

  tearDownAll(() {
    tempDir.deleteSync(recursive: true);
  });

  setUp(() {
    savedOverrides = HttpOverrides.current;
    HttpOverrides.global =
        null; // Allow real loopback connections for fake server
  });

  tearDown(() {
    HttpOverrides.global = savedOverrides;
    savedOverrides = null;
  });

  Future<ApiClient> buildAuthenticatedClient(String baseUrl) async {
    _installFakeSecureStorage();
    final store = SecureStore();
    await store.saveTokens(access: 'access-token', refresh: 'refresh-token');
    return ApiClient(store, baseUrl: baseUrl);
  }

  test('uploadNowWithRetry succeeds immediately on a clean 2xx response',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    server.statusScript = [200];

    final api = await buildAuthenticatedClient(server.baseUrl);
    final queue = UploadQueue(api, maxAttempts: 3);

    final result = await queue.uploadNowWithRetry('/uploads', sampleFile);

    expect(server.requestCount, 1);
    expect(result, isA<Map>());
    expect((result as Map)['id'], 'upload-1');
  });

  test('uploadNowWithRetry retries transient 5xx failures and then succeeds',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    // Fail twice, then succeed on the third attempt.
    server.statusScript = [500, 503, 200];

    final api = await buildAuthenticatedClient(server.baseUrl);
    final queue = UploadQueue(api, maxAttempts: 3);

    final result = await queue.uploadNowWithRetry('/uploads', sampleFile);

    expect(server.requestCount, 3);
    expect((result as Map)['id'], 'upload-3');
  });

  test('uploadNowWithRetry stops retrying after maxAttempts and rethrows',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    server.statusScript = [500, 500, 500, 500];

    final api = await buildAuthenticatedClient(server.baseUrl);
    final queue = UploadQueue(api, maxAttempts: 3);

    await expectLater(
      queue.uploadNowWithRetry('/uploads', sampleFile),
      throwsA(isA<ApiException>()),
    );
    // Exactly maxAttempts requests, no more.
    expect(server.requestCount, 3);
  });

  test(
      'uploadNowWithRetry does not retry a deterministic 4xx (e.g. validation error)',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    server.statusScript = [422, 200, 200];

    final api = await buildAuthenticatedClient(server.baseUrl);
    final queue = UploadQueue(api, maxAttempts: 3);

    await expectLater(
      queue.uploadNowWithRetry('/uploads', sampleFile),
      throwsA(isA<ApiException>()),
    );
    // A 4xx is treated as final: only the first attempt should have fired.
    expect(server.requestCount, 1);
  });

  test('enqueue drains the queue and drops items whose local file vanished',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    server.statusScript = [200];

    final api = await buildAuthenticatedClient(server.baseUrl);
    Object? failureError;
    final queue = UploadQueue(
      api,
      maxAttempts: 1,
      onPermanentFailure: (_, error) => failureError = error,
    );

    final missingPath = '${tempDir.path}/does-not-exist.txt';
    await queue.enqueue(
      PendingUpload(jobId: 'job-1', path: '/uploads', filePath: missingPath),
    );

    // Missing local files are terminal queue failures; they are surfaced
    // through the permanent-failure callback and removed from the queue.
    expect(queue.pendingCount, 0);
    expect(server.requestCount, 0);
    expect(failureError, isA<FileSystemException>());
  });

  test(
      'a permanently-failed (4xx) item is dropped instead of jamming items enqueued after it',
      () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    // First upload gets a deterministic 4xx; the second one behind it in the
    // queue should still go through instead of waiting forever.
    server.statusScript = [422, 200];

    final api = await buildAuthenticatedClient(server.baseUrl);
    PendingUpload? failedItem;
    Object? failureError;
    final queue = UploadQueue(
      api,
      maxAttempts: 1,
      onPermanentFailure: (item, error) {
        failedItem = item;
        failureError = error;
      },
    );

    final badFile = File('${tempDir.path}/bad-evidence.txt')
      ..writeAsStringSync('rejected by backend');
    await queue.enqueue(
      PendingUpload(jobId: 'job-1', path: '/uploads', filePath: badFile.path),
    );
    await queue.enqueue(
      PendingUpload(
          jobId: 'job-2', path: '/uploads', filePath: sampleFile.path),
    );

    expect(queue.pendingCount, 0);
    expect(server.requestCount, 2);
    expect(failedItem?.jobId, 'job-1');
    expect(failureError, isA<ApiException>());
  });
  test('drain reports transient failures without dropping the queued item', () async {
    final server = await _FakeServer.start();
    addTearDown(server.close);
    server.statusScript = [500];

    final api = await buildAuthenticatedClient(server.baseUrl);
    PendingUpload? failedItem;
    Object? failureError;
    final queue = UploadQueue(
      api,
      maxAttempts: 1,
      onTransientFailure: (item, error) {
        failedItem = item;
        failureError = error;
      },
    );

    await queue.enqueue(
      PendingUpload(jobId: 'job-transient', path: '/uploads', filePath: sampleFile.path),
    );

    expect(queue.pendingCount, 1);
    expect(server.requestCount, 1);
    expect(failedItem?.jobId, 'job-transient');
    expect(failureError, isA<ApiException>());
  });
}
