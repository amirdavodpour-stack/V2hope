import '../network/api_client.dart';

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final Map<String, dynamic> user;

  factory AuthSession.fromResponse(Object? data) {
    if (data is! Map || data['user'] is! Map) {
      throw const FormatException('Invalid authentication response');
    }
    final access = data['accessToken'];
    final refresh = data['refreshToken'];
    if (access is! String ||
        access.isEmpty ||
        refresh is! String ||
        refresh.isEmpty) {
      throw const FormatException('Authentication tokens were not returned');
    }
    return AuthSession(
      accessToken: access,
      refreshToken: refresh,
      user: Map<String, dynamic>.from(data['user'] as Map),
    );
  }
}

abstract interface class AuthRepository {
  Future<AuthSession> login(String email, String password);
  Future<AuthSession> register(
      String email, String password, String displayName);
  Future<void> logout();
  Future<void> requestPasswordReset(String email);
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._api);
  final ApiClient _api;

  @override
  Future<AuthSession> login(String email, String password) async {
    final data = await _api.request('POST', '/auth/login', body: {
      'email': email,
      'password': password,
    });
    return AuthSession.fromResponse(data);
  }

  @override
  Future<AuthSession> register(
      String email, String password, String displayName) async {
    final data = await _api.request('POST', '/auth/register', body: {
      'email': email,
      'password': password,
      'displayName': displayName,
    });
    return AuthSession.fromResponse(data);
  }

  @override
  Future<void> logout() async {
    await _api.request('POST', '/auth/logout', auth: true);
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    await _api.request('POST', '/auth/password-reset/request', body: {
      'email': email,
    });
  }
}
