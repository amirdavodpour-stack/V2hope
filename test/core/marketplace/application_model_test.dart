import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/application.dart';

void main() {
  Map<String, dynamic> payload({String? status}) => <String, dynamic>{
        'id': 'app1',
        'jobId': 'j1',
        'jobTitle': 'Frontend developer',
        'jobCity': 'Tehran',
        'jobKind': 'JOB',
        'resumeText': 'رزومه',
        'skills': 'Flutter, Dart',
        'status': status,
        'createdAt': '2026-09-01T00:00:00Z',
        'updatedAt': '2026-09-02T00:00:00Z',
      };

  test('missing status defaults to PENDING', () {
    final application = HopeApplication.fromMap(payload());
    expect(application.status, 'PENDING');
  });

  test('status is uppercased regardless of source casing', () {
    final application = HopeApplication.fromMap(payload(status: 'shortlisted'));
    expect(application.status, 'SHORTLISTED');
  });

  test('missing jobKind defaults to JOB', () {
    final map = payload()..remove('jobKind');
    final application = HopeApplication.fromMap(map);
    expect(application.jobKind, 'JOB');
  });

  test('jobCity is null when absent, not the string "null"', () {
    final map = payload()..remove('jobCity');
    final application = HopeApplication.fromMap(map);
    expect(application.jobCity, isNull);
  });

  group('canWithdraw', () {
    const withdrawable = ['PENDING', 'SHORTLISTED', 'FORWARDED', 'INTERVIEW'];
    const terminal = ['HIRED', 'REJECTED', 'WITHDRAWN'];

    for (final status in withdrawable) {
      test('is true for $status', () {
        final application = HopeApplication.fromMap(payload(status: status));
        expect(application.canWithdraw, isTrue);
      });
    }

    for (final status in terminal) {
      test('is false for terminal status $status', () {
        final application = HopeApplication.fromMap(payload(status: status));
        expect(application.canWithdraw, isFalse);
      });
    }

    test('is case-insensitive with respect to the source status casing', () {
      final application = HopeApplication.fromMap(payload(status: 'interview'));
      expect(application.canWithdraw, isTrue);
    });
  });
}
