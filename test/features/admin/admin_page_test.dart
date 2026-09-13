import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/admin/admin_repository.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/features/admin/admin_page.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';

/// Behavior tests for the admin control center. Every scenario uses a fresh
/// in-memory AdminRepository fake, so tests are order-independent and touch
/// no real network or shared global state.
class _FakeAdmin implements AdminRepository {
  _FakeAdmin({this.failJobs = false});

  /// Only [listJobs] can fail (it powers the initially-active tab, whose
  /// FutureBuilder observes the error future from the very first frame, so
  /// no unobserved async error can be raised).
  bool failJobs = false;

  /// When true the next state-mutating action throws (error-path coverage).
  bool failNextAction = false;

  final List<String> calls = [];

  HopeAdminSummary summary = const HopeAdminSummary(values: {
    'users': 3,
    'published_opportunities': 5,
    'missions': 2,
    'jobs': 3,
    'pending_applications': 1,
    'audit_events': 9,
  });
  List<HopeJob> jobs = const [];
  List<HopeApplication> applications = const [];
  List<HopeAdminUser> users = const [];
  List<HopeAdminAuditEvent> audit = const [];

  @override
  Future<HopeAdminSummary> getSummary() async => summary;

  @override
  Future<List<HopeJob>> listJobs() async {
    calls.add('jobs');
    if (failJobs) throw Exception('network down');
    return jobs;
  }

  @override
  Future<List<HopeApplication>> listApplications() async {
    calls.add('applications');
    return applications;
  }

  @override
  Future<List<HopeAdminUser>> listUsers() async {
    calls.add('users');
    return users;
  }

  @override
  Future<List<HopeAdminAuditEvent>> listAudit() async {
    calls.add('audit');
    return audit;
  }

  @override
  Future<void> shortlistApplication(String id) async {
    calls.add('shortlist:$id');
    if (failNextAction) throw Exception('action boom');
  }

  @override
  Future<void> forwardApplication(String id) async {
    calls.add('forward:$id');
    if (failNextAction) throw Exception('action boom');
  }

  @override
  Future<void> rejectApplication(String id) async {
    calls.add('reject:$id');
    if (failNextAction) throw Exception('action boom');
  }

  @override
  Future<void> moderateJob(String id, String status) async {
    calls.add('moderate:$id:$status');
    if (failNextAction) throw Exception('action boom');
  }

  @override
  Future<void> setUserStatus(String id, String status) async {
    calls.add('status:$id:$status');
    if (failNextAction) throw Exception('action boom');
  }

  @override
  Future<void> deleteJob(String id) async {
    calls.add('delete:$id');
    if (failNextAction) throw Exception('action boom');
  }
}

HopeJob _job(String id,
        {String kind = 'JOB', String status = 'PUBLISHED', String title = 'Design a logo'}) =>
    HopeJob.fromMap({
      'id': id,
      'title': title,
      'description': 'A clear deliverable description.',
      'categoryId': 'c1',
      'category': 'Design',
      'jobType': kind == 'JOB' ? 'HOURLY' : 'FIXED',
      'budgetType': 'FIXED',
      'budgetMin': '1000',
      'budgetMax': '2000',
      'duration': '8',
      'acceptanceCriteria': 'Acceptance criteria here',
      'status': status,
      'ownerId': 'o1',
      'providerId': 'p1',
      'city': 'Tehran',
      'kind': kind,
      'visibility': 'PUBLIC',
      'schedule': 'FULL_TIME',
      'monthlySalary': kind == 'JOB' ? '15000000' : null,
      'applicationDeadline': kind == 'JOB' ? '2026-09-30' : null,
      'offerCount': 0,
      'isOwner': false,
      'distanceKm': null,
    });

Future<void> _pump(WidgetTester tester, _FakeAdmin repo) async {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData.light(),
    locale: const Locale('en'),
    supportedLocales: const [Locale('en'), Locale('fa')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: Provider<AdminRepository>.value(value: repo, child: const AdminPage()),
  ));
  await tester.pumpAndSettle();
}

Future<void> _openTab(WidgetTester tester, String label) async {
  await tester.tap(
      find.descendant(of: find.byType(TabBar), matching: find.text(label)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('admin renders summary metrics and moderation actions',
      (tester) async {
    final repo = _FakeAdmin()
      ..jobs = [
        _job('j1', kind: 'JOB', status: 'DRAFT'),
        _job('j2', kind: 'MISSION', status: 'PUBLISHED', title: 'Translate site'),
      ]
      ..applications = [
        HopeApplication.fromMap({
          'id': 'a1',
          'jobId': 'j1',
          'jobTitle': 'Design a logo',
          'status': 'PENDING'
        }),
        HopeApplication.fromMap({
          'id': 'a2',
          'jobId': 'j2',
          'jobTitle': 'Translate site',
          'status': 'SHORTLISTED'
        }),
      ]
      ..users = [
        const HopeAdminUser(
            id: 'u1',
            displayName: 'Alice',
            email: 'alice@example.com',
            role: 'USER',
            status: 'ACTIVE'),
        const HopeAdminUser(
            id: 'u2',
            displayName: 'Boss',
            email: 'boss@example.com',
            role: 'ADMIN',
            status: 'ACTIVE'),
      ]
      ..audit = [
        const HopeAdminAuditEvent(
            action: 'JOB_MODERATED',
            actorName: '',
            entityType: 'JOB',
            createdAt: '2026-09-01')
      ];
    await _pump(tester, repo);

    // Summary grid: users=3 and jobs=3 are both rendered.
    expect(find.text('3'), findsWidgets);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('9'), findsOneWidget);

    // Opportunities tab: draft rows offer the publish action.
    expect(find.text('Design a logo'), findsOneWidget);
    expect(find.textContaining('DRAFT'), findsOneWidget);
    final publish = find.byTooltip('Publish');
    expect(publish, findsOneWidget);
    await tester.ensureVisible(publish);
    await tester.tap(publish);
    await tester.pumpAndSettle();
    expect(repo.calls, contains('moderate:j1:PUBLISHED'));

    // Applications tab, contact actions delegate.
    await _openTab(tester, 'Applications');
    expect(find.text('Shortlist'), findsOneWidget);
    expect(find.text('Forward to employer'), findsOneWidget);
    await tester.tap(find.text('Shortlist'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('shortlist:a1'));

    // Users tab: suspend for non-admin ACTIVE user, none for ADMIN.
    await _openTab(tester, 'Users');
    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('Boss'), findsOneWidget);
    final suspend = find.byTooltip('Suspend');
    expect(suspend, findsOneWidget);
    await tester.tap(suspend);
    await tester.pumpAndSettle();
    expect(repo.calls, contains('status:u1:SUSPENDED'));

    // Audit log tab: system actor fallback for empty actor name.
    await _openTab(tester, 'Audit log');
    expect(find.text('JOB_MODERATED'), findsOneWidget);
    expect(find.textContaining('System'), findsOneWidget);
  });

  testWidgets('admin empty states are explicit per tab', (tester) async {
    final repo = _FakeAdmin();
    await _pump(tester, repo);

    await _openTab(tester, 'Opportunities');
    expect(find.text('No opportunities'), findsOneWidget);

    await _openTab(tester, 'Applications');
    expect(find.text('No applications'), findsOneWidget);

    await _openTab(tester, 'Users');
    expect(find.text('The server did not return data. Try again.'),
        findsOneWidget);
  });

  testWidgets('admin load failure shows retry and recovers', (tester) async {
    final repo = _FakeAdmin(failJobs: true)
      ..jobs = [_job('j1', kind: 'MISSION', status: 'PUBLISHED')];
    await _pump(tester, repo);

    // The active opportunities tab surfaces the error state with a retry.
    expect(find.text('Connection failed'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    repo.failJobs = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Design a logo'), findsOneWidget);
    expect(find.text('Connection failed'), findsNothing);
  });

  testWidgets('admin action failure surfaces an error snackbar',
      (tester) async {
    final repo = _FakeAdmin()
      ..applications = [
        HopeApplication.fromMap({
          'id': 'a1',
          'jobId': 'j1',
          'jobTitle': 'Job',
          'status': 'PENDING'
        }),
      ];
    await _pump(tester, repo);
    await _openTab(tester, 'Applications');

    repo.failNextAction = true;
    await tester.tap(find.widgetWithText(OutlinedButton, 'Shortlist'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Operation failed.'), findsOneWidget);
    expect(repo.calls, contains('shortlist:a1'));
  });

  testWidgets('admin reactivates a suspended user', (tester) async {
    final repo = _FakeAdmin()
      ..users = [
        const HopeAdminUser(
            id: 'u3',
            displayName: 'Sara',
            email: 'sara@example.com',
            role: 'USER',
            status: 'SUSPENDED'),
      ];
    await _pump(tester, repo);
    await _openTab(tester, 'Users');
    expect(find.text('Sara'), findsOneWidget);
    final activate = find.byTooltip('Activate');
    expect(activate, findsOneWidget);
    await tester.tap(activate);
    await tester.pumpAndSettle();
    expect(repo.calls, contains('status:u3:ACTIVE'));
  });
}
