import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:flutter_localizations/flutter_localizations.dart";
import "package:hope_mobile/core/ui/copy.dart";
import "package:hope_mobile/core/ui/components.dart";
import "package:hope_mobile/l10n/generated/app_localizations.dart";
import "package:hope_mobile/core/theme/app_theme.dart";

MaterialApp _app({required Widget home, Locale locale = const Locale("fa")}) =>
    MaterialApp(
      theme: AppTheme.light(),
      locale: locale,
      supportedLocales: const [Locale("fa"), Locale("en")],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: home,
    );

void main() {
  testWidgets("copy helper switches between Persian and English",
      (tester) async {
    late BuildContext captured;

    await tester.pumpWidget(
      _app(
        locale: const Locale("en"),
        home: Builder(
          builder: (context) {
            captured = context;
            return const SizedBox();
          },
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(tx(captured, "سلام", "Hello"), "Hello");
  });

  testWidgets("interactive controls preserve minimum touch targets",
      (tester) async {
    await tester.pumpWidget(
      _app(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                IconButton(
                  tooltip: "Back",
                  onPressed: () {},
                  icon: const Icon(Icons.arrow_back),
                ),
                const SearchField(onChanged: _noop),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    final iconBox = tester.getSize(find.byType(IconButton));
    expect(iconBox.width, greaterThanOrEqualTo(48));
    expect(iconBox.height, greaterThanOrEqualTo(48));
    expect(find.bySemanticsLabel("جست‌وجو کن..."), findsOneWidget);
  });
}

void _noop(String _) {}
