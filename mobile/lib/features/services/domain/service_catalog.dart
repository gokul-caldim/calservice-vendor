import '../../../core/utils/json_parsing.dart';

class CatalogService {
  const CatalogService({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.icon,
    this.categoryId,
    this.categoryName,
    this.durationMinutes = 60,
  });

  factory CatalogService.fromJson(Map<String, dynamic> json) {
    return CatalogService(
      id: json['id'],
      name: parseString(json['name']) ?? 'Service',
      slug: parseString(json['slug']) ?? '',
      description: parseString(json['description']),
      icon: parseString(json['icon']) ?? 'Wrench',
      categoryId: json['category_id'],
      categoryName: parseString(json['category_name']),
      durationMinutes: parseInt(json['duration']) ?? parseInt(json['duration_minutes']) ?? 60,
    );
  }

  final dynamic id;
  final String name;
  final String slug;
  final String? description;
  final String? icon;
  final dynamic categoryId;
  final String? categoryName;
  final int durationMinutes;
}

class CatalogCategory {
  const CatalogCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.icon,
    required this.services,
  });

  factory CatalogCategory.fromJson(Map<String, dynamic> json) {
    final svcsJson = json['services'];
    return CatalogCategory(
      id: json['id'],
      name: parseString(json['name']) ?? 'Category',
      slug: parseString(json['slug']) ?? '',
      description: parseString(json['description']),
      icon: parseString(json['icon']) ?? 'Wrench',
      services: svcsJson is List
          ? svcsJson.whereType<Map<String, dynamic>>().map(CatalogService.fromJson).toList()
          : const [],
    );
  }

  final dynamic id;
  final String name;
  final String slug;
  final String? description;
  final String? icon;
  final List<CatalogService> services;
}

class EmployeeSkill {
  const EmployeeSkill({
    required this.id,
    required this.skillId,
    required this.skillName,
    this.category,
    required this.proficiencyLevel,
    required this.isVerified,
  });

  factory EmployeeSkill.fromJson(Map<String, dynamic> json) {
    return EmployeeSkill(
      id: parseInt(json['id']) ?? 0,
      skillId: parseInt(json['skill_id']) ?? 0,
      skillName: parseString(json['skill_name']) ?? 'Skill',
      category: parseString(json['category']),
      proficiencyLevel: parseString(json['proficiency_level']) ?? 'INTERMEDIATE',
      isVerified: parseBool(json['is_verified']),
    );
  }

  final int id;
  final int skillId;
  final String skillName;
  final String? category;
  final String proficiencyLevel;
  final bool isVerified;
}
