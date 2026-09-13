import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('load', () {
    test(
      'starts in a loading state and flips to loaded with defaults',
      () async {
        final settings = HopeSettingsController();
        expect(settings.isLoading, isTrue);

        await settings.load();

        expect(settings.isLoading, isFalse);
        expect(settings.language, 'fa');
        expect(settings.theme, 'system');
        expect(settings.city, 'تهران');
        expect(settings.locationEnabled, isFalse);
        expect(settings.notifications, isTrue);
        expect(settings.personalizedRecommendations, isTrue);
        expect(settings.quietHours, isFalse);
        expect(settings.compactCards, isFalse);
      },
    );

    test('rehydrates previously persisted values', () async {
      SharedPreferences.setMockInitialValues({
        'language': 'en',
        'theme': 'dark',
        'city': 'شیراز',
        'notifications': false,
        'compactCards': true,
      });
      final settings = HopeSettingsController();

      await settings.load();

      expect(settings.language, 'en');
      expect(settings.theme, 'dark');
      expect(settings.city, 'شیراز');
      expect(settings.notifications, isFalse);
      expect(settings.compactCards, isTrue);
    });
  });

  group('setLanguage', () {
    test('accepts en and persists it', () async {
      final settings = HopeSettingsController();
      await settings.load();

      await settings.setLanguage('en');

      expect(settings.language, 'en');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('language'), 'en');
    });

    test('any value other than en collapses to fa', () async {
      final settings = HopeSettingsController();
      await settings.load();

      await settings.setLanguage('fr');

      expect(settings.language, 'fa');
    });
  });

  group('setTheme', () {
    test('accepts the three known values', () async {
      final settings = HopeSettingsController();
      await settings.load();

      for (final value in ['light', 'dark', 'system']) {
        await settings.setTheme(value);
        expect(settings.theme, value);
      }
    });

    test(
        'an unknown value falls back to system rather than being stored '
        'verbatim', () async {
      final settings = HopeSettingsController();
      await settings.load();

      await settings.setTheme('sepia');

      expect(settings.theme, 'system');
    });
  });

  group('setCity', () {
    test('trims surrounding whitespace before storing', () async {
      final settings = HopeSettingsController();
      await settings.load();

      await settings.setCity('  اصفهان  ');

      expect(settings.city, 'اصفهان');
    });

    test('a blank value is ignored, keeping the previous city', () async {
      final settings = HopeSettingsController();
      await settings.load();
      await settings.setCity('مشهد');

      await settings.setCity('   ');

      expect(settings.city, 'مشهد');
    });
  });

  group('notifyListeners', () {
    test('each setter notifies listeners exactly once', () async {
      final settings = HopeSettingsController();
      await settings.load();
      var notifications = 0;
      settings.addListener(() => notifications++);

      await settings.setNotifications(false);
      await settings.setQuietHours(true);
      await settings.setPersonalizedRecommendations(false);
      await settings.setCompactCards(true);

      expect(notifications, 4);
      expect(settings.notifications, isFalse);
      expect(settings.quietHours, isTrue);
      expect(settings.personalizedRecommendations, isFalse);
      expect(settings.compactCards, isTrue);
    });
  });

  group('disableLocation', () {
    test('clears location state and persists the change', () async {
      SharedPreferences.setMockInitialValues({
        'locationEnabled': true,
        'locationLatitude': 35.7,
        'locationLongitude': 51.4,
      });
      final settings = HopeSettingsController();
      await settings.load();
      expect(settings.locationEnabled, isTrue);

      await settings.disableLocation();

      expect(settings.locationEnabled, isFalse);
      expect(settings.latitude, isNull);
      expect(settings.longitude, isNull);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('locationEnabled'), isFalse);
      expect(prefs.containsKey('locationLatitude'), isFalse);
    });
  });

  group('nearestCity', () {
    test('returns the city whose coordinates are closest', () {
      // Tehran's own coordinates should resolve to Tehran itself.
      expect(HopeSettingsController.nearestCity(35.6892, 51.3890), 'تهران');
    });

    test('a point near Shiraz resolves to Shiraz, not the fallback', () {
      expect(HopeSettingsController.nearestCity(29.60, 52.58), 'شیراز');
    });

    test(
      'an unrecognizable/far-away point still returns the closest known '
      'city rather than the fallback (the function has no "too far" cutoff)',
      () {
        final result = HopeSettingsController.nearestCity(
          0,
          0,
          fallback: 'تهران',
        );
        expect(HopeSettingsController.cities, contains(result));
      },
    );
  });
}
