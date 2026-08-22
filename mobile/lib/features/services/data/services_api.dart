import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class ServicesApi {
  ServicesApi(this._dio);

  final Dio _dio;

  Future<List<dynamic>> fetchCatalog() async {
    final response = await _dio.get('/workforce/catalog/');
    final data = response.data;
    return data is List ? data : const [];
  }

  Future<List<dynamic>> fetchMySkills() async {
    final response = await _dio.get('/workforce/skills/me/');
    final data = response.data;
    return data is List ? data : const [];
  }

  Future<Map<String, dynamic>> requestService({
    required dynamic serviceId,
    String name = '',
  }) async {
    final response = await _dio.post(
      '/workforce/services/request/',
      data: {'service_id': serviceId, 'name': name},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> bulkRequestServices(List<dynamic> serviceIds) async {
    final response = await _dio.post(
      '/workforce/services/request/',
      data: {'service_ids': serviceIds},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> removeService(dynamic serviceId) async {
    final response = await _dio.post(
      '/workforce/services/remove/',
      data: {'service_id': serviceId},
    );
    return response.data as Map<String, dynamic>;
  }
}

final servicesApiProvider = Provider<ServicesApi>((ref) {
  return ServicesApi(ref.watch(apiClientProvider));
});
