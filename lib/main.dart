import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/auth/auth_controller.dart';
import 'core/auth/auth_repository.dart';
import 'core/network/api_client.dart';
import 'core/settings/settings_controller.dart';
import 'core/storage/secure_store.dart';
import 'core/theme/theme_controller.dart';
import 'core/telemetry/telemetry_service.dart';
import 'core/notifications/notification_service.dart';
import 'core/notifications/notification_repository.dart';
import 'core/profile/profile_repository.dart';
import 'core/uploads/upload_queue.dart';
import 'dart:ui';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'core/marketplace/marketplace_repository.dart';
import 'core/marketplace/saved_search_repository.dart';
import 'core/marketplace/job_detail_repository.dart';
import 'core/transactions/transaction_repository.dart';
import 'core/admin/admin_repository.dart';
import 'core/application/application_registry.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = HopeSettingsController();
  await settings.load();

  final store = SecureStore();
  final api = ApiClient(store);
  final authRepository = ApiAuthRepository(api);
  final profileRepository = ApiProfileRepository(api);
  final notificationRepository = ApiNotificationRepository(api);
  final telemetry = TelemetryService(store, baseUrl: api.baseUrl);
  store.onCorruptUser = (error, stack) => telemetry.recordError(
        error, stack, context: {'source': 'secure_store_corrupt_user'});
  settings.onLocationFailure = (reason, error, stack) async {
    await telemetry.recordError(
      error ?? StateError('Location failed: ${reason.name}'),
      stack ?? StackTrace.current,
      context: {'source': 'location', 'reason': reason.name},
    );
  };
  final auth = AuthController(authRepository, store);
  auth.telemetry = telemetry;
  api.onSessionRefreshed = auth.applyRefreshedUser;
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    telemetry.recordError(
        details.exception, details.stack ?? StackTrace.current,
        context: {'source': 'flutter_error'});
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    telemetry.recordError(error, stack, context: {'source': 'platform_error'});
    return true;
  };
  await telemetry.track('app_opened');
  await auth.restoreSession();
  api.onUnauthorized = () => auth.logout(notifyServer: false);
  final notifications = NotificationService(api);
  await notifications.initialize();

  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: settings),
      ChangeNotifierProvider(create: (_) => ThemeController(settings)),
      ChangeNotifierProvider.value(value: auth),
      Provider<AuthRepository>.value(value: authRepository),
      Provider<ProfileRepository>.value(value: profileRepository),
      Provider<NotificationRepository>.value(value: notificationRepository),
      Provider<MarketplaceRepository>(
          create: (_) => OfflineMarketplaceRepository(ApiMarketplaceRepository(api)),
      ),
      Provider<JobDetailRepository>(create: (_) => ApiJobDetailRepository(api)),
      Provider<TransactionRepository>(
          create: (_) => ApiTransactionRepository(api)),
      Provider<AdminRepository>(create: (_) => ApiAdminRepository(api)),
      Provider<SavedSearchRepository>(
        create: (_) => SyncedSavedSearchRepository(
          local: SharedPreferencesSavedSearchRepository(SharedPreferences.getInstance),
          api: api,
        ),
      ),
      Provider<ApplicationRegistry>(
        create: (context) => ApplicationRegistry(
          marketplace: context.read<MarketplaceRepository>(),
          jobDetail: context.read<JobDetailRepository>(),
          transactions: context.read<TransactionRepository>(),
          admin: context.read<AdminRepository>(),
          auth: context.read<AuthRepository>(),
          notifications: context.read<NotificationRepository>(),
          profile: context.read<ProfileRepository>(),
          savedSearches: context.read<SavedSearchRepository>(),
        ),
      ),
      Provider<UploadQueue>(
        create: (_) => UploadQueue(
          api,
          onTransientFailure: (item, error) => telemetry.recordError(
            error,
            StackTrace.current,
            context: {
              'source': 'upload_queue_stall',
              'jobId': item.jobId,
              'path': item.path,
            },
          ),
          onPermanentFailure: (item, error) => telemetry.recordError(
            error,
            StackTrace.current,
            context: {
              'source': 'upload_queue_permanent_failure',
              'jobId': item.jobId,
              'path': item.path,
            },
          ),
        ),
      ),
      Provider<ApiClient>.value(value: api),
    ],
    child: const WorkMarketplaceApp(),
  ));
}

class WorkMarketplaceApp extends StatelessWidget {
  const WorkMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    final settings = context.watch<HopeSettingsController>();
    final locale = Locale(settings.language);
    final isEn = locale.languageCode == 'en';
    // Clamp accessibility text scaling so large system fonts cannot break
    // the RTL layouts. The parameter was renamed to maxScaleFactor in
    // Flutter 3.16+; the previous `maxScale` name no longer compiles.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: MaterialApp(
        title: 'HOPE',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: theme.mode,
        locale: locale,
        supportedLocales: const [Locale('fa'), Locale('en')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Directionality(
          textDirection: isEn ? TextDirection.ltr : TextDirection.rtl,
          child: const AppRouter(),
        ),
      ),
    );
  }
}
