import 'package:flutter/material.dart';

/// HOPE V2 design primitives.
///
/// This is intentionally token-first: screens should consume these values
/// instead of inventing per-page spacing, radii, or breakpoints.
class HopeV2Spacing {
  const HopeV2Spacing._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
  static const section = 40.0;
  static const display = 56.0;
}

class HopeV2Radii {
  const HopeV2Radii._();
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 22.0;
  static const xl = 28.0;
  static const hero = 32.0;
  static const pill = 999.0;
}

class HopeV2Breakpoints {
  const HopeV2Breakpoints._();
  static const compact = 600.0;
  static const medium = 900.0;
  static const expanded = 1200.0;

  static double width(BuildContext context) => MediaQuery.sizeOf(context).width;

  static bool isCompact(BuildContext context) => width(context) < compact;

  static bool isMedium(BuildContext context) =>
      width(context) >= compact && width(context) < medium;

  static bool isExpanded(BuildContext context) => width(context) >= medium;

  static bool isWide(BuildContext context) => width(context) >= expanded;
}

class HopeV2Motion {
  const HopeV2Motion._();
  static const fast = Duration(milliseconds: 160);
  static const standard = Duration(milliseconds: 240);
  static const emphasis = Duration(milliseconds: 360);
}

class HopeV2Touch {
  const HopeV2Touch._();
  static const minimum = 48.0;
}

class HopeV2Layer {
  const HopeV2Layer._();
  static const base = 0;
  static const navigation = 20;
  static const modal = 40;
  static const toast = 60;
}

class HopeV2Surfaces {
  const HopeV2Surfaces._();

  static Color page(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? const Color(0xFF090811) : const Color(0xFFF7F7FB);
  }

  static Color panel(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? const Color(0xFF15131D) : Colors.white;
  }

  static Color panelSoft(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? const Color(0xFF1C1926) : const Color(0xFFFCFBFF);
  }

  static Color border(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? Colors.white.withValues(alpha: .075) : const Color(0xFFE5E2EC);
  }
}

class HopeV2Shadows {
  const HopeV2Shadows._();

  static const card = [
    BoxShadow(
      color: Color(0x0D1B1638),
      blurRadius: 28,
      offset: Offset(0, 12),
    ),
  ];

  static const hero = [
    BoxShadow(
      color: Color(0x241C1738),
      blurRadius: 36,
      offset: Offset(0, 18),
    ),
  ];
}

class HopeV2Type {
  const HopeV2Type._();

  static TextStyle display(BuildContext context) => Theme.of(context)
      .textTheme
      .displaySmall!
      .copyWith(fontSize: 38, letterSpacing: -1.0, height: 1.02);

  static TextStyle hero(BuildContext context) => Theme.of(context)
      .textTheme
      .headlineMedium!
      .copyWith(fontSize: 31, letterSpacing: -.75, height: 1.05);

  static TextStyle section(BuildContext context) => Theme.of(context)
      .textTheme
      .titleLarge!
      .copyWith(fontSize: 20, letterSpacing: -.25);

  static TextStyle eyebrow(BuildContext context) => Theme.of(context)
      .textTheme
      .labelLarge!
      .copyWith(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: .8);
}
