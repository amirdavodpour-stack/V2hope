import 'package:flutter/material.dart';

import '../theme/hope_v2_design.dart';
import '../theme/app_theme.dart';
import 'premium_components.dart';

class PremiumLifecycleStep {
  const PremiumLifecycleStep({
    required this.label,
    required this.icon,
    required this.active,
    this.complete = false,
    this.caption,
  });

  final String label;
  final IconData icon;
  final bool active;
  final bool complete;
  final String? caption;
}

class PremiumLifecycle extends StatelessWidget {
  const PremiumLifecycle({
    super.key,
    required this.steps,
    this.title,
    this.subtitle,
  });

  final List<PremiumLifecycleStep> steps;
  final String? title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();
    return PremiumPanel(
      semanticLabel: title,
      padding: const EdgeInsets.all(HopeV2Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: HopeV2Type.section(context)),
            if (subtitle != null) ...[
              const SizedBox(height: HopeV2Spacing.xs),
              Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
            ],
            const SizedBox(height: HopeV2Spacing.lg),
          ],
          ...List.generate(steps.length, (index) {
            final step = steps[index];
            final last = index == steps.length - 1;
            return _StepRow(step: step, last: last);
          }),
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.step, required this.last});

  final PremiumLifecycleStep step;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final highlighted = step.active || step.complete;
    final iconColor = highlighted ? AppColors.primary : AppColors.muted;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 38,
          child: Column(
            children: [
              Semantics(
                label: step.label,
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: highlighted
                        ? iconColor.withValues(alpha: .12)
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    border: Border.all(
                      color: highlighted
                          ? iconColor.withValues(alpha: .35)
                          : Theme.of(context).dividerColor,
                    ),
                  ),
                  child: Icon(
                    step.complete ? Icons.check_rounded : step.icon,
                    size: 18,
                    color: iconColor,
                  ),
                ),
              ),
              if (!last)
                Container(
                  width: 2,
                  height: 34,
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  color: Theme.of(context).dividerColor,
                ),
            ],
          ),
        ),
        const SizedBox(width: HopeV2Spacing.md),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: HopeV2Spacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: highlighted ? FontWeight.w800 : FontWeight.w600,
                      ),
                ),
                if (step.caption != null) ...[
                  const SizedBox(height: HopeV2Spacing.xs),
                  Text(step.caption!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
