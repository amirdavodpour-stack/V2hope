import 'dart:convert';

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
import 'package:http/http.dart' as http;

class _SmokeAuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login(String email, String password) =>
      throw UnimplementedError();
  @override
  Future<AuthSession> register(
          String email, String password, String displayName) =>
      throw UnimplementedError();
  @override
  Future<void> logout() async {}
  @override
  Future<void> requestPasswordReset(String email) async {}
}

Future<void> _pump(WidgetTester tester) async {
  final settings = HopeSettingsController();
  await settings.load();
  final auth = AuthController(_SmokeAuthRepository(), SecureStore());
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
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('HOPE boots on an actual Flutter runtime surface',
      (tester) async {
    await _pump(tester);
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(NavigationBar), findsOneWidget);
  });

  testWidgets('configured staging live and categories endpoints are reachable',
      (tester) async {
    const enabled = bool.fromEnvironment(
      'CI_DEVICE_INTEGRATION',
      defaultValue: false,
    );
    if (!enabled) return;
    const baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    expect(baseUrl, isNotEmpty);
    expect(Uri.parse(baseUrl).scheme, 'https');
    final live = await http
        .get(Uri.parse('$baseUrl/live'))
        .timeout(const Duration(seconds: 10));
    expect(live.statusCode, 200);
    expect(live.headers['content-type'] ?? '', contains('application/json'));

    final categories = await http
        .get(Uri.parse('$baseUrl/categories'))
        .timeout(const Duration(seconds: 10));
    expect(categories.statusCode, 200);
    expect(
        categories.headers['content-type'] ?? '', contains('application/json'));
    final body = jsonDecode(categories.body);
    expect(body, isA<Map>());
    expect((body['data'] as List), isNotEmpty);
  });
}
