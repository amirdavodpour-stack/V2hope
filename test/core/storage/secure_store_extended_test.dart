import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';
import 'package:flutter/services.dart';

void _installStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final values = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    switch (call.method) {
      case 'write':
        values[args['key'] as String] = args['value'] as String;
        return null;
      case 'read':
        return values[args['key'] as String];
      case 'delete':
        values.remove(args['key'] as String);
        return null;
      case 'deleteAll':
        values.clear();
        return null;
      case 'readAll':
        return values;
      default:
        return null;
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(_installStorage);

  test('round-trips access and refresh tokens', () async {
    final store = SecureStore();
    await store.saveTokens(access: 'a', refresh: 'r');
    expect(await store.accessToken, 'a');
    expect(await store.refreshToken, 'r');
  });

  test('round-trips nested user data', () async {
    final store = SecureStore();
    await store.saveUser({
      'id': 'u1',
      'roles': ['PROVIDER'],
      'profile': {'city': 'تهران'},
    });
    expect(await store.user, {
      'id': 'u1',
      'roles': ['PROVIDER'],
      'profile': {'city': 'تهران'},
    });
  });

  test('invalid serialized user data is treated as absent', () async {
    const channel =
        MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    String? raw;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'read' &&
          call.arguments is Map &&
          (call.arguments as Map)['key'] == 'hope.user') {
        return raw;
      }
      return null;
    });
    raw = '{not-json';
    expect(await SecureStore().user, isNull);
  });

  test('corrupt cached user is cleared and reported once', () async {
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    var reads = 0;
    var deletes = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'read' &&
          call.arguments is Map &&
          (call.arguments as Map)['key'] == 'hope.user') {
        reads++;
        return '{bad-json';
      }
      if (call.method == 'delete' &&
          call.arguments is Map &&
          (call.arguments as Map)['key'] == 'hope.user') {
        deletes++;
      }
      return null;
    });
    Object? captured;
    final store = SecureStore(onCorruptUser: (error, _) => captured = error);
    expect(await store.user, isNull);
    expect(reads, 1);
    expect(deletes, 1);
    expect(captured, isNotNull);
  });

  test('clear removes the complete local authentication material', () async {
    final store = SecureStore();
    await store.saveTokens(access: 'a', refresh: 'r');
    await store.saveUser({'id': 'u1'});
    await store.clear();
    expect(await store.accessToken, isNull);
    expect(await store.refreshToken, isNull);
    expect(await store.user, isNull);
  });
}
