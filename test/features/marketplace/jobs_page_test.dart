import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/category.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/marketplace/marketplace_repository.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/features/jobs/jobs_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Repo implements MarketplaceRepository {
  final calls = <String>[];

  /// All jobs this fake server "knows about", spread across a couple of
  /// cities plus one online job -- used so tests can tell apart "server
  /// filtered by city" from "server ignored the filter", the way a real
  /// backend with an exact-match `city` filter would.
  late final List<HopeJob> _allJobs = [
    job('m1', 'طراحی اپ', 'MISSION', 'تهران'),
    job('j1', 'استخدام Flutter', 'JOB', 'تهران'),
    job('online', 'کار آنلاین', 'MISSION', 'آنلاین'),
    job('d1', 'طراحی گرافیک', 'MISSION', 'تهران',
        categoryId: 'design', category: 'طراحی'),
    job('s1', 'همکاری تخصصی', 'MISSION', 'تهران', visibility: 'SPECIALIZED'),
    job('shiraz1', 'طراحی در شیراز', 'MISSION', 'شیراز'),
  ];

  // Two distinct categories, mirroring the real catalog: the picker hands
  // back `slug`, while jobs carry both `categoryId` (the slug, for this
  // app's own create flow) and `category` (the localized display name).
  HopeCategory get techCategory => const HopeCategory(
        id: 'tech',
        slug: 'tech',
        name: 'فناوری',
        nameEn: 'Technology',
        description: '',
        parentId: null,
        sortOrder: 0,
        isActive: true,
      );

  HopeCategory get designCategory => const HopeCategory(
        id: 'design',
        slug: 'design',
        name: 'طراحی',
        nameEn: 'Design',
        description: '',
        parentId: null,
        sortOrder: 1,
        isActive: true,
      );

  HopeJob job(
    String id,
    String title,
    String kind,
    String city, {
    String visibility = 'PUBLIC',
    String categoryId = 'tech',
    String category = 'فناوری',
  }) =>
      HopeJob.fromMap({
        'id': id,
        'title': title,
        'description': 'شرح $title',
        'categoryId': categoryId,
        'category': category,
        'kind': kind,
        'visibility': visibility,
        'city': city,
      });

  @override
  Future<HopeJob> getOpportunity(String id) async =>
      _allJobs.firstWhere((j) => j.id == id, orElse: () => _allJobs.first);

  @override
  Future<List<HopeCategory>> listCategories() async {
    calls.add('categories');
    return [techCategory, designCategory];
  }

  @override
  Future<List<HopeJob>> listOpportunities({
    required String? city,
    required bool personalizedRecommendations,
    double? latitude,
    double? longitude,
    String? search,
    String? kind,
    String? visibility,
    String? categoryId,
  }) async {
    calls.add('jobs:${city ?? 'ALL'}:$personalizedRecommendations');
    // Mirrors the real backend: `/jobs/recommended` (personalized) never
    // filters by city -- city there only feeds distance/location scoring
    // -- while the plain `/jobs` listing does an *exact* match when a city
    // is given, and returns everything when it isn't.
    if (personalizedRecommendations || city == null) return _allJobs;
    return _allJobs.where((j) => (j.city ?? '') == city).toList();
  }

  @override
  Future<HopeJob> createOpportunity(Map<String, dynamic> body) =>
      throw UnimplementedError();

  @override
  Future<void> publishOpportunity(String id) async {}
}

Future<void> _pump(WidgetTester tester, _Repo repo,
    {HopeSettingsController? settings}) async {
  HopeSettingsController resolvedSettings;
  if (settings != null) {
    // Caller already called `SharedPreferences.setMockInitialValues`,
    // constructed, and configured this controller (e.g. to flip
    // personalizedRecommendations off) before handing it to us.
    resolvedSettings = settings;
  } else {
    SharedPreferences.setMockInitialValues({});
    resolvedSettings = HopeSettingsController();
    await resolvedSettings.load();
  }
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData.light(),
    locale: const Locale('fa'),
    supportedLocales: const [Locale('fa'), Locale('en')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: resolvedSettings),
        Provider<MarketplaceRepository>.value(value: repo),
      ],
      child: const JobsPage(),
    ),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

// The visibility chip labels ("عمومی"/"تخصصی") are the exact same strings
// shown on every job card's own status badge, so a bare `find.text(...)` is
// ambiguous as soon as more than one matching card is on screen.
// `find.widgetWithText(ChoiceChip, ...)` scopes the search to the filter
// chip itself.
Finder _choiceChip(String label) => find.widgetWithText(ChoiceChip, label);

void main() {
  testWidgets('jobs page requests categories and opportunities',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    expect(find.byType(JobsPage), findsOneWidget);
    expect(find.text('طراحی اپ'), findsOneWidget);
    expect(repo.calls, contains('categories'));
    expect(repo.calls.any((e) => e.startsWith('jobs:تهران:')), isTrue);
  });

  testWidgets('search narrows the rendered opportunity list', (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Flutter');
    await tester.pump();
    expect(find.text('استخدام Flutter'), findsOneWidget);
    expect(find.text('طراحی اپ'), findsNothing);
  });

  testWidgets('online jobs remain visible for a selected city', (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('کار آنلاین'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('کار آنلاین'), findsOneWidget);
  });

  testWidgets('kind chip narrows the list to missions only', (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.tap(_choiceChip('ماموریت‌ها'));
    await tester.pumpAndSettle();
    expect(find.text('طراحی اپ'), findsOneWidget); // MISSION
    expect(find.text('استخدام Flutter'), findsNothing); // JOB
  });

  testWidgets('kind chip narrows the list to jobs only', (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.tap(_choiceChip('شغل‌ها'));
    await tester.pumpAndSettle();
    expect(find.text('استخدام Flutter'), findsOneWidget); // JOB
    expect(find.text('طراحی اپ'), findsNothing); // MISSION
  });

  testWidgets('visibility chip narrows the list to specialized only',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.tap(_choiceChip('تخصصی'));
    await tester.pumpAndSettle();
    expect(find.text('همکاری تخصصی'), findsOneWidget); // SPECIALIZED
    expect(find.text('طراحی اپ'), findsNothing); // PUBLIC
  });

  testWidgets('visibility chip toggles from specialized back to public',
      (tester) async {
    // Note: there is no "all visibilities" chip in the UI (unlike kind,
    // which has one) -- once a specific visibility is picked, the only way
    // back is to pick the other specific one. This test documents the
    // actual, more limited behavior rather than a reset-to-all that the UI
    // doesn't offer.
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.tap(_choiceChip('تخصصی'));
    await tester.pumpAndSettle();
    expect(find.text('طراحی اپ'), findsNothing);
    await tester.tap(_choiceChip('عمومی'));
    await tester.pumpAndSettle();
    expect(find.text('طراحی اپ'), findsOneWidget);
    expect(find.text('همکاری تخصصی'), findsNothing);
  });

  testWidgets(
      'selecting a category filters the list and shows its localized label '
      '(regression: picker used to leak the raw slug and never match any job)',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();

    // Open the category picker via the chip showing the default "all
    // fields" label, and pick the "design" category by its localized name.
    await tester.tap(find.text('همه حوزه‌ها'));
    await tester.pumpAndSettle();
    expect(find.text('طراحی'), findsOneWidget); // category option in sheet
    await tester.tap(find.text('طراحی'));
    await tester.pumpAndSettle();

    // The chip must show the localized category name, not the raw slug
    // ("design") that the picker hands back internally.
    expect(find.text('طراحی'), findsOneWidget);
    expect(find.text('design'), findsNothing);

    // Only the job tagged with the "design" category should remain.
    expect(find.text('طراحی گرافیک'), findsOneWidget);
    expect(find.text('طراحی اپ'), findsNothing);
    expect(find.text('استخدام Flutter'), findsNothing);
    expect(find.text('کار آنلاین'), findsNothing);
  });

  testWidgets('choosing "همه حوزه‌ها" again clears the category filter',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    await tester.pumpAndSettle();
    await tester.tap(find.text('همه حوزه‌ها'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('طراحی'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('طراحی')); // reopen picker via updated chip
    await tester.pumpAndSettle();
    await tester.tap(find.text('همه حوزه‌ها'));
    await tester.pumpAndSettle();

    expect(find.text('طراحی اپ'), findsOneWidget);
    // The list is lazy; the design card sits below the fold of the default
    // 800x600 test surface, so scroll it into view before asserting it is
    // present again after the filter was cleared.
    await tester.scrollUntilVisible(find.text('طراحی گرافیک'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('طراحی گرافیک'), findsOneWidget);
  });

  testWidgets(
      'selecting "همه" (all cities) surfaces jobs from every city '
      '(regression: the literal word used to be sent to the server as the '
      'city filter, and since no job\'s city equals that string the '
      'server returned zero jobs)', (tester) async {
    final repo = _Repo();
    SharedPreferences.setMockInitialValues({});
    final settings = HopeSettingsController();
    await settings.load();
    // Force the non-personalized `/jobs` path, where the server applies an
    // exact-match city filter -- the bug only manifested there.
    await settings.setPersonalizedRecommendations(false);
    await _pump(tester, repo, settings: settings);
    await tester.pumpAndSettle();

    // Default city is تهران, so the شیراز-only job isn't shown yet.
    expect(find.text('طراحی در شیراز'), findsNothing);

    // Tap the city chip by its label: the ActionChip avatar icon sits at
    // the chip edge, where the computed tap offset does not hit-test
    // reliably on the default test surface.
    await tester.tap(find.widgetWithText(ActionChip, 'اطراف تهران'));
    await tester.pumpAndSettle();
    // "همه" is the last row of the city sheet and sits below the fold of
    // the visible area. Scroll the sheet's own scrollable (the sheet is
    // rendered on top, so its Scrollable is the last one in the tree) to
    // build the row, then bring it fully into view before tapping (a
    // built-but-off-screen row still fails the tap hit test).
    await tester.scrollUntilVisible(find.widgetWithText(ListTile, 'همه'), 200,
        scrollable: find.byType(Scrollable).last);
    await tester.ensureVisible(find.widgetWithText(ListTile, 'همه'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'همه'));
    await tester.pumpAndSettle();

    expect(find.text('طراحی اپ'), findsOneWidget);
    // After clearing the city filter every city's jobs are listed; the
    // شیراز card is below the fold, so scroll to it before asserting.
    await tester.scrollUntilVisible(find.text('طراحی در شیراز'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('طراحی در شیراز'), findsOneWidget);
  });

  testWidgets(
      'picking a specific city still shows online jobs '
      '(regression: forwarding the city filter to the server used to drop '
      'every online job, since the server has no carve-out for them)',
      (tester) async {
    final repo = _Repo();
    SharedPreferences.setMockInitialValues({});
    final settings = HopeSettingsController();
    await settings.load();
    await settings.setPersonalizedRecommendations(false);
    await _pump(tester, repo, settings: settings);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ActionChip, 'اطراف تهران'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'شیراز'));
    await tester.pumpAndSettle();

    expect(find.text('کار آنلاین'), findsOneWidget); // online job
    expect(find.text('طراحی اپ'), findsNothing); // تهران-only job
    // The شیراز card is below the fold of the lazy list; scroll it into
    // view before asserting it is present.
    await tester.scrollUntilVisible(find.text('طراحی در شیراز'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('طراحی در شیراز'), findsOneWidget); // شیراز job
  });
}
