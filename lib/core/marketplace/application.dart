/// Typed view of a candidate's job application as returned by
/// `GET /applications` (see `backend/src/routes/application_routes.js`;
/// `candidateId` is stripped server-side before it reaches the client).
class HopeApplication {
  const HopeApplication({
    required this.id,
    required this.jobId,
    required this.jobTitle,
    required this.jobCity,
    required this.jobKind,
    required this.resumeText,
    required this.skills,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String jobId;
  final String jobTitle;
  final String? jobCity;
  final String jobKind;
  final String resumeText;
  final String skills;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  static const _withdrawable = {
    'PENDING',
    'SHORTLISTED',
    'FORWARDED',
    'INTERVIEW'
  };
  bool get canWithdraw => _withdrawable.contains(status.toUpperCase());

  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'در انتظار بررسی';
      case 'SHORTLISTED': return 'منتخب اولیه';
      case 'FORWARDED': return 'ارسال شده برای بررسی';
      case 'INTERVIEW': return 'مصاحبه';
      case 'OFFERED': return 'پیشنهاد همکاری';
      case 'ACCEPTED': return 'پذیرفته شد';
      case 'REJECTED': return 'رد شد';
      case 'WITHDRAWN': return 'پس گرفته شد';
      default: return status;
    }
  }

  bool get isTerminal => const {'ACCEPTED', 'REJECTED', 'WITHDRAWN'}.contains(status.toUpperCase());

  factory HopeApplication.fromMap(Map<String, dynamic> map) => HopeApplication(
        id: '${map['id'] ?? ''}',
        jobId: '${map['jobId'] ?? ''}',
        jobTitle: '${map['jobTitle'] ?? ''}',
        jobCity: map['jobCity'] == null ? null : '${map['jobCity']}',
        jobKind: '${map['jobKind'] ?? 'JOB'}',
        resumeText: '${map['resumeText'] ?? ''}',
        skills: '${map['skills'] ?? ''}',
        status: '${map['status'] ?? 'PENDING'}'.toUpperCase(),
        createdAt: map['createdAt'] == null ? null : '${map['createdAt']}',
        updatedAt: map['updatedAt'] == null ? null : '${map['updatedAt']}',
      );
}


class HopeOffer {
  const HopeOffer({
    required this.id,
    required this.jobId,
    required this.providerId,
    required this.price,
    required this.message,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String jobId;
  final String providerId;
  final num price;
  final String message;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  factory HopeOffer.fromMap(Map<String, dynamic> map) => HopeOffer(
    id: '${map['id'] ?? ''}',
    jobId: '${map['jobId'] ?? ''}',
    providerId: '${map['providerId'] ?? ''}',
    price: map['price'] is num ? map['price'] as num : (num.tryParse('${map['price'] ?? 0}') ?? 0),
    message: '${map['message'] ?? ''}',
    status: '${map['status'] ?? 'PENDING'}'.toUpperCase(),
    createdAt: map['createdAt'] == null ? null : '${map['createdAt']}',
    updatedAt: map['updatedAt'] == null ? null : '${map['updatedAt']}',
  );

  bool get isPending => status == 'PENDING';
}
