import '../admin/admin_repository.dart';
import '../auth/auth_repository.dart';
import '../notifications/notification_repository.dart';
import '../profile/profile_repository.dart';
import '../marketplace/job_detail_repository.dart';
import '../marketplace/marketplace_repository.dart';
import '../marketplace/job.dart';
import '../marketplace/saved_search_repository.dart';
import '../transactions/transaction_repository.dart';
import 'use_cases.dart';

class ApplicationRegistry {
  const ApplicationRegistry({
    this.marketplace,
    this.jobDetail,
    this.transactions,
    this.admin,
    this.auth,
    this.notifications,
    this.profile,
    SavedSearchRepository? savedSearches,
  }) : _savedSearches = savedSearches;

  final MarketplaceRepository? marketplace;
  final JobDetailRepository? jobDetail;
  final TransactionRepository? transactions;
  final AdminRepository? admin;
  final AuthRepository? auth;
  final NotificationRepository? notifications;
  final ProfileRepository? profile;
  final SavedSearchRepository? _savedSearches;

  T _require<T>(T? value, String name) =>
      value ?? (throw StateError('ApplicationRegistry dependency missing: $name'));

  MarketplaceRepository get marketplaceOrThrow => _require(marketplace, 'marketplace');
  JobDetailRepository get jobDetailOrThrow => _require(jobDetail, 'jobDetail');
  TransactionRepository get transactionsOrThrow => _require(transactions, 'transactions');
  AdminRepository get adminOrThrow => _require(admin, 'admin');
  AuthRepository get authOrThrow => _require(auth, 'auth');
  NotificationRepository get notificationsOrThrow => _require(notifications, 'notifications');
  ProfileRepository get profileOrThrow => _require(profile, 'profile');
  SavedSearchRepository get savedSearches => _require(_savedSearches, 'savedSearches');

  CreateOpportunityUseCase get createOpportunity => CreateOpportunityUseCase(marketplaceOrThrow);
  ListCategoriesUseCase get listCategories => ListCategoriesUseCase(marketplaceOrThrow);
  Future<HopeJob> getOpportunity(String id) => marketplaceOrThrow.getOpportunity(id);
  ListOpportunitiesUseCase get listOpportunities => ListOpportunitiesUseCase(marketplaceOrThrow);
  ApplyToJobUseCase get applyToJob => ApplyToJobUseCase(jobDetailOrThrow);
  SubmitOfferUseCase get submitOffer => SubmitOfferUseCase(jobDetailOrThrow);
  CandidateActionUseCase get candidateAction => CandidateActionUseCase(jobDetailOrThrow);
  ListMyJobsUseCase get listMyJobs => ListMyJobsUseCase(transactionsOrThrow);
  LoadTransactionUseCase get loadTransaction => LoadTransactionUseCase(transactionsOrThrow);
  TransactionCommandUseCase get transactionCommand => TransactionCommandUseCase(transactionsOrThrow);
  AdminCommandUseCase get adminCommands => AdminCommandUseCase(adminOrThrow);
  LoginUseCase get login => LoginUseCase(authOrThrow);
  RegisterUseCase get register => RegisterUseCase(authOrThrow);
  LogoutUseCase get logout => LogoutUseCase(authOrThrow);
  RequestPasswordResetUseCase get requestPasswordReset => RequestPasswordResetUseCase(authOrThrow);
  ListNotificationsUseCase get listNotifications => ListNotificationsUseCase(notificationsOrThrow);
  LoadNotificationPreferencesUseCase get loadNotificationPreferences => LoadNotificationPreferencesUseCase(notificationsOrThrow);
  UpdateNotificationPreferencesUseCase get updateNotificationPreferences => UpdateNotificationPreferencesUseCase(notificationsOrThrow);
  MarkNotificationReadUseCase get markNotificationRead => MarkNotificationReadUseCase(notificationsOrThrow);
  MarkAllNotificationsReadUseCase get markAllNotificationsRead => MarkAllNotificationsReadUseCase(notificationsOrThrow);
  LoadProviderProfileUseCase get loadProviderProfile => LoadProviderProfileUseCase(profileOrThrow);
  ListApplicationsUseCase get listApplications => ListApplicationsUseCase(profileOrThrow);
  WithdrawApplicationUseCase get withdrawApplication => WithdrawApplicationUseCase(profileOrThrow);
}
