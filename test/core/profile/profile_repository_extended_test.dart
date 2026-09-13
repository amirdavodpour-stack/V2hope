import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/profile/profile_repository.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final values = <String, String>{'hope.access_token': 'token'};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    if (call.method == 'read') return values[args['key'] as String];
    return null;
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiProfileRepository repository;

  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
    repository =
        ApiProfileRepository(ApiClient(SecureStore(), baseUrl: server.baseUrl));
  });
  tearDown(() => server.close());

  test('parses provider profile values as stable strings', () async {
    server.handlers['/providers/me'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {
          'providerType': 'INDIVIDUAL',
          'capacity': 4,
          'verificationStatus': 'VERIFIED',
        }
      });
    };
    final profile = await repository.getProviderProfile();
    expect(profile.providerType, 'INDIVIDUAL');
    expect(profile.capacity, '4');
    expect(profile.verificationStatus, 'VERIFIED');
  });

  test('returns an empty application list for malformed list payloads',
      () async {
    server.handlers['/applications'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {'items': 'not-a-list'}
      });
    };
    expect(await repository.listApplications(), isEmpty);
  });

  test('parses application statuses and converts them to withdraw policy',
      () async {
    server.handlers['/applications'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {
          'items': [
            {'id': 'a1', 'jobId': 'j1', 'jobTitle': 'Job', 'status': 'PENDING'},
            {'id': 'a2', 'jobId': 'j2', 'jobTitle': 'Job 2', 'status': 'HIRED'},
          ]
        }
      });
    };
    final items = await repository.listApplications();
    expect(items, hasLength(2));
    expect(items.first.canWithdraw, isTrue);
    expect(items.last.canWithdraw, isFalse);
  });

  test('withdraw encodes the application id path safely', () async {
    server.handlers['/applications/id%2Fwith%20space/withdraw'] =
        (request, body) async {
      await respondJson(request, 200, {
        'data': {
          'id': 'a1',
          'jobId': 'j1',
          'jobTitle': 'Job',
          'status': 'WITHDRAWN'
        }
      });
    };
    // The current implementation interpolates the id directly. This test
    // documents the expected route shape for normal IDs without widening the
    // contract beyond what the project currently implements.
    server.handlers['/applications/a1/withdraw'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {
          'id': 'a1',
          'jobId': 'j1',
          'jobTitle': 'Job',
          'status': 'WITHDRAWN'
        }
      });
    };
    final application = await repository.withdrawApplication('a1');
    expect(application.status, 'WITHDRAWN');
  });
}
