// Backward-compatible wrapper around the canonical HOPE brand widget.
//
// `HopeMark` is kept as the public name used across existing screens
// (auth, home, profile, transactions, about) so no call sites needed to
// change. Its implementation now delegates entirely to `HopeLogo`, the
// single canonical brand source in lib/core/branding/.
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../branding/widgets/hope_logo.dart';

class HopeMark extends StatelessWidget {
  const HopeMark({super.key, this.size = 44, this.showText = true});
  final double size;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    return HopeLogo(
      size: size,
      showWordmark: showText,
      subtitle: showText ? 'Jobs • Missions' : null,
    );
  }
}

class SoftPill extends StatelessWidget {
  const SoftPill(
      {super.key,
      required this.icon,
      required this.label,
      this.color = AppColors.primary});
  final IconData icon;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w900, color: color))
        ]),
      );
}
