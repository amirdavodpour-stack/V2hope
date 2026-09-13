import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/profile/profile_repository.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/features/profile/profile_page.dart';
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

Future<void> _pump(WidgetTester tester, {bool authenticated = false}) async {
  SharedPreferences.setMockInitialValues({});
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_AuthRepo(), SecureStore());
  if (authenticated) {
    await auth.applyRefreshedUser({'id': 'u1', 'displayName': 'کاربر'});
  } else {
    auth.continueAsGuest();
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
    home: Scaffold(
      body: MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: settings),
          ChangeNotifierProvider(create: (_) => ThemeController(settings)),
          ChangeNotifierProvider.value(value: auth),
          Provider<ProfileRepository>.value(value: _ProfileRepo()),
        ],
        child: const ProfilePage(),
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('guest profile explains sign-in requirement', (tester) async {
    await _pump(tester);
    expect(find.byType(ProfilePage), findsOneWidget);
    expect(find.textContaining('ورود'), findsWidgets);
  });

  testWidgets('authenticated profile displays account and provider data',
      (tester) async {
    await _pump(tester, authenticated: true);
    expect(find.text('کاربر'), findsOneWidget);
    final individual = find.textContaining('INDIVIDUAL');
    var attempts = 0;
    while (attempts < 6 && individual.evaluate().isEmpty) {
      await tester.drag(find.byType(ListView), const Offset(0, -200));
      await tester.pump();
      attempts++;
    }
    expect(individual, findsOneWidget);
    expect(find.textContaining('VERIFIED'), findsOneWidget);
  });
}
