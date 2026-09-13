import '../marketplace/application.dart';
import '../network/api_client.dart';

class HopeProviderProfile {
  const HopeProviderProfile({
    required this.providerType,
    required this.capacity,
    required this.verificationStatus,
    required this.trustSignals,
  });

  final String providerType;
  final String capacity;
  final String verificationStatus;
  final Map<String, dynamic> trustSignals;

  bool get isVerified => trustSignals['verified'] == true;
  int get completedJobs => _intValue(trustSignals['completedJobs']);
  int get activeJobs => _intValue(trustSignals['activeJobs']);
  String get memberSince => '${trustSignals['memberSince'] ?? ''}';

  factory HopeProviderProfile.fromMap(Map<String, dynamic> map) =>
      HopeProviderProfile(
        providerType: '${map['providerType'] ?? ''}',
        capacity: '${map['capacity'] ?? ''}',
        verificationStatus: '${map['verificationStatus'] ?? ''}',
        trustSignals: map['trustSignals'] is Map
            ? Map<String, dynamic>.from(map['trustSignals'] as Map)
            : const <String, dynamic>{},
      );

  static int _intValue(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;
}

abstract interface class ProfileRepository {
  Future<HopeProviderProfile> getProviderProfile();
  Future<List<HopeApplication>> listApplications();
  Future<HopeApplication> withdrawApplication(String applicationId);
}

class ApiProfileRepository implements ProfileRepository {
  ApiProfileRepository(this._api);
  final ApiClient _api;

  @override
  Future<HopeProviderProfile> getProviderProfile() async {
    final data = await _api.request('GET', '/providers/me', auth: true);
    return HopeProviderProfile.fromMap(Map<String, dynamic>.from(data as Map));
  }

  @override
  Future<List<HopeApplication>> listApplications() async {
    final data = await _api.request('GET', '/applications', auth: true);
    final items = data is Map ? data['items'] : data;
    if (items is! List) return const <HopeApplication>[];
    return items
        .whereType<Map>()
        .map((item) => HopeApplication.fromMap(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<HopeApplication> withdrawApplication(String applicationId) async {
    final data = await _api.request(
      'POST',
      '/applications/$applicationId/withdraw',
      auth: true,
    );
    return HopeApplication.fromMap(Map<String, dynamic>.from(data as Map));
  }
}
