import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void installFakeSecureStorageForTests() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final backing = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (MethodCall call) async {
    final args = call.arguments is Map
        ? Map<String, dynamic>.from(call.arguments as Map)
        : const <String, dynamic>{};
    switch (call.method) {
      case 'write':
        final key = args['key'] as String;
        final value = args['value'] as String?;
        if (value == null) {
          backing.remove(key);
        } else {
          backing[key] = value;
        }
        return null;
      case 'read':
        return backing[args['key'] as String];
      case 'delete':
        backing.remove(args['key'] as String);
        return null;
      case 'deleteAll':
        backing.clear();
        return null;
      case 'readAll':
        return backing;
      default:
        return null;
    }
  });
}
