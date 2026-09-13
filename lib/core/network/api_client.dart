import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../storage/secure_store.dart';

// Note: ArgumentError constructors are intentionally non-const below,
// since they build their message from a runtime value.

class ApiConfig {
  static const String baseUrl = String.fromEnvironment('API_BASE_URL');
}

class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});
  final String code;
  final String message;
  // HTTP status of the failed response, when known. Needed so callers (e.g.
  // UploadQueue) can decide "is this a deterministic 4xx that a retry can
  // never fix" without trying to parse it back out of `code` -- real backend
  // error codes are semantic strings like FILE_TOO_LARGE or
  // VALIDATION_ERROR, not "HTTP_<status>", so that parsing never matched.
  final int? status;
  @override
  String toString() => '$code: $message';
}

class ApiClient {
  ApiClient(this.store, {String? baseUrl})
      : baseUrl = _normalizeBaseUrl(baseUrl ?? ApiConfig.baseUrl);

  static String _normalizeBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    if (normalized.isEmpty) {
      throw ArgumentError('API_BASE_URL must be provided at build time.');
    }
    final uri = Uri.tryParse(normalized);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw ArgumentError('API_BASE_URL must be an absolute URL.');
    }
    if (uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      throw ArgumentError(
          'API_BASE_URL must not contain credentials, a query, or a fragment.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw ArgumentError('API_BASE_URL must use HTTPS in release builds.');
    }
    return normalized;
  }

  final SecureStore store;
  final String baseUrl;

  Future<void> Function()? onUnauthorized;
  Future<void> Function(Map<String, dynamic> user)? onSessionRefreshed;
  void Function(Object error)? onError;
  Future<bool>? _refreshFuture;

  Future<dynamic> uploadFile(String path, File file, {bool auth = true}) async {
    return _uploadFile(path, file, auth: auth, retryAfterRefresh: true);
  }

  Future<dynamic> _uploadFile(String path, File file,
      {required bool auth, required bool retryAfterRefresh}) async {
    final response = await _sendMultipart(path, file, auth: auth);
    final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
    if (response.statusCode == 401 && auth && retryAfterRefresh) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        return _uploadFile(path, file, auth: auth, retryAfterRefresh: false);
      }
      await _handleUnauthorized();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error =
          _apiException(response.statusCode, decoded, 'Upload failed');
      onError?.call(error);
      throw error;
    }
    return decoded is Map && decoded.containsKey('data')
        ? decoded['data']
        : decoded;
  }

  Future<http.Response> _sendMultipart(String path, File file,
      {required bool auth}) async {
    try {
      final uri = Uri.parse('$baseUrl$path');
      final request = http.MultipartRequest('POST', uri);
      request.headers['Accept'] = 'application/json';
      if (auth) {
        final token = await store.accessToken;
        if (token == null || token.isEmpty) {
          throw ApiException('UNAUTHENTICATED', 'Authentication required',
              status: 401);
        }
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.files.add(await http.MultipartFile.fromPath('file', file.path));
      final streamed =
          await request.send().timeout(const Duration(seconds: 60));
      return await http.Response.fromStream(streamed);
    } on ApiException {
      rethrow;
    } on FileSystemException catch (_) {
      final exception = ApiException(
          'FILE_ACCESS_ERROR', 'Could not access the selected file');
      onError?.call(exception);
      throw exception;
    } on SocketException catch (_) {
      final exception = ApiException('NETWORK_ERROR', 'Network request failed');
      onError?.call(exception);
      throw exception;
    } on http.ClientException {
      final exception = ApiException('NETWORK_ERROR', 'Network request failed');
      onError?.call(exception);
      throw exception;
    } on TimeoutException {
      final exception = ApiException('TIMEOUT', 'Request timed out');
      onError?.call(exception);
      throw exception;
    }
  }

  static const int _maxIdempotentRetries = 2;
  static const Duration _retryBaseDelay = Duration(milliseconds: 250);

  Future<http.Response> _sendChecked(String method, String path,
      {Object? body, required bool auth}) async {
    final normalizedMethod = method.toUpperCase();
    final canRetry = normalizedMethod == 'GET';
    Object? lastError;
    for (var attempt = 0; attempt <= (canRetry ? _maxIdempotentRetries : 0); attempt++) {
      try {
        final response = await _send(normalizedMethod, path, body: body, auth: auth);
        if (canRetry && _isRetryableStatus(response.statusCode) && attempt < _maxIdempotentRetries) {
          await _delayBeforeRetry(attempt);
          continue;
        }
        return response;
      } on SocketException {
        lastError = ApiException('NETWORK_ERROR', 'Network request failed');
      } on http.ClientException {
        lastError = ApiException('NETWORK_ERROR', 'Network request failed');
      } on TimeoutException {
        lastError = ApiException('TIMEOUT', 'Request timed out');
      }
      if (!canRetry || attempt >= _maxIdempotentRetries) break;
      await _delayBeforeRetry(attempt);
    }
    final exception = lastError!;
    onError?.call(exception);
    throw exception;
  }

  bool _isRetryableStatus(int status) =>
      status == 408 || status == 429 || status == 502 || status == 503 || status == 504;

  Future<void> _delayBeforeRetry(int attempt) =>
      Future<void>.delayed(_retryBaseDelay * (attempt + 1));


  Future<dynamic> request(String method, String path,
      {Object? body, bool auth = false}) async {
    final response = await _sendChecked(method, path, body: body, auth: auth);
    final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
    if (response.statusCode == 401 && auth) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        final retry = await _sendChecked(method, path, body: body, auth: true);
        if (retry.statusCode == 401) {
          await _handleUnauthorized();
        }
        return _finishResponse(
          retry,
          retry.body.isEmpty ? null : _decodeBody(retry.body),
          'Request failed',
        );
      }
      await _handleUnauthorized();
    }
    return _finishResponse(response, decoded, 'Request failed');
  }

  Future<http.Response> _send(String method, String path,
      {Object? body, required bool auth}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final token = await store.accessToken;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    final uri = Uri.parse('$baseUrl$path');
    final encoded = body == null ? null : jsonEncode(body);
    const timeout = Duration(seconds: 20);
    switch (method.toUpperCase()) {
      case 'GET':
        return http.get(uri, headers: headers).timeout(timeout);
      case 'POST':
        return http.post(uri, headers: headers, body: encoded).timeout(timeout);
      case 'PUT':
        return http.put(uri, headers: headers, body: encoded).timeout(timeout);
      case 'PATCH':
        return http
            .patch(uri, headers: headers, body: encoded)
            .timeout(timeout);
      case 'DELETE':
        return http.delete(uri, headers: headers).timeout(timeout);
      default:
        throw UnsupportedError('Unsupported HTTP method: $method');
    }
  }

  dynamic _decodeBody(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return body;
    }
  }

  ApiException _apiException(int status, dynamic decoded, String fallback) {
    final error = decoded is Map && decoded['error'] is Map
        ? decoded['error'] as Map
        : const {};
    return ApiException(
      '${error['code'] ?? 'HTTP_$status'}',
      '${error['message'] ?? fallback}',
      status: status,
    );
  }

  dynamic _finishResponse(
      http.Response response, dynamic decoded, String fallback) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = _apiException(response.statusCode, decoded, fallback);
      onError?.call(error);
      throw error;
    }
    return decoded is Map && decoded.containsKey('data')
        ? decoded['data']
        : decoded;
  }

  Future<bool> _refreshAccessToken() async {
    final inFlight = _refreshFuture;
    if (inFlight != null) return inFlight;
    final future = _doRefreshAccessToken();
    _refreshFuture = future;
    try {
      return await future;
    } finally {
      if (identical(_refreshFuture, future)) _refreshFuture = null;
    }
  }

  Future<bool> _doRefreshAccessToken() async {
    final refresh = await store.refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final response = await _sendChecked('POST', '/auth/refresh',
          auth: false, body: {'refreshToken': refresh});
      final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final data = decoded is Map && decoded['data'] is Map
          ? decoded['data'] as Map
          : null;
      if (data == null ||
          data['accessToken'] is! String ||
          data['refreshToken'] is! String) {
        return false;
      }
      await store.saveTokens(
        access: data['accessToken'] as String,
        refresh: data['refreshToken'] as String,
      );
      if (data['user'] is Map) {
        final account = Map<String, dynamic>.from(data['user'] as Map);
        await store.saveUser(account);
        await onSessionRefreshed?.call(account);
      }
      return true;
    } catch (error) {
      onError?.call(error);
      return false;
    }
  }

  bool _handlingUnauthorized = false;
  Future<void> _handleUnauthorized() async {
    if (_handlingUnauthorized || onUnauthorized == null) return;
    _handlingUnauthorized = true;
    try {
      await onUnauthorized!();
    } finally {
      _handlingUnauthorized = false;
    }
  }
}
