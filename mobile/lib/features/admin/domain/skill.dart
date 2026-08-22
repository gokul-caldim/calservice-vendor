import '../../../core/utils/json_parsing.dart';

/// Represents a skill in the master workforce skills catalog.
class Skill {
  const Skill({
    required this.id,
    required this.name,
    this.category = 'General',
    this.description,
    this.createdAt,
    this.updatedAt,
  });

  factory Skill.fromJson(Map<String, dynamic> json) {
    return Skill(
      id: parseInt(json['id']) ?? 0,
      name: parseString(json['name']) ?? parseString(json['skill_name']) ?? 'Skill',
      category: parseString(json['category']) ?? 'General',
      description: parseString(json['description']),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: parseDateTime(json['updated_at']),
    );
  }

  final int id;
  final String name;
  final String category;
  final String? description;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}
