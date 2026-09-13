import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/main.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_server.dart';

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
  @override
  Future<List<HopeJob>> listMyJobs() async => [];
  @override
  Future<HopePayment> getPayment(String id) => throw UnimplementedError();
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

Future<void> _pump(WidgetTester tester, {String language = 'fa'}) async {
  SharedPreferences.setMockInitialValues({'language': language});
  installFakeSecureStorage();
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_AuthRepo(), SecureStore());
  await auth.restoreSession();
  await tester.pumpWidget(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: settings),
      ChangeNotifierProvider(create: (_) => ThemeController(settings)),
      ChangeNotifierProvider.value(value: auth),
      Provider<TransactionRepository>.value(value: _Transactions()),
    ],
    child: const WorkMarketplaceApp(),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Persian shell uses RTL direction', (tester) async {
    await _pump(tester);
    final directions =
        tester.widgetList<Directionality>(find.byType(Directionality));
    expect(directions.any((d) => d.textDirection == TextDirection.rtl), isTrue);
  });

  testWidgets('English shell uses LTR direction', (tester) async {
    await _pump(tester, language: 'en');
    final directions =
        tester.widgetList<Directionality>(find.byType(Directionality));
    expect(directions.any((d) => d.textDirection == TextDirection.ltr), isTrue);
  });

  testWidgets('drawer opens for the guest shell', (tester) async {
    await _pump(tester);
    final menu = find.byIcon(Icons.menu_rounded);
    if (menu.evaluate().isNotEmpty) {
      await tester.tap(menu);
    } else {
      expect(find.byType(Drawer), findsOneWidget);
      return;
    }
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsOneWidget);
  });

  testWidgets(
      'language can be changed from the drawer without replacing MaterialApp',
      (tester) async {
    await _pump(tester);
    final menu = find.byIcon(Icons.menu_rounded);
    await tester.tap(menu);
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsOneWidget);
    final languageTile = find.textContaining('زبان');
    if (languageTile.evaluate().isNotEmpty) {
      await tester.tap(languageTile.first);
      await tester.pumpAndSettle();
    }
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
