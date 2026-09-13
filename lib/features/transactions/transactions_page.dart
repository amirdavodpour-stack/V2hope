import 'package:flutter/material.dart';
import '../../core/ui/hope_l10n.dart';
import 'package:provider/provider.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/transactions/payment.dart';
import '../../core/marketplace/job.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/components.dart';
import '../../core/theme/app_theme.dart';
import '../../core/router/app_routes.dart';

import '../../core/ui/premium_components.dart';
import '../../core/ui/premium_lifecycle.dart';
import '../../core/ui/premium_payment_summary.dart';

class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key, required this.repository});
  final TransactionRepository repository;
  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  Future<List<HopeJob>>? future;
  String? loadedUserId;
  final Map<String, Future<HopePayment?>> _paymentFutures =
      <String, Future<HopePayment?>>{};
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = context.read<AuthController>().user?['id']?.toString();
    if (id != loadedUserId) {
      loadedUserId = id;
      future = id == null ? null : widget.repository.listMyJobs();
      _paymentFutures.clear();
    }
  }

  Future<void> reload() async {
    if (!mounted) return;
    final next = widget.repository.listMyJobs();
    _paymentFutures.clear();
    setState(() => future = next);
    await next.catchError((_) => const <HopeJob>[]);
  }

  Future<HopePayment?> _tryGetPayment(String jobId) {
    return _paymentFutures.putIfAbsent(jobId, () async {
      try {
        return await widget.repository.getPayment(jobId);
      } catch (_) {
        // Payment details are supplementary to the activity list. A missing,
        // unavailable, or not-yet-created payment must never make the whole
        // authenticated transactions page fail to render.
        return null;
      }
    });
  }

  List<PremiumLifecycleStep> _stepsForStatus(String rawStatus) {
    final status = rawStatus.toUpperCase();
    const order = <String>['PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
    var index = order.indexOf(status);
    if (index < 0 && {'RELEASED', 'SETTLED'}.contains(status)) index = order.length - 1;
    if (index < 0) index = 0;
    const labels = <String>['منتشر شده', 'تخصیص داده شده', 'در حال انجام', 'تحویل شده', 'تکمیل شده'];
    const icons = <IconData>[Icons.campaign_outlined, Icons.assignment_ind_outlined, Icons.play_circle_outline_rounded, Icons.upload_file_outlined, Icons.check_circle_outline_rounded];
    return List.generate(order.length, (i) => PremiumLifecycleStep(
      label: labels[i],
      icon: icons[i],
      active: i == index,
      complete: i < index,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (auth.isGuest) {
      return Center(
          child: EmptyState(
              icon: Icons.lock_outline_rounded,
              title: HopeCopy.of(context).copy_your_activity_is_private_1363766,
              message: HopeCopy.of(context)
                  .copy_sign_in_to_view_your_projects_and_payments_32a2bc2,
              action: FilledButton.icon(
                  onPressed: () => Navigator.push(context, HopeRoutes.login()),
                  icon: const Icon(Icons.login_rounded),
                  label: Text(HopeCopy.of(context).copy_log_in_b4c960b))));
    }
    if (future == null) return const Center(child: CircularProgressIndicator());
    return FutureBuilder<List<HopeJob>>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return RefreshIndicator(
                onRefresh: reload,
                child: ListView(children: [
                  const SizedBox(height: 220),
                  EmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: HopeCopy.of(context)
                          .copy_could_not_load_activity_335b923,
                      message: HopeCopy.of(context)
                          .copy_pull_down_to_try_again_c41d215)
                ]));
          }
          final items = snap.data ?? const <HopeJob>[];
          if (items.isEmpty) {
            return RefreshIndicator(
                onRefresh: reload,
                child: ListView(children: [
                  const SizedBox(height: 220),
                  EmptyState(
                      icon: Icons.auto_graph_rounded,
                      title: HopeCopy.of(context).copy_no_activity_yet_264ceb0,
                      message: HopeCopy.of(context)
                          .copy_your_projects_applications_and_payments_wi_bec5340)
                ]));
          }
          return RefreshIndicator(
              onRefresh: reload,
              child: PremiumPageFrame(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 48),
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    PremiumHeader(
                      eyebrow: HopeCopy.of(context).copy_activity_4b38716,
                      title: HopeCopy.of(context).copy_latest_activity_a05277b,
                      subtitle: HopeCopy.of(context)
                          .copy_projects_progress_and_payments_at_a_glance_a0178c8,
                      trailing: const HopeIconTile(
                        Icons.swap_horizontal_circle_rounded,
                        size: 50,
                        filled: true,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(children: [
                      Expanded(
                          child: MetricTile(
                              label: HopeCopy.of(context)
                                  .copy_total_projects_78ce548,
                              value: '${items.length}',
                              icon: Icons.work_history_rounded)),
                      const SizedBox(width: 10),
                      Expanded(
                          child: MetricTile(
                              label: HopeCopy.of(context).copy_status_b81f9c7,
                              value: HopeCopy.of(context).copy_active_5726b26,
                              icon: Icons.bolt_rounded,
                              color: secondaryAccent(context)))
                    ]),
                    const SizedBox(height: 20),
                    SectionTitle(
                        title:
                            HopeCopy.of(context).copy_latest_activity_a05277b,
                        subtitle: HopeCopy.of(context)
                            .copy_the_most_recent_project_updates_5e402d8),
                    const SizedBox(height: 12),
                    ...items.map((job) {
                      final status = job.status ?? '—';
                      final released = status == 'RELEASED' ||
                          status == 'COMPLETED' ||
                          status == 'SETTLED';
                      return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: PremiumPanel(
                            padding: const EdgeInsets.all(17),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    HopeIconTile(
                                      released
                                          ? Icons.check_rounded
                                          : Icons.hourglass_top_rounded,
                                      color: released
                                          ? AppColors.success
                                          : AppColors.primary,
                                      filled: true,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            job.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context).textTheme.titleMedium,
                                          ),
                                          const SizedBox(height: 5),
                                          Text(
                                            '${HopeCopy.of(context).copy_work_status_eb2d6f2}: ${job.status ?? '—'}',
                                            style: Theme.of(context).textTheme.bodyMedium,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 7),
                                    StatusPill(
                                      released
                                          ? HopeCopy.of(context).copy_completed_4ab501b
                                          : HopeCopy.of(context).copy_in_progress_ed61091,
                                      color: released ? AppColors.success : AppColors.primary,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                PremiumLifecycle(
                                  steps: _stepsForStatus(status),
                                  title: 'مسیر پروژه',
                                  subtitle: 'وضعیت کار را در یک نگاه دنبال کنید.',
                                ),
                                FutureBuilder<HopePayment?>(
                                  future: _tryGetPayment(job.id),
                                  builder: (context, paymentSnap) {
                                    if (paymentSnap.connectionState != ConnectionState.done ||
                                        paymentSnap.data == null) {
                                      return const SizedBox.shrink();
                                    }
                                    return PremiumPaymentSummary(payment: paymentSnap.data!);
                                  },
                                ),
                              ],
                            ),
                          ),
                        );
                    }),
                  ],
                ),
              ));
        });
  }
}
