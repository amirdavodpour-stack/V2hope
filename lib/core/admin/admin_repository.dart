import '../marketplace/job.dart';
import '../marketplace/application.dart';
import '../network/api_client.dart';

class HopeAdminSummary {
  const HopeAdminSummary({required this.values});
  final Map<String, int> values;
  int operator [](String key) => values[key] ?? 0;
  factory HopeAdminSummary.fromMap(Map<String, dynamic> map) =>
      HopeAdminSummary(
        values: map.map((key, value) => MapEntry(
            key, value is num ? value.toInt() : int.tryParse('$value') ?? 0)),
      );
}

class HopeAdminUser {
  const HopeAdminUser(
      {required this.id,
      required this.displayName,
      required this.email,
      required this.role,
      required this.status});
  final String id;
  final String displayName;
  final String email;
  final String role;
  final String status;
  factory HopeAdminUser.fromMap(Map<String, dynamic> map) => HopeAdminUser(
        id: '${map['id'] ?? ''}',
        displayName: '${map['displayName'] ?? ''}',
        email: '${map['email'] ?? ''}',
        role: '${map['role'] ?? 'USER'}',
        status: '${map['status'] ?? 'ACTIVE'}',
      );
}

class HopeAdminAuditEvent {
  const HopeAdminAuditEvent(
      {required this.action,
      required this.actorName,
      required this.entityType,
      required this.createdAt});
  final String action;
  final String actorName;
  final String entityType;
  final String createdAt;
  factory HopeAdminAuditEvent.fromMap(Map<String, dynamic> map) =>
      HopeAdminAuditEvent(
        action: '${map['action'] ?? ''}',
        actorName: '${map['actorName'] ?? ''}',
        entityType: '${map['entityType'] ?? ''}',
        createdAt: '${map['createdAt'] ?? ''}',
      );
}

abstract interface class AdminRepository {
  Future<HopeAdminSummary> getSummary();
  Future<List<HopeJob>> listJobs();
  Future<List<HopeApplication>> listApplications();
  Future<List<HopeAdminUser>> listUsers();
  Future<List<HopeAdminAuditEvent>> listAudit();
  Future<void> shortlistApplication(String id);
  Future<void> forwardApplication(String id);
  Future<void> rejectApplication(String id);
  Future<void> moderateJob(String id, String status);
  Future<void> setUserStatus(String id, String status);
  Future<void> deleteJob(String id);
}

class ApiAdminRepository implements AdminRepository {
  const ApiAdminRepository(this._api);
  final ApiClient _api;

  @override
  Future<HopeAdminSummary> getSummary() async => HopeAdminSummary.fromMap(
        Map<String, dynamic>.from(
            await _api.request('GET', '/admin/summary', auth: true) as Map),
      );

  @override
  Future<List<HopeJob>> listJobs() => _list('/admin/jobs', HopeJob.fromMap);
  @override
  Future<List<HopeApplication>> listApplications() =>
      _list('/admin/applications', HopeApplication.fromMap);
  @override
  Future<List<HopeAdminUser>> listUsers() =>
      _list('/admin/users', HopeAdminUser.fromMap);
  @override
  Future<List<HopeAdminAuditEvent>> listAudit() =>
      _list('/admin/audit', HopeAdminAuditEvent.fromMap);
  @override
  Future<void> shortlistApplication(String id) =>
      _post('/admin/applications/$id/shortlist');
  @override
  Future<void> forwardApplication(String id) =>
      _post('/admin/applications/$id/select');
  @override
  Future<void> rejectApplication(String id) =>
      _post('/admin/applications/$id/reject');
  @override
  Future<void> moderateJob(String id, String status) =>
      _post('/admin/jobs/$id/moderate', body: {'status': status});
  @override
  Future<void> setUserStatus(String id, String status) =>
      _post('/admin/users/$id/status', body: {'status': status});
  @override
  Future<void> deleteJob(String id) =>
      _api.request('DELETE', '/admin/jobs/$id', auth: true).then((_) {});
  Future<void> _post(String path, {Map<String, dynamic>? body}) =>
      _api.request('POST', path, auth: true, body: body).then((_) {});

  Future<List<T>> _list<T>(
      String path, T Function(Map<String, dynamic>) parse) async {
    final raw = await _api.request('GET', path, auth: true);
    if (raw is! List) return <T>[];
    return raw
        .whereType<Map>()
        .map((item) => parse(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }
}
