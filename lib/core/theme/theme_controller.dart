import 'package:flutter/material.dart';
import '../settings/settings_controller.dart';

class ThemeController extends ChangeNotifier {
  ThemeController(this.settings) : _mode = _fromName(settings.theme) {
    settings.addListener(_syncFromSettings);
  }
  final HopeSettingsController settings;
  ThemeMode _mode;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  static ThemeMode _fromName(String value) => switch (value) {
        'dark' => ThemeMode.dark,
        'light' => ThemeMode.light,
        _ => ThemeMode.system,
      };

  Future<void> setMode(ThemeMode mode) async {
    if (_mode == mode) return;
    _mode = mode;
    await settings.setTheme(switch (mode) {
      ThemeMode.dark => 'dark',
      ThemeMode.light => 'light',
      _ => 'system'
    });
    notifyListeners();
  }

  Future<void> toggle() => setMode(isDark ? ThemeMode.light : ThemeMode.dark);

  void _syncFromSettings() {
    final next = _fromName(settings.theme);
    if (next == _mode) return;
    _mode = next;
    notifyListeners();
  }

  @override
  void dispose() {
    settings.removeListener(_syncFromSettings);
    super.dispose();
  }
}
