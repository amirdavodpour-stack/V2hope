import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/marketplace/job.dart';
import '../../core/marketplace/job_detail_repository.dart';
import 'job_detail_controller.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/uploads/upload_queue.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/router/app_routes.dart';
import '../../core/ui/components.dart';
import '../../core/ui/copy.dart';

import '../../core/theme/app_theme.dart';
import '../../core/ui/hope_l10n.dart';

class JobDetailPage extends StatefulWidget {
  const JobDetailPage({
    super.key,
    required this.job,
  });
  final HopeJob job;

  @override
  State<JobDetailPage> createState() => _JobDetailPageState();
}

class _JobDetailPageState extends State<JobDetailPage> {
  bool loading = false;
  late final JobDetailController _controller;
  Future<List<HopeCandidate>>? _candidatesFuture;

  @override
  void initState() {
    super.initState();
    _controller = JobDetailController(
      repository: context.read<JobDetailRepository>(),
      job: widget.job,
    );
    _candidatesFuture = _controller.candidatesFuture;
  }

  Future<void> action() async {
    final auth = context.read<AuthController>();

    if (!auth.isAuthenticated) {
      await Navigator.push(context, HopeRoutes.login());

      if (!mounted || !auth.isAuthenticated) {
        return;
      }
    }

    final isJob = widget.job.isJob;

    if (isJob) {
      final resume = TextEditingController();
      final skills = TextEditingController();

      final values = await showModalBottomSheet<List<String>>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                HopeCopy.of(context).copy_apply_to_this_job_923b353,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                HopeCopy.of(context)
                    .copy_add_a_concise_resume_and_relevant_skills_298a4f1,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              TextField(
                controller: resume,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: HopeCopy.of(context).copy_resume_summary_a1cc787,
                  prefixIcon: const Icon(Icons.description_outlined),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: skills,
                decoration: InputDecoration(
                  labelText: HopeCopy.of(context).copy_skills_79566c4,
                  prefixIcon: const Icon(Icons.psychology_outlined),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  final resumeText = resume.text.trim();
                  final skillsText = skills.text.trim();
                  Navigator.pop(context, [resumeText, skillsText]);
                },
                child: Text(
                  HopeCopy.of(context).copy_submit_application_43b8707,
                ),
              ),
            ],
          ),
        ),
      );

      final submittedResume = resume.text.trim();
      final submittedSkills = skills.text.trim();
      resume.dispose();
      skills.dispose();

      if (values == null) {
        return;
      }

      if (submittedResume.length < 10) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(HopeCopy.of(context)
                  .copy_add_a_concise_resume_and_relevant_skills_298a4f1)));
        }
        return;
      }

      if (!mounted) return;
      setState(() => loading = true);

      try {
        await _controller.apply(
          resumeText: values.isNotEmpty ? values[0] : submittedResume,
          skills: values.length > 1 ? values[1] : submittedSkills,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                HopeCopy.of(context)
                    .copy_your_application_was_sent_for_admin_review_5d9c43a,
              ),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(apiErrorMessage(e,
                    fallback:
                        HopeCopy.of(context).copy_operation_failed_eb38c4c))),
          );
        }
      } finally {
        if (mounted) {
          setState(() => loading = false);
        }
      }

      return;
    }

    final price = TextEditingController(
      text: widget.job.budgetMin ?? '',
    );
    final message = TextEditingController();

    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          8,
          20,
          MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              HopeCopy.of(context).copy_offer_for_this_mission_f50b00a,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              HopeCopy.of(context)
                  .copy_send_your_price_and_a_short_message_to_the_3961669,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: price,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: HopeCopy.of(context).copy_offer_price_d8fc5f4,
                prefixIcon: const Icon(Icons.payments_outlined),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: message,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: HopeCopy.of(context).copy_message_c821412,
                alignLabelWithHint: true,
                prefixIcon: const Icon(Icons.chat_bubble_outline_rounded),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                [price.text, message.text],
              ),
              child: Text(HopeCopy.of(context).copy_send_offer_8aa1351),
            ),
          ],
        ),
      ),
    );

    final submittedPrice = result?.isNotEmpty == true ? result![0] : price.text;
    final submittedMessage =
        result != null && result.length > 1 ? result[1] : message.text;
    price.dispose();
    message.dispose();

    if (result == null) {
      return;
    }
    final offerPrice = double.tryParse(submittedPrice.trim());
    if (offerPrice == null || offerPrice <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(HopeCopy.of(context).copy_operation_failed_eb38c4c)));
      }
      return;
    }

    if (!mounted) return;
    setState(() => loading = true);

    try {
      await _controller.sendOffer(
        price: offerPrice,
        message: submittedMessage.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              HopeCopy.of(context).copy_your_offer_was_submitted_75e3409,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(apiErrorMessage(e,
                  fallback:
                      HopeCopy.of(context).copy_operation_failed_eb38c4c))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> _candidateAction(String candidateId, String action) async {
    try {
      await _controller.candidateAction(candidateId, action);
      if (mounted) {
        setState(() {
          _candidatesFuture = _controller.candidatesFuture;
        });
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(apiErrorMessage(error,
              fallback: HopeCopy.of(context).copy_operation_failed_eb38c4c))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final j = widget.job;
    final isJob = j.isJob;
    final visibility = j.visibility;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isJob
              ? HopeCopy.of(context).copy_job_details_e815855
              : HopeCopy.of(context).copy_mission_details_78d58d8,
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
          child: FilledButton.icon(
            onPressed: loading ? null : action,
            icon: Icon(
              isJob ? Icons.send_rounded : Icons.bolt_rounded,
            ),
            label: Text(
              loading
                  ? HopeCopy.of(context).copy_sending_c4b5575
                  : isJob
                      ? HopeCopy.of(context).copy_apply_for_this_job_3a75a03
                      : HopeCopy.of(context).copy_offer_for_mission_ced8d4c,
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 5, 20, 20),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: SizedBox(
              height: 175,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset(
                    'assets/images/hope_marketplace_hero.png',
                    fit: BoxFit.cover,
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: .65),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 16,
                    bottom: 16,
                    right: 16,
                    child: Text(
                      j.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusPill(
                isJob
                    ? HopeCopy.of(context).copy_job_ce2feba
                    : HopeCopy.of(context).copy_mission_fb4c5e1,
                color: isJob ? secondaryAccent(context) : AppColors.primary,
                icon:
                    isJob ? Icons.business_center_rounded : Icons.bolt_rounded,
              ),
              StatusPill(
                visibility == 'SPECIALIZED'
                    ? HopeCopy.of(context).copy_specialized_5d1ca04
                    : HopeCopy.of(context).copy_public_21e97be,
                color: visibility == 'SPECIALIZED'
                    ? AppColors.warning
                    : secondaryAccent(context),
                icon: Icons.visibility_outlined,
              ),
              if (j.city != null)
                StatusPill(
                  j.city!,
                  color: AppColors.muted,
                  icon: Icons.location_on_outlined,
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            j.description,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: MetricTile(
                  label: isJob
                      ? HopeCopy.of(context).copy_monthly_pay_d62519b
                      : HopeCopy.of(context).copy_mission_budget_923bb6e,
                  value: isJob
                      ? moneyLabel(
                          context,
                          j.monthlySalary ?? j.budgetMin ?? '—',
                        )
                      : moneyLabel(
                          context,
                          '${j.budgetMin ?? '—'} تا ${j.budgetMax ?? '—'}',
                        ),
                  icon: Icons.payments_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: MetricTile(
                  label: HopeCopy.of(context).copy_field_fcb7b26,
                  value: j.category ?? j.categoryId ?? '—',
                  icon: Icons.category_outlined,
                  color: secondaryAccent(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          HopeSurface(
            padding: const EdgeInsets.all(17),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  HopeCopy.of(context).copy_working_details_4ef3155,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 10),
                if (isJob) ...[
                  _line(
                    context,
                    Icons.schedule_rounded,
                    HopeCopy.of(context).copy_schedule_3af1939,
                    j.schedule == 'PART_TIME'
                        ? HopeCopy.of(context).copy_part_time_086787b
                        : HopeCopy.of(context).copy_full_time_1e4bd4e,
                  ),
                  _line(
                    context,
                    Icons.event_outlined,
                    HopeCopy.of(context).copy_application_deadline_0a6c25c,
                    j.applicationDeadline ?? '—',
                  ),
                ],
                if (!isJob)
                  _line(
                    context,
                    Icons.timelapse_rounded,
                    HopeCopy.of(context).copy_duration_cc42be6,
                    '${j.duration ?? '—'} ${HopeCopy.of(context).copy_hours_7408608}',
                  ),
                _line(
                  context,
                  Icons.fact_check_outlined,
                  HopeCopy.of(context).copy_acceptance_criteria_f213cb2,
                  j.acceptanceCriteria ?? '—',
                ),
              ],
            ),
          ),
          const SizedBox(height: 13),
          if (isJob &&
              context.read<AuthController>().user?['id'] == (j.ownerId ?? ''))
            FutureBuilder<List<HopeCandidate>>(
              future: _candidatesFuture,
              builder: (context, snapshot) {
                final list = snapshot.data ?? const <HopeCandidate>[];

                if (list.isEmpty) {
                  return const SizedBox.shrink();
                }

                return HopeSurface(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        HopeCopy.of(context).copy_forwarded_candidates_5de386c,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 10),
                      ...list.map<Widget>((candidate) {
                        final status = candidate.status;

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 9),
                          child: HopeSurface(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const HopeIconTile(
                                      Icons.person_search_rounded,
                                    ),
                                    const SizedBox(width: 9),
                                    Expanded(
                                      child: Text(
                                        HopeCopy.of(context)
                                            .copy_anonymous_candidate_ba01a0d,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall,
                                      ),
                                    ),
                                    Text(status),
                                  ],
                                ),
                                const SizedBox(height: 7),
                                Text(candidate.skills),
                                const SizedBox(height: 5),
                                Text(
                                  candidate.resumeText,
                                  maxLines: 4,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 7,
                                  children: [
                                    if (status == 'FORWARDED')
                                      OutlinedButton(
                                        onPressed: () => _candidateAction(
                                            candidate.id, 'interview'),
                                        child: Text(
                                          HopeCopy.of(context)
                                              .copy_interview_9734f37,
                                        ),
                                      ),
                                    if (status == 'INTERVIEW')
                                      OutlinedButton(
                                        onPressed: () => _candidateAction(
                                            candidate.id, 'offer'),
                                        child: Text(
                                          HopeCopy.of(context)
                                              .copy_offer_cc3327c,
                                        ),
                                      ),
                                    if (status == 'OFFERED')
                                      FilledButton(
                                        onPressed: () => _candidateAction(
                                            candidate.id, 'hire'),
                                        child: Text(
                                          HopeCopy.of(context)
                                              .copy_hire_36ed063,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: 13),
          if (isJob)
            HopeSurface(
              padding: const EdgeInsets.all(16),
              highlight: true,
              child: Text(
                HopeCopy.of(context)
                    .copy_job_applications_are_reviewed_by_an_admin__5098e17,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                HopeRoutes.transaction(
                  repository: context.read<TransactionRepository>(),
                  uploadQueue: context.read<UploadQueue>(),
                  jobId: j.id,
                ),
              ),
              icon: const Icon(Icons.receipt_long_rounded),
              label: Text(
                HopeCopy.of(context).copy_view_transaction_a91f1e6,
              ),
            ),
        ],
      ),
    );
  }

  Widget _line(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(
            icon,
            size: 19,
            color: AppColors.primary,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ],
      ),
    );
  }
}
