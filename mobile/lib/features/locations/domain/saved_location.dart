import '../../../core/utils/json_parsing.dart';

/// Mirrors EmployeeSavedLocationSerializer
/// (backend/workforce_api/serializers.py:907-951), returned by
/// GET /workforce/locations/saved/.
class SavedLocation {
  const SavedLocation({
    required this.id,
    required this.label,
    this.name,
    this.address,
    this.locality,
    this.city,
    this.state,
    this.pincode,
    this.landmark,
    this.latitude,
    this.longitude,
    required this.isDefault,
    this.createdAt,
  });

  factory SavedLocation.fromJson(Map<String, dynamic> json) {
    return SavedLocation(
      id: parseInt(json['id']) ?? 0,
      label: parseString(json['label']) ?? 'other',
      name: parseString(json['name']),
      address: parseString(json['address']),
      locality: parseString(json['locality']),
      city: parseString(json['city']),
      state: parseString(json['state']),
      pincode: parseString(json['pincode']),
      landmark: parseString(json['landmark']),
      latitude: parseDouble(json['latitude']),
      longitude: parseDouble(json['longitude']),
      isDefault: parseBool(json['is_default']),
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final String label; // home | work | other
  final String? name;
  final String? address;
  final String? locality;
  final String? city;
  final String? state;
  final String? pincode;
  final String? landmark;
  final double? latitude;
  final double? longitude;
  final bool isDefault;
  final DateTime? createdAt;

  String get displayTitle {
    if (name != null && name!.isNotEmpty) return name!;
    if (label.isNotEmpty) return label[0].toUpperCase() + label.substring(1);
    return 'Saved Location';
  }

  String get fullAddress {
    final parts = [address, locality, city, state, pincode].where((p) => p != null && p.isNotEmpty);
    return parts.isEmpty ? 'No address details' : parts.join(', ');
  }

  bool get hasCoordinates => latitude != null && longitude != null;
}

class GeocodeAddress {
  const GeocodeAddress({
    this.locality,
    this.city,
    this.state,
    this.pincode,
    this.formattedAddress,
  });

  final String? locality;
  final String? city;
  final String? state;
  final String? pincode;
  final String? formattedAddress;
}
