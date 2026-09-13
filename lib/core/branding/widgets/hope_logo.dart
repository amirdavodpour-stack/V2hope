// Canonical HOPE logo widget.
//
// This is the ONE source of truth for the HOPE mark inside the app. Every
// screen that needs the logo should ask for a `HopeLogo` variant rather
// than reconstructing the shape or gradient by hand.
//
// The mark is drawn as vector paths (CustomPainter) rather than a raster
// image so it stays crisp at any size, costs nothing to decode, and works
// fully offline. The same path geometry is mirrored in
// assets/branding/hope_mark.svg as the canonical exportable vector source
// for marketing/platform-icon tooling outside the app.
import 'package:flutter/material.dart';

import '../hope_brand.dart';

enum _HopeLogoTone { adaptive, dark, light, mono }

/// The HOPE brand logo: fluid biomorphic "H" mark, optionally paired with
/// the HOPE wordmark.
///
/// Usage:
/// ```dart
/// HopeLogo()                 // full lockup, adapts to current theme
/// HopeLogo.icon(size: 40)    // symbol only (app bar, compact spaces)
/// HopeLogo.wordmark()        // wordmark only
/// HopeLogo.dark()            // forces the dark-background lockup
/// HopeLogo.light()           // forces the light-background lockup
/// HopeLogo.mono(color: ...)  // monochrome, silhouette-preserving
/// ```
class HopeLogo extends StatelessWidget {
  const HopeLogo({
    super.key,
    this.size = 44,
    this.showWordmark = true,
    this.subtitle,
  })  : _tone = _HopeLogoTone.adaptive,
        _monoColor = null;

  /// Symbol only — for app bars, nav rails, and other compact spaces.
  /// Per brand guidance, the primary app icon and constrained UI locations
  /// use the symbol alone; only show the full wordmark where space allows.
  const HopeLogo.icon({super.key, this.size = 44})
      : showWordmark = false,
        subtitle = null,
        _tone = _HopeLogoTone.adaptive,
        _monoColor = null;

  /// Wordmark only, no symbol.
  const HopeLogo.wordmark({super.key, this.size = 28})
      : showWordmark = true,
        subtitle = null,
        _tone = _HopeLogoTone.adaptive,
        _monoColor = null;

  /// Forces the dark-background lockup (full-color mark, light wordmark),
  /// regardless of the ambient theme. Use on brand moments with a fixed
  /// dark backdrop (splash, onboarding).
  const HopeLogo.dark({
    super.key,
    this.size = 44,
    this.showWordmark = true,
    this.subtitle,
  })  : _tone = _HopeLogoTone.dark,
        _monoColor = null;

  /// Forces the light-background lockup (full-color mark, dark wordmark).
  const HopeLogo.light({
    super.key,
    this.size = 44,
    this.showWordmark = true,
    this.subtitle,
  })  : _tone = _HopeLogoTone.light,
        _monoColor = null;

  /// Monochrome variant — preserves the exact silhouette without the
  /// gradient. For accessibility contexts, system UI, and badges.
  const HopeLogo.mono({
    super.key,
    this.size = 44,
    this.showWordmark = true,
    this.subtitle,
    Color? color,
  })  : _tone = _HopeLogoTone.mono,
        _monoColor = color;

  /// Overall symbol size (square). Wordmark/subtitle scale relative to it.
  final double size;

  /// Whether to show the "HOPE" wordmark next to the symbol.
  final bool showWordmark;

  /// Optional small line under the wordmark (e.g. "Jobs • Missions").
  final String? subtitle;

  final _HopeLogoTone _tone;
  final Color? _monoColor;

  bool _resolveIsDark(BuildContext context) {
    switch (_tone) {
      case _HopeLogoTone.dark:
        return true;
      case _HopeLogoTone.light:
        return false;
      case _HopeLogoTone.mono:
      case _HopeLogoTone.adaptive:
        return Theme.of(context).brightness == Brightness.dark;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = _resolveIsDark(context);
    final mono = _tone == _HopeLogoTone.mono;
    final monoColor = _monoColor ??
        (isDark ? HopeBrandColors.hopeMonoLight : HopeBrandColors.hopeMonoDark);

    final symbol = SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _HopeMarkPainter(mono: mono, monoColor: monoColor),
      ),
    );

    if (!showWordmark) return symbol;

    final wordmarkColor = mono
        ? monoColor
        : (isDark
            ? HopeBrandColors.hopeMonoLight
            : HopeBrandColors.hopeMonoDark);

    final wordmark = Text(
      'HOPE',
      style: TextStyle(
        fontSize: size * 0.5,
        fontWeight: FontWeight.w800,
        letterSpacing: size * 0.02,
        height: 1,
        color: wordmarkColor,
      ),
    );

    if (subtitle == null) {
      return Row(mainAxisSize: MainAxisSize.min, children: [
        symbol,
        SizedBox(width: size * 0.22),
        wordmark,
      ]);
    }

    return Row(mainAxisSize: MainAxisSize.min, children: [
      symbol,
      SizedBox(width: size * 0.22),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        wordmark,
        Text(
          subtitle!,
          style: TextStyle(
            fontSize: size * 0.16,
            letterSpacing: 0.25,
            color: wordmarkColor.withValues(alpha: 0.72),
          ),
        ),
      ]),
    ]);
  }
}

/// Draws the fluid, biomorphic HOPE "H" mark: two rounded vertical forms
/// connected by a flowing diagonal band — a continuous shape rather than a
/// geometric construction from straight lines, per the approved brand
/// direction. Geometry mirrors assets/branding/hope_mark.svg.
class _HopeMarkPainter extends CustomPainter {
  const _HopeMarkPainter({required this.mono, required this.monoColor});

  final bool mono;
  final Color monoColor;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = _buildMarkPath(w, h);

    final paint = Paint()..style = PaintingStyle.fill;
    if (mono) {
      paint.color = monoColor;
    } else {
      paint.shader = HopeBrandGradients.mark.createShader(
        Rect.fromLTWH(0, 0, w, h),
      );
    }
    canvas.drawPath(path, paint);
  }

  /// Builds the mark as a single continuous path, traced from the
  /// approved reference artwork (contour-extracted + Catmull-Rom smoothed),
  /// so the silhouette matches the approved brand direction exactly rather
  /// than an eyeballed approximation. Geometry mirrors
  /// assets/branding/hope_mark.svg.
  Path _buildMarkPath(double w, double h) {
    return Path()
      ..moveTo(w * 0.3070, h * 0.0257)
      ..cubicTo(w * 0.2858, h * 0.0333, w * 0.2637, h * 0.0441, w * 0.2437,
          h * 0.0579)
      ..cubicTo(w * 0.2237, h * 0.0718, w * 0.2058, h * 0.0829, w * 0.1869,
          h * 0.1085)
      ..cubicTo(w * 0.1681, h * 0.1342, w * 0.1482, h * 0.1691, w * 0.1306,
          h * 0.2120)
      ..cubicTo(w * 0.1129, h * 0.2549, w * 0.0956, h * 0.3072, w * 0.0811,
          h * 0.3660)
      ..cubicTo(w * 0.0666, h * 0.4248, w * 0.0519, h * 0.5053, w * 0.0438,
          h * 0.5647)
      ..cubicTo(w * 0.0357, h * 0.6241, w * 0.0339, h * 0.6791, w * 0.0324,
          h * 0.7224)
      ..cubicTo(w * 0.0310, h * 0.7657, w * 0.0340, h * 0.8004, w * 0.0349,
          h * 0.8247)
      ..cubicTo(w * 0.0358, h * 0.8490, w * 0.0376, h * 0.8558, w * 0.0377,
          h * 0.8684)
      ..cubicTo(w * 0.0378, h * 0.8809, w * 0.0345, h * 0.8897, w * 0.0357,
          h * 0.9003)
      ..cubicTo(w * 0.0368, h * 0.9108, w * 0.0370, h * 0.9212, w * 0.0446,
          h * 0.9314)
      ..cubicTo(w * 0.0522, h * 0.9416, w * 0.0652, h * 0.9543, w * 0.0815,
          h * 0.9615)
      ..cubicTo(w * 0.0978, h * 0.9687, w * 0.1209, h * 0.9741, w * 0.1423,
          h * 0.9747)
      ..cubicTo(w * 0.1638, h * 0.9752, w * 0.1909, h * 0.9714, w * 0.2101,
          h * 0.9648)
      ..cubicTo(w * 0.2292, h * 0.9582, w * 0.2458, h * 0.9472, w * 0.2571,
          h * 0.9351)
      ..cubicTo(w * 0.2684, h * 0.9230, w * 0.2737, h * 0.9082, w * 0.2778,
          h * 0.8922)
      ..cubicTo(w * 0.2818, h * 0.8762, w * 0.2781, h * 0.8594, w * 0.2814,
          h * 0.8390)
      ..cubicTo(w * 0.2847, h * 0.8186, w * 0.2892, h * 0.7921, w * 0.2976,
          h * 0.7697)
      ..cubicTo(w * 0.3061, h * 0.7473, w * 0.3179, h * 0.7245, w * 0.3321,
          h * 0.7044)
      ..cubicTo(w * 0.3464, h * 0.6843, w * 0.3669, h * 0.6632, w * 0.3832,
          h * 0.6491)
      ..cubicTo(w * 0.3995, h * 0.6349, w * 0.4157, h * 0.6267, w * 0.4298,
          h * 0.6194)
      ..cubicTo(w * 0.4440, h * 0.6120, w * 0.4558, h * 0.6071, w * 0.4680,
          h * 0.6051)
      ..cubicTo(w * 0.4801, h * 0.6030, w * 0.4907, h * 0.6007, w * 0.5028,
          h * 0.6073)
      ..cubicTo(w * 0.5149, h * 0.6139, w * 0.5278, h * 0.6271, w * 0.5406,
          h * 0.6447)
      ..cubicTo(w * 0.5533, h * 0.6622, w * 0.5691, h * 0.6854, w * 0.5795,
          h * 0.7125)
      ..cubicTo(w * 0.5898, h * 0.7396, w * 0.5973, h * 0.7797, w * 0.6026,
          h * 0.8075)
      ..cubicTo(w * 0.6079, h * 0.8352, w * 0.6086, h * 0.8586, w * 0.6115,
          h * 0.8790)
      ..cubicTo(w * 0.6144, h * 0.8993, w * 0.6136, h * 0.9169, w * 0.6200,
          h * 0.9296)
      ..cubicTo(w * 0.6265, h * 0.9422, w * 0.6358, h * 0.9484, w * 0.6500,
          h * 0.9549)
      ..cubicTo(w * 0.6643, h * 0.9614, w * 0.6853, h * 0.9680, w * 0.7056,
          h * 0.9685)
      ..cubicTo(w * 0.7259, h * 0.9690, w * 0.7507, h * 0.9661, w * 0.7717,
          h * 0.9578)
      ..cubicTo(w * 0.7926, h * 0.9496, w * 0.8143, h * 0.9356, w * 0.8313,
          h * 0.9190)
      ..cubicTo(w * 0.8483, h * 0.9023, w * 0.8603, h * 0.8858, w * 0.8735,
          h * 0.8581)
      ..cubicTo(w * 0.8867, h * 0.8303, w * 0.8990, h * 0.7956, w * 0.9104,
          h * 0.7525)
      ..cubicTo(w * 0.9217, h * 0.7093, w * 0.9323, h * 0.6568, w * 0.9416,
          h * 0.5992)
      ..cubicTo(w * 0.9509, h * 0.5416, w * 0.9635, h * 0.4647, w * 0.9663,
          h * 0.4070)
      ..cubicTo(w * 0.9692, h * 0.3494, w * 0.9663, h * 0.2932, w * 0.9586,
          h * 0.2534)
      ..cubicTo(w * 0.9510, h * 0.2135, w * 0.9376, h * 0.1843, w * 0.9205,
          h * 0.1680)
      ..cubicTo(w * 0.9034, h * 0.1516, w * 0.8769, h * 0.1529, w * 0.8560,
          h * 0.1555)
      ..cubicTo(w * 0.8352, h * 0.1580, w * 0.8143, h * 0.1695, w * 0.7956,
          h * 0.1834)
      ..cubicTo(w * 0.7769, h * 0.1972, w * 0.7595, h * 0.2174, w * 0.7437,
          h * 0.2384)
      ..cubicTo(w * 0.7279, h * 0.2593, w * 0.7169, h * 0.2864, w * 0.7007,
          h * 0.3091)
      ..cubicTo(w * 0.6846, h * 0.3319, w * 0.6684, h * 0.3569, w * 0.6468,
          h * 0.3748)
      ..cubicTo(w * 0.6252, h * 0.3927, w * 0.5983, h * 0.4085, w * 0.5714,
          h * 0.4166)
      ..cubicTo(w * 0.5444, h * 0.4246, w * 0.5112, h * 0.4265, w * 0.4850,
          h * 0.4232)
      ..cubicTo(w * 0.4588, h * 0.4198, w * 0.4299, h * 0.4088, w * 0.4144,
          h * 0.3964)
      ..cubicTo(w * 0.3990, h * 0.3841, w * 0.3917, h * 0.3661, w * 0.3921,
          h * 0.3491)
      ..cubicTo(w * 0.3925, h * 0.3321, w * 0.4045, h * 0.3121, w * 0.4169,
          h * 0.2945)
      ..cubicTo(w * 0.4292, h * 0.2769, w * 0.4509, h * 0.2604, w * 0.4663,
          h * 0.2435)
      ..cubicTo(w * 0.4818, h * 0.2266, w * 0.4991, h * 0.2099, w * 0.5093,
          h * 0.1929)
      ..cubicTo(w * 0.5196, h * 0.1758, w * 0.5262, h * 0.1585, w * 0.5280,
          h * 0.1412)
      ..cubicTo(w * 0.5298, h * 0.1238, w * 0.5273, h * 0.1048, w * 0.5203,
          h * 0.0887)
      ..cubicTo(w * 0.5132, h * 0.0727, w * 0.5001, h * 0.0568, w * 0.4858,
          h * 0.0451)
      ..cubicTo(w * 0.4715, h * 0.0334, w * 0.4538, h * 0.0242, w * 0.4347,
          h * 0.0187)
      ..cubicTo(w * 0.4156, h * 0.0132, w * 0.3923, h * 0.0109, w * 0.3710,
          h * 0.0121)
      ..cubicTo(w * 0.3498, h * 0.0133, w * 0.3282, h * 0.0180, w * 0.3070,
          h * 0.0257)
      ..close();
  }

  @override
  bool shouldRepaint(covariant _HopeMarkPainter oldDelegate) =>
      oldDelegate.mono != mono || oldDelegate.monoColor != monoColor;
}
