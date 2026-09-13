import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/core/uploads/upload_queue.dart';
import 'package:hope_mobile/features/transactions/transaction_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';

/// Behavior tests for the transaction page: loading, error + retry, funded
/// start, financial details, refund gate (owner only) and settled-completion
/// states. Each test builds its own fake transaction repository.
class _FakeTx implements TransactionRepository {
  _FakeTx({this.failLoad = false});

  Future<HopePayment>? payment;
  bool failLoad = false;
  final List<String> calls = [];

  @override
  Future<HopePayment> getPayment(String jobId) async {
    calls.add('get:$jobId');
    if (failLoad) throw Exception('load boom');
    return (await payment)!;
  }

  @override
  Future<HopePayment> fundPayment(String jobId, {String? idempotencyKey}) {
    calls.add('fund:$jobId');
    return Future.value(_data(jobId, 'FUNDED'));
  }

  @override
  Future<HopePayment> refundPayment(String jobId) {
    calls.add('refund:$jobId');
    return Future.value(_data(jobId, 'REFUND_PENDING'));
  }

  @override
  Future<HopePayment> releasePayment(String jobId) {
    calls.add('release:$jobId');
    return Future.value(_data(jobId, 'RELEASED'));
  }

  @override
  Future<HopeJob> startJob(String jobId) {
    calls.add('start:$jobId');
    return Future.value(_job(jobId, 'IN_PROGRESS'));
  }

  @override
  Future<HopeJob> deliverJob(String jobId) {
    calls.add('deliver:$jobId');
    return Future.value(_job(jobId, 'IN_PROGRESS'));
  }

  @override
  Future<HopeJob> acceptJob(String jobId) {
    calls.add('accept:$jobId');
    return Future.value(_job(jobId, 'COMPLETED'));
  }

  @override
  Future<List<HopeJob>> listMyJobs() async => [];

  @override
  Future<void> submitEvidence(String jobId,
      {required String uri,
      required String notes,
      required String type}) async {
    calls.add('evidence:$jobId');
  }

  static HopePayment _data(String jobId, String status) => HopePayment.fromMap({
        'id': 'pay-$jobId',
        'status': status,
        'amount': 1000000,
        'providerRef': 'ref-1',
        'job': _job(jobId, 'FUNDED').toMap(),
        'fees': {
          'baseAmount': 1000000,
          'employerFee': 100000,
          'workerFee': 100000,
          'platformFee': 0,
          'employerCharge': 1100000,
          'providerPayout': 900000,
          'policyVersion': 'v1',
          'currency': 'IRR',
        },
      });
}

HopeJob _job(String id, String status) => HopeJob.fromMap({
      'id': id,
      'title': 'Design landing page',
      'description': 'Deliver a landing page.',
      'categoryId': 'c1',
      'kind': 'MISSION',
      'status': status,
      'ownerId': 'u1',
      'visibility': 'PUBLIC',
      'budgetMin': '1000000',
      'budgetMax': '1500000',
      'offerCount': 0,
      'isOwner': false,
    });

class _AuthRepo implements AuthRepository {
  @override
  Future<AuthSession> login(String e, String p) => throw UnimplementedError();
  @override
  Future<AuthSession> register(String e, String p, String n) =>
      throw UnimplementedError();
  @override
  Future<void> logout() async {}
  @override
  Future<void> requestPasswordReset(String e) async {}
}

class _NoopUploadQueue implements UploadQueue {
  // Plain stand-in: no real file IO, no network. The api field is never read
  // by the flows under test.
  @override
  late final ApiClient api;
  @override
  int get maxAttempts => 1;
  @override
  void Function(PendingUpload item, Object error)? onPermanentFailure;
  @override
  void Function(PendingUpload item, Object error)? onTransientFailure;

  @override
  Future<dynamic> uploadNowWithRetry(String path, File file) async =>
      <String, String>{'key': 'k1'};
  @override
  Future<void> enqueue(PendingUpload item) async {}
  @override
  Future<void> drain() async {}
  @override
  int get pendingCount => 0;
}

Future<void> _pump(
  WidgetTester tester,
  _FakeTx repo, {
  String ownerId = 'u1',
}) async {
  tester.view.physicalSize = const Size(900, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final auth = AuthController(_AuthRepo(), SecureStore());
  await auth.applyRefreshedUser({'id': ownerId, 'displayName': 'Ali'});

  await tester.pumpWidget(MaterialApp(
    theme: ThemeData.light(),
    locale: const Locale('en'),
    supportedLocales: const [Locale('en'), Locale('fa')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        Provider<TransactionRepository>.value(value: repo),
        Provider<UploadQueue>.value(value: _NoopUploadQueue()),
      ],
      child: TransactionPage(
        repository: repo,
        uploadQueue: _NoopUploadQueue(),
        jobId: 'j1',
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('loading then funded payload shows status, amount and start work',
      (tester) async {
    final repo = _FakeTx()
      ..payment = Future.value(HopePayment.fromMap({
        'id': 'p1',
        'status': 'FUNDED',
        'amount': 1000000,
        'providerRef': 'ref-1',
        'job': _job('j1', 'FUNDED').toMap(),
      }));
    await _pump(tester, repo);

    expect(find.text('FUNDED'), findsWidgets);
    expect(find.text('1000000'), findsOneWidget);
    expect(find.text('Design landing page'), findsOneWidget);
    expect(find.text('Start work'), findsOneWidget);
    await tester.ensureVisible(find.text('Start work'));
    await tester.tap(find.text('Start work'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('start:j1'));
  });

  testWidgets('load failure shows retry which recovers', (tester) async {
    final repo = _FakeTx(failLoad: true);
    await _pump(tester, repo);

    expect(find.text('Operation failed.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    repo.failLoad = false;
    repo.payment = Future.value(HopePayment.fromMap({
      'id': 'p1',
      'status': 'NO_TRANSACTION',
      'job': _job('j1', 'FUNDED').toMap(),
    }));
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Fund payment'), findsOneWidget);
  });

  testWidgets('no-transaction view offers fund payment', (tester) async {
    final repo = _FakeTx()
      ..payment = Future.value(HopePayment.fromMap({
        'id': null,
        'status': 'NO_TRANSACTION',
        'job': _job('j1', 'FUNDED').toMap(),
      }));
    await _pump(tester, repo);

    expect(find.text('No payment'), findsOneWidget);
    await tester.ensureVisible(find.text('Fund payment'));
    await tester.tap(find.text('Fund payment'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('fund:j1'));
    expect(find.text('Operation completed.'), findsOneWidget);
  });

  testWidgets('held payment shows refund only to the job owner',
      (tester) async {
    final held = HopePayment.fromMap({
      'id': 'p1',
      'status': 'HELD',
      'amount': 1000000,
      'job': _job('j1', 'FUNDED').toMap(),
    });
    final repo = _FakeTx()..payment = Future.value(held);
    await _pump(tester, repo, ownerId: 'someone-else');
    // Non-owner: no refund action.
    expect(find.text('Request refund'), findsNothing);

    final repo2 = _FakeTx()..payment = Future.value(held);
    await _pump(tester, repo2, ownerId: 'u1');
    expect(find.text('Request refund'), findsOneWidget);
    await tester.ensureVisible(find.text('Request refund'));
    await tester.tap(find.text('Request refund'));
    await tester.pumpAndSettle();
    expect(repo2.calls, contains('refund:j1'));
  });

  testWidgets('completed and released payment shows settled copy',
      (tester) async {
    final repo = _FakeTx()
      ..payment = Future.value(HopePayment.fromMap({
        'id': 'p1',
        'status': 'RELEASED',
        'amount': 1000000,
        'providerRef': 'ref-1',
        'job': _job('j1', 'COMPLETED').toMap(),
      }));
    await _pump(tester, repo);

    expect(find.text('RELEASED'), findsWidgets);
    await tester.drag(find.byType(ListView), const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('Payment has been settled.'), findsOneWidget);
  });

  testWidgets('financial details section renders fee breakdown rows',
      (tester) async {
    final repo = _FakeTx()
      ..payment = Future.value(HopePayment.fromMap({
        'id': 'p1',
        'status': 'HELD',
        'amount': 1000000,
        'job': _job('j1', 'FUNDED').toMap(),
        'fees': {
          'baseAmount': 1000000,
          'employerFee': 100000,
          'workerFee': 100000,
          'platformFee': 0,
          'employerCharge': 1100000,
          'providerPayout': 900000,
          'policyVersion': 'v1',
          'currency': 'IRR',
        },
      }));
    await _pump(tester, repo);

    // Scroll the fee breakdown into the built viewport.
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(find.text('Financial details'), findsOneWidget);
    expect(find.text('Base amount'), findsOneWidget);
    expect(find.text('Employer fee'), findsOneWidget);
    expect(find.text('Worker fee'), findsOneWidget);
    expect(find.text('Employer charge'), findsOneWidget);
    expect(find.text('Worker payout'), findsOneWidget);
  });
}
