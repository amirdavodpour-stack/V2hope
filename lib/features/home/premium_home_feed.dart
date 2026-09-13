import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/settings/settings_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/hope_v2_design.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/hope_l10n.dart';
import '../../core/ui/premium_components.dart';
import '../../core/ui/components.dart';

class PremiumHomeFeed extends StatelessWidget {
  const PremiumHomeFeed({super.key, required this.onOpenExplore});

  final VoidCallback onOpenExplore;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final settings = context.watch<HopeSettingsController>();
    final name = auth.isGuest
        ? HopeCopy.of(context).copy_hope_friend_b997e02
        : '${auth.user?['displayName'] ?? HopeCopy.of(context).copy_hope_friend_b997e02}';

    return PremiumPageFrame(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        children: [
          Row(
            children: [
              const Expanded(child: HopeMark()),
              IconButton(
                onPressed: () => Scaffold.of(context).openDrawer(),
                icon: const Icon(Icons.menu_rounded),
                tooltip: HopeCopy.of(context).copy_menu_1f381a4,
              ),
            ],
          ),
          const SizedBox(height: HopeV2Spacing.section),
          AnimatedEntrance(
            child: Text(
              '${HopeCopy.of(context).copy_hello_fc7ef4a} $name 👋',
              style: HopeV2Type.display(context),
            ),
          ),
          const SizedBox(height: HopeV2Spacing.sm),
          Text(
            HopeCopy.of(context).copy_a_clearer_more_human_way_to_find_work_3553ab8,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: HopeV2Spacing.xl),
          PremiumHero(
            image: 'assets/images/hope_marketplace_hero.png',
            eyebrow: '${HopeCopy.of(context).copy_near_1df6db0} ${settings.city}',
            title: HopeCopy.of(context).copy_opportunities_may_already_be_nearby_585bbac,
            message: HopeCopy.of(context).copy_start_with_your_city_or_explore_any_other__05a1e84,
            action: FilledButton.icon(
              onPressed: onOpenExplore,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.ink,
                minimumSize: const Size(148, 52),
              ),
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(HopeCopy.of(context).copy_explore_a80d678),
            ),
          ),
          const SizedBox(height: HopeV2Spacing.xl),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= HopeV2Breakpoints.medium ? 3 : 1;
              final cards = [
                PremiumStatCard(
                  label: HopeCopy.of(context).copy_missions_a833d13,
                  value: HopeCopy.of(context).copy_defined_tasks_with_clear_pay_9120d5e,
                  icon: Icons.bolt_rounded,
                  accent: AppColors.primary,
                ),
                PremiumStatCard(
                  label: HopeCopy.of(context).copy_jobs_ebf9a80,
                  value: HopeCopy.of(context).copy_part_time_or_full_time_a007875,
                  icon: Icons.business_center_rounded,
                  accent: secondaryAccent(context),
                ),
                PremiumStatCard(
                  label: HopeCopy.of(context).copy_city_3d7dc3e,
                  value: settings.city,
                  icon: Icons.location_on_rounded,
                  accent: AppColors.warning,
                ),
              ];
              if (columns == 1) {
                return Column(
                  children: [for (final card in cards) ...[card, const SizedBox(height: HopeV2Spacing.md)]],
                );
              }
              return Row(children: [for (var i = 0; i < cards.length; i++) ...[
                Expanded(child: cards[i]),
                if (i != cards.length - 1) const SizedBox(width: HopeV2Spacing.md),
              ]]);
            },
          ),
          const SizedBox(height: HopeV2Spacing.section),
          PremiumSectionHeader(
            title: HopeCopy.of(context).copy_recommended_for_you_e56d06b,
            subtitle: HopeCopy.of(context).copy_based_on_your_city_and_preferences_79e2a31,
          ),
          const SizedBox(height: HopeV2Spacing.lg),
          PremiumPanel(
            highlight: true,
            child: Row(
              children: [
                HopeIconTile(Icons.near_me_rounded, size: 54, filled: true, color: secondaryAccent(context)),
                const SizedBox(width: HopeV2Spacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(settings.city, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(
                        HopeCopy.of(context).copy_location_personalization_is_on_you_can_cha_8dd12f4,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: HopeV2Spacing.section),
          PremiumPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(HopeCopy.of(context).copy_how_hope_works_bea7074, style: HopeV2Type.section(context)),
                const SizedBox(height: HopeV2Spacing.lg),
                _Step(number: '۱', title: HopeCopy.of(context).copy_choose_79a9d79, text: HopeCopy.of(context).copy_decide_whether_you_want_a_mission_or_a_job_3a6f9b5),
                _Step(number: '۲', title: HopeCopy.of(context).copy_explore_837e4eb, text: HopeCopy.of(context).copy_filter_by_city_field_and_opportunity_type_1d75340),
                _Step(number: '۳', title: HopeCopy.of(context).copy_apply_1b61105, text: HopeCopy.of(context).copy_apply_with_a_strong_professional_profile_13980b1),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.title, required this.text});
  final String number;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: .10),
                shape: BoxShape.circle,
              ),
              child: Text(number, style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)),
            ),
            const SizedBox(width: HopeV2Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(text, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      );
}
