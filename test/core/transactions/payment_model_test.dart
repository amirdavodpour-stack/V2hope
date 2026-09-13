import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/transactions/payment.dart';

void main() {
  Map<String, dynamic> jobPayload() => <String, dynamic>{
        'id': 'j1',
        'title': 'Fix a leaking tap',
        'description': 'Kitchen tap drips',
      };

  group('HopePayment.fromMap', () {
    test('throws FormatException when the job payload is missing', () {
      expect(
        () => HopePayment.fromMap({'status': 'HELD', 'amount': 100}),
        throwsFormatException,
      );
    });

    test('defaults to NO_TRANSACTION when status is absent', () {
      final payment = HopePayment.fromMap({'job': jobPayload()});
      expect(payment.status, 'NO_TRANSACTION');
      expect(payment.isMissing, isTrue);
    });

    test('falls back to paymentStatus when status is absent', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'paymentStatus': 'released',
      });
      expect(payment.status, 'RELEASED');
      expect(payment.isMissing, isFalse);
    });

    test('status is uppercased regardless of source casing', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'status': 'held',
      });
      expect(payment.status, 'HELD');
    });

    test('amount accepts a numeric value as-is', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'amount': 125.5,
      });
      expect(payment.amount, 125.5);
    });

    test('amount parses a numeric string', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'amount': '125.50',
      });
      expect(payment.amount, 125.5);
    });

    test('amount is null when unparsable', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'amount': 'not-a-number',
      });
      expect(payment.amount, isNull);
    });

    test('id and providerRef are stringified when present, null otherwise', () {
      final withRefs = HopePayment.fromMap({
        'job': jobPayload(),
        'id': 42,
        'providerRef': 'pi_123',
      });
      expect(withRefs.id, '42');
      expect(withRefs.providerRef, 'pi_123');

      final withoutRefs = HopePayment.fromMap({'job': jobPayload()});
      expect(withoutRefs.id, isNull);
      expect(withoutRefs.providerRef, isNull);
    });

    test('fees is null when the map has no fees key', () {
      final payment = HopePayment.fromMap({'job': jobPayload()});
      expect(payment.fees, isNull);
    });

    test('fees is parsed when present', () {
      final payment = HopePayment.fromMap({
        'job': jobPayload(),
        'fees': {
          'baseAmount': 100,
          'employerFee': 10,
          'workerFee': 0,
          'platformFee': 10,
          'employerCharge': 110,
          'providerPayout': 100,
          'policyVersion': '2026-08-v1',
          'currency': 'USD',
        },
      });
      expect(payment.fees, isNotNull);
      expect(payment.fees!.baseAmount, 100);
      expect(payment.fees!.employerCharge, 110);
      expect(payment.fees!.policyVersion, '2026-08-v1');
    });
  });

  group('HopePaymentFees.fromMap', () {
    test('missing policyVersion/currency fall back to legacy/USD', () {
      final fees = HopePaymentFees.fromMap({});
      expect(fees.policyVersion, 'legacy');
      expect(fees.currency, 'USD');
      expect(fees.baseAmount, isNull);
    });

    test('numeric-string fee fields are parsed to numbers', () {
      final fees = HopePaymentFees.fromMap({
        'baseAmount': '100',
        'employerFee': '10.5',
        'workerFee': '0',
        'platformFee': '10.5',
        'employerCharge': '110.5',
        'providerPayout': '100',
      });
      expect(fees.baseAmount, 100);
      expect(fees.employerFee, 10.5);
      expect(fees.employerCharge, 110.5);
    });

    test('unparsable fee fields degrade to null instead of throwing', () {
      final fees = HopePaymentFees.fromMap({'baseAmount': 'garbage'});
      expect(fees.baseAmount, isNull);
    });
  });
}
