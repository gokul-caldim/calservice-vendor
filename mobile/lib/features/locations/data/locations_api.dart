import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/saved_location.dart';

class LocationsApi {
  LocationsApi(this._dio);

  final Dio _dio;

  Future<List<dynamic>> fetchSavedLocations() async {
    final response = await _dio.get('/workforce/locations/saved/');
    final data = response.data;
    return data is List ? data : const [];
  }

  Future<Map<String, dynamic>> createLocation(Map<String, dynamic> data) async {
    final response = await _dio.post('/workforce/locations/saved/', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateLocation(int id, Map<String, dynamic> data) async {
    final response = await _dio.put('/workforce/locations/saved/$id/', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> patchLocation(int id, Map<String, dynamic> data) async {
    final response = await _dio.patch('/workforce/locations/saved/$id/', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<void> deleteLocation(int id) async {
    await _dio.delete('/workforce/locations/saved/$id/');
  }

  Future<GeocodeAddress?> reverseGeocode(double latitude, double longitude) async {
    try {
      final dio = Dio();
      final url = 'https://nominatim.openstreetmap.org/reverse?lat=$latitude&lon=$longitude&format=json&addressdetails=1';
      final resp = await dio.get(
        url,
        options: Options(headers: {'User-Agent': 'WorkforceApp/1.0'}),
      );
      if (resp.statusCode == 200 && resp.data is Map<String, dynamic>) {
        final data = resp.data as Map<String, dynamic>;
        final addr = data['address'] as Map<String, dynamic>? ?? {};

        final areaParts = [
          addr['building'],
          addr['house_number'],
          addr['road'],
          addr['suburb'],
          addr['neighbourhood'],
          addr['city_district'],
        ].where((p) => p != null && p.toString().isNotEmpty).map((p) => p.toString()).toSet().toList();

        final locality = areaParts.take(2).join(', ');
        final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? '';
        final state = addr['state'] ?? '';
        final pincode = addr['postcode'] ?? '';
        final formatted = data['display_name'] ?? '';

        return GeocodeAddress(
          locality: locality.isNotEmpty ? locality : null,
          city: city.toString().isNotEmpty ? city.toString() : null,
          state: state.toString().isNotEmpty ? state.toString() : null,
          pincode: pincode.toString().isNotEmpty ? pincode.toString() : null,
          formattedAddress: formatted.toString().isNotEmpty ? formatted.toString() : null,
        );
      }
    } catch (_) {
      // Fall through gracefully if reverse geocoding request fails
    }
    return null;
  }
}

final locationsApiProvider = Provider<LocationsApi>((ref) {
  return LocationsApi(ref.watch(apiClientProvider));
});
