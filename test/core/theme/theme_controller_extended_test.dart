import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/core/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('starts from the persisted setting', () async {
    SharedPreferences.setMockInitialValues({'theme': 'dark'});
    final settings = HopeSettingsController();
    await settings.load();
    final theme = ThemeController(settings);
    expect(theme.mode, ThemeMode.dark);
    theme.dispose();
  });

  test('system is the safe fallback for an invalid theme name', () async {
    SharedPreferences.setMockInitialValues({'theme': 'sepia'});
    final settings = HopeSettingsController();
    await settings.load();
    final theme = ThemeController(settings);
    expect(theme.mode, ThemeMode.system);
    theme.dispose();
  });

  test('setMode persists the selected mode and ignores duplicates', () async {
    final settings = HopeSettingsController();
    await settings.load();
    final theme = ThemeController(settings);
    var notifications = 0;
    theme.addListener(() => notifications++);

    await theme.setMode(ThemeMode.dark);
    await theme.setMode(ThemeMode.dark);

    expect(theme.mode, ThemeMode.dark);
    expect(settings.theme, 'dark');
    expect(notifications, 1);
    theme.dispose();
  });

  test('toggle alternates dark and light', () async {
    final settings = HopeSettingsController();
    await settings.load();
    final theme = ThemeController(settings);

    await theme.setMode(ThemeMode.dark);
    await theme.toggle();
    expect(theme.mode, ThemeMode.light);
    await theme.toggle();
    expect(theme.mode, ThemeMode.dark);

    theme.dispose();
  });

  test('controller synchronizes when settings change directly', () async {
    final settings = HopeSettingsController();
    await settings.load();
    final theme = ThemeController(settings);

    await settings.setTheme('light');
    expect(theme.mode, ThemeMode.light);
    await settings.setTheme('dark');
    expect(theme.mode, ThemeMode.dark);

    theme.dispose();
  });
}
