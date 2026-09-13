import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:hope_mobile/main.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _AuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login(String email, String password) async =>
      const AuthSession(
          accessToken: 'runtime-access',
          refreshToken: 'runtime-refresh',
          user: {'id': 'runtime'});
  @override
  Future<AuthSession> register(
          String email, String password, String displayName) async =>
      const AuthSession(
          accessToken: 'runtime-access',
          refreshToken: 'runtime-refresh',
          user: {'id': 'runtime'});
  @override
  Future<void> logout() async {}
  @override
  Future<void> requestPasswordReset(String email) async {}
}

Future<({HopeSettingsController settings, AuthController auth})> _pumpShell(
    WidgetTester tester) async {
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_AuthRepository(), SecureStore());
  auth.continueAsGuest();
  await tester.pumpWidget(MultiProvider(
    providers: [
      ChangeNotifierProvider<HopeSettingsController>.value(value: settings),
      ChangeNotifierProvider<ThemeController>(
          create: (_) => ThemeController(settings)),
      ChangeNotifierProvider<AuthController>.value(value: auth),
    ],
    child: const WorkMarketplaceApp(),
  ));
  await tester.pumpAndSettle();
  return (settings: settings, auth: auth);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Flutter runtime boots through real MaterialApp and router',
      (tester) async {
    await _pumpShell(tester);
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.text('HOPE'), findsWidgets);
  });

  testWidgets('runtime starts in guest browse-first state', (tester) async {
    final shell = await _pumpShell(tester);
    expect(shell.auth.isGuest, isTrue);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsOneWidget);
  });

  testWidgets('runtime persists language across a new settings controller',
      (tester) async {
    final shell = await _pumpShell(tester);
    await shell.settings.setLanguage('en');
    final next = HopeSettingsController();
    await next.load();
    expect(next.language, 'en');
  });

  testWidgets('runtime persists theme across a new settings controller',
      (tester) async {
    final shell = await _pumpShell(tester);
    await shell.settings.setTheme('dark');
    final next = HopeSettingsController();
    await next.load();
    expect(next.theme, 'dark');
  });

  testWidgets('runtime switches RTL and LTR without replacing the app shell',
      (tester) async {
    final shell = await _pumpShell(tester);
    expect(find.byType(Directionality), findsWidgets);
    await shell.settings.setLanguage('en');
    await tester.pumpAndSettle();
    expect(find.byType(MaterialApp), findsOneWidget);
    await shell.settings.setLanguage('fa');
    await tester.pumpAndSettle();
    expect(find.byType(MaterialApp), findsOneWidget);
  });

  testWidgets('runtime changes theme mode without rebuilding the provider tree',
      (tester) async {
    await _pumpShell(tester);
    final theme =
        tester.element(find.byType(WorkMarketplaceApp)).read<ThemeController>();
    await theme.setMode(ThemeMode.dark);
    await tester.pumpAndSettle();
    expect(Theme.of(tester.element(find.byType(NavigationBar))).brightness,
        Brightness.dark);
  });

  testWidgets('real SharedPreferences round-trip works on the device runtime',
      (tester) async {
    await _pumpShell(tester);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('runtime_probe', 'ok');
    expect(prefs.getString('runtime_probe'), 'ok');
    await prefs.remove('runtime_probe');
    expect(prefs.containsKey('runtime_probe'), isFalse);
  });

  testWidgets('real secure storage round-trip works on the device runtime',
      (tester) async {
    await _pumpShell(tester);
    final store = SecureStore();
    await store.clear();
    await store.saveTokens(access: 'runtime-a', refresh: 'runtime-r');
    await store.saveUser({'id': 'runtime-u', 'displayName': 'Runtime'});
    expect(await store.accessToken, 'runtime-a');
    expect(await store.refreshToken, 'runtime-r');
    expect((await store.user)?['id'], 'runtime-u');
    await store.clear();
    expect(await store.accessToken, isNull);
  });

  testWidgets('runtime Android platform plugins report usable primitives',
      (tester) async {
    await _pumpShell(tester);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs, isNotNull);
    final settings = HopeSettingsController();
    await settings.load();
    expect(settings.isLoading, isFalse);
  });

  testWidgets(
      'guest posting action opens authentication sheet instead of crashing',
      (tester) async {
    await _pumpShell(tester);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    expect(find.text('ورود'), findsOneWidget);
    expect(find.text('ثبت‌نام'), findsOneWidget);
  });
}
