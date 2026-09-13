import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/uploads/upload_queue.dart';

import '../../support/fake_api_server.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final values = <String, String>{'hope.access_token': 'token'};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    if (call.method == 'read') return values[args['key'] as String];
    return null;
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late Directory temp;

  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
    temp = await Directory.systemTemp.createTemp('hope-upload-test-');
  });

  tearDown(() async {
    await server.close();
    await temp.delete(recursive: true);
  });

  test('enqueue uploads a real temporary file and drains the queue', () async {
    final file = File('${temp.path}/evidence.txt');
    await file.writeAsString('hello HOPE');
    var calls = 0;
    server.handlers['/uploads/evidence'] = (request, body) async {
      calls++;
      expect(request.headers.value('authorization'), 'Bearer token');
      await request.drain();
      await respondJson(request, 200, {
        'data': {'key': 'e1'}
      });
    };
    final queue = UploadQueue(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      maxAttempts: 1,
    );

    await queue.enqueue(PendingUpload(
        jobId: 'j1', path: '/uploads/evidence', filePath: file.path));

    expect(calls, 1);
    expect(queue.pendingCount, 0);
  });

  test('a missing local file is discarded without a network request', () async {
    final queue = UploadQueue(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      maxAttempts: 1,
    );
    await queue.enqueue(PendingUpload(
        jobId: 'j1',
        path: '/uploads/evidence',
        filePath: '${temp.path}/missing.txt'));
    expect(queue.pendingCount, 0);
    expect(server.received, isEmpty);
  });

  test('a deterministic 4xx failure is reported and does not jam the queue',
      () async {
    final file = File('${temp.path}/bad.txt');
    await file.writeAsString('bad');
    PendingUpload? permanent;
    server.handlers['/uploads/evidence'] = (request, body) async {
      await request.drain();
      await respondJson(request, 422, {
        'error': {'code': 'FILE_TOO_LARGE', 'message': 'too big'}
      });
    };
    final queue = UploadQueue(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      maxAttempts: 1,
      onPermanentFailure: (item, error) => permanent = item,
    );

    await queue.enqueue(PendingUpload(
        jobId: 'j1', path: '/uploads/evidence', filePath: file.path));

    expect(permanent?.jobId, 'j1');
    expect(queue.pendingCount, 0);
  });

  test('transient failure remains pending for a later drain', () async {
    final file = File('${temp.path}/retry.txt');
    await file.writeAsString('retry');
    var calls = 0;
    server.handlers['/uploads/evidence'] = (request, body) async {
      calls++;
      await request.drain();
      await respondJson(
          request,
          calls == 1 ? 500 : 200,
          calls == 1
              ? {
                  'error': {'code': 'TEMP'}
                }
              : {
                  'data': {'ok': true}
                });
    };
    final queue = UploadQueue(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
      maxAttempts: 1,
    );
    final item = PendingUpload(
        jobId: 'j1', path: '/uploads/evidence', filePath: file.path);

    await queue.enqueue(item);
    expect(queue.pendingCount, 1);
    await queue.drain();
    expect(queue.pendingCount, 0);
    expect(calls, 2);
  });
}
