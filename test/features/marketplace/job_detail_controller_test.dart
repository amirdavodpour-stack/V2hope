import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/marketplace/job_detail_repository.dart';
import 'package:hope_mobile/features/marketplace/job_detail_controller.dart';

class _Repo implements JobDetailRepository {
  int applyCalls = 0;
  int offerCalls = 0;
  int actionCalls = 0;
  Object? applyError;
  String? lastResume;
  String? lastSkills;
  double? lastPrice;
  String? lastMessage;
  String? lastCandidateId;
  String? lastAction;

  @override
  Future<List<HopeCandidate>> listCandidates(String jobId) async => const [];

  @override
  Future<HopeApplication> applyToJob(String jobId,
      {required String resumeText, required String skills}) async {
    applyCalls += 1;
    lastResume = resumeText;
    lastSkills = skills;
    final err = applyError;
    if (err != null) throw err;
    return HopeApplication(
        id: 'a1',
        jobId: jobId,
        jobTitle: '',
        jobCity: null,
        jobKind: 'JOB',
        resumeText: resumeText,
        skills: skills,
        status: 'PENDING',
        createdAt: null,
        updatedAt: null);
  }

  @override
  Future<HopeOffer> submitOffer(String jobId,
      {required double price, required String message}) async {
    offerCalls += 1;
    lastPrice = price;
    lastMessage = message;
    return HopeOffer.fromMap({'id': 'o1', 'jobId': jobId, 'providerId': 'u1', 'price': price, 'message': message, 'status': 'PENDING'});
  }

  @override
  Future<void> candidateAction(
      String jobId, String candidateId, String action) async {
    actionCalls += 1;
    lastCandidateId = candidateId;
    lastAction = action;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

HopeJob _job({required String kind, String? ownerId}) => HopeJob.fromMap({
      'id': 'j1',
      'title': 'پروژه تست',
      'description': 'شرح',
      'status': 'OPEN',
      'kind': kind,
      'visibility': 'PUBLIC',
      if (ownerId != null) 'ownerId': ownerId,
    });

void main() {
  test('candidatesFuture is null for missions and for jobs without an owner', () {
    final mission = _job(kind: 'MISSION', ownerId: 'u1');
    final ownerless = _job(kind: 'JOB');
    final controller = JobDetailController(
        repository: _Repo(), job: _job(kind: 'JOB', ownerId: 'u1'));
    expect(JobDetailController(repository: _Repo(), job: mission).candidatesFuture,
        isNull);
    expect(JobDetailController(repository: _Repo(), job: ownerless).candidatesFuture,
        isNull);
    expect(controller.candidatesFuture, isNotNull);
  });

  test('apply forwards resume text and skills to the repository', () async {
    final repo = _Repo();
    final controller =
        JobDetailController(repository: repo, job: _job(kind: 'JOB', ownerId: 'u1'));
    await controller.apply(resumeText: 'رزومه کامل', skills: 'flutter, dart');
    expect(repo.applyCalls, 1);
    expect(repo.lastResume, 'رزومه کامل');
    expect(repo.lastSkills, 'flutter, dart');
  });

  test('apply propagates repository failure to the caller (no silent swallow)',
      () async {
    final repo = _Repo()..applyError = StateError('network down');
    final controller =
        JobDetailController(repository: repo, job: _job(kind: 'JOB', ownerId: 'u1'));
    await expectLater(
        controller.apply(resumeText: 'x' * 12, skills: 'dart'),
        throwsStateError);
  });

  test('sendOffer forwards price and message to the repository', () async {
    final repo = _Repo();
    final controller = JobDetailController(
        repository: repo, job: _job(kind: 'MISSION', ownerId: 'u1'));
    await controller.sendOffer(price: 125000, message: 'پیشنهاد من');
    expect(repo.offerCalls, 1);
    expect(repo.lastPrice, 125000);
    expect(repo.lastMessage, 'پیشنهاد من');
  });

  test('candidateAction forwards candidate id and action verb', () async {
    final repo = _Repo();
    final controller = JobDetailController(
        repository: repo, job: _job(kind: 'JOB', ownerId: 'u1'));
    await controller.candidateAction('c9', 'SHORTLIST');
    expect(repo.actionCalls, 1);
    expect(repo.lastCandidateId, 'c9');
    expect(repo.lastAction, 'SHORTLIST');
  });
}
