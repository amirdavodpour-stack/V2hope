import '../marketplace/job.dart';

/// Typed participant-safe payment view returned by the backend payment routes.
class HopePayment {
  const HopePayment({
    this.id,
    required this.status,
    required this.amount,
    this.providerRef,
    required this.job,
    this.fees,
    this.createdAt,
    this.updatedAt,
  });

  final String? id;
  final String status;
  final num? amount;
  final String? providerRef;
  final HopeJob job;
  final HopePaymentFees? fees;
  final String? createdAt;
  final String? updatedAt;

  bool get isMissing => status == 'NO_TRANSACTION';
  String get paymentStatus => status;

  factory HopePayment.fromMap(Map<String, dynamic> map) {
    final rawJob = map['job'];
    if (rawJob is! Map) {
      throw const FormatException('Payment job payload is missing');
    }
    return HopePayment(
      id: map['id'] == null ? null : '${map['id']}',
      status: '${map['status'] ?? map['paymentStatus'] ?? 'NO_TRANSACTION'}'
          .toUpperCase(),
      amount: map['amount'] is num
          ? map['amount'] as num
          : num.tryParse('${map['amount'] ?? ''}'),
      providerRef: map['providerRef'] == null ? null : '${map['providerRef']}',
      job: HopeJob.fromMap(Map<String, dynamic>.from(rawJob)),
      fees: map['fees'] is Map
          ? HopePaymentFees.fromMap(
              Map<String, dynamic>.from(map['fees'] as Map))
          : null,
      createdAt: map['createdAt'] == null ? null : '${map['createdAt']}',
      updatedAt: map['updatedAt'] == null ? null : '${map['updatedAt']}',
    );
  }
}

class HopePaymentFees {
  const HopePaymentFees({
    required this.baseAmount,
    required this.employerFee,
    required this.workerFee,
    required this.platformFee,
    required this.employerCharge,
    required this.providerPayout,
    required this.policyVersion,
    required this.currency,
  });

  final num? baseAmount;
  final num? employerFee;
  final num? workerFee;
  final num? platformFee;
  final num? employerCharge;
  final num? providerPayout;
  final String policyVersion;
  final String currency;

  factory HopePaymentFees.fromMap(Map<String, dynamic> map) => HopePaymentFees(
        baseAmount: _number(map['baseAmount']),
        employerFee: _number(map['employerFee']),
        workerFee: _number(map['workerFee']),
        platformFee: _number(map['platformFee']),
        employerCharge: _number(map['employerCharge']),
        providerPayout: _number(map['providerPayout']),
        policyVersion: '${map['policyVersion'] ?? 'legacy'}',
        currency: '${map['currency'] ?? 'USD'}',
      );

  static num? _number(dynamic value) =>
      value is num ? value : num.tryParse('${value ?? ''}');
}
