import 'package:flutter/material.dart';

import '../../features/about/about_page.dart';
import '../../features/admin/admin_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/password_reset_page.dart';
import '../../features/auth/register_page.dart';
import '../../features/marketplace/create_job_page.dart';
import '../marketplace/job.dart';
import '../../features/marketplace/job_detail_page.dart';
import '../../features/notifications/notifications_page.dart';
import '../../features/transactions/transaction_page.dart';
import '../transactions/transaction_repository.dart';
import '../uploads/upload_queue.dart';

/// Central place where every in-app destination is turned into a [Route].
///
/// Features no longer construct `MaterialPageRoute` themselves; they ask
/// [HopeRoutes] for a route and hand it to `Navigator.push(...)`. This keeps
/// page construction and routing policy (transitions, animation, future
/// deep-link wiring) in one file, and lets the feature layer depend on
/// routing intent instead of concrete page wiring — the same reason
/// repositories already live behind abstractions in `lib/core`.
abstract final class HopeRoutes {
  /// Auth flows.
  static Route<void> login() => _page(const LoginPage());
  static Route<void> register() => _page(const RegisterPage());
  static Route<void> passwordReset() => _page(const PasswordResetPage());

  /// Account & content destinations.
  static Route<void> notifications() => _page(const NotificationsPage());
  static Route<void> admin() => _page(const AdminPage());
  static Route<void> about() => _page(const AboutHopePage());
  static Route<void> createJob() => _page(const CreateJobPage());

  /// Marketplace.
  static Route<JobDetailPage> jobDetail(HopeJob job) =>
      _page(JobDetailPage(job: job));
  static Route<TransactionPage> transaction({
    required TransactionRepository repository,
    required UploadQueue uploadQueue,
    required String jobId,
  }) =>
      _page(TransactionPage(
        repository: repository,
        uploadQueue: uploadQueue,
        jobId: jobId,
      ));

  static Route<T> _page<T>(Widget page) => MaterialPageRoute<T>(
        builder: (_) => page,
      );
}
