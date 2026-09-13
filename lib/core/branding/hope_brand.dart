// HOPE brand system — single source of truth for colors and gradient
// definitions used by the canonical logo (see widgets/hope_logo.dart).
//
// Do not scatter raw brand hex values elsewhere in the UI. Reference
// [HopeBrandColors] / [HopeBrandGradients] instead so the whole app stays
// visually consistent with the approved HOPE brand direction.
import 'package:flutter/material.dart';

/// Approved HOPE brand palette.
///
/// The logo gradient spectrum is intentionally: blue/cyan → violet/purple →
/// magenta/pink → warm orange. Keep the surrounding UI restrained — the
/// logo is the expressive element, the interface should not become a
/// generic rainbow.
class HopeBrandColors {
  const HopeBrandColors._();

  static const Color hopeBlue = Color(0xFF145CFF);
  static const Color hopeCyan = Color(0xFF10B5FE);
  static const Color hopePurple = Color(0xFF9B2BFF);
  static const Color hopeMagenta = Color(0xFFF30E9E);
  static const Color hopeOrange = Color(0xFFFF7A1A);
  static const Color hopeGold = Color(0xFFFFC61A);

  /// Deep, near-black background used behind the primary (dark) logo
  /// lockup, splash screen, and launcher icon background.
  static const Color hopeDeepBackground = Color(0xFF0A0714);

  /// Light surface used behind the light-background logo lockup.
  static const Color hopeSurface = Color(0xFFFFFFFF);

  /// Monochrome ink used for the mono logo variant on light backgrounds.
  static const Color hopeMonoDark = Color(0xFF141018);

  /// Monochrome used for the mono logo variant on dark backgrounds.
  static const Color hopeMonoLight = Color(0xFFFFFFFF);
}

/// Reusable gradients derived from the approved brand spectrum.
class HopeBrandGradients {
  const HopeBrandGradients._();

  /// Primary mark gradient: blue → purple → magenta → orange, applied
  /// top-left to bottom-right, matching the approved reference direction.
  static const LinearGradient mark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      HopeBrandColors.hopeBlue,
      HopeBrandColors.hopePurple,
      HopeBrandColors.hopeMagenta,
      HopeBrandColors.hopeOrange,
      HopeBrandColors.hopeGold,
    ],
    stops: [0.0, 0.35, 0.6, 0.8, 1.0],
  );

  /// Subtle background wash used behind large brand moments (splash,
  /// onboarding, auth) — never used behind dense UI/text content.
  static const LinearGradient ambientDark = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      HopeBrandColors.hopeDeepBackground,
      Color(0xFF120B22),
    ],
  );
}
