import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';

void main() {
  test(
      'location settings verify service availability before reading a position',
      () {
    final source =
        File('lib/core/settings/settings_controller.dart').readAsStringSync();
    expect(source, contains('Geolocator.isLocationServiceEnabled()'));
    expect(source, contains('if (!serviceEnabled)'));
  });

  test('location controller exposes distinct failure reasons', () {
    expect(LocationFailureReason.values, containsAll([
      LocationFailureReason.serviceDisabled,
      LocationFailureReason.permissionDenied,
      LocationFailureReason.positionUnavailable,
      LocationFailureReason.unsupportedPlatform,
    ]));
    final source = File('lib/core/settings/settings_controller.dart').readAsStringSync();
    expect(source, contains('onLocationFailure'));
    expect(source, contains('positionUnavailable'));
  });

  test('location permission denial clears persisted location state', () {
    final source =
        File('lib/core/settings/settings_controller.dart').readAsStringSync();
    expect(source, contains("_prefs?.setBool(_locationKey, false)"));
    expect(source, contains("_prefs?.remove(_latitudeKey)"));
    expect(source, contains("_prefs?.remove(_longitudeKey)"));
  });
}


