import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum LocationFailureReason {
  serviceDisabled,
  permissionDenied,
  positionUnavailable,
  unsupportedPlatform,
}

class HopeSettingsController extends ChangeNotifier {
  static const _languageKey = 'language';
  static const _themeKey = 'theme';
  static const _cityKey = 'city';
  static const _locationKey = 'locationEnabled';
  static const _notificationsKey = 'notifications';
  static const _recommendationsKey = 'personalizedRecommendations';
  static const _quietKey = 'quietHours';
  static const _compactKey = 'compactCards';
  static const _latitudeKey = 'locationLatitude';
  static const _longitudeKey = 'locationLongitude';

  SharedPreferences? _prefs;
  String _language = 'fa';
  String _theme = 'system';
  String _city = 'تهران';
  bool _locationEnabled = false;
  bool _notifications = true;
  bool _personalizedRecommendations = true;
  bool _quietHours = false;
  bool _compactCards = false;
  double? _latitude;
  double? _longitude;
  bool _loading = true;
  LocationFailureReason? _lastLocationFailure;

  Future<void> Function(LocationFailureReason reason, Object? error,
      StackTrace? stack)? onLocationFailure;

  bool get isLoading => _loading;
  String get language => _language;
  String get theme => _theme;
  String get city => _city;
  bool get locationEnabled => _locationEnabled;
  bool get notifications => _notifications;
  bool get personalizedRecommendations => _personalizedRecommendations;
  bool get quietHours => _quietHours;
  bool get compactCards => _compactCards;
  double? get latitude => _latitude;
  double? get longitude => _longitude;
  LocationFailureReason? get lastLocationFailure => _lastLocationFailure;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    _language = _prefs!.getString(_languageKey) ?? 'fa';
    _theme = _prefs!.getString(_themeKey) ?? 'system';
    _city = _prefs!.getString(_cityKey) ?? 'تهران';
    _locationEnabled = _prefs!.getBool(_locationKey) ?? false;
    _notifications = _prefs!.getBool(_notificationsKey) ?? true;
    _personalizedRecommendations = _prefs!.getBool(_recommendationsKey) ?? true;
    _quietHours = _prefs!.getBool(_quietKey) ?? false;
    _compactCards = _prefs!.getBool(_compactKey) ?? false;
    _latitude = _prefs!.getDouble(_latitudeKey);
    _longitude = _prefs!.getDouble(_longitudeKey);
    _loading = false;
    notifyListeners();
  }

  Future<void> setLanguage(String value) async {
    _language = value == 'en' ? 'en' : 'fa';
    await _prefs?.setString(_languageKey, _language);
    notifyListeners();
  }

  Future<void> setTheme(String value) async {
    _theme = {'system', 'light', 'dark'}.contains(value) ? value : 'system';
    await _prefs?.setString(_themeKey, _theme);
    notifyListeners();
  }

  Future<void> setCity(String value) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    _city = trimmed;
    await _prefs?.setString(_cityKey, _city);
    notifyListeners();
  }

  Future<bool> enableLocation() async {
    _lastLocationFailure = null;
    if (kIsWeb) {
      _lastLocationFailure = LocationFailureReason.unsupportedPlatform;
      await onLocationFailure?.call(_lastLocationFailure!, null, null);
      return false;
    }
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _lastLocationFailure = LocationFailureReason.serviceDisabled;
      await _clearLocationState();
      await onLocationFailure?.call(_lastLocationFailure!, null, null);
      return false;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      _lastLocationFailure = LocationFailureReason.permissionDenied;
      _locationEnabled = false;
      _latitude = null;
      _longitude = null;
      await _prefs?.setBool(_locationKey, false);
      await _prefs?.remove(_latitudeKey);
      await _prefs?.remove(_longitudeKey);
      notifyListeners();
      await onLocationFailure?.call(_lastLocationFailure!, null, null);
      return false;
    }
    Position position;
    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.medium),
      );
    } catch (error, stack) {
      _lastLocationFailure = LocationFailureReason.positionUnavailable;
      await _clearLocationState();
      await onLocationFailure?.call(
          _lastLocationFailure!, error, stack);
      return false;
    }
    _lastLocationFailure = null;
    _locationEnabled = true;
    _city = nearestCity(position.latitude, position.longitude, fallback: _city);
    _latitude = position.latitude;
    _longitude = position.longitude;
    await _prefs?.setBool(_locationKey, true);
    await _prefs?.setString(_cityKey, _city);
    await _prefs?.setDouble(_latitudeKey, position.latitude);
    await _prefs?.setDouble(_longitudeKey, position.longitude);
    notifyListeners();
    return true;
  }

  Future<void> _clearLocationState() async {
    _locationEnabled = false;
    _latitude = null;
    _longitude = null;
    await _prefs?.setBool(_locationKey, false);
    await _prefs?.remove(_latitudeKey);
    await _prefs?.remove(_longitudeKey);
    notifyListeners();
  }

  Future<void> disableLocation() async {
    await _clearLocationState();
  }

  Future<void> setNotifications(bool value) async {
    _notifications = value;
    await _prefs?.setBool(_notificationsKey, value);
    notifyListeners();
  }

  Future<void> setPersonalizedRecommendations(bool value) async {
    _personalizedRecommendations = value;
    await _prefs?.setBool(_recommendationsKey, value);
    notifyListeners();
  }

  Future<void> setQuietHours(bool value) async {
    _quietHours = value;
    await _prefs?.setBool(_quietKey, value);
    notifyListeners();
  }

  Future<void> setCompactCards(bool value) async {
    _compactCards = value;
    await _prefs?.setBool(_compactKey, value);
    notifyListeners();
  }

  static const cities = <String>[
    'تهران',
    'مشهد',
    'اصفهان',
    'شیراز',
    'تبریز',
    'کرج',
    'قم',
    'اهواز',
    'رشت',
    'کرمانشاه',
    'ارومیه',
    'یزد',
    'کرمان',
    'ساری',
    'بندرعباس',
    'همدان',
    'آنلاین',
  ];

  static String nearestCity(double lat, double lng,
      {String fallback = 'تهران'}) {
    const points = <String, List<double>>{
      'تهران': [35.6892, 51.3890],
      'مشهد': [36.2605, 59.6168],
      'اصفهان': [32.6546, 51.6680],
      'شیراز': [29.5918, 52.5837],
      'تبریز': [38.0962, 46.2738],
      'کرج': [35.8400, 50.9391],
      'قم': [34.6416, 50.8746],
      'اهواز': [31.3183, 48.6706],
      'رشت': [37.2808, 49.5832],
      'کرمانشاه': [34.3142, 47.0650],
      'ارومیه': [37.5527, 45.0761],
      'یزد': [31.8974, 54.3569],
      'کرمان': [30.2839, 57.0834],
      'ساری': [36.5659, 53.0586],
      'بندرعباس': [27.1832, 56.2666],
      'همدان': [34.7988, 48.5150],
    };
    String best = fallback;
    double bestScore = double.infinity;
    points.forEach((city, point) {
      final score = ((point[0] - lat) * (point[0] - lat)) +
          ((point[1] - lng) * (point[1] - lng));
      if (score < bestScore) {
        bestScore = score;
        best = city;
      }
    });
    return best;
  }
}
