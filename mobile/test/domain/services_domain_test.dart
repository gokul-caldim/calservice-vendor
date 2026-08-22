import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/locations/domain/saved_location.dart';
import 'package:mobile/features/services/domain/service_catalog.dart';

void main() {
  group('Services & Locations Domain Models', () {
    test('parses CatalogCategory and CatalogService correctly', () {
      final json = {
        'id': 1,
        'name': 'AC & Appliance',
        'slug': 'ac-appliance',
        'description': 'HVAC and home cooling repairs',
        'icon': 'Wrench',
        'services': [
          {
            'id': 101,
            'name': 'AC Regular Servicing & Jet Clean',
            'slug': 'ac-regular-servicing',
            'description': 'Full deep cleaning of split AC unit',
            'icon': 'Wrench',
            'category_id': 1,
            'category_name': 'AC & Appliance',
            'duration': 60,
          },
          {
            'id': 102,
            'name': 'Compressor Replacement',
            'slug': 'compressor-replacement',
            'duration_minutes': 120,
          },
        ],
      };

      final cat = CatalogCategory.fromJson(json);

      expect(cat.id, 1);
      expect(cat.name, 'AC & Appliance');
      expect(cat.services.length, 2);

      final s1 = cat.services[0];
      expect(s1.id, 101);
      expect(s1.name, 'AC Regular Servicing & Jet Clean');
      expect(s1.durationMinutes, 60);

      final s2 = cat.services[1];
      expect(s2.id, 102);
      expect(s2.durationMinutes, 120);
    });

    test('parses EmployeeSkill correctly', () {
      final json = {
        'id': 12,
        'skill_id': 5,
        'skill_name': 'Refrigerant Recovery',
        'category': 'HVAC Certified',
        'proficiency_level': 'EXPERT',
        'is_verified': true,
      };

      final skill = EmployeeSkill.fromJson(json);

      expect(skill.id, 12);
      expect(skill.skillId, 5);
      expect(skill.skillName, 'Refrigerant Recovery');
      expect(skill.category, 'HVAC Certified');
      expect(skill.proficiencyLevel, 'EXPERT');
      expect(skill.isVerified, isTrue);
    });

    test('parses SavedLocation correctly', () {
      final json = {
        'id': 7,
        'label': 'home',
        'name': 'Main Residence',
        'address': 'Flat 4B, Oceanic Tower',
        'locality': 'Anna Nagar',
        'city': 'Chennai',
        'state': 'Tamil Nadu',
        'pincode': '600040',
        'landmark': 'Near Roundtana',
        'latitude': 13.0827123,
        'longitude': 80.2707456,
        'is_default': true,
      };

      final loc = SavedLocation.fromJson(json);

      expect(loc.id, 7);
      expect(loc.label, 'home');
      expect(loc.displayTitle, 'Main Residence');
      expect(loc.isDefault, isTrue);
      expect(loc.fullAddress, contains('Flat 4B, Oceanic Tower'));
      expect(loc.fullAddress, contains('Chennai'));
      expect(loc.hasCoordinates, isTrue);
      expect(loc.latitude, 13.0827123);
    });
  });
}
