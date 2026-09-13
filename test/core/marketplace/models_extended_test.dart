import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/application.dart';
import 'package:hope_mobile/core/marketplace/category.dart';
import 'package:hope_mobile/core/marketplace/job.dart';

Map<String, dynamic> _job({Map<String, dynamic>? extra}) => {
      'id': 'j1',
      'title': 'کار پروژه‌ای',
      'description': 'توضیح',
      'categoryId': 'c1',
      'category': 'فناوری',
      'jobType': 'FIXED',
      'budgetType': 'FIXED',
      'budgetMin': 100,
      'budgetMax': 200,
      'duration': '2 days',
      'acceptanceCriteria': 'done',
      'status': 'OPEN',
      'ownerId': 'u1',
      'providerId': null,
      'city': 'تهران',
      'kind': 'MISSION',
      'visibility': 'PUBLIC',
      'schedule': null,
      'monthlySalary': null,
      'applicationDeadline': null,
      'offerCount': 2,
      'isOwner': false,
      ...?extra,
    };

void main() {
  group('HopeJob', () {
    test('normalizes missing kind from FIXED jobType to MISSION', () {
      final job = HopeJob.fromMap(_job()..remove('kind'));
      expect(job.kind, 'MISSION');
      expect(job.isMission, isTrue);
      expect(job.isJob, isFalse);
    });

    test('normalizes non-fixed missing kind to JOB', () {
      final map = _job()..remove('kind');
      map['jobType'] = 'MONTHLY';
      final job = HopeJob.fromMap(map);
      expect(job.kind, 'JOB');
      expect(job.isJob, isTrue);
    });

    test('exposes specialized visibility and distance when present', () {
      final job = HopeJob.fromMap(_job(extra: {
        'visibility': 'specialized',
        'distanceKm': '4.5',
        'verticalId': 'v1',
        'attributes': {'remote': true},
      }));
      expect(job.isSpecialized, isTrue);
      expect(job.distanceKm, 4.5);
      expect(job.verticalId, 'v1');
      expect(job.attributes['remote'], isTrue);
    });

    test('toMap preserves raw fields and promoted additions', () {
      final job = HopeJob.fromMap(_job(extra: {
        'verticalId': 'v1',
        'attributes': {'skill': 'dart'},
      }));
      final map = job.toMap();
      expect(map['id'], 'j1');
      expect(map['verticalId'], 'v1');
      expect((map['attributes'] as Map)['skill'], 'dart');
    });

    test('invalid distance is represented as null', () {
      final job = HopeJob.fromMap(_job(extra: {'distanceKm': 'unknown'}));
      expect(job.distanceKm, isNull);
    });
  });

  group('HopeApplication', () {
    test('normalizes status for withdrawal policy', () {
      final application = HopeApplication.fromMap({
        'id': 'a1',
        'jobId': 'j1',
        'jobTitle': 'Job',
        'status': 'pending',
      });
      expect(application.status, 'PENDING');
      expect(application.canWithdraw, isTrue);
    });

    test('closed statuses cannot be withdrawn', () {
      for (final status in ['HIRED', 'REJECTED', 'WITHDRAWN', 'CLOSED']) {
        final application = HopeApplication.fromMap({'status': status});
        expect(application.canWithdraw, isFalse, reason: status);
      }
    });
  });

  group('categories', () {
    HopeCategory c(String id, String? parent, int order, bool active) =>
        HopeCategory(
          id: id,
          slug: id,
          name: id,
          nameEn: id,
          description: '',
          parentId: parent,
          sortOrder: order,
          isActive: active,
        );

    test('removes inactive categories', () {
      final result = flattenCategories([
        c('active', null, 0, true),
        c('inactive', null, 1, false),
      ]);
      expect(result.map((e) => e.id), ['active']);
    });

    test('sorts siblings by sortOrder then Persian label', () {
      final result = flattenCategories([
        c('ب', null, 1, true),
        c('الف', null, 1, true),
        c('ج', null, 0, true),
      ]);
      expect(result.map((e) => e.id), ['ج', 'الف', 'ب']);
    });

    test('keeps parent immediately before descendants', () {
      final result = flattenCategories([
        c('child', 'root', 0, true),
        c('root', null, 0, true),
        c('grand', 'child', 0, true),
      ]);
      expect(result.map((e) => e.id), ['root', 'child', 'grand']);
    });

    test('uses Persian label when English label is unavailable', () {
      const category = HopeCategory(
        id: 'x',
        slug: 'x',
        name: 'فارسی',
        nameEn: '',
        description: '',
        parentId: null,
        sortOrder: 0,
        isActive: true,
      );
      expect(category.label(true), 'فارسی');
    });
  });
}
