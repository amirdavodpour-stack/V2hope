import 'application.dart';
import '../network/api_client.dart';

class HopeCandidate {
  const HopeCandidate(
      {required this.id,
      required this.skills,
      required this.resumeText,
      required this.status});
  final String id;
  final String skills;
  final String resumeText;
  final String status;

  factory HopeCandidate.fromMap(Map<String, dynamic> map) => HopeCandidate(
        id: '${map['id'] ?? ''}',
        skills: '${map['skills'] ?? ''}',
        resumeText: '${map['resumeText'] ?? ''}',
        status: '${map['status'] ?? 'FORWARDED'}'.toUpperCase(),
      );
}

abstract interface class JobDetailRepository {
  Future<List<HopeCandidate>> listCandidates(String jobId);
  Future<HopeApplication> applyToJob(String jobId,
      {required String resumeText, required String skills});
  Future<HopeOffer> submitOffer(String jobId,
      {required double price, required String message});
  Future<void> candidateAction(String jobId, String candidateId, String action);
}

class ApiJobDetailRepository implements JobDetailRepository {
  const ApiJobDetailRepository(this._api);
  final ApiClient _api;

  @override
  Future<List<HopeCandidate>> listCandidates(String jobId) async {
    final raw = await _api.request(
        'GET', '/jobs/${Uri.encodeComponent(jobId)}/candidates',
        auth: true);
    if (raw is! List) return const <HopeCandidate>[];
    return raw
        .whereType<Map>()
        .map((item) => HopeCandidate.fromMap(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<HopeApplication> applyToJob(String jobId,
      {required String resumeText, required String skills}) async {
    final raw = await _api.request('POST', '/applications', auth: true, body: {
      'jobId': jobId,
      'resumeText': resumeText,
      'skills': skills,
    });
    return HopeApplication.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  @override
  Future<HopeOffer> submitOffer(String jobId,
          {required double price, required String message}) async {
    final raw = await _api.request('POST', '/offers', auth: true, body: {
      'jobId': jobId,
      'price': price,
      'message': message,
    });
    return HopeOffer.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  @override
  Future<void> candidateAction(
          String jobId, String candidateId, String action) =>
      _api
          .request('POST',
              '/jobs/${Uri.encodeComponent(jobId)}/candidates/${Uri.encodeComponent(candidateId)}/$action',
              auth: true)
          .then((_) {});
}
