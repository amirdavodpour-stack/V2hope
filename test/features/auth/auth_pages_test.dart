import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/features/auth/login_page.dart';
import 'package:hope_mobile/features/auth/password_reset_page.dart';
import 'package:hope_mobile/features/auth/register_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _AuthRepo implements AuthRepository {
  @override
  Future<AuthSession> login(String email, String password) async =>
      const AuthSession(accessToken: 'a', refreshToken: 'r', user: {'id': 'u'});

  @override
  Future<AuthSession> register(
          String email, String password, String displayName) async =>
      const AuthSession(accessToken: 'a', refreshToken: 'r', user: {'id': 'u'});

  @override
  Future<void> logout() async {}

  @override
  Future<void> requestPasswordReset(String email) async {}
}

Future<Widget> _screen(Widget child) async {
  SharedPreferences.setMockInitialValues({});
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_AuthRepo(), SecureStore());
  return MaterialApp(
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
      providers: [
        ChangeNotifierProvider<HopeSettingsController>.value(value: settings),
        ChangeNotifierProvider<ThemeController>(
            create: (_) => ThemeController(settings)),
        ChangeNotifierProvider<AuthController>.value(value: auth),
      ],
      child: child,
    ),
  );
}

void main() {
  testWidgets('login exposes guest entry and account actions', (tester) async {
    await tester.pumpWidget(await _screen(const LoginPage()));
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.text('فعلاً به‌عنوان مهمان ادامه بده'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('ساخت حساب'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('ساخت حساب'), findsOneWidget);
  });

  testWidgets('guest action changes authentication state without credentials',
      (tester) async {
    await tester.pumpWidget(await _screen(const LoginPage()));
    await tester.pumpAndSettle();
    final auth = Provider.of<AuthController>(
        tester.element(find.byType(LoginPage)),
        listen: false);
    await tester.tap(find.text('فعلاً به‌عنوان مهمان ادامه بده'));
    await tester.pumpAndSettle();
    expect(auth.isGuest, isTrue);
    expect(auth.isAuthenticated, isFalse);
  });

  testWidgets('register page renders required account fields', (tester) async {
    await tester.pumpWidget(await _screen(const RegisterPage()));
    await tester.pumpAndSettle();
    expect(find.byType(RegisterPage), findsOneWidget);
    expect(find.byType(TextField), findsAtLeastNWidgets(3));
  });

  testWidgets('password reset renders an email form', (tester) async {
    await tester.pumpWidget(await _screen(const PasswordResetPage()));
    await tester.pumpAndSettle();
    expect(find.byType(PasswordResetPage), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });
}
