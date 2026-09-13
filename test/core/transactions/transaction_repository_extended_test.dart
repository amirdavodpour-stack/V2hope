import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';

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

Map<String, dynamic> _job(String id) => {
      'id': id,
      'title': 'Job $id',
      'description': 'Description',
      'kind': 'MISSION',
      'visibility': 'PUBLIC',
    };

Map<String, dynamic> _payment(String id) => {
      'id': id,
      'status': 'FUNDED',
      'amount': '100.50',
      'job': _job('j1'),
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiTransactionRepository repository;

  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
    repository = ApiTransactionRepository(
        ApiClient(SecureStore(), baseUrl: server.baseUrl));
  });
  tearDown(() => server.close());

  test('lists only valid job maps from mine endpoint', () async {
    server.handlers['/jobs/mine'] = (request, body) async {
      await respondJson(request, 200, {
        'data': [_job('j1'), 'bad']
      });
    };
    final jobs = await repository.listMyJobs();
    expect(jobs, hasLength(1));
    expect(jobs.single.id, 'j1');
  });

  test('getPayment parses numeric strings and status', () async {
    server.handlers['/payments/jobs/j1'] = (request, body) async {
      await respondJson(request, 200, {'data': _payment('p1')});
    };
    final payment = await repository.getPayment('j1');
    expect(payment.id, 'p1');
    expect(payment.amount, 100.5);
    expect(payment.paymentStatus, 'FUNDED');
  });

  test('fund sends idempotency key only when supplied', () async {
    server.handlers['/payments/fund/j1'] = (request, body) async {
      expect(body['idempotencyKey'], 'idem-1');
      await respondJson(request, 200, {'data': _payment('p1')});
    };
    final payment =
        await repository.fundPayment('j1', idempotencyKey: 'idem-1');
    expect(payment.id, 'p1');
  });

  test('refund and release use their distinct endpoints', () async {
    for (final path in ['/payments/refund/j1', '/payments/release/j1']) {
      server.handlers[path] = (request, body) async {
        await respondJson(request, 200, {'data': _payment('p1')});
      };
    }
    expect((await repository.refundPayment('j1')).id, 'p1');
    expect((await repository.releasePayment('j1')).id, 'p1');
  });

  test('job lifecycle actions return the typed job', () async {
    for (final path in [
      '/jobs/j1/start',
      '/jobs/j1/deliver',
      '/jobs/j1/accept'
    ]) {
      server.handlers[path] = (request, body) async {
        await respondJson(request, 200, {'data': _job('j1')});
      };
    }
    expect((await repository.startJob('j1')).id, 'j1');
    expect((await repository.deliverJob('j1')).id, 'j1');
    expect((await repository.acceptJob('j1')).id, 'j1');
  });

  test('submitEvidence sends all required fields', () async {
    server.handlers['/jobs/j1/evidence'] = (request, body) async {
      expect(body['uri'], 'https://example.com/evidence');
      expect(body['notes'], 'done');
      expect(body['type'], 'LINK');
      await respondJson(request, 200, {});
    };
    await repository.submitEvidence(
      'j1',
      uri: 'https://example.com/evidence',
      notes: 'done',
      type: 'LINK',
    );
  });
}
