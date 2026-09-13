import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/auth/auth_controller.dart';
import 'package:hope_mobile/core/auth/auth_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import '../network/test_fixtures.dart';

class _Repository implements AuthRepository {
  _Repository({this.failLogin = false, this.failRegister = false});
  bool failLogin;
  bool failRegister;

  @override
  Future<AuthSession> login(String email, String password) async {
    if (failLogin) {
      throw ApiException('INVALID_TOKEN', 'invalid');
    }
    return const AuthSession(
      accessToken: 'a',
      refreshToken: 'r',
      user: {'id': 'u1'},
    );
  }

  @override
  Future<AuthSession> register(
      String email, String password, String displayName) async {
    if (failRegister) {
      throw ApiException('VALIDATION_ERROR', 'invalid');
    }
    return const AuthSession(
      accessToken: 'a2',
      refreshToken: 'r2',
      user: {'id': 'u2'},
    );
  }

  @override
  Future<void> logout() async {}

  @override
  Future<void> requestPasswordReset(String email) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => installFakeSecureStorageForTests());

  test('continueAsGuest clears a previous error and notifies once', () async {
    final auth = AuthController(_Repository(failLogin: true), SecureStore());
    try {
      await auth.login('u@example.com', 'bad');
    } catch (_) {}
    var changes = 0;
    auth.addListener(() => changes++);

    auth.continueAsGuest();

    expect(auth.isGuest, isTrue);
    expect(auth.error, isNull);
    expect(changes, 1);
  });

  test('successful login publishes authenticated state only after persistence',
      () async {
    final auth = AuthController(_Repository(), SecureStore());
    await auth.login('u@example.com', 'pw');

    expect(auth.isAuthenticated, isTrue);
    expect(auth.user?['id'], 'u1');
    expect(await auth.store.accessToken, 'a');
    expect(await auth.store.refreshToken, 'r');
  });

  test('failed login leaves the controller unauthenticated', () async {
    final auth = AuthController(_Repository(failLogin: true), SecureStore());

    await expectLater(
      auth.login('u@example.com', 'bad'),
      throwsA(isA<ApiException>()),
    );

    expect(auth.isAuthenticated, isFalse);
    expect(auth.isGuest, isTrue);
    expect(auth.error, 'نیاز به ورود مجدد دارید.');
    expect(auth.loading, isFalse);
  });

  test('register stores the returned session', () async {
    final auth = AuthController(_Repository(), SecureStore());
    await auth.register('new@example.com', 'pw', 'New User');

    expect(auth.isAuthenticated, isTrue);
    expect(auth.user?['id'], 'u2');
    expect(await auth.store.accessToken, 'a2');
  });

  test('failed registration restores idle state and exposes validation message',
      () async {
    final auth = AuthController(_Repository(failRegister: true), SecureStore());

    await expectLater(
      auth.register('bad', 'pw', 'x'),
      throwsA(isA<ApiException>()),
    );

    expect(auth.loading, isFalse);
    expect(auth.isAuthenticated, isFalse);
    expect(auth.error, 'اطلاعات واردشده را بررسی کنید.');
  });

  test('restoreSession clears a partial session instead of authenticating it',
      () async {
    final store = SecureStore();
    await store.saveTokens(access: 'access-only', refresh: 'refresh');
    final auth = AuthController(_Repository(), store);

    await auth.restoreSession();

    expect(auth.initialized, isTrue);
    expect(auth.isGuest, isTrue);
    expect(await store.accessToken, isNull);
    expect(await store.refreshToken, isNull);
  });
}
