import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/main.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets('app boots into a real top-level surface', (tester) async {
    final store = SecureStore();
    final api = ApiClient(store, baseUrl: 'http://127.0.0.1:9/api/v1');
    final settings = HopeSettingsController();
    final auth = AuthController(ApiAuthRepository(api), store);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<HopeSettingsController>.value(value: settings),
          ChangeNotifierProvider<ThemeController>(
              create: (_) => ThemeController(settings)),
          ChangeNotifierProvider<AuthController>.value(value: auth),
        ],
        child: const WorkMarketplaceApp(),
      ),
    );
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
