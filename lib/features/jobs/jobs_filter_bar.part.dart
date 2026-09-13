part of 'jobs_page.dart';

class _JobsFilterHeader extends StatelessWidget {
  const _JobsFilterHeader({
    required this.kind,
    required this.visibility,
    required this.categoryError,
    required this.cityLabel,
    required this.categoryLabel,
    required this.resultCount,
    required this.onQueryChanged,
    required this.onKindChanged,
    required this.onVisibilityChanged,
    required this.onRetryCategories,
    required this.onPickCity,
    required this.onPickCategory,
    required this.savedSearchCount,
    required this.onSaveSearch,
    required this.onOpenSavedSearches,
  });

  final String kind;
  final String visibility;
  final String? categoryError;
  final String cityLabel;
  final String categoryLabel;
  final int resultCount;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<String> onKindChanged;
  final ValueChanged<String> onVisibilityChanged;
  final VoidCallback onRetryCategories;
  final VoidCallback onPickCity;
  final VoidCallback onPickCategory;
  final int savedSearchCount;
  final VoidCallback onSaveSearch;
  final VoidCallback onOpenSavedSearches;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PremiumSectionHeader(
          title: HopeCopy.of(context).copy_explore_115e9fd,
          subtitle: HopeCopy.of(context)
              .copy_see_missions_and_jobs_together_then_narrow_7e573a3,
          action: const HopeIconTile(
            Icons.explore_rounded,
            size: 52,
            filled: true,
          ),
        ),
        const SizedBox(height: HopeV2Spacing.lg),
        PremiumPanel(
          padding: const EdgeInsets.all(HopeV2Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PremiumSearchBar(
                onChanged: onQueryChanged,
                hint: HopeCopy.of(context).copy_title_city_or_skill_bccb024,
              ),
              const SizedBox(height: HopeV2Spacing.sm),
              Wrap(
                spacing: HopeV2Spacing.sm,
                runSpacing: HopeV2Spacing.sm,
                children: [
                  OutlinedButton.icon(
                    onPressed: onSaveSearch,
                    icon: const Icon(Icons.bookmark_add_outlined, size: 18),
                    label: Text(Localizations.localeOf(context).languageCode == 'en' ? 'Save search' : 'ذخیره جست‌وجو'),
                  ),
                  if (savedSearchCount > 0)
                    OutlinedButton.icon(
                      onPressed: onOpenSavedSearches,
                      icon: const Icon(Icons.bookmarks_outlined, size: 18),
                      label: Text(Localizations.localeOf(context).languageCode == 'en' ? 'Saved ($savedSearchCount)' : 'ذخیره‌شده ($savedSearchCount)'),
                    ),
                ],
              ),
              const SizedBox(height: HopeV2Spacing.md),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _chip(
                      context,
                      HopeCopy.of(context).copy_all_ba7d5b6,
                      kind == 'ALL',
                      () => onKindChanged('ALL'),
                    ),
                    _chip(
                      context,
                      HopeCopy.of(context).copy_missions_a833d13,
                      kind == 'MISSION',
                      () => onKindChanged('MISSION'),
                      icon: Icons.bolt_rounded,
                    ),
                    _chip(
                      context,
                      HopeCopy.of(context).copy_jobs_ebf9a80,
                      kind == 'JOB',
                      () => onKindChanged('JOB'),
                      icon: Icons.business_center_rounded,
                    ),
                    const SizedBox(width: HopeV2Spacing.sm),
                    _chip(
                      context,
                      HopeCopy.of(context).copy_public_21e97be,
                      visibility == 'PUBLIC',
                      () => onVisibilityChanged('PUBLIC'),
                    ),
                    _chip(
                      context,
                      HopeCopy.of(context).copy_specialized_5d1ca04,
                      visibility == 'SPECIALIZED',
                      () => onVisibilityChanged('SPECIALIZED'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: HopeV2Spacing.sm),
              if (categoryError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: HopeV2Spacing.sm),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          categoryError!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      TextButton(
                        onPressed: onRetryCategories,
                        child: Text(HopeCopy.of(context).copy_retry_49f3eba),
                      ),
                    ],
                  ),
                ),
              Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.location_on_outlined, size: 17),
                    label: Text(cityLabel),
                    onPressed: onPickCity,
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.category_outlined, size: 17),
                    label: Text(categoryLabel),
                    onPressed: onPickCategory,
                  ),
                  Semantics(
                    liveRegion: true,
                    label:
                        '$resultCount ${HopeCopy.of(context).copy_results_2d120a3}',
                    child: StatusPill(
                      '$resultCount ${HopeCopy.of(context).copy_results_2d120a3}',
                      icon: Icons.grid_view_rounded,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _chip(
    BuildContext context,
    String text,
    bool selected,
    VoidCallback onTap, {
    IconData? icon,
  }) => Padding(
        padding: const EdgeInsets.only(right: 7),
        child: ChoiceChip(
          selected: selected,
          label: Text(text),
          avatar: icon == null ? null : Icon(icon, size: 17),
          onSelected: (_) => onTap(),
        ),
      );
}
