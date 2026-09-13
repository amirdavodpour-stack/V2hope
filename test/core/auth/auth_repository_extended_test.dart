import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';

void main() {
  group('AuthSession.fromResponse', () {
    test('accepts the unwrapped session payload', () {
      final session = AuthSession.fromResponse({
        'user': {'id': 'u1', 'email': 'u@example.com'},
        'accessToken': 'access',
        'refreshToken': 'refresh',
      });
      expect(session.accessToken, 'access');
      expect(session.refreshToken, 'refresh');
      expect(session.user['id'], 'u1');
    });

    test('rejects a missing user object', () {
      expect(
        () => AuthSession.fromResponse({
          'accessToken': 'access',
          'refreshToken': 'refresh',
        }),
        throwsFormatException,
      );
    });

    test('rejects an empty access token', () {
      expect(
        () => AuthSession.fromResponse({
          'user': {'id': 'u1'},
          'accessToken': '',
          'refreshToken': 'refresh',
        }),
        throwsFormatException,
      );
    });

    test('rejects an empty refresh token', () {
      expect(
        () => AuthSession.fromResponse({
          'user': {'id': 'u1'},
          'accessToken': 'access',
          'refreshToken': '',
        }),
        throwsFormatException,
      );
    });

    test('rejects non-string token values', () {
      expect(
        () => AuthSession.fromResponse({
          'user': {'id': 'u1'},
          'accessToken': 123,
          'refreshToken': true,
        }),
        throwsFormatException,
      );
    });

    test('copies the user map instead of retaining the mutable input map', () {
      final input = {
        'user': {'id': 'u1'},
        'accessToken': 'access',
        'refreshToken': 'refresh',
      };
      final session = AuthSession.fromResponse(input);
      (input['user'] as Map)['id'] = 'changed';
      expect(session.user['id'], 'u1');
    });
  });
}
