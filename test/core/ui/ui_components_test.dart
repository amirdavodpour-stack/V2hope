import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:flutter_localizations/flutter_localizations.dart";
import "package:hope_mobile/core/ui/components.dart";
import "package:hope_mobile/l10n/generated/app_localizations.dart";
import "package:hope_mobile/core/theme/app_theme.dart";

MaterialApp _app(Widget home) => MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale("fa"),
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
  testWidgets("premium components render with accessible semantics",
      (tester) async {
    await tester.pumpWidget(
      _app(
        const Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                StatusPill("منتشر شده",
                    icon: Icons.check_circle_outline_rounded),
                HopeIconTile(Icons.work_rounded),
                SearchField(onChanged: _noop),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text("منتشر شده"), findsOneWidget);
    expect(find.byIcon(Icons.work_rounded), findsOneWidget);
    expect(find.bySemanticsLabel("جست‌وجو کن..."), findsOneWidget);
  });

  testWidgets("pressable scale exposes button semantics", (tester) async {
    var tapped = false;

    await tester.pumpWidget(
      _app(
        Scaffold(
          body: PressableScale(
            semanticLabel: "عمل آزمایشی",
            onTap: () => tapped = true,
            child: const Text("انجام"),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel("عمل آزمایشی"), findsOneWidget);
    await tester.tap(find.text("انجام"));
    await tester.pump();
    expect(tapped, isTrue);
  });
}

void _noop(String _) {}
