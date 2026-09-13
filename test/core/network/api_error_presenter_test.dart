import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/network/api_error_presenter.dart';

void main() {
  const mapped = <String, String>{
    'UNAUTHENTICATED': 'نیاز به ورود مجدد دارید.',
    'INVALID_TOKEN': 'نیاز به ورود مجدد دارید.',
    'FORBIDDEN': 'دسترسی به این بخش مجاز نیست.',
    'JOB_NOT_HIRABLE': 'این موقعیت دیگر قابل استخدام نیست.',
    'CANDIDATE_ALREADY_HIRED': 'برای این موقعیت قبلاً فردی استخدام شده است.',
    'VALIDATION_ERROR': 'اطلاعات واردشده را بررسی کنید.',
    'RATE_LIMITED': 'درخواست‌های زیادی ارسال شده؛ کمی بعد دوباره تلاش کنید.',
    'NETWORK_ERROR': 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.',
    'TIMEOUT': 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.',
  };

  mapped.forEach((code, expected) {
    test('maps ApiException($code) to its stable Persian message', () {
      final message = apiErrorMessage(ApiException(code, 'raw backend text'));
      expect(message, expected);
    });
  });

  test('an unrecognized ApiException code returns the default fallback', () {
    final message = apiErrorMessage(
      ApiException('SOME_NEW_BACKEND_CODE', 'raw text'),
    );
    expect(message, 'عملیات ناموفق بود.');
  });

  test('a non-ApiException error also returns the default fallback', () {
    final message = apiErrorMessage(const FormatException('boom'));
    expect(message, 'عملیات ناموفق بود.');
  });

  test('a caller-supplied fallback overrides the default', () {
    final message = apiErrorMessage(
      Exception('boom'),
      fallback: 'بارگذاری اطلاعات با خطا مواجه شد.',
    );
    expect(message, 'بارگذاری اطلاعات با خطا مواجه شد.');
  });

  test('the mapped message never leaks the raw backend message text', () {
    final message = apiErrorMessage(
      ApiException('VALIDATION_ERROR', 'internal stack trace or SQL detail'),
    );
    expect(message, isNot(contains('internal stack trace')));
  });
}
