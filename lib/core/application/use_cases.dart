import '../admin/admin_repository.dart';
import '../auth/auth_repository.dart';
import '../marketplace/job_detail_repository.dart';
import '../marketplace/job.dart';
import '../marketplace/category.dart';
import '../marketplace/application.dart';
import '../notifications/notification.dart';
import '../marketplace/marketplace_repository.dart';
import '../notifications/notification_repository.dart';
import '../profile/profile_repository.dart';
import '../transactions/payment.dart';
import '../transactions/transaction_repository.dart';

/// Application/use-case boundary for the mobile client. Widgets should depend
/// on these small commands/queries rather than knowing HTTP paths or DTO shape.
class LoginUseCase {
  const LoginUseCase(this.repository);
  final AuthRepository repository;
  Future<AuthSession> call(String email, String password) => repository.login(email, password);
}


class RegisterUseCase {
  const RegisterUseCase(this.repository);
  final AuthRepository repository;
  Future<AuthSession> call(String email, String password, String displayName) =>
      repository.register(email, password, displayName);
}

class LogoutUseCase {
  const LogoutUseCase(this.repository);
  final AuthRepository repository;
  Future<void> call() => repository.logout();
}

class CreateOpportunityUseCase {
  const CreateOpportunityUseCase(this.repository);
  final MarketplaceRepository repository;
  Future<HopeJob> call(Map<String, dynamic> payload) => repository.createOpportunity(payload);
  Future<void> publish(String id) => repository.publishOpportunity(id);
}

class ListCategoriesUseCase {
  const ListCategoriesUseCase(this.repository);
  final MarketplaceRepository repository;
  Future<List<HopeCategory>> call() => repository.listCategories();
  Future<HopeJob> get(String id) => repository.getOpportunity(id);
}

class ListOpportunitiesUseCase {
  const ListOpportunitiesUseCase(this.repository);
  final MarketplaceRepository repository;
  Future<List<HopeJob>> call({
    String? city,
    bool personalizedRecommendations = false,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  }) =>
      repository.listOpportunities(
        city: city,
        personalizedRecommendations: personalizedRecommendations,
        latitude: latitude,
        longitude: longitude,
        search: search,
        kind: kind,
        visibility: visibility,
        categoryId: categoryId,
      );
}

class RequestPasswordResetUseCase {
  const RequestPasswordResetUseCase(this.repository);
  final AuthRepository repository;
  Future<void> call(String email) => repository.requestPasswordReset(email);
}

class ApplyToJobUseCase {
  const ApplyToJobUseCase(this.repository);
  final JobDetailRepository repository;
  Future<HopeApplication> call(String jobId, {required String resumeText, required String skills}) =>
      repository.applyToJob(jobId, resumeText: resumeText, skills: skills);
}

class SubmitOfferUseCase {
  const SubmitOfferUseCase(this.repository);
  final JobDetailRepository repository;
  Future<HopeOffer> call(String jobId, {required double price, required String message}) =>
      repository.submitOffer(jobId, price: price, message: message);
}

class CandidateActionUseCase {
  const CandidateActionUseCase(this.repository);
  final JobDetailRepository repository;
  Future<void> call(String jobId, String candidateId, String action) =>
      repository.candidateAction(jobId, candidateId, action);
}

class ListMyJobsUseCase {
  const ListMyJobsUseCase(this.repository);
  final TransactionRepository repository;
  Future<List<HopeJob>> call() => repository.listMyJobs();
}

class LoadTransactionUseCase {
  const LoadTransactionUseCase(this.repository);
  final TransactionRepository repository;
  Future<HopePayment?> call(String jobId) => repository.getPayment(jobId);
}

class TransactionCommandUseCase {
  const TransactionCommandUseCase(this.repository);
  final TransactionRepository repository;
  Future<HopePayment> call(String jobId, String operation, {String? idempotencyKey}) {
    switch (operation) {
      case 'fund':
        return repository.fundPayment(jobId, idempotencyKey: idempotencyKey);
      case 'refund':
        return repository.refundPayment(jobId);
      case 'release':
        return repository.releasePayment(jobId);
      default:
        throw StateError('Unsupported transaction operation: $operation');
    }
  }
}

class ListNotificationsUseCase {
  const ListNotificationsUseCase(this.repository);
  final NotificationRepository repository;
  Future<HopeNotificationPage> call({int limit = 50, int offset = 0}) =>
      repository.listNotifications(limit: limit, offset: offset);
}

class LoadNotificationPreferencesUseCase {
  const LoadNotificationPreferencesUseCase(this.repository);
  final NotificationRepository repository;
  Future<HopeNotificationPreferences> call() => repository.getPreferences();
}

class UpdateNotificationPreferencesUseCase {
  const UpdateNotificationPreferencesUseCase(this.repository);
  final NotificationRepository repository;
  Future<HopeNotificationPreferences> call(Map<String, bool> patch) =>
      repository.updatePreferences(patch);
}

class MarkNotificationReadUseCase {
  const MarkNotificationReadUseCase(this.repository);
  final NotificationRepository repository;
  Future<HopeNotification> call(String id) => repository.markRead(id);
}

class MarkAllNotificationsReadUseCase {
  const MarkAllNotificationsReadUseCase(this.repository);
  final NotificationRepository repository;
  Future<int> call() => repository.markAllRead();
}

class LoadProviderProfileUseCase {
  const LoadProviderProfileUseCase(this.repository);
  final ProfileRepository repository;
  Future<HopeProviderProfile> call() => repository.getProviderProfile();
}

class ListApplicationsUseCase {
  const ListApplicationsUseCase(this.repository);
  final ProfileRepository repository;
  Future<List<HopeApplication>> call() => repository.listApplications();
}

class WithdrawApplicationUseCase {
  const WithdrawApplicationUseCase(this.repository);
  final ProfileRepository repository;
  Future<HopeApplication> call(String applicationId) =>
      repository.withdrawApplication(applicationId);
}

class AdminCommandUseCase {
  const AdminCommandUseCase(this.repository);
  final AdminRepository repository;
  Future<void> shortlist(String id) => repository.shortlistApplication(id);
  Future<void> forward(String id) => repository.forwardApplication(id);
  Future<void> reject(String id) => repository.rejectApplication(id);
  Future<void> moderateJob(String id, String status) => repository.moderateJob(id, status);
  Future<void> setUserStatus(String id, String status) => repository.setUserStatus(id, status);
  Future<void> deleteJob(String id) => repository.deleteJob(id);
}
