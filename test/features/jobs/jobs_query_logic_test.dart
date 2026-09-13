import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/job.dart';
import 'package:hope_mobile/features/jobs/jobs_query_logic.dart';

HopeJob _job({
  String id = 'id',
  String title = '',
  String description = '',
  String? categoryId,
  String? category,
  String kind = 'MISSION',
  String visibility = 'PUBLIC',
  String? city,
}) =>
    HopeJob.fromMap({
      'id': id,
      'title': title,
      'description': description,
      'categoryId': categoryId,
      'category': category,
      'kind': kind,
      'visibility': visibility,
      'city': city,
    });

void main() {
  group('normalizePersian', () {
    test('unifies Arabic and Persian letter variants', () {
      expect(normalizePersian('كباب'), normalizePersian('کباب'));
      expect(normalizePersian('علي'), normalizePersian('علی'));
      expect(normalizePersian('قهوة'), normalizePersian('قهوه'));
    });

    test('unifies Arabic-Indic and Persian digits with ASCII digits', () {
      expect(normalizePersian('١٢٣'), '123');
      expect(normalizePersian('۱۲۳'), '123');
    });

    test('strips diacritics and zero-width characters', () {
      expect(normalizePersian('می‌کنم'), normalizePersian('میکنم'));
    });

    test('collapses repeated whitespace and trims', () {
      expect(normalizePersian('  سلام   دنیا  '), 'سلام دنیا');
    });

    test('lower-cases Latin text', () {
      expect(normalizePersian('Flutter DEV'), 'flutter dev');
    });
  });

  group('filterJobs — kind', () {
    final jobs = [
      _job(id: 'm1', kind: 'MISSION'),
      _job(id: 'j1', kind: 'JOB'),
    ];

    test('ALL returns every job regardless of kind', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), containsAll(['m1', 'j1']));
    });

    test('MISSION excludes JOB entries', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'MISSION',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['m1']);
    });

    test('JOB excludes MISSION entries', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'JOB',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['j1']);
    });
  });

  group('filterJobs — visibility', () {
    final jobs = [
      _job(id: 'pub', visibility: 'PUBLIC'),
      _job(id: 'spec', visibility: 'SPECIALIZED'),
    ];

    test('ALL returns every job regardless of visibility', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result, hasLength(2));
    });

    test('PUBLIC excludes SPECIALIZED entries', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'PUBLIC',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['pub']);
    });

    test('SPECIALIZED excludes PUBLIC entries', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'SPECIALIZED',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['spec']);
    });
  });

  group('filterJobs — category (regression: slug vs. display name)', () {
    // Mirrors what the server actually sends: `categoryId` is the raw slug
    // the app sent when the job was created, while `category` is the
    // already-localized display name. Both must be matchable, since the
    // picker in jobs_page.dart hands back a slug.
    final jobs = [
      _job(id: 'tech', categoryId: 'technology', category: 'فناوری'),
      _job(id: 'design', categoryId: 'design', category: 'طراحی'),
      _job(id: 'no-category', categoryId: null, category: null),
    ];

    test('ALL returns every job regardless of category', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result, hasLength(3));
    });

    test('selecting a category slug matches jobs by categoryId', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'technology');
      expect(result.map((j) => j.id), ['tech']);
    });

    test('selecting a different category slug excludes non-matching jobs', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'design');
      expect(result.map((j) => j.id), ['design']);
    });

    test('jobs without a category never match a specific category filter', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'technology');
      expect(result.map((j) => j.id), isNot(contains('no-category')));
    });

    test('also matches when the filter value equals the display name', () {
      // Defensive path: covers jobs created through a flow where categoryId
      // is a real id instead of a slug, but the display name happens to be
      // the filter value being compared.
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'فناوری');
      expect(result.map((j) => j.id), ['tech']);
    });
  });

  group('filterJobs — city', () {
    final jobs = [
      _job(id: 'tehran', city: 'تهران'),
      _job(id: 'shiraz', city: 'شیراز'),
      _job(id: 'remote', city: 'آنلاین'),
    ];

    test('"همه" (all cities) returns every job', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result, hasLength(3));
    });

    test('a specific city returns matching jobs plus online jobs', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'تهران',
          category: 'ALL');
      expect(result.map((j) => j.id), containsAll(['tehran', 'remote']));
      expect(result.map((j) => j.id), isNot(contains('shiraz')));
    });

    test('a job with no city is treated as online and always shown', () {
      final noCity = _job(id: 'no-city', city: null);
      final result = filterJobs(
          jobs: [noCity],
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'تهران',
          category: 'ALL');
      expect(result.map((j) => j.id), ['no-city']);
    });
  });

  group('filterJobs — search query', () {
    final jobs = [
      _job(id: 'flutter', title: 'استخدام Flutter', description: 'کار روی اپ'),
      _job(id: 'design', title: 'طراحی رابط کاربری', description: 'یوایکس'),
    ];

    test('empty query returns every job', () {
      final result = filterJobs(
          jobs: jobs,
          query: '',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result, hasLength(2));
    });

    test('matches case-insensitively against Latin text', () {
      final result = filterJobs(
          jobs: jobs,
          query: 'FLUTTER',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['flutter']);
    });

    test('matches Persian text despite letter-variant differences', () {
      // 'كاربري' (Arabic ك/ي) should still match 'کاربری' (Persian ک/ی)
      // stored in the title.
      final result = filterJobs(
          jobs: jobs,
          query: 'كاربري',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['design']);
    });

    test('matches against description as well as title', () {
      final result = filterJobs(
          jobs: jobs,
          query: 'یوایکس',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result.map((j) => j.id), ['design']);
    });

    test('no match returns an empty list', () {
      final result = filterJobs(
          jobs: jobs,
          query: 'nonexistent-term-xyz',
          kind: 'ALL',
          visibility: 'ALL',
          activeCity: 'همه',
          category: 'ALL');
      expect(result, isEmpty);
    });
  });

  group('filterJobs — combined filters', () {
    final jobs = [
      _job(
          id: 'match',
          title: 'استخدام Flutter',
          kind: 'JOB',
          visibility: 'PUBLIC',
          city: 'تهران',
          categoryId: 'technology',
          category: 'فناوری'),
      _job(
          id: 'wrong-kind',
          title: 'استخدام Flutter',
          kind: 'MISSION',
          visibility: 'PUBLIC',
          city: 'تهران',
          categoryId: 'technology',
          category: 'فناوری'),
      _job(
          id: 'wrong-category',
          title: 'استخدام Flutter',
          kind: 'JOB',
          visibility: 'PUBLIC',
          city: 'تهران',
          categoryId: 'design',
          category: 'طراحی'),
    ];

    test('all filters must hold simultaneously', () {
      final result = filterJobs(
        jobs: jobs,
        query: 'Flutter',
        kind: 'JOB',
        visibility: 'PUBLIC',
        activeCity: 'تهران',
        category: 'technology',
      );
      expect(result.map((j) => j.id), ['match']);
    });

    test('empty input list returns empty output regardless of filters', () {
      final result = filterJobs(
        jobs: const [],
        query: 'anything',
        kind: 'JOB',
        visibility: 'PUBLIC',
        activeCity: 'تهران',
        category: 'technology',
      );
      expect(result, isEmpty);
    });
  });
}
