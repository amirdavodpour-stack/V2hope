import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/marketplace/category.dart';

HopeCategory _cat(
  String id, {
  String? parentId,
  int sortOrder = 0,
  bool isActive = true,
  String name = '',
  String nameEn = '',
}) =>
    HopeCategory(
      id: id,
      slug: id,
      name: name.isEmpty ? id : name,
      nameEn: nameEn,
      description: '',
      parentId: parentId,
      sortOrder: sortOrder,
      isActive: isActive,
    );

void main() {
  group('HopeCategory.fromMap', () {
    test('isActive defaults to true unless explicitly false', () {
      expect(HopeCategory.fromMap(const {'id': 'a'}).isActive, isTrue);
      expect(
        HopeCategory.fromMap(const {'id': 'a', 'isActive': false}).isActive,
        isFalse,
      );
      // Any non-`false` value (including a truthy-looking string) is active —
      // only a literal `false` flips it off.
      expect(
        HopeCategory.fromMap(const {'id': 'a', 'isActive': 'no'}).isActive,
        isTrue,
      );
    });

    test('sortOrder falls back to 0 when missing or unparsable', () {
      expect(HopeCategory.fromMap(const {'id': 'a'}).sortOrder, 0);
      expect(
        HopeCategory.fromMap(const {'id': 'a', 'sortOrder': 'x'}).sortOrder,
        0,
      );
      expect(
        HopeCategory.fromMap(const {'id': 'a', 'sortOrder': '3'}).sortOrder,
        3,
      );
    });

    test('parentId is null when absent', () {
      expect(HopeCategory.fromMap(const {'id': 'a'}).parentId, isNull);
    });
  });

  group('HopeCategory.label', () {
    test('uses the Persian name unless english is requested', () {
      final category = _cat('a', name: 'فناوری', nameEn: 'Technology');
      expect(category.label(false), 'فناوری');
      expect(category.label(true), 'Technology');
    });

    test('falls back to the Persian name when nameEn is empty', () {
      final category = _cat('a', name: 'فناوری', nameEn: '');
      expect(category.label(true), 'فناوری');
    });
  });

  group('flattenCategories', () {
    test('inactive categories are excluded entirely', () {
      final result = flattenCategories([
        _cat('a', isActive: true),
        _cat('b', isActive: false),
      ]);
      expect(result.map((c) => c.id), ['a']);
    });

    test('root categories come before their children (depth-first order)', () {
      final result = flattenCategories([
        _cat('child', parentId: 'root'),
        _cat('root'),
      ]);
      expect(result.map((c) => c.id), ['root', 'child']);
    });

    test('siblings are ordered by sortOrder, ascending', () {
      final result = flattenCategories([
        _cat('b', sortOrder: 2),
        _cat('a', sortOrder: 1),
        _cat('c', sortOrder: 0),
      ]);
      expect(result.map((c) => c.id), ['c', 'a', 'b']);
    });

    test(
      'siblings with equal sortOrder fall back to alphabetical label order',
      () {
        final result = flattenCategories([
          _cat('x', name: 'ب', sortOrder: 1),
          _cat('y', name: 'الف', sortOrder: 1),
        ]);
        expect(result.map((c) => c.id), ['y', 'x']);
      },
    );

    test('multi-level trees are fully walked depth-first per branch', () {
      final result = flattenCategories([
        _cat('root-a', sortOrder: 0),
        _cat('root-b', sortOrder: 1),
        _cat('a-child', parentId: 'root-a'),
        _cat('a-grandchild', parentId: 'a-child'),
        _cat('b-child', parentId: 'root-b'),
      ]);
      expect(result.map((c) => c.id), [
        'root-a',
        'a-child',
        'a-grandchild',
        'root-b',
        'b-child',
      ]);
    });

    test(
        'an active child whose parent is inactive (or missing) is silently '
        'dropped, not promoted to the root', () {
      // Documents current behaviour rather than asserting it is necessarily
      // desirable: `walk` only descends into a bucket by visiting the parent
      // category first. If the parent was filtered out by the isActive
      // check, `walk('parent')` is never called, so the orphaned child never
      // makes it into the result even though it is itself active.
      final result = flattenCategories([
        _cat('parent', isActive: false),
        _cat('child', parentId: 'parent', isActive: true),
      ]);
      expect(result, isEmpty);
    });

    test(
        'a category referencing a parentId absent from the input is also '
        'dropped for the same reason', () {
      final result = flattenCategories([
        _cat('child', parentId: 'does-not-exist'),
      ]);
      expect(result, isEmpty);
    });

    test('an empty input list returns an empty result', () {
      expect(flattenCategories(const []), isEmpty);
    });
  });
}
