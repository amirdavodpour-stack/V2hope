import 'dart:async';

import '../network/api_client.dart';
import 'push_token_provider.dart';

/// Coordinates server-side notification devices while keeping the native
/// push provider behind an injectable platform boundary.
class NotificationService {
  NotificationService(this.api, {this.pushProvider});

  final ApiClient api;
  final PushTokenProvider? pushProvider;
  final StreamController<String> _events = StreamController.broadcast();

  Stream<String> get events => _events.stream;

  Future<void> initialize({String platform = 'ANDROID'}) async {
    final provider = pushProvider;
    if (provider == null) return;
    final token = (await provider.getToken())?.trim();
    if (token == null || token.isEmpty) return;
    await registerPushToken(platform: platform, token: token);
  }

  Future<Map<String, dynamic>> registerPushToken({
    required String platform,
    required String token,
  }) async {
    final data = await api.request(
      'POST',
      '/notifications/devices',
      auth: true,
      body: {'platform': platform, 'token': token},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<Map<String, dynamic>>> listDevices() async {
    final data = await api.request('GET', '/notifications/devices', auth: true);
    final items = data is Map ? data['items'] : data;
    return (items is List)
        ? items
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList()
        : const [];
  }

  Future<void> unregisterDevice(String deviceId) async {
    await api.request('DELETE', '/notifications/devices/$deviceId', auth: true);
  }

  void publishLocal(String event) => _events.add(event);

  Future<void> dispose() => _events.close();
}
