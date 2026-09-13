import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/marketplace_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeApiServer server;
  late ApiMarketplaceRepository repository;

  setUp(() async {
    installFakeSecureStorage();
    server = await FakeApiServer.start();
    final api = ApiClient(SecureStore(), baseUrl: server.baseUrl);
    repository = ApiMarketplaceRepository(api);
  });

  tearDown(() => server.close());

  group('listCategories', () {
    test(
      'flattens the nested response into parent-before-child order',
      () async {
        server.handlers['/categories'] = (request, body) async {
          await respondJson(request, 200, {
            'data': [
              {'id': 'root', 'slug': 'root', 'name': 'ریشه', 'sortOrder': 0},
              {
                'id': 'child',
                'slug': 'child',
                'name': 'فرزند',
                'parentId': 'root',
                'sortOrder': 0,
              },
            ],
          });
        };

        final categories = await repository.listCategories();

        expect(categories.map((c) => c.id), ['root', 'child']);
      },
    );

    test('tolerates a bare list response (no data envelope)', () async {
      // The backend may return a raw JSON array instead of {data: [...]};
      // ApiMarketplaceRepository._asList must handle both shapes.
      server.handlers['/categories'] = (request, body) async {
        request.response.statusCode = 200;
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          '[{"id":"a","slug":"a","name":"الف","sortOrder":0}]',
        );
        await request.response.close();
      };

      final categories = await repository.listCategories();

      expect(categories.map((c) => c.id), ['a']);
    });
  });

  group('listOpportunities', () {
    test(
      'requests /jobs (not /jobs/recommended) when personalization is off',
      () async {
        server.handlers['/jobs'] = (request, body) async {
          expect(request.uri.queryParameters['city'], 'تهران');
          await respondJson(request, 200, {'data': []});
        };

        await repository.listOpportunities(
          city: 'تهران',
          personalizedRecommendations: false,
        );
      },
    );

    test(
        'requests /jobs/recommended with lat/lng when personalization is on '
        'and coordinates are available', () async {
      server.handlers['/jobs/recommended'] = (request, body) async {
        expect(request.uri.queryParameters['lat'], '35.7');
        expect(request.uri.queryParameters['lng'], '51.4');
        await respondJson(request, 200, {'data': []});
      };

      await repository.listOpportunities(
        city: 'تهران',
        personalizedRecommendations: true,
        latitude: 35.7,
        longitude: 51.4,
      );
    });

    test(
        'omits lat/lng from the recommended query when coordinates are '
        'unavailable', () async {
      server.handlers['/jobs/recommended'] = (request, body) async {
        expect(request.uri.queryParameters.containsKey('lat'), isFalse);
        await respondJson(request, 200, {'data': []});
      };

      await repository.listOpportunities(
        city: 'تهران',
        personalizedRecommendations: true,
      );
    });

    test('parses each returned item into a HopeJob', () async {
      server.handlers['/jobs'] = (request, body) async {
        await respondJson(request, 200, {
          'data': [
            {'id': 'j1', 'title': 'Job one', 'description': 'd'},
            {'id': 'j2', 'title': 'Job two', 'description': 'd'},
          ],
        });
      };

      final jobs = await repository.listOpportunities(
        city: 'تهران',
        personalizedRecommendations: false,
      );

      expect(jobs, hasLength(2));
      expect(jobs.map((j) => j.id), ['j1', 'j2']);
    });

    test(
        'omits the city query parameter entirely when city is null '
        '(regression: sending a literal "all cities" sentinel made the '
        "server's exact-match filter drop every job)", () async {
      server.handlers['/jobs'] = (request, body) async {
        expect(request.uri.queryParameters.containsKey('city'), isFalse);
        await respondJson(request, 200, {'data': []});
      };

      await repository.listOpportunities(
        city: null,
        personalizedRecommendations: false,
      );
    });
  });

  group('createOpportunity', () {
    test('sends the body and returns the parsed job on success', () async {
      server.handlers['/jobs'] = (request, body) async {
        expect(request.method, 'POST');
        expect(body['title'], 'New gig');
        await respondJson(request, 200, {
          'id': 'new-job',
          'title': 'New gig',
          'description': 'd',
        });
      };

      final job = await repository.createOpportunity({'title': 'New gig'});

      expect(job.id, 'new-job');
    });

    test('throws FormatException when the response has no id', () async {
      server.handlers['/jobs'] = (request, body) async {
        await respondJson(request, 200, {'title': 'No id here'});
      };

      await expectLater(
        repository.createOpportunity({'title': 'x'}),
        throwsFormatException,
      );
    });

    test('surfaces backend validation failures as ApiException', () async {
      server.handlers['/jobs'] = (request, body) async {
        await respondJson(request, 422, {
          'error': {'code': 'VALIDATION_ERROR', 'message': 'invalid'},
        });
      };

      await expectLater(
        repository.createOpportunity({'title': ''}),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('publishOpportunity', () {
    test('rejects a blank id locally without making a network call', () async {
      await expectLater(
        repository.publishOpportunity('   '),
        throwsFormatException,
      );
      expect(server.received, isEmpty);
    });

    test('POSTs to the publish endpoint for a valid id', () async {
      var called = false;
      server.handlers['/jobs/j1/publish'] = (request, body) async {
        called = true;
        expect(request.method, 'POST');
        await respondJson(request, 200, {});
      };

      await repository.publishOpportunity('j1');

      expect(called, isTrue);
    });
  });
}
