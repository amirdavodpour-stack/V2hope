import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';

import '../../support/fake_api_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiTransactionRepository repository;

  setUp(() async {
    installFakeSecureStorage();
    server = await FakeApiServer.start();
    repository = ApiTransactionRepository(
      ApiClient(SecureStore(), baseUrl: server.baseUrl),
    );
  });
  tearDown(() => server.close());

  final job = <String, dynamic>{
    'id': 'job-1',
    'title': 'Mission',
    'description': 'd',
    'categoryId': 'c1',
    'category': 'Test',
    'kind': 'MISSION',
    'visibility': 'PUBLIC',
    'offerCount': 0,
  };

  test('listMyJobs parses only map elements and ignores malformed list members',
      () async {
    server.handlers['/jobs/mine'] =
        (request, body) async => respondJson(request, 200, {
              'data': [job, 'bad', 42],
            });
    final jobs = await repository.listMyJobs();
    expect(jobs, hasLength(1));
    expect(jobs.single.id, 'job-1');
  });

  test('getPayment rejects a response missing its required nested job',
      () async {
    server.handlers['/payments/jobs/job-1'] =
        (request, body) async => respondJson(request, 200, {
              'id': 'p1',
              'status': 'HELD',
              'amount': 100,
            });
    await expectLater(
        repository.getPayment('job-1'), throwsA(isA<FormatException>()));
  });

  test('fundPayment sends the optional idempotency key in the JSON body',
      () async {
    server.handlers['/payments/fund/job-1'] = (request, body) async {
      expect(body['idempotencyKey'], 'fund-123');
      await respondJson(request, 200,
          {'id': 'p1', 'status': 'HELD', 'amount': 100, 'job': job});
    };
    final payment =
        await repository.fundPayment('job-1', idempotencyKey: 'fund-123');
    expect(payment.id, 'p1');
  });

  test('fundPayment omits the body when no idempotency key is supplied',
      () async {
    server.handlers['/payments/fund/job-1'] = (request, body) async {
      expect(body, isNull);
      await respondJson(request, 200,
          {'id': 'p1', 'status': 'HELD', 'amount': 100, 'job': job});
    };
    await repository.fundPayment('job-1');
  });

  test('job actions are POST-only and parse the updated typed job', () async {
    server.handlers['/jobs/job-1/start'] = (request, body) async {
      expect(request.method, 'POST');
      await respondJson(request, 200, {...job, 'status': 'IN_PROGRESS'});
    };
    final updated = await repository.startJob('job-1');
    expect(updated.status, 'IN_PROGRESS');
  });

  test('submitEvidence forwards all evidence fields exactly once', () async {
    var calls = 0;
    server.handlers['/jobs/job-1/evidence'] = (request, body) async {
      calls++;
      expect(request.method, 'POST');
      expect(body,
          {'uri': 'https://example.com/x', 'notes': 'done', 'type': 'LINK'});
      await respondJson(request, 201, {'id': 'e1'});
    };
    await repository.submitEvidence('job-1',
        uri: 'https://example.com/x', notes: 'done', type: 'LINK');
    expect(calls, 1);
  });
}
