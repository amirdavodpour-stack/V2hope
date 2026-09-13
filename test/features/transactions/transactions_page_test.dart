import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/features/transactions/transactions_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

class _Transactions implements TransactionRepository {
  List<HopeJob> jobs = const [];
  bool paymentUnavailable = false;
  @override
  Future<List<HopeJob>> listMyJobs() async => jobs;
  @override
  Future<HopePayment> getPayment(String id) async {
    if (paymentUnavailable) {
      throw StateError('payment service unavailable');
    }
    final job = jobs.firstWhere(
      (item) => item.id == id,
      orElse: () => _job(id),
    );
    return HopePayment(
      id: 'payment-$id',
      status: 'FUNDED',
      amount: 100,
      job: job,
    );
  }
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

Future<void> _pump(WidgetTester tester, _Transactions repo,
    {bool guest = false}) async {
  SharedPreferences.setMockInitialValues({});
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_AuthRepo(), SecureStore());
  if (guest) {
    auth.continueAsGuest();
  } else {
    await auth.applyRefreshedUser({'id': 'u1', 'displayName': 'User'});
  }
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData.light(),
    locale: const Locale('fa'),
    supportedLocales: const [Locale('fa'), Locale('en')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: MultiProvider(
      providers: [ChangeNotifierProvider.value(value: auth)],
      child: TransactionsPage(repository: repo),
    ),
  ));
  await tester.pumpAndSettle();
}

HopeJob _job(String id, {String status = 'OPEN'}) => HopeJob.fromMap({
      'id': id,
      'title': 'پروژه $id',
      'description': '',
      'status': status,
      'kind': 'MISSION',
      'visibility': 'PUBLIC',
    });

void main() {
  testWidgets('guest transactions protect private activity', (tester) async {
    final repo = _Transactions();
    await _pump(tester, repo, guest: true);
    expect(find.byType(TransactionsPage), findsOneWidget);
    expect(find.textContaining('خصوصی'), findsOneWidget);
  });

  testWidgets('empty authenticated transactions show the empty state',
      (tester) async {
    final repo = _Transactions()..jobs = [];
    await _pump(tester, repo);
    expect(find.textContaining('فعالیتی'), findsWidgets);
  });

  testWidgets('authenticated transactions render active and completed jobs',
      (tester) async {
    final repo = _Transactions()
      ..jobs = [
        _job('a', status: 'IN_PROGRESS'),
        _job('b', status: 'COMPLETED')
      ];
    await _pump(tester, repo);
    expect(find.text('پروژه a'), findsOneWidget);

    // The activity list is scrollable and each project card contains a
    // lifecycle section, so the second card may be outside the initial
    // viewport and therefore not built by ListView yet. Scroll to it before
    // asserting that the completed job is rendered.
    await tester.scrollUntilVisible(
      find.text('پروژه b'),
      500,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.pumpAndSettle();
    expect(find.text('پروژه b'), findsOneWidget);
  });

  testWidgets('transactions still render when payment lookup is unavailable',
      (tester) async {
    final repo = _Transactions()
      ..paymentUnavailable = true
      ..jobs = [_job('payment-unavailable', status: 'IN_PROGRESS')];
    await _pump(tester, repo);
    expect(find.text('پروژه payment-unavailable'), findsOneWidget);
  });
}
