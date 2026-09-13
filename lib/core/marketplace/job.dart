/// Typed view of a job/mission as returned by `GET /jobs`, `GET /jobs/:id`,
/// and `GET /jobs/recommended` (see `backend/src/application/view_helpers.js`
/// `jobView()` for the canonical server-side shape).
class HopeJob {
  const HopeJob({
    required this.id,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.category,
    required this.jobType,
    required this.budgetType,
    required this.budgetMin,
    required this.budgetMax,
    required this.duration,
    required this.acceptanceCriteria,
    required this.status,
    required this.ownerId,
    required this.providerId,
    required this.city,
    required this.kind,
    required this.visibility,
    required this.schedule,
    required this.monthlySalary,
    required this.applicationDeadline,
    required this.offerCount,
    required this.isOwner,
    required this.distanceKm,
    required this.raw,
    this.verticalId,
    this.attributes = const <String, dynamic>{},
  });

  final String id;
  final String title;
  final String description;
  final String? categoryId;
  final String? category;
  final String? jobType;
  final String? budgetType;
  final String? budgetMin;
  final String? budgetMax;
  final String? duration;
  final String? acceptanceCriteria;
  final String? status;
  final String? ownerId;
  final String? providerId;
  final String? city;
  final String? schedule;
  final String? monthlySalary;
  final String? applicationDeadline;
  final int offerCount;
  final bool isOwner;

  /// Present only on `/jobs/recommended` results.
  final double? distanceKm;

  /// `'MISSION'` (one-off, offer-based) or `'JOB'` (recruitment, application-based).
  final String kind;

  /// `'PUBLIC'` or `'SPECIALIZED'`.
  final String visibility;

  /// Multi-vertical plumbing (Wave 1, additive). `null` on legacy responses
  /// and on any payload produced before the server exposed the column.
  final String? verticalId;

  /// Vertical-specific attributes. Always a map; defaults to `{}` for the
  /// live `jobs` vertical and for legacy responses that omit the key.
  final Map<String, dynamic> attributes;

  /// The raw server map. Kept as an escape hatch for fields not yet promoted
  /// to this model (e.g. `feePolicy`, `recommendationReasons`) so migrating
  /// callers to [HopeJob] doesn't require modeling every field up front.
  final Map<String, dynamic> raw;

  bool get isJob => kind.toUpperCase() == 'JOB';
  bool get isMission => !isJob;
  bool get isSpecialized => visibility.toUpperCase() == 'SPECIALIZED';

  /// Explainability metadata is emitted only for personalized recommendations.
  List<String> get recommendationReasons {
    final value = raw['recommendationReasons'];
    return value is List ? value.whereType<String>().toList(growable: false) : const [];
  }

  Map<String, double> get recommendationComponents {
    final value = raw['recommendationComponents'];
    if (value is! Map) return const {};
    return Map.unmodifiable({
      for (final entry in value.entries)
        if (entry.value is num) '${entry.key}': (entry.value as num).toDouble(),
    });
  }

  double? get recommendationScore {
    final value = raw['recommendationScore'];
    return value is num ? value.toDouble() : double.tryParse('$value');
  }

  bool get isRecommended => recommendationScore != null || recommendationReasons.isNotEmpty;

  factory HopeJob.fromMap(Map<String, dynamic> map) {
    final kind =
        '${map['kind'] ?? (map['jobType'] == 'FIXED' ? 'MISSION' : 'JOB')}'
            .toUpperCase();
    final rawCategory = map['category'];
    final rawDistance = map['distanceKm'];
    return HopeJob(
      id: '${map['id'] ?? ''}',
      title: '${map['title'] ?? ''}',
      description: '${map['description'] ?? ''}',
      categoryId: map['categoryId'] == null ? null : '${map['categoryId']}',
      category: rawCategory == null ? null : '$rawCategory',
      jobType: map['jobType'] == null ? null : '${map['jobType']}',
      budgetType: map['budgetType'] == null ? null : '${map['budgetType']}',
      budgetMin: map['budgetMin'] == null ? null : '${map['budgetMin']}',
      budgetMax: map['budgetMax'] == null ? null : '${map['budgetMax']}',
      duration: map['duration'] == null ? null : '${map['duration']}',
      acceptanceCriteria: map['acceptanceCriteria'] == null
          ? null
          : '${map['acceptanceCriteria']}',
      status: map['status'] == null ? null : '${map['status']}',
      ownerId: map['ownerId'] == null ? null : '${map['ownerId']}',
      providerId: map['providerId'] == null ? null : '${map['providerId']}',
      city: map['city'] == null ? null : '${map['city']}',
      kind: kind,
      visibility: '${map['visibility'] ?? 'PUBLIC'}'.toUpperCase(),
      schedule: map['schedule'] == null ? null : '${map['schedule']}',
      monthlySalary:
          map['monthlySalary'] == null ? null : '${map['monthlySalary']}',
      applicationDeadline: map['applicationDeadline'] == null
          ? null
          : '${map['applicationDeadline']}',
      offerCount: int.tryParse('${map['offerCount'] ?? 0}') ?? 0,
      isOwner: map['isOwner'] == true,
      distanceKm: rawDistance == null ? null : double.tryParse('$rawDistance'),
      raw: map,
      verticalId: map['verticalId'] == null ? null : '${map['verticalId']}',
      attributes: _attributesFrom(map['attributes']),
    );
  }

  /// JSON round-trip counterpart of [HopeJob.fromMap]. Emits the new keys only
  /// when they carry information, so a jobs-vertical listing serialises to the
  /// exact payload shape it had before Wave 1.
  Map<String, dynamic> toMap() {
    final map = Map<String, dynamic>.from(raw);
    if (verticalId != null) map['verticalId'] = verticalId;
    if (attributes.isNotEmpty) {
      map['attributes'] = Map<String, dynamic>.from(attributes);
    }
    return map;
  }

  static Map<String, dynamic> _attributesFrom(dynamic value) {
    if (value is Map) {
      return Map<String, dynamic>.fromEntries(
        value.entries.map((e) => MapEntry('${e.key}', e.value)),
      );
    }
    return const <String, dynamic>{};
  }
}
