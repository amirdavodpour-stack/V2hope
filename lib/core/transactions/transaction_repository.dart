import '../marketplace/job.dart';
import '../network/api_client.dart';
import 'payment.dart';

abstract interface class TransactionRepository {
  Future<List<HopeJob>> listMyJobs();
  Future<HopePayment> getPayment(String jobId);
  Future<HopePayment> fundPayment(String jobId, {String? idempotencyKey});
  Future<HopePayment> refundPayment(String jobId);
  Future<HopePayment> releasePayment(String jobId);
  Future<HopeJob> startJob(String jobId);
  Future<HopeJob> deliverJob(String jobId);
  Future<HopeJob> acceptJob(String jobId);
  Future<void> submitEvidence(
    String jobId, {
    required String uri,
    required String notes,
    required String type,
  });
}

class ApiTransactionRepository implements TransactionRepository {
  const ApiTransactionRepository(this._api);
  final ApiClient _api;

  @override
  Future<List<HopeJob>> listMyJobs() async {
    final raw = await _api.request('GET', '/jobs/mine', auth: true);
    return _asList(raw)
        .map((item) => HopeJob.fromMap(item))
        .toList(growable: false);
  }

  @override
  Future<HopePayment> getPayment(String jobId) async {
    final raw = await _api.request('GET', '/payments/jobs/$jobId', auth: true);
    return HopePayment.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  @override
  Future<HopePayment> fundPayment(String jobId,
          {String? idempotencyKey}) async =>
      _paymentAction(
        'POST',
        '/payments/fund/$jobId',
        body:
            idempotencyKey == null ? null : {'idempotencyKey': idempotencyKey},
      );

  @override
  Future<HopePayment> refundPayment(String jobId) =>
      _paymentAction('POST', '/payments/refund/$jobId');

  @override
  Future<HopePayment> releasePayment(String jobId) =>
      _paymentAction('POST', '/payments/release/$jobId');

  @override
  Future<HopeJob> startJob(String jobId) => _jobAction('/jobs/$jobId/start');

  @override
  Future<HopeJob> deliverJob(String jobId) =>
      _jobAction('/jobs/$jobId/deliver');

  @override
  Future<HopeJob> acceptJob(String jobId) => _jobAction('/jobs/$jobId/accept');

  @override
  Future<void> submitEvidence(
    String jobId, {
    required String uri,
    required String notes,
    required String type,
  }) async {
    await _api.request('POST', '/jobs/$jobId/evidence', auth: true, body: {
      'uri': uri,
      'notes': notes,
      'type': type,
    });
  }

  Future<HopePayment> _paymentAction(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final raw = await _api.request(method, path, auth: true, body: body);
    return HopePayment.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  Future<HopeJob> _jobAction(String path) async {
    final raw = await _api.request('POST', path, auth: true);
    return HopeJob.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  static List<Map<String, dynamic>> _asList(dynamic raw) {
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    }
    return const <Map<String, dynamic>>[];
  }
}
