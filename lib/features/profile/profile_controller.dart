import '../../core/marketplace/application.dart';
import '../../core/profile/profile_repository.dart';

class ProfileController {
  ProfileController({required this.repository});

  final ProfileRepository repository;

  Future<HopeProviderProfile> loadProfile() => repository.getProviderProfile();

  Future<List<HopeApplication>> loadApplications() =>
      repository.listApplications();

  Future<void> withdrawApplication(String applicationId) =>
      repository.withdrawApplication(applicationId);
}
