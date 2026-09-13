import 'package:flutter/material.dart';
import '../theme/hope_v2_design.dart';
import 'components.dart';

/// Shared page shell. Every V2 flagship surface should use this instead of
/// inventing its own max-width, page padding, or bottom safe-area behavior.
class PremiumPageFrame extends StatelessWidget {
  const PremiumPageFrame({
    super.key,
    required this.child,
    this.maxWidth = 1180,
    this.padding = const EdgeInsets.fromLTRB(20, 20, 20, 96),
    this.safeBottom = true,
  });

  final Widget child;
  final double maxWidth;
  final EdgeInsets padding;
  final bool safeBottom;

  @override
  Widget build(BuildContext context) {
    final bottomInset = safeBottom ? MediaQuery.paddingOf(context).bottom : 0.0;
    return DecoratedBox(
      decoration: BoxDecoration(color: HopeV2Surfaces.page(context)),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Padding(
            padding: padding.copyWith(bottom: padding.bottom + bottomInset),
            child: child,
          ),
        ),
      ),
    );
  }
}

class PremiumHeader extends StatelessWidget {
  const PremiumHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < HopeV2Breakpoints.compact;
          final content = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow.toUpperCase(),
                style: HopeV2Type.eyebrow(context).copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(height: HopeV2Spacing.sm),
              Text(title, style: HopeV2Type.display(context)),
              if (subtitle != null) ...[
                const SizedBox(height: HopeV2Spacing.sm),
                Text(subtitle!, style: Theme.of(context).textTheme.bodyLarge),
              ],
            ],
          );

          if (trailing == null) return content;
          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                content,
                const SizedBox(height: HopeV2Spacing.lg),
                trailing!,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: content),
              const SizedBox(width: HopeV2Spacing.lg),
              trailing!,
            ],
          );
        },
      );
}

class PremiumPanel extends StatelessWidget {
  const PremiumPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(HopeV2Spacing.xl),
    this.radius = HopeV2Radii.lg,
    this.highlight = false,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final bool highlight;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final panel = Container(
      decoration: BoxDecoration(
        color: HopeV2Surfaces.panel(context),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: highlight
              ? Theme.of(context).colorScheme.primary.withValues(alpha: .18)
              : HopeV2Surfaces.border(context),
        ),
        boxShadow: Theme.of(context).brightness == Brightness.dark
            ? const []
            : HopeV2Shadows.card,
      ),
      padding: padding,
      child: child,
    );
    return semanticLabel == null
        ? panel
        : Semantics(container: true, label: semanticLabel, child: panel);
  }
}

class PremiumHero extends StatelessWidget {
  const PremiumHero({
    super.key,
    required this.image,
    required this.eyebrow,
    required this.title,
    required this.message,
    this.action,
    this.height = 280,
    this.semanticLabel,
  });

  final String image;
  final String eyebrow;
  final String title;
  final String message;
  final Widget? action;
  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < HopeV2Breakpoints.compact;
    final heroHeight = compact ? height.clamp(300.0, 420.0).toDouble() : height;
    final horizontal = compact ? HopeV2Spacing.lg : HopeV2Spacing.xxl;

    return Semantics(
      container: true,
      label: semanticLabel ?? title,
      child: Container(
        height: heroHeight,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(HopeV2Radii.hero),
          boxShadow: HopeV2Shadows.hero,
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ExcludeSemantics(
              child: Image.asset(image, fit: BoxFit.cover),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                  colors: [
                    Colors.black.withValues(alpha: .08),
                    Colors.black.withValues(alpha: .30),
                    Colors.black.withValues(alpha: .82),
                  ],
                ),
              ),
            ),
            Positioned(
              right: -52,
              top: -62,
              child: ExcludeSemantics(
                child: Container(
                  width: 210,
                  height: 210,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: .10)),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(horizontal),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 600),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        eyebrow.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white70,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: .9,
                        ),
                      ),
                      const SizedBox(height: HopeV2Spacing.sm),
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 31,
                          height: 1.03,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -.9,
                        ),
                      ),
                      const SizedBox(height: HopeV2Spacing.sm),
                      Text(
                        message,
                        style: const TextStyle(color: Colors.white70, height: 1.48),
                      ),
                      if (action != null) ...[
                        const SizedBox(height: HopeV2Spacing.lg),
                        ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: HopeV2Touch.minimum),
                          child: action!,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PremiumStatCard extends StatelessWidget {
  const PremiumStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accent,
    this.caption,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? accent;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? Theme.of(context).colorScheme.primary;
    return PremiumPanel(
      semanticLabel: '$label: $value',
      padding: const EdgeInsets.all(HopeV2Spacing.lg),
      child: Row(
        children: [
          ExcludeSemantics(
            child: HopeIconTile(icon, color: color, filled: true, size: 46),
          ),
          const SizedBox(width: HopeV2Spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 3),
                Text(value, style: Theme.of(context).textTheme.titleLarge),
                if (caption != null)
                  Text(caption!, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PremiumSectionHeader extends StatelessWidget {
  const PremiumSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
  });

  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < HopeV2Breakpoints.compact;
          final content = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: HopeV2Type.section(context)),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ],
          );
          if (action == null) return content;
          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                content,
                const SizedBox(height: HopeV2Spacing.sm),
                action!,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: content),
              const SizedBox(width: HopeV2Spacing.lg),
              action!,
            ],
          );
        },
      );
}

class PremiumTag extends StatelessWidget {
  const PremiumTag({
    super.key,
    required this.label,
    this.icon,
    this.color,
    this.inverse = false,
  });

  final String label;
  final IconData? icon;
  final Color? color;
  final bool inverse;

  @override
  Widget build(BuildContext context) {
    final base = color ?? Theme.of(context).colorScheme.primary;
    final foreground = inverse ? Colors.white : base;
    final background = inverse
        ? Colors.white.withValues(alpha: .12)
        : base.withValues(alpha: .10);
    return Semantics(
      label: label,
      container: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: 32),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(HopeV2Radii.pill),
          border: Border.all(
            color: inverse ? Colors.white24 : base.withValues(alpha: .08),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              ExcludeSemantics(child: Icon(icon, size: 14, color: foreground)),
              const SizedBox(width: 5),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: foreground,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PremiumSearchBar extends StatelessWidget {
  const PremiumSearchBar({
    super.key,
    required this.hint,
    required this.onChanged,
    this.onFilter,
  });

  final String hint;
  final ValueChanged<String> onChanged;
  final VoidCallback? onFilter;

  @override
  Widget build(BuildContext context) => Semantics(
        textField: true,
        label: hint,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: HopeV2Touch.minimum),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(HopeV2Radii.lg),
              boxShadow: Theme.of(context).brightness == Brightness.dark
                  ? const []
                  : const [
                      BoxShadow(
                        color: Color(0x081B1638),
                        blurRadius: 18,
                        offset: Offset(0, 8),
                      ),
                    ],
            ),
            child: SearchField(
              onChanged: onChanged,
              onFilter: onFilter,
              hint: hint,
            ),
          ),
        ),
      );
}
