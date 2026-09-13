import '../network/api_client.dart';
import 'notification.dart';

abstract interface class NotificationRepository {
  Future<HopeNotificationPage> listNotifications(
      {int limit = 50, int offset = 0});
  Future<HopeNotification> markRead(String id);
  Future<int> markAllRead();
  Future<HopeNotificationPreferences> getPreferences();
  Future<HopeNotificationPreferences> updatePreferences(Map<String, bool> patch);
}

class ApiNotificationRepository implements NotificationRepository {
  ApiNotificationRepository(this._api);
  final ApiClient _api;

  @override
  Future<HopeNotificationPage> listNotifications(
      {int limit = 50, int offset = 0}) async {
    final data = await _api.request(
      'GET',
      '/notifications?limit=$limit&offset=$offset',
      auth: true,
    );
    final map = Map<String, dynamic>.from(data as Map);
    final rawItems = map['items'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map>()
            .map((item) =>
                HopeNotification.fromMap(Map<String, dynamic>.from(item)))
            .toList()
        : const <HopeNotification>[];
    return HopeNotificationPage(
      items: items,
      unreadCount:
          map['unreadCount'] is num ? (map['unreadCount'] as num).toInt() : 0,
    );
  }

  @override
  Future<HopeNotification> markRead(String id) async {
    final data =
        await _api.request('POST', '/notifications/$id/read', auth: true);
    return HopeNotification.fromMap(Map<String, dynamic>.from(data as Map));
  }

  @override
  Future<HopeNotificationPreferences> getPreferences() async {
    final data = await _api.request('GET', '/notifications/preferences', auth: true);
    return HopeNotificationPreferences.fromMap(Map<String, dynamic>.from(data as Map));
  }

  @override
  Future<HopeNotificationPreferences> updatePreferences(Map<String, bool> patch) async {
    final data = await _api.request(
      'PUT',
      '/notifications/preferences',
      auth: true,
      body: Map<String, dynamic>.from(patch),
    );
    return HopeNotificationPreferences.fromMap(Map<String, dynamic>.from(data as Map));
  }

  @override
  Future<int> markAllRead() async {
    final data =
        await _api.request('POST', '/notifications/read-all', auth: true);
    final map = Map<String, dynamic>.from(data as Map);
    return map['updated'] is num ? (map['updated'] as num).toInt() : 0;
  }
}
