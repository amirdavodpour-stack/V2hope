import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/router/app_routes.dart';
import 'package:hope_mobile/features/auth/login_page.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/features/marketplace/job_detail_page.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/job_detail_repository.dart';
import 'package:hope_mobile/l10n/generated/app_localizations.dart';
import 'package:provider/provider.dart';

/// JobDetailPage reads a [JobDetailRepository] from the widget tree in
/// initState, exactly as the production app wires it in main.dart. The host
/// below provides a no-op fake so the route can be exercised in isolation.
class _FakeJobDetailRepository implements JobDetailRepository {
  @override
  Future<List<HopeCandidate>> listCandidates(String jobId) async => const [];

  @override
  Future<HopeApplication> applyToJob(String jobId,
          {required String resumeText, required String skills}) =>
      throw UnimplementedError();

  @override
  Future<HopeOffer> submitOffer(String jobId,
          {required double price, required String message}) async => HopeOffer.fromMap({'id': 'o1', 'jobId': jobId, 'providerId': 'u1', 'price': price, 'message': message, 'status': 'PENDING'});

  @override
  Future<void> candidateAction(
          String jobId, String candidateId, String action) async {}
}

// The provider must sit ABOVE the MaterialApp: a route pushed with
// Navigator.push lives under the Navigator (a descendant of MaterialApp),
// not under the `home:` subtree, so a provider placed inside `home:` would
// be invisible to the pushed JobDetailPage.
Widget _host(void Function(BuildContext) push) => MultiProvider(
      providers: [
        Provider<JobDetailRepository>.value(value: _FakeJobDetailRepository()),
      ],
      child: MaterialApp(
        locale: const Locale('fa'),
        supportedLocales: const [Locale('fa'), Locale('en')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: ThemeData.light(),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => push(context),
                child: const Text('go'),
              ),
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('HopeRoutes.login pushes a real LoginPage onto the stack',
      (tester) async {
    await tester.pumpWidget(
        _host((context) => Navigator.push(context, HopeRoutes.login())));
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets('HopeRoutes.jobDetail pushes a page for the given job',
      (tester) async {
    final job = HopeJob.fromMap(const {
      'id': 'j1',
      'title': 'طراحی اپ',
      'description': 'شرح آگهی',
      'categoryId': 'tech',
      'category': 'فناوری',
      'kind': 'MISSION',
      'visibility': 'PUBLIC',
      'city': 'تهران',
    });
    await tester.pumpWidget(
        _host((context) => Navigator.push(context, HopeRoutes.jobDetail(job))));
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    expect(find.byType(JobDetailPage), findsOneWidget);
    expect(find.text('طراحی اپ'), findsWidgets);
  });
}
