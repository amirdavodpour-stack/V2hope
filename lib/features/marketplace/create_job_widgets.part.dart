part of 'create_job_page.dart';

class _TypeHero extends StatelessWidget {
  const _TypeHero({required this.kind, required this.onChanged});

  final String kind;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return HopeSurface(
      highlight: true,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            HopeCopy.of(context)
                .copy_first_choose_what_kind_of_opportunity_you__f035ca9,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _tile(
                  context,
                  'MISSION',
                  Icons.bolt_rounded,
                  HopeCopy.of(context).copy_mission_fb4c5e1,
                  HopeCopy.of(context)
                      .copy_a_defined_task_with_defined_pay_77b1068,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _tile(
                  context,
                  'JOB',
                  Icons.business_center_rounded,
                  HopeCopy.of(context).copy_job_ce2feba,
                  HopeCopy.of(context)
                      .copy_part_full_time_with_monthly_pay_abd5afd,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _tile(
    BuildContext context,
    String value,
    IconData icon,
    String title,
    String sub,
  ) {
    final selected = kind == value;

    return PressableScale(
      onTap: () => onChanged(value),
      semanticLabel: '$title. $sub',
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFF6C4DFF), Color(0xFF22B8A7)],
                )
              : null,
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: selected ? Colors.white : AppColors.primary,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: selected ? Colors.white : null,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              sub,
              style: TextStyle(
                fontSize: 11,
                height: 1.35,
                color: selected ? Colors.white70 : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VisibilityCard extends StatelessWidget {
  const _VisibilityCard({
    required this.icon,
    required this.title,
    required this.sub,
    required this.value,
    required this.selected,
    required this.onSelected,
  });

  final IconData icon;
  final String title;
  final String sub;
  final String value;
  final bool selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => onSelected(value),
      semanticLabel: '$title. $sub',
      child: HopeSurface(
        highlight: selected,
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            HopeIconTile(
              icon,
              filled: selected,
              size: 42,
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    sub,
                    style: Theme.of(context).textTheme.bodyMedium,
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
