import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/notifications/notification.dart';
import 'package:hope_mobile/core/notifications/notification_repository.dart';
import 'package:hope_mobile/core/profile/profile_repository.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/core/transactions/payment.dart';
import 'package:hope_mobile/core/transactions/transaction_repository.dart';
import 'package:hope_mobile/features/home/home_page.dart';
import 'package:hope_mobile/features/notifications/notifications_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Home navigation behavior: drawer intents, admin gate, language toggle and
/// bottom-tab switching. Every test builds its own widgets/fakes, so there is
/// no shared mutable state between tests.
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

class _Notifications implements NotificationRepository {
  @override
  Future<HopeNotificationPage> listNotifications(
          {int limit = 50, int offset = 0}) async =>
      const HopeNotificationPage(items: [], unreadCount: 0);
  @override
  Future<HopeNotification> markRead(String id) async => HopeNotification(
      id: id,
      type: 'x',
      title: 't',
      body: 'b',
      createdAt: null,
      readAt: 'now');
  @override
  Future<HopeNotificationPreferences> getPreferences() async => const HopeNotificationPreferences(inApp: true, push: true, email: true, jobAlerts: true, applicationUpdates: true, paymentUpdates: true, marketing: false);

  @override
  Future<HopeNotificationPreferences> updatePreferences(Map<String, bool> patch) async => getPreferences();

  @override
  Future<int> markAllRead() async => 0;
}

class _ProfileRepo implements ProfileRepository {
  @override
  Future<HopeProviderProfile> getProviderProfile() async =>
      const HopeProviderProfile(
          providerType: 'INDIVIDUAL',
          capacity: '3',
          verificationStatus: 'VERIFIED',
          trustSignals: {'verified': true});
  @override
  Future<List<HopeApplication>> listApplications() async => const [];
  @override
  Future<HopeApplication> withdrawApplication(String applicationId) =>
      throw UnimplementedError();
}

void _setView(WidgetTester tester) {
  // Tall viewport so every drawer tile (including the last, language) is
  // laid out and tappable.
  tester.view.physicalSize = const Size(700, 1700);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<Widget> _app({
  bool admin = false,
  bool authenticated = false,
}) async {
  SharedPreferences.setMockInitialValues({});
  final settings = HopeSettingsController();
  await settings.load();
  // The app defaults to Persian; tests exercise the English navigation
  // labels, so pin the locale explicitly and deterministically.
  await settings.setLanguage('en');
  final auth = AuthController(_AuthRepo(), SecureStore());
  if (authenticated) {
    await auth.applyRefreshedUser({
      'id': 'u1',
      'displayName': 'Ali',
      if (admin) 'role': 'ADMIN',
    });
  } else {
    auth.continueAsGuest();
  }
  // Providers sit ABOVE the MaterialApp so routes pushed onto the app
  // Navigator (NotificationsPage via HopeRoutes) resolve them. The whole app
  // rebuilds with the settings locale when the drawer toggles the language.
  return ListenableBuilder(
    listenable: settings,
    builder: (context, _) => MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: settings),
        ChangeNotifierProvider(create: (_) => ThemeController(settings)),
        ChangeNotifierProvider.value(value: auth),
        Provider<TransactionRepository>.value(value: _Transactions()),
        Provider<NotificationRepository>.value(value: _Notifications()),
        Provider<ProfileRepository>.value(value: _ProfileRepo()),
      ],
      child: MaterialApp(
        theme: ThemeData.light(),
        locale: Locale(settings.language),
        supportedLocales: const [Locale('en'), Locale('fa')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const HomePage(),
      ),
    ),
  );
}

void main() {
  testWidgets('member drawer shows account entries and hides admin panel',
      (tester) async {
    _setView(tester);
    await tester.pumpWidget(await _app(authenticated: true));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Your professional path'), findsOneWidget);
    // A non-admin member sees notifications but no admin panel.
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Admin panel'), findsNothing);
    expect(find.text('Current location'), findsOneWidget);
  });

  testWidgets('admin member sees the admin panel entry in the drawer',
      (tester) async {
    _setView(tester);
    await tester.pumpWidget(await _app(authenticated: true, admin: true));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Admin panel'), findsOneWidget);
  });

  testWidgets('notifications drawer entry opens the notifications page',
      (tester) async {
    _setView(tester);
    await tester.pumpWidget(await _app(authenticated: true));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();
    expect(find.byType(NotificationsPage), findsOneWidget);
  });

  testWidgets('drawer language toggle switches the app locale',
      (tester) async {
    _setView(tester);
    await tester.pumpWidget(await _app(authenticated: true));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Language: English'), findsOneWidget);
    await tester.tap(find.text('Language: English'));
    await tester.pumpAndSettle();
    // The settings controller switched languages and the app rebuilds with
    // the Persian locale; navigation bar still present.
    final settings = tester
        .element(find.byType(NavigationBar))
        .read<HopeSettingsController>();
    expect(settings.language, 'fa');
    expect(find.byType(NavigationBar), findsOneWidget);
  });

  testWidgets('bottom navigation switches tabs and shows profile scaffold',
      (tester) async {
    _setView(tester);
    await tester.pumpWidget(await _app(authenticated: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Profile'), findsWidgets);
    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
  });
}
