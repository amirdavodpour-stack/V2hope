import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/features/transactions/transaction_controller.dart';

class _Repo implements TransactionRepository {
  int loadCalls = 0, fundCalls = 0, refundCalls = 0, releaseCalls = 0;
  String? lastIdempotencyKey;
  HopePayment? payment;

  @override
  Future<List<HopeJob>> listMyJobs() async => const [];
  @override
  Future<HopePayment> getPayment(String id) async {
    loadCalls += 1;
    return payment ?? _pay('NO_TRANSACTION');
  }
  @override
  Future<HopePayment> fundPayment(String id, {String? idempotencyKey}) async {
    fundCalls += 1;
    lastIdempotencyKey = idempotencyKey;
    return payment ?? _pay('HELD');
  }
  @override
  Future<HopePayment> refundPayment(String id) async {
    refundCalls += 1;
    return _pay('REFUNDED');
  }
  @override
  Future<HopePayment> releasePayment(String id) async {
    releaseCalls += 1;
    return _pay('RELEASED');
  }
  @override
  Future<HopeJob> startJob(String id) => throw UnimplementedError();
  @override
  Future<HopeJob> deliverJob(String id) => throw UnimplementedError();
  @override
  Future<HopeJob> acceptJob(String id) => throw UnimplementedError();
  @override
  Future<void> submitEvidence(String jobId,
      {required String uri, required String notes, required String type}) async {}
}

HopePayment _pay(String status) => HopePayment.fromMap({
      'status': status, 'amount': 150000, 'providerRef': 'ref-1',
      'job': {'id': 'j1', 'title': 'پروژه', 'status': 'OPEN', 'kind': 'MISSION', 'visibility': 'PUBLIC', 'ownerId': 'u1'},
    });

void main() {
  test('load delegates to the repository and returns the payment', () async {
    final repo = _Repo()..payment = _pay('HELD');
    final controller = TransactionController(repository: repo, jobId: 'j1');
    final result = await controller.load();
    expect(repo.loadCalls, 1);
    expect(result?.status, 'HELD');
  });

  test('fund passes a mobile idempotency key', () async {
    final repo = _Repo();
    final controller = TransactionController(repository: repo, jobId: 'j1');
    final result = await controller.execute('fund');
    expect(repo.fundCalls, 1);
    expect(repo.lastIdempotencyKey, startsWith('mobile-'));
    expect(result.status, 'HELD');
  });

  test('refund and release delegate to the repository', () async {
    final repo = _Repo();
    final controller = TransactionController(repository: repo, jobId: 'j1');
    expect((await controller.execute('refund')).status, 'REFUNDED');
    expect((await controller.execute('release')).status, 'RELEASED');
    expect(repo.refundCalls, 1);
    expect(repo.releaseCalls, 1);
  });

  test('unknown operations fail closed with a StateError and no side effects', () {
    final repo = _Repo();
    final controller = TransactionController(repository: repo, jobId: 'j1');
    Object? caught;
    try {
      controller.execute('nonsense');
    } catch (e) {
      caught = e;
    }
    expect(caught, isA<StateError>());
    expect(repo.fundCalls, 0);
  });
}
