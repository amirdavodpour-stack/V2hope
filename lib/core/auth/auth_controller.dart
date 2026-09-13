import 'package:flutter/foundation.dart';
import 'auth_repository.dart';
import '../network/api_error_presenter.dart';
import '../storage/secure_store.dart';
import '../telemetry/telemetry_service.dart';
import '../application/use_cases.dart';

class AuthController extends ChangeNotifier {
  AuthController(this.repository, this.store);
  final AuthRepository repository;
  final SecureStore store;
  TelemetryService? telemetry;

  bool loading = false;
  bool initialized = false;
  bool guest = true;
  Map<String, dynamic>? user;
  String? error;

  bool get isAuthenticated => user != null;
  bool get isGuest => guest && user == null;

  Future<void> applyRefreshedUser(Map<String, dynamic> account) async {
    user = Map<String, dynamic>.from(account);
    guest = false;
    error = null;
    notifyListeners();
  }

  Future<void> restoreSession() async {
    try {
      final token = await store.accessToken;
      final savedUser = await store.user;
      if (token != null && token.isNotEmpty && savedUser != null) {
        user = savedUser;
        guest = false;
      } else {
        await store.clear();
        user = null;
        guest = true;
      }
    } finally {
      initialized = true;
      notifyListeners();
    }
  }

  void continueAsGuest() {
    user = null;
    guest = true;
    error = null;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _auth(() async {
      final session = await LoginUseCase(repository)(email, password);
      await _applySession(session);
      await telemetry?.track('login_completed');
    });
  }

  Future<void> register(
      String email, String password, String displayName) async {
    await _auth(() async {
      final session = await RegisterUseCase(repository)(email, password, displayName);
      await _applySession(session);
      await telemetry?.track('signup_completed');
    });
  }

  Future<void> _applySession(AuthSession session) async {
    // Persist first; only then publish the authenticated state. This avoids
    // a false-positive login if secure storage itself fails.
    await store.saveTokens(
      access: session.accessToken,
      refresh: session.refreshToken,
    );
    await store.saveUser(session.user);
    user = session.user;
    guest = false;
  }

  Future<void> logout({bool notifyServer = true}) async {
    try {
      if (notifyServer && user != null) {
        try {
          await LogoutUseCase(repository)();
        } catch (_) {
          // Local session cleanup is the authoritative fallback.
        }
      }
    } finally {
      await store.clear();
      user = null;
      guest = true;
      notifyListeners();
    }
  }

  Future<void> _auth(Future<void> Function() fn) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await fn();
    } catch (e) {
      error = apiErrorMessage(e, fallback: 'Authentication failed');
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
