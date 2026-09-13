import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/features/marketplace/create_job_payload.dart';

CreateJobPayloadInput _mission() => const CreateJobPayloadInput(
      title: '  طراحی وب  ', description: '  شرح کامل  ', categoryId: 'tech',
      minBudget: '100000', maxBudget: '200000', duration: '8',
      acceptanceCriteria: 'خروجی فایل', city: 'تهران', kind: 'MISSION',
      visibility: 'PUBLIC', schedule: 'FULL_TIME', monthlySalary: '',
      applicationDeadline: '',
    );

// Mirrors the page contract: for JOB kind the page passes salary.text as both
// effective budget fields.
CreateJobPayloadInput _job() => const CreateJobPayloadInput(
      title: 'استخدام برنامه‌نویس', description: 'شرح', categoryId: 'tech',
      minBudget: '5000000', maxBudget: '5000000', duration: '8',
      acceptanceCriteria: '', city: 'شیراز', kind: 'JOB',
      visibility: 'SPECIALIZED', schedule: 'PART_TIME', monthlySalary: '5000000',
      applicationDeadline: '2026-09-30',
    );

void main() {
  test('mission payload maps to a FIXED priced opportunity with a duration', () {
    final body = buildCreateOpportunityPayload(_mission());
    expect(body['title'], 'طراحی وب');
    expect(body['description'], 'شرح کامل');
    expect(body['categoryId'], 'tech');
    expect(body['jobType'], 'FIXED');
    expect(body['budgetType'], 'FIXED');
    expect(body['budgetMin'], 100000);
    expect(body['budgetMax'], 200000);
    expect(body['duration'], 8);
    expect(body['kind'], 'MISSION');
    expect(body['visibility'], 'PUBLIC');
    expect(body['schedule'], isNull);
    expect(body['monthlySalary'], isNull);
    expect(body['applicationDeadline'], isNull);
  });

  test('job payload maps to an HOURLY salary opportunity with schedule and deadline', () {
    final body = buildCreateOpportunityPayload(_job());
    expect(body['jobType'], 'HOURLY');
    expect(body['duration'], 30);
    expect(body['schedule'], 'PART_TIME');
    expect(body['monthlySalary'], 5000000);
    expect(body['applicationDeadline'], '2026-09-30');
    expect(body['city'], 'شیراز');
  });

  test('mission payload trims surrounding whitespace from free text', () {
    final body = buildCreateOpportunityPayload(_mission());
    expect(body['city'], 'تهران');
    expect(body['acceptanceCriteria'], 'خروجی فایل');
  });
}
