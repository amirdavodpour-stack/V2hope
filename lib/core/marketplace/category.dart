class HopeCategory {
  const HopeCategory({
    required this.id,
    required this.slug,
    required this.name,
    required this.nameEn,
    required this.description,
    required this.parentId,
    required this.sortOrder,
    required this.isActive,
  });

  final String id;
  final String slug;
  final String name;
  final String nameEn;
  final String description;
  final String? parentId;
  final int sortOrder;
  final bool isActive;

  factory HopeCategory.fromMap(Map<String, dynamic> map) => HopeCategory(
        id: '${map['id'] ?? ''}',
        slug: '${map['slug'] ?? ''}',
        name: '${map['name'] ?? ''}',
        nameEn: '${map['nameEn'] ?? ''}',
        description: '${map['description'] ?? ''}',
        parentId: map['parentId'] == null ? null : '${map['parentId']}',
        sortOrder: int.tryParse('${map['sortOrder'] ?? 0}') ?? 0,
        isActive: map['isActive'] != false,
      );

  String label(bool english) => english && nameEn.isNotEmpty ? nameEn : name;
}

List<HopeCategory> flattenCategories(List<HopeCategory> categories) {
  final byParent = <String?, List<HopeCategory>>{};
  for (final category in categories.where((c) => c.isActive)) {
    byParent
        .putIfAbsent(category.parentId, () => <HopeCategory>[])
        .add(category);
  }
  for (final children in byParent.values) {
    children.sort((a, b) {
      final order = a.sortOrder.compareTo(b.sortOrder);
      return order != 0 ? order : a.label(false).compareTo(b.label(false));
    });
  }

  final result = <HopeCategory>[];
  void walk(String? parent) {
    for (final category in byParent[parent] ?? const <HopeCategory>[]) {
      result.add(category);
      walk(category.id);
    }
  }

  walk(null);
  return result;
}
