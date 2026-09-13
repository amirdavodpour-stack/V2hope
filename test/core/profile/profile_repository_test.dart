import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/profile/profile_repository.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeApiServer server;
  late ApiProfileRepository repository;

  setUp(() async {
    installFakeSecureStorage();
    server = await FakeApiServer.start();
    final api = ApiClient(SecureStore(), baseUrl: server.baseUrl);
    repository = ApiProfileRepository(api);
  });

  tearDown(() => server.close());

  group('getProviderProfile', () {
    test('parses the provider profile from an authenticated GET', () async {
      server.handlers['/providers/me'] = (request, body) async {
        expect(request.headers.value('authorization'), isNull);
        await respondJson(request, 200, {
          'providerType': 'FREELANCER',
          'capacity': 'FULL_TIME',
          'verificationStatus': 'VERIFIED',
        });
      };

      final profile = await repository.getProviderProfile();

      expect(profile.providerType, 'FREELANCER');
      expect(profile.verificationStatus, 'VERIFIED');
    });

    test('propagates a 404 as an ApiException', () async {
      server.handlers['/providers/me'] = (request, body) async {
        await respondJson(request, 404, {
          'error': {'code': 'NOT_FOUND', 'message': 'no profile'},
        });
      };

      await expectLater(
        repository.getProviderProfile(),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('listApplications', () {
    test('parses the items list into HopeApplication objects', () async {
      server.handlers['/applications'] = (request, body) async {
        await respondJson(request, 200, {
          'items': [
            {
              'id': 'a1',
              'jobId': 'j1',
              'jobTitle': 'Job one',
              'status': 'PENDING',
            },
            {
              'id': 'a2',
              'jobId': 'j2',
              'jobTitle': 'Job two',
              'status': 'HIRED',
            },
          ],
        });
      };

      final applications = await repository.listApplications();

      expect(applications, hasLength(2));
      expect(applications.map((a) => a.id), ['a1', 'a2']);
      expect(applications.last.canWithdraw, isFalse);
    });

    test(
        'an unexpected (non-list) items shape yields an empty list instead '
        'of throwing', () async {
      server.handlers['/applications'] = (request, body) async {
        await respondJson(request, 200, {'items': 'unexpected-string'});
      };

      final applications = await repository.listApplications();

      expect(applications, isEmpty);
    });

    test('a raw list body (no items wrapper) is also accepted', () async {
      server.handlers['/applications'] = (request, body) async {
        request.response.statusCode = 200;
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          '[{"id":"a1","jobId":"j1","jobTitle":"Job one"}]',
        );
        await request.response.close();
      };

      final applications = await repository.listApplications();

      expect(applications.map((a) => a.id), ['a1']);
    });
  });

  group('withdrawApplication', () {
    test(
      'POSTs to the withdraw endpoint and returns the updated application',
      () async {
        server.handlers['/applications/a1/withdraw'] = (request, body) async {
          expect(request.method, 'POST');
          await respondJson(request, 200, {
            'id': 'a1',
            'jobId': 'j1',
            'jobTitle': 'Job one',
            'status': 'WITHDRAWN',
          });
        };

        final application = await repository.withdrawApplication('a1');

        expect(application.status, 'WITHDRAWN');
        expect(application.canWithdraw, isFalse);
      },
    );
  });
}
