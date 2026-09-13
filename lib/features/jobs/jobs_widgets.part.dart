part of 'jobs_page.dart';

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job});
  final HopeJob job;

  @override
  Widget build(BuildContext context) {
    final isMission = job.isMission;
    final vis = job.visibility;
    final city = job.city ?? 'آنلاین';
    final title = job.title.isEmpty
        ? HopeCopy.of(context).copy_untitled_d89410e
        : job.title;
    final amount = isMission
        ? '${job.budgetMin ?? '—'} – ${job.budgetMax ?? '—'}'
        : job.monthlySalary ?? job.budgetMin ?? '—';
    final primary = isMission ? AppColors.primary : secondaryAccent(context);
    final cardLabel =
        '${isMission ? HopeCopy.of(context).copy_mission_fb4c5e1 : HopeCopy.of(context).copy_job_ce2feba}. $title. $city. ${moneyLabel(context, amount)}';

    return PressableScale(
      onTap: () => Navigator.push(context, HopeRoutes.jobDetail(job)),
      semanticLabel: cardLabel,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(HopeV2Radii.xl),
          border: Border.all(color: HopeV2Surfaces.border(context)),
          boxShadow: Theme.of(context).brightness == Brightness.dark
              ? const []
              : HopeV2Shadows.card,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 128,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset('assets/images/hope_marketplace_hero.png', fit: BoxFit.cover),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: .08),
                          Colors.black.withValues(alpha: .68),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: PremiumTag(
                      label: isMission
                          ? HopeCopy.of(context).copy_mission_fb4c5e1
                          : HopeCopy.of(context).copy_job_ce2feba,
                      icon: isMission ? Icons.bolt_rounded : Icons.business_center_rounded,
                      color: primary,
                      inverse: true,
                    ),
                  ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: PremiumTag(
                      label: vis == 'SPECIALIZED'
                          ? HopeCopy.of(context).copy_specialized_5d1ca04
                          : HopeCopy.of(context).copy_public_21e97be,
                      icon: Icons.visibility_outlined,
                      inverse: true,
                    ),
                  ),
                  Positioned(
                    left: 16,
                    bottom: 13,
                    right: 16,
                    child: Text(
                      moneyLabel(context, amount),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(HopeV2Spacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      if (job.isRecommended) ...[
                        const SizedBox(width: HopeV2Spacing.sm),
                        PremiumTag(
                          icon: Icons.auto_awesome_rounded,
                          label: Localizations.localeOf(context).languageCode == 'fa'
                              ? 'پیشنهاد هوشمند'
                              : 'Smart match',
                          color: primary,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: HopeV2Spacing.sm),
                  Wrap(
                    spacing: HopeV2Spacing.sm,
                    runSpacing: HopeV2Spacing.sm,
                    children: [
                      PremiumTag(icon: Icons.location_on_outlined, label: city, color: secondaryAccent(context)),
                      if ((job.category ?? '').isNotEmpty)
                        PremiumTag(
                          icon: Icons.category_outlined,
                          // Prefixed rather than the bare category name: the
                          // filter bar's category chip already shows that
                          // exact localized string, and once a filter narrows
                          // the list to a single job, a bare-text tag here
                          // would render the same text a second time.
                          label: Localizations.localeOf(context).languageCode == 'fa'
                              ? 'دسته: ${job.category!}'
                              : 'Category: ${job.category!}',
                          color: AppColors.muted,
                        ),
                      if (job.distanceKm != null)
                        PremiumTag(icon: Icons.near_me_rounded, label: '${job.distanceKm} km', color: secondaryAccent(context)),
                    ],
                  ),
                  if (job.recommendationReasons.isNotEmpty) ...[
                    const SizedBox(height: HopeV2Spacing.md),
                    Text(
                      Localizations.localeOf(context).languageCode == 'fa'
                          ? 'دلیل پیشنهاد'
                          : 'Why this match',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: HopeV2Spacing.xs),
                    Wrap(
                      spacing: HopeV2Spacing.sm,
                      runSpacing: HopeV2Spacing.sm,
                      children: job.recommendationReasons.take(3).map((reason) => PremiumTag(
                        icon: Icons.check_circle_outline_rounded,
                        label: _reasonLabel(context, reason),
                        color: primary,
                      )).toList(),
                    ),
                  ],
                  const SizedBox(height: HopeV2Spacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          isMission
                              ? HopeCopy.of(context).copy_pay_4121159
                              : HopeCopy.of(context).copy_monthly_pay_d62519b,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      Icon(Icons.arrow_forward_rounded, size: 20, color: primary),
                    ],
                  ),
                  const SizedBox(height: HopeV2Spacing.sm),
                  if (job.applicationDeadline != null && !isMission)
                    PremiumTag(
                      icon: Icons.event_outlined,
                      label: '${HopeCopy.of(context).copy_deadline_ffa13f2}: ${job.applicationDeadline}',
                      color: AppColors.warning,
                    )
                  else
                    PremiumTag(
                      icon: Icons.schedule_rounded,
                      label: isMission
                          ? HopeCopy.of(context).copy_one_time_1d496d8
                          : HopeCopy.of(context).copy_part_full_time_4d952a9,
                      color: secondaryAccent(context),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _reasonLabel(BuildContext context, String reason) {
  final fa = Localizations.localeOf(context).languageCode == 'fa';
  const faLabels = {
    'SKILL_MATCH': 'مهارت مرتبط',
    'CATEGORY_MATCH': 'دسته‌بندی مرتبط',
    'VERY_NEAR': 'خیلی نزدیک',
    'NEARBY': 'نزدیک',
    'REMOTE': 'قابل انجام آنلاین',
    'WORK_MODE_MATCH': 'نوع همکاری مناسب',
    'SALARY_FIT': 'تناسب درآمد',
    'BEHAVIOR_MATCH': 'متناسب با ترجیحات',
    'GENERAL_MATCH': 'تناسب کلی',
  };
  const enLabels = {
    'SKILL_MATCH': 'Skill match',
    'CATEGORY_MATCH': 'Category match',
    'VERY_NEAR': 'Very near',
    'NEARBY': 'Nearby',
    'REMOTE': 'Remote',
    'WORK_MODE_MATCH': 'Work mode fit',
    'SALARY_FIT': 'Salary fit',
    'BEHAVIOR_MATCH': 'Preference fit',
    'GENERAL_MATCH': 'General fit',
  };
  return (fa ? faLabels[reason] : enLabels[reason]) ?? reason;
}
