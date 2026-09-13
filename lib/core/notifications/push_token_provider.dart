/// Platform boundary for native push SDKs (FCM/APNs/Web Push).
///
/// The mobile app does not depend directly on a push vendor. A concrete
/// platform adapter can be injected when the native SDK is configured.
abstract interface class PushTokenProvider {
  Future<String?> getToken();
}
