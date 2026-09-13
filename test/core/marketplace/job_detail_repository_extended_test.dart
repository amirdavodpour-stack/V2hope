import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/job_detail_repository.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

import '../../support/fake_api_server.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    if (call.method == 'read' && args['key'] == 'hope.access_token') {
      return 'token';
    }
    return null;
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeApiServer server;
  late ApiJobDetailRepository repository;
  setUp(() async {
    _installStorage();
    server = await FakeApiServer.start();
    repository = ApiJobDetailRepository(
        ApiClient(SecureStore(), baseUrl: server.baseUrl));
  });
  tearDown(() => server.close());

  test('listCandidates converts server maps to typed candidates', () async {
    server.handlers['/jobs/j1/candidates'] = (request, body) async {
      await respondJson(request, 200, {
        'data': [
          {
            'id': 'c1',
            'skills': 'Dart',
            'resumeText': 'resume',
            'status': 'forwarded'
          },
        ]
      });
    };
    final candidates = await repository.listCandidates('j1');
    expect(candidates, hasLength(1));
    expect(candidates.single.status, 'FORWARDED');
  });

  test('listCandidates treats a non-list response as empty', () async {
    server.handlers['/jobs/j1/candidates'] = (request, body) async {
      await respondJson(request, 200, {
        'data': {'items': []}
      });
    };
    expect(await repository.listCandidates('j1'), isEmpty);
  });

  test('applyToJob sends resume and skills and parses application', () async {
    server.handlers['/applications'] = (request, body) async {
      expect(body['jobId'], 'j1');
      expect(body['resumeText'], 'resume');
      expect(body['skills'], 'Flutter');
      await respondJson(request, 200, {
        'data': {
          'id': 'a1',
          'jobId': 'j1',
          'jobTitle': 'Job',
          'status': 'PENDING',
        }
      });
    };
    final app = await repository.applyToJob(
      'j1',
      resumeText: 'resume',
      skills: 'Flutter',
    );
    expect(app.id, 'a1');
  });

  test('submitOffer serializes the numeric price and message', () async {
    server.handlers['/offers'] = (request, body) async {
      expect(body['jobId'], 'j1');
      expect(body['price'], 125.5);
      expect(body['message'], 'offer');
      await respondJson(request, 200, {});
    };
    await repository.submitOffer('j1', price: 125.5, message: 'offer');
  });

  test('candidateAction encodes both path identifiers', () async {
    server.handlers['/jobs/j%2F1/candidates/c%2F1/shortlist'] =
        (request, body) async {
      await respondJson(request, 200, {});
    };
    await repository.candidateAction('j/1', 'c/1', 'shortlist');
  });
}
