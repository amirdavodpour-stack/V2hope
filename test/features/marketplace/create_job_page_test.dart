import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/category.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/core/marketplace/marketplace_repository.dart';
import 'package:hope_mobile/core/router/app_routes.dart';
import 'package:hope_mobile/core/settings/settings_controller.dart';
import 'package:hope_mobile/features/marketplace/create_job_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Behavior tests for the create-opportunity form: validation gating, kind
/// switching, fee copy, delegation of create+publish, busy state and
/// navigation intent. All repositories are fresh per test.
class _FakeMarket implements MarketplaceRepository {
  final List<String> calls = [];

  bool failCreate = false;

  /// When set, createOpportunity waits on this gate so the busy state can be
  /// observed deterministically.
  Completer<HopeJob>? createGate;

  @override
  Future<HopeJob> getOpportunity(String id) => throw UnimplementedError();

  @override
  Future<List<HopeCategory>> listCategories() async => const [
        HopeCategory(
            id: '1',
            slug: 'design',
            name: 'طراحی',
            nameEn: 'Design',
            description: '',
            parentId: null,
            sortOrder: 1,
            isActive: true),
        HopeCategory(
            id: '2',
            slug: 'dev',
            name: 'توسعه',
            nameEn: 'Development',
            description: '',
            parentId: '1',
            sortOrder: 2,
            isActive: true),
        HopeCategory(
            id: '3',
            slug: 'off',
            name: 'غیرفعال',
            nameEn: 'Inactive',
            description: '',
            parentId: null,
            sortOrder: 3,
            isActive: false),
      ];

  @override
  Future<HopeJob> createOpportunity(Map<String, dynamic> body) async {
    calls.add('create:${body['kind']}:${body['title']}');
    if (failCreate) throw Exception('create boom');
    if (createGate != null) return createGate!.future;
    return HopeJob.fromMap({
      ...body,
      'id': 'job-new',
      'status': 'PUBLISHED',
      'ownerId': 'u1',
      'offerCount': 0,
    });
  }

  @override
  Future<void> publishOpportunity(String id) async {
    calls.add('publish:$id');
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
  }) async =>
      const [];
}

Future<void> _pump(WidgetTester tester, _FakeMarket repo,
    {HopeSettingsController? settings}) async {
  tester.view.physicalSize = const Size(900, 3400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  SharedPreferences.setMockInitialValues({});
  final controller = settings ?? HopeSettingsController();
  await controller.load();
  // Providers must sit ABOVE the MaterialApp so routes pushed onto the
  // app Navigator (CreateJobPage via HopeRoutes) still resolve them.
  await tester.pumpWidget(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: controller),
      Provider<MarketplaceRepository>.value(value: repo),
    ],
    child: MaterialApp(
      theme: ThemeData.light(),
      locale: const Locale('en'),
      supportedLocales: const [Locale('en'), Locale('fa')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: FilledButton(
              onPressed: () => Navigator.push(context, HopeRoutes.createJob()),
              child: const Text('open form'),
            ),
          ),
        ),
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open form'));
  await tester.pumpAndSettle();
  expect(find.byType(CreateJobPage), findsOneWidget);
}

Future<void> _selectCategory(WidgetTester tester, String label) async {
  final dropdown = find.byType(DropdownButtonFormField<String>).first;
  await tester.ensureVisible(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  // Exact match first (child categories carry a '  ↳ ' indent prefix).
  var item = find.text(label);
  if (item.evaluate().isEmpty) item = find.textContaining(label);
  await tester.tap(item.last);
  await tester.pumpAndSettle();
}

Future<void> _fillMissionForm(WidgetTester tester, {String? category}) async {
  await tester.enterText(
      find.widgetWithText(TextField, 'Title'), 'Design a landing page');
  await tester.enterText(find.widgetWithText(TextField, 'Full description'),
      'A complete landing page design for an online shop');
  if (category != null) {
    await _selectCategory(tester, category);
  }
  await tester.enterText(
      find.widgetWithText(TextField, 'Minimum pay'), '500000');
  await tester.enterText(
      find.widgetWithText(TextField, 'Maximum pay'), '800000');
  await tester.enterText(
      find.widgetWithText(TextField, 'Acceptance / selection criteria'),
      'Deliver PSD and Figma files');
}

void main() {
  testWidgets('mission publish delegates create then publish and pops back',
      (tester) async {
    final repo = _FakeMarket();
    await _pump(tester, repo);
    await _open(tester);

    await _fillMissionForm(tester, category: 'Design');
    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pumpAndSettle();

    expect(repo.calls, contains('create:MISSION:Design a landing page'));
    expect(repo.calls, contains('publish:job-new'));
    expect(find.text('Opportunity published.'), findsOneWidget);
    // Navigation intent: the page popped back to the host.
    expect(find.byType(CreateJobPage), findsNothing);
  });

  testWidgets('validation failure blocks submit without category',
      (tester) async {
    final repo = _FakeMarket();
    await _pump(tester, repo);
    await _open(tester);

    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Choose a professional category.'), findsOneWidget);
    expect(repo.calls, isEmpty);
  });

  testWidgets('switching types swaps price fields, fee copy and job deadline',
      (tester) async {
    final repo = _FakeMarket();
    await _pump(tester, repo);
    await _open(tester);

    // MISSION default: mission pricing + mission fee copy.
    expect(find.text('Minimum pay'), findsOneWidget);
    expect(find.text('Maximum pay'), findsOneWidget);
    expect(find.text('Duration (hours)'), findsOneWidget);
    expect(find.text('Monthly salary'), findsNothing);
    expect(find.textContaining('10% from the employer'), findsOneWidget);

    // Switch to JOB via the type hero tile.
    await tester.tap(find.text('Job'));
    await tester.pumpAndSettle();
    expect(find.text('Monthly salary'), findsOneWidget);
    expect(find.text('Application deadline'), findsOneWidget);
    expect(find.text('Minimum pay'), findsNothing);
    expect(find.text('Duration (hours)'), findsNothing);
    expect(find.textContaining('30% of the candidate'), findsOneWidget);

    // JOB published without a deadline is rejected by the dedicated guard.
    await tester
        .enterText(find.widgetWithText(TextField, 'Title'), 'Flutter developer');
    await tester.enterText(find.widgetWithText(TextField, 'Full description'),
        'Build and ship the mobile application');
    // Child categories are rendered with a '  ↳ ' indent prefix.
    await _selectCategory(tester, 'Development');
    await tester.enterText(
        find.widgetWithText(TextField, 'Monthly salary'), '12000000');
    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Set an application deadline for jobs.'), findsOneWidget);
    expect(repo.calls, isEmpty);

    // With a deadline the job publishes.
    await tester.enterText(
        find.widgetWithText(TextField, 'Application deadline'), '2026-09-30');
    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('create:JOB:Flutter developer'));
    expect(repo.calls, contains('publish:job-new'));
  });

  testWidgets('busy state disables the submit action while in flight',
      (tester) async {
    final repo = _FakeMarket()..createGate = Completer<HopeJob>();
    await _pump(tester, repo);
    await _open(tester);

    await _fillMissionForm(tester, category: 'Design');
    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pump();

    final submitArea = find.byType(FilledButton);
    expect(submitArea, findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsWidgets);

    repo.createGate!
        .complete(HopeJob.fromMap({
          'id': 'job-new',
          'title': 'Design a landing page',
          'status': 'PUBLISHED',
        }));
    await tester.pumpAndSettle();
    expect(find.text('Opportunity published.'), findsOneWidget);
    expect(repo.calls, contains('publish:job-new'));
  });

  testWidgets('create failure surfaces server error snackbar', (tester) async {
    final repo = _FakeMarket()..failCreate = true;
    await _pump(tester, repo);
    await _open(tester);

    await _fillMissionForm(tester, category: 'Design');
    await tester.ensureVisible(find.text('Publish opportunity'));
    await tester.tap(find.text('Publish opportunity'));
    await tester.pumpAndSettle();

    expect(find.text('The server did not return data. Try again.'),
        findsOneWidget);
    // Still on the form: the pop only happens on success.
    expect(find.byType(CreateJobPage), findsOneWidget);
  });
}
