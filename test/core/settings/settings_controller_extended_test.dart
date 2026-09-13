import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('defaults', () {
    test('load supplies product defaults when storage is empty', () async {
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
      expect(settings.latitude, isNull);
      expect(settings.longitude, isNull);
    });

    test('load restores every persisted setting', () async {
      SharedPreferences.setMockInitialValues({
        'language': 'en',
        'theme': 'dark',
        'city': 'اصفهان',
        'locationEnabled': true,
        'notifications': false,
        'personalizedRecommendations': false,
        'quietHours': true,
        'compactCards': true,
        'locationLatitude': 32.6546,
        'locationLongitude': 51.668,
      });
      final settings = HopeSettingsController();
      await settings.load();
      expect(settings.language, 'en');
      expect(settings.theme, 'dark');
      expect(settings.city, 'اصفهان');
      expect(settings.locationEnabled, isTrue);
      expect(settings.notifications, isFalse);
      expect(settings.personalizedRecommendations, isFalse);
      expect(settings.quietHours, isTrue);
      expect(settings.compactCards, isTrue);
      expect(settings.latitude, 32.6546);
      expect(settings.longitude, 51.668);
    });
  });

  group('sanitization', () {
    test('only en survives language sanitization', () async {
      final settings = HopeSettingsController();
      await settings.load();
      await settings.setLanguage('EN');
      expect(settings.language, 'fa');
      await settings.setLanguage('en');
      expect(settings.language, 'en');
      await settings.setLanguage('xx');
      expect(settings.language, 'fa');
    });

    test('only known theme values survive sanitization', () async {
      final settings = HopeSettingsController();
      await settings.load();
      for (final value in ['light', 'dark', 'system']) {
        await settings.setTheme(value);
        expect(settings.theme, value);
      }
      await settings.setTheme('LIGHT');
      expect(settings.theme, 'system');
    });

    test('setCity stores a meaningful trimmed value', () async {
      final settings = HopeSettingsController();
      await settings.load();
      await settings.setCity('  مشهد  ');
      expect(settings.city, 'مشهد');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('city'), 'مشهد');
    });

    test('setCity ignores whitespace-only input and keeps persistence intact',
        () async {
      final settings = HopeSettingsController();
      await settings.load();
      await settings.setCity('مشهد');
      await settings.setCity('  ');
      expect(settings.city, 'مشهد');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('city'), 'مشهد');
    });
  });

  group('persistence setters', () {
    test('notification preference survives a new controller', () async {
      final first = HopeSettingsController();
      await first.load();
      await first.setNotifications(false);
      final second = HopeSettingsController();
      await second.load();
      expect(second.notifications, isFalse);
    });

    test('recommendation preference survives a new controller', () async {
      final first = HopeSettingsController();
      await first.load();
      await first.setPersonalizedRecommendations(false);
      final second = HopeSettingsController();
      await second.load();
      expect(second.personalizedRecommendations, isFalse);
    });

    test('quiet-hours preference survives a new controller', () async {
      final first = HopeSettingsController();
      await first.load();
      await first.setQuietHours(true);
      final second = HopeSettingsController();
      await second.load();
      expect(second.quietHours, isTrue);
    });

    test('compact-card preference survives a new controller', () async {
      final first = HopeSettingsController();
      await first.load();
      await first.setCompactCards(true);
      final second = HopeSettingsController();
      await second.load();
      expect(second.compactCards, isTrue);
    });
  });

  group('location state', () {
    test('disableLocation clears coordinates and persistence', () async {
      SharedPreferences.setMockInitialValues({
        'locationEnabled': true,
        'locationLatitude': 35.6892,
        'locationLongitude': 51.389,
      });
      final settings = HopeSettingsController();
      await settings.load();
      await settings.disableLocation();
      final prefs = await SharedPreferences.getInstance();
      expect(settings.locationEnabled, isFalse);
      expect(settings.latitude, isNull);
      expect(settings.longitude, isNull);
      expect(prefs.getBool('locationEnabled'), isFalse);
      expect(prefs.containsKey('locationLatitude'), isFalse);
      expect(prefs.containsKey('locationLongitude'), isFalse);
    });

    test('nearestCity recognizes every canonical city coordinate', () {
      final coordinates = <String, List<double>>{
        'تهران': [35.6892, 51.389],
        'مشهد': [36.2605, 59.6168],
        'اصفهان': [32.6546, 51.668],
        'شیراز': [29.5918, 52.5837],
        'تبریز': [38.0962, 46.2738],
        'کرج': [35.84, 50.9391],
        'قم': [34.6416, 50.8746],
      };
      for (final entry in coordinates.entries) {
        expect(
          HopeSettingsController.nearestCity(entry.value[0], entry.value[1]),
          entry.key,
        );
      }
    });

    test('cities list contains the manual online option and Tehran', () {
      expect(HopeSettingsController.cities, containsAll(['تهران', 'آنلاین']));
    });

    test('known Geolocator permission enum values are handled as platform data',
        () {
      expect(LocationPermission.values, isNotEmpty);
      expect(LocationPermission.deniedForever, isNotNull);
    });
  });
}
