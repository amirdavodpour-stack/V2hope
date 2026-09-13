import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/job.dart';

/// Session 8 — additive multi-vertical plumbing on [HopeJob].
/// The live jobs vertical must round-trip byte-identically.
void main() {
  Map<String, dynamic> legacyPayload() => <String, dynamic>{
        'id': 'j1',
        'title': 'Fix a leaking tap',
        'description': 'Kitchen tap drips',
        'categoryId': 'c1',
        'category': 'Plumbing',
        'jobType': 'FIXED',
        'budgetType': 'FIXED',
        'budgetMin': 100,
        'budgetMax': 100,
        'status': 'OPEN',
        'ownerId': 'u1',
        'kind': 'MISSION',
        'visibility': 'PUBLIC',
        'offerCount': 2,
        'isOwner': true,
      };

  test('legacy payload without the new keys still parses', () {
    final job = HopeJob.fromMap(legacyPayload());
    expect(job.id, 'j1');
    expect(job.verticalId, isNull);
    expect(job.attributes, isEmpty);
  });

  test('explicit nulls are tolerated', () {
    final job = HopeJob.fromMap(
      legacyPayload()..addAll({'verticalId': null, 'attributes': null}),
    );
    expect(job.verticalId, isNull);
    expect(job.attributes, isEmpty);
  });

  test('a non-map attributes value degrades to an empty map', () {
    final job = HopeJob.fromMap(legacyPayload()..['attributes'] = 'nope');
    expect(job.attributes, isEmpty);
  });

  test('populated vertical fields are parsed', () {
    final job = HopeJob.fromMap(
      legacyPayload()
        ..addAll({
          'verticalId': '9f1d0b6e-0000-4000-8000-000000000001',
          'attributes': {'bedrooms': 3, 'furnished': true, 'city': 'Tehran'},
        }),
    );
    expect(job.verticalId, '9f1d0b6e-0000-4000-8000-000000000001');
    expect(job.attributes['bedrooms'], 3);
    expect(job.attributes['furnished'], true);
    expect(job.attributes['city'], 'Tehran');
  });

  test('toMap does not add the new keys for a legacy jobs listing', () {
    final payload = legacyPayload();
    final round = HopeJob.fromMap(payload).toMap();
    expect(round.containsKey('verticalId'), isFalse);
    expect(round.containsKey('attributes'), isFalse);
    expect(round, equals(payload));
  });

  test('toMap round-trips the new keys when present', () {
    final payload = legacyPayload()
      ..addAll({
        'verticalId': 'v-1',
        'attributes': {'bedrooms': 3},
      });
    final round = HopeJob.fromMap(payload).toMap();
    expect(round['verticalId'], 'v-1');
    expect(round['attributes'], {'bedrooms': 3});
    expect(HopeJob.fromMap(round).attributes, {'bedrooms': 3});
  });

  test('the default constructor keeps both fields optional', () {
    const job = HopeJob(
      id: 'j2',
      title: 't',
      description: 'd',
      categoryId: null,
      category: null,
      jobType: null,
      budgetType: null,
      budgetMin: null,
      budgetMax: null,
      duration: null,
      acceptanceCriteria: null,
      status: null,
      ownerId: null,
      providerId: null,
      city: null,
      kind: 'MISSION',
      visibility: 'PUBLIC',
      schedule: null,
      monthlySalary: null,
      applicationDeadline: null,
      offerCount: 0,
      isOwner: false,
      distanceKm: null,
      raw: <String, dynamic>{},
    );
    expect(job.verticalId, isNull);
    expect(job.attributes, isEmpty);
  });
}
