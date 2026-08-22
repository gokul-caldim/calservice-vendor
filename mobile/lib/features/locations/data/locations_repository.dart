import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/saved_location.dart';
import 'locations_api.dart';

class LocationsRepository {
  LocationsRepository(this._api);

  final LocationsApi _api;

  Future<List<SavedLocation>> fetchSavedLocations() async {
    final raw = await _api.fetchSavedLocations();
    return raw.whereType<Map<String, dynamic>>().map(SavedLocation.fromJson).toList();
  }

  Future<SavedLocation> createLocation(Map<String, dynamic> data) async {
    final json = await _api.createLocation(data);
    return SavedLocation.fromJson(json);
  }

  Future<SavedLocation> updateLocation(int id, Map<String, dynamic> data) async {
    final json = await _api.updateLocation(id, data);
    return SavedLocation.fromJson(json);
  }

  Future<SavedLocation> patchLocation(int id, Map<String, dynamic> data) async {
    final json = await _api.patchLocation(id, data);
    return SavedLocation.fromJson(json);
  }

  Future<void> deleteLocation(int id) async {
    await _api.deleteLocation(id);
  }

  Future<GeocodeAddress?> reverseGeocode(double lat, double lng) async {
    return _api.reverseGeocode(lat, lng);
  }
}

final locationsRepositoryProvider = Provider<LocationsRepository>((ref) {
  return LocationsRepository(ref.watch(locationsApiProvider));
});
