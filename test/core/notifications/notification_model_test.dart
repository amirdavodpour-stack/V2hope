import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/notifications/notification.dart';

void main() {
  group('HopeNotification.fromMap', () {
    test('missing string fields default to empty strings, not null', () {
      final notification = HopeNotification.fromMap(const {});
      expect(notification.id, '');
      expect(notification.type, '');
      expect(notification.title, '');
      expect(notification.body, '');
    });

    test('populated fields are stringified as given', () {
      final notification = HopeNotification.fromMap(const {
        'id': 'n1',
        'type': 'APPLICATION_UPDATE',
        'title': 'درخواست شما بررسی شد',
        'body': 'وضعیت درخواست شما تغییر کرد.',
        'createdAt': '2026-09-01T00:00:00Z',
        'readAt': null,
      });
      expect(notification.id, 'n1');
      expect(notification.type, 'APPLICATION_UPDATE');
      expect(notification.createdAt, '2026-09-01T00:00:00Z');
      expect(notification.readAt, isNull);
    });

    test('isUnread is true exactly when readAt is null', () {
      final unread = HopeNotification.fromMap(const {'id': 'n1'});
      expect(unread.isUnread, isTrue);

      final read = HopeNotification.fromMap(const {
        'id': 'n2',
        'readAt': '2026-09-02T00:00:00Z',
      });
      expect(read.isUnread, isFalse);
    });

    test('non-string id/type values are coerced via string interpolation', () {
      final notification = HopeNotification.fromMap(const {'id': 7});
      expect(notification.id, '7');
    });
  });

  group('HopeNotificationPage', () {
    test('carries items and unreadCount as given without recomputing them', () {
      final items = [
        HopeNotification.fromMap(const {'id': 'n1'}),
        HopeNotification.fromMap(const {
          'id': 'n2',
          'readAt': '2026-09-02T00:00:00Z',
        }),
      ];
      final page = HopeNotificationPage(items: items, unreadCount: 5);
      expect(page.items, hasLength(2));
      // Deliberately not derived from items.where((n) => n.isUnread).length —
      // the backend's unreadCount is the source of truth (e.g. it may count
      // items beyond the current page), so the page must not recompute it.
      expect(page.unreadCount, 5);
    });
  });
}
