import '../../core/marketplace/job.dart';
import '../../core/marketplace/application.dart';
import '../../core/marketplace/job_detail_repository.dart';
import '../../core/application/use_cases.dart';

class JobDetailController {
  JobDetailController({required this.repository, required this.job});

  final JobDetailRepository repository;
  final HopeJob job;
  late final ApplyToJobUseCase _applyUseCase = ApplyToJobUseCase(repository);
  late final SubmitOfferUseCase _offerUseCase = SubmitOfferUseCase(repository);
  late final CandidateActionUseCase _candidateActionUseCase = CandidateActionUseCase(repository);

  Future<List<HopeCandidate>>? get candidatesFuture =>
      job.isJob && job.ownerId != null
          ? repository.listCandidates(job.id)
          : null;

  Future<void> apply({required String resumeText, required String skills}) =>
      _applyUseCase(job.id, resumeText: resumeText, skills: skills);

  Future<HopeOffer> sendOffer({required double price, required String message}) =>
      _offerUseCase(job.id, price: price, message: message);

  Future<void> candidateAction(String candidateId, String action) =>
      _candidateActionUseCase(job.id, candidateId, action);
}
