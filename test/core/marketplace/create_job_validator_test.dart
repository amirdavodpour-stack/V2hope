import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/features/marketplace/create_job_validator.dart';

void main() {
  const base = <String, String>{
    'title': 'طراحی سایت',
    'description': 'شرح کامل این کار برای تست اعتبارسنجی.',
    'categoryId': 'cat-1',
    'minBudget': '100',
    'maxBudget': '500',
    'duration': '8',
    'acceptanceCriteria': 'تحویل کامل و مطابق شرح.',
  };

  CreateJobValidationResult run({
    String? title,
    String? description,
    String? categoryId,
    String? minBudget,
    String? maxBudget,
    String? duration,
    String? acceptanceCriteria,
  }) {
    return validateCreateJob(
      title: title ?? base['title']!,
      description: description ?? base['description']!,
      categoryId: categoryId ?? base['categoryId']!,
      minBudget: minBudget ?? base['minBudget']!,
      maxBudget: maxBudget ?? base['maxBudget']!,
      duration: duration ?? base['duration']!,
      acceptanceCriteria: acceptanceCriteria ?? base['acceptanceCriteria']!,
    );
  }

  test('accepts valid input', () {
    expect(run().isValid, isTrue);
  });

  test('rejects empty title', () {
    final result = run(title: '   ');
    expect(result.isValid, isFalse);
    expect(result.error, contains('عنوان'));
  });

  test('rejects title shorter than 2 characters', () {
    final result = run(title: 'ا');
    expect(result.isValid, isFalse);
  });

  test('accepts title at the 160 character upper boundary', () {
    final title = 'ا' * 160;
    expect(run(title: title).isValid, isTrue);
  });

  test('rejects title over the 160 character upper boundary', () {
    final title = 'ا' * 161;
    final result = run(title: title);
    expect(result.isValid, isFalse);
    expect(result.error, contains('۲ تا ۱۶۰'));
  });

  test('rejects description shorter than 10 characters', () {
    final result = run(description: 'کوتاه');
    expect(result.isValid, isFalse);
    expect(result.error, contains('شرح کار'));
  });

  test('accepts description exactly 10 characters', () {
    // 10 non-space characters after trim.
    expect(run(description: 'ا' * 10).isValid, isTrue);
  });

  test('rejects empty categoryId', () {
    final result = run(categoryId: '   ');
    expect(result.isValid, isFalse);
    expect(result.error, contains('دسته‌بندی'));
  });

  test('rejects non-numeric minBudget', () {
    final result = run(minBudget: 'abc');
    expect(result.isValid, isFalse);
    expect(result.error, contains('حداقل بودجه'));
  });

  test('rejects zero minBudget (must be strictly positive)', () {
    final result = run(minBudget: '0');
    expect(result.isValid, isFalse);
    expect(result.error, contains('حداقل بودجه'));
  });

  test('rejects negative maxBudget', () {
    final result = run(maxBudget: '-10');
    expect(result.isValid, isFalse);
    expect(result.error, contains('حداکثر بودجه'));
  });

  test('rejects reversed budget range', () {
    final result = run(minBudget: '900', maxBudget: '500');
    expect(result.error, contains('حداقل بودجه'));
  });

  test('accepts equal min and max budget', () {
    expect(run(minBudget: '250', maxBudget: '250').isValid, isTrue);
  });

  test('rejects invalid (zero) duration', () {
    expect(run(duration: '0').isValid, isFalse);
  });

  test('rejects non-integer duration', () {
    expect(run(duration: '3.5').isValid, isFalse);
  });

  test('rejects negative duration', () {
    expect(run(duration: '-5').isValid, isFalse);
  });

  test('accepts duration at the 36500 hour upper boundary', () {
    expect(run(duration: '36500').isValid, isTrue);
  });

  test('rejects duration over the 36500 hour upper boundary', () {
    final result = run(duration: '36501');
    expect(result.isValid, isFalse);
    expect(result.error, contains('۱ تا ۳۶۵۰۰'));
  });

  test('rejects acceptanceCriteria shorter than 2 characters', () {
    final result = run(acceptanceCriteria: 'ا');
    expect(result.isValid, isFalse);
    expect(result.error, contains('شرایط پذیرش'));
  });

  test('accepts acceptanceCriteria at the 2 character boundary', () {
    expect(run(acceptanceCriteria: 'اا').isValid, isTrue);
  });
}
