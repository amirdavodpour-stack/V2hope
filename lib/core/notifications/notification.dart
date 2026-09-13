class HopeNotification {
  const HopeNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.readAt,
    this.data = const <String, dynamic>{},
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? createdAt;
  final String? readAt;
  final Map<String, dynamic> data;

  bool get isUnread => readAt == null;
  String? get jobId => data['jobId'] == null ? null : '${data['jobId']}';
  String? get paymentId => data['paymentId'] == null ? null : '${data['paymentId']}';
  bool get hasAction => jobId != null || paymentId != null;
  String get actionLabel {
    switch (type.toUpperCase()) {
      case 'PAYMENT_UPDATE': return 'مشاهده پرداخت';
      case 'JOB_APPLICATION_RECEIVED':
      case 'APPLICATION_SHORTLISTED':
      case 'APPLICATION_FORWARDED':
      case 'INTERVIEW_SCHEDULED':
      case 'OFFER_RECEIVED':
      case 'APPLICATION_ACCEPTED':
      case 'APPLICATION_REJECTED':
      case 'APPLICATION_WITHDRAWN': return 'مشاهده پروژه';
      default: return 'مشاهده جزئیات';
    }
  }


  factory HopeNotification.fromMap(Map<String, dynamic> map) =>
      HopeNotification(
        id: '${map['id'] ?? ''}',
        type: '${map['type'] ?? ''}',
        title: '${map['title'] ?? ''}',
        body: '${map['body'] ?? ''}',
        createdAt: map['createdAt'] == null ? null : '${map['createdAt']}',
        readAt: map['readAt'] == null ? null : '${map['readAt']}',
        data: map['data'] is Map ? Map<String, dynamic>.from(map['data'] as Map) : const <String, dynamic>{},
      );
}

class HopeNotificationPage {
  const HopeNotificationPage({required this.items, required this.unreadCount});
  final List<HopeNotification> items;
  final int unreadCount;
}


class HopeNotificationPreferences {
  const HopeNotificationPreferences({
    required this.inApp,
    required this.push,
    required this.email,
    required this.jobAlerts,
    required this.applicationUpdates,
    required this.paymentUpdates,
    required this.marketing,
  });

  final bool inApp;
  final bool push;
  final bool email;
  final bool jobAlerts;
  final bool applicationUpdates;
  final bool paymentUpdates;
  final bool marketing;

  factory HopeNotificationPreferences.fromMap(Map<String, dynamic> map) =>
      HopeNotificationPreferences(
        inApp: map['inApp'] != false,
        push: map['push'] != false,
        email: map['email'] != false,
        jobAlerts: map['jobAlerts'] != false,
        applicationUpdates: map['applicationUpdates'] != false,
        paymentUpdates: map['paymentUpdates'] != false,
        marketing: map['marketing'] == true,
      );
}
