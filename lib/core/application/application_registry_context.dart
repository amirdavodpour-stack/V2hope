import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import 'application_registry.dart';
import '../admin/admin_repository.dart';
import '../auth/auth_repository.dart';
import '../marketplace/job_detail_repository.dart';
import '../marketplace/marketplace_repository.dart';
import '../notifications/notification_repository.dart';
import '../profile/profile_repository.dart';
import '../transactions/transaction_repository.dart';
import '../marketplace/saved_search_repository.dart';

/// Resolves the application registry from the widget tree.
///
/// The production app always provides a complete [ApplicationRegistry]. The
/// fallback keeps feature widgets embeddable in focused tests and legacy host
/// trees that provide the underlying repository directly, without making the
/// feature layer depend on repository types.
ApplicationRegistry applicationRegistryOf(BuildContext context) {
  final existing = context.read<ApplicationRegistry?>();
  if (existing != null) return existing;
  return ApplicationRegistry(
    marketplace: context.read<MarketplaceRepository?>(),
    jobDetail: context.read<JobDetailRepository?>(),
    transactions: context.read<TransactionRepository?>(),
    admin: context.read<AdminRepository?>(),
    auth: context.read<AuthRepository?>(),
    notifications: context.read<NotificationRepository?>(),
    profile: context.read<ProfileRepository?>(),
    savedSearches: context.read<SavedSearchRepository?>(),
  );
}
