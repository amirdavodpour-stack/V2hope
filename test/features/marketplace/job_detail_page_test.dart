import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/marketplace/job_detail_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/core/uploads/upload_queue.dart';
import 'package:hope_mobile/features/marketplace/job_detail_page.dart';
import 'package:hope_mobile/features/transactions/transaction_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';

/// Behavior tests for the job detail page: mission vs job rendering, owner
/// candidate pipeline, owner transaction navigation, non-owner candidate
/// suppression. Fresh fakes per test, no network.
class _FakeDetail implements JobDetailRepository {
  _FakeDetail({this.candidates = const []});

  List<HopeCandidate> candidates;
  final List<String> calls = [];

  @override
  Future<List<HopeCandidate>> listCandidates(String jobId) async =>
      candidates;

  @override
  Future<HopeApplication> applyToJob(String jobId,
      {required String resumeText, required String skills}) async {
    calls.add('apply:$jobId');
    return HopeApplication.fromMap({
      'id': 'app1',
      'jobId': jobId,
      'jobTitle': 't',
      'status': 'PENDING'
    });
  }

  @override
  Future<HopeOffer> submitOffer(String jobId,
      {required double price, required String message}) async {
    calls.add('offer:$jobId:$price');
    return HopeOffer.fromMap({'id': 'o1', 'jobId': jobId, 'providerId': 'u1', 'price': price, 'message': message, 'status': 'PENDING'});
  }

  @override
  Future<void> candidateAction(
      String jobId, String candidateId, String action) async {
    calls.add('candidate:$candidateId:$action');
  }
}

class _FakeTx implements TransactionRepository {
  @override
  Future<List<HopeJob>> listMyJobs() async => [];
  @override
  Future<HopePayment> getPayment(String id) async => HopePayment(
        id: 'p1',
        status: 'FUNDED',
        amount: 1000000,
        providerRef: 'r1',
        job: _job(kind: 'MISSION', ownerId: 'u1'),
        fees: const HopePaymentFees(
          baseAmount: 1000000,
          employerFee: 100000,
          workerFee: 100000,
          platformFee: 100000,
          employerCharge: 1100000,
          providerPayout: 900000,
          policyVersion: 'v1',
          currency: 'IRR',
        ),
      );
  @override
  Future<HopePayment> fundPayment(String id, {String? idempotencyKey}) =>
      throw UnimplementedError();
  @override
  Future<HopePayment> refundPayment(String id) => throw UnimplementedError();
  @override
  Future<HopePayment> releasePayment(String id) => throw UnimplementedError();
  @override
  Future<HopeJob> startJob(String id) => throw UnimplementedError();
  @override
  Future<HopeJob> deliverJob(String id) => throw UnimplementedError();
  @override
  Future<HopeJob> acceptJob(String id) => throw UnimplementedError();
  @override
  Future<void> submitEvidence(String jobId,
      {required String uri,
      required String notes,
      required String type}) async {}
}

class _FakeQueue implements UploadQueue {
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

HopeJob _job({
  String id = 'j1',
  String kind = 'MISSION',
  String visibility = 'PUBLIC',
  String? ownerId = 'u1',
  String? city = 'Tehran',
}) =>
    HopeJob.fromMap({
      'id': id,
      'title': kind == 'JOB' ? 'Flutter developer' : 'Design a logo',
      'description': 'A clear, concise deliverable description for the page.',
      'categoryId': 'c1',
      'category': 'Design',
      'jobType': kind == 'JOB' ? 'HOURLY' : 'FIXED',
      'budgetType': 'FIXED',
      'budgetMin': '1000000',
      'budgetMax': '1500000',
      'duration': '8',
      'acceptanceCriteria': 'Acceptance criteria are listed here.',
      'status': 'PUBLISHED',
      'ownerId': ownerId,
      'providerId': 'p1',
      'city': city,
      'kind': kind,
      'visibility': visibility,
      'schedule': kind == 'JOB' ? 'FULL_TIME' : null,
      'monthlySalary': kind == 'JOB' ? '12000000' : null,
      'applicationDeadline': kind == 'JOB' ? '2026-09-30' : null,
      'offerCount': 0,
      'isOwner': false,
      'distanceKm': null,
    });

Future<void> _pump(
  WidgetTester tester, {
  required HopeJob job,
  _FakeDetail? detail,
  String userId = 'u9',
}) async {
  tester.view.physicalSize = const Size(900, 3400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  SharedPreferences.setMockInitialValues({});
  final settings = HopeSettingsController();
  await settings.load();
  await settings.setLanguage('en');
  final auth = AuthController(_AuthRepo(), SecureStore());
  await auth.applyRefreshedUser({'id': userId, 'displayName': 'Ali'});

  // Providers sit ABOVE the MaterialApp so routes pushed onto the app
  // Navigator (e.g. TransactionPage) resolve them.
  await tester.pumpWidget(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: settings),
      ChangeNotifierProvider(create: (_) => ThemeController(settings)),
      ChangeNotifierProvider.value(value: auth),
      Provider<JobDetailRepository>.value(value: detail ?? _FakeDetail()),
      Provider<TransactionRepository>.value(value: _FakeTx()),
      Provider<UploadQueue>.value(value: _FakeQueue()),
    ],
    child: MaterialApp(
      theme: ThemeData.light(),
      locale: const Locale('en'),
      supportedLocales: const [Locale('en'), Locale('fa')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: JobDetailPage(job: job),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mission details render pricing, duration and transaction entry',
      (tester) async {
    await _pump(tester, job: _job());
    expect(find.text('Mission details'), findsOneWidget);
    expect(find.text('Design a logo'), findsOneWidget);
    expect(find.text('Mission budget'), findsOneWidget);
    expect(find.textContaining('IRR'), findsWidgets);
    // Duration is mission-only.
    expect(find.text('Duration'), findsOneWidget);
    // A mission exposes the transaction entry, not the admin-review banner.
    expect(find.text('View transaction'), findsOneWidget);
    expect(find.textContaining('reviewed by an admin'), findsNothing);
  });

  testWidgets('job details render monthly pay, deadline and admin banner',
      (tester) async {
    await _pump(tester, job: _job(kind: 'JOB'));
    expect(find.text('Job details'), findsOneWidget);
    expect(find.text('Flutter developer'), findsOneWidget);
    expect(find.text('Monthly pay'), findsOneWidget);
    expect(find.textContaining('IRR'), findsWidgets);
    expect(find.textContaining('2026-09-30'), findsOneWidget);
    expect(find.textContaining('reviewed by an admin'), findsOneWidget);
    expect(find.text('View transaction'), findsNothing);
  });

  testWidgets('owner job with forwarded candidates renders candidate actions',
      (tester) async {
    final detail = _FakeDetail(candidates: const [
      HopeCandidate(
          id: 'c1',
          skills: 'Flutter',
          resumeText: 'Cross-platform experience.',
          status: 'FORWARDED'),
      HopeCandidate(
          id: 'c2',
          skills: 'Dart',
          resumeText: 'Backend experience.',
          status: 'OFFERED'),
    ]);
    await _pump(
      tester,
      job: _job(kind: 'JOB', ownerId: 'u1'),
      detail: detail,
      userId: 'u1',
    );

    expect(find.text('Forwarded candidates'), findsOneWidget);
    expect(find.text('Anonymous candidate'), findsNWidgets(2));
    expect(find.text('Flutter'), findsOneWidget);
    expect(find.text('Interview'), findsOneWidget);
    expect(find.text('Hire'), findsOneWidget);

    await tester.ensureVisible(find.text('Interview'));
    await tester.tap(find.text('Interview'));
    await tester.pumpAndSettle();
    expect(detail.calls, contains('candidate:c1:interview'));

    await tester.ensureVisible(find.text('Hire'));
    await tester.tap(find.text('Hire'));
    await tester.pumpAndSettle();
    expect(detail.calls, contains('candidate:c2:hire'));
  });

  testWidgets('non-owner never sees the candidate pipeline', (tester) async {
    final detail = _FakeDetail(candidates: const [
      HopeCandidate(
          id: 'c1',
          skills: 'Flutter',
          resumeText: 'Cross-platform experience.',
          status: 'FORWARDED'),
    ]);
    await _pump(
      tester,
      job: _job(kind: 'JOB', ownerId: 'u1'),
      detail: detail,
      userId: 'u-other',
    );
    expect(find.text('Forwarded candidates'), findsNothing);
    expect(detail.calls, isEmpty);
  });

  testWidgets('owner mission opens the transaction route intent',
      (tester) async {
    await _pump(tester, job: _job(kind: 'MISSION', ownerId: 'u1'), userId: 'u1');
    expect(find.byType(TransactionPage), findsNothing);
    await tester.scrollUntilVisible(find.text('View transaction'), 150);
    await tester.pumpAndSettle();
    await tester.tap(find.text('View transaction'));
    await tester.pumpAndSettle();
    // Navigation intent reached the transaction route and the transaction
    // page renders the funded payment.
    expect(find.byType(TransactionPage), findsOneWidget);
  });
}
