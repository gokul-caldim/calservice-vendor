import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/service_catalog.dart';
import 'services_api.dart';

class ServicesRepository {
  ServicesRepository(this._api);

  final ServicesApi _api;

  Future<List<CatalogCategory>> fetchCatalog() async {
    final raw = await _api.fetchCatalog();
    return raw.whereType<Map<String, dynamic>>().map(CatalogCategory.fromJson).toList();
  }

  Future<List<EmployeeSkill>> fetchMySkills() async {
    final raw = await _api.fetchMySkills();
    return raw.whereType<Map<String, dynamic>>().map(EmployeeSkill.fromJson).toList();
  }

  Future<Map<String, dynamic>> requestService({
    required dynamic serviceId,
    String name = '',
  }) async {
    return _api.requestService(serviceId: serviceId, name: name);
  }

  Future<Map<String, dynamic>> bulkRequestServices(List<dynamic> serviceIds) async {
    return _api.bulkRequestServices(serviceIds);
  }

  Future<Map<String, dynamic>> removeService(dynamic serviceId) async {
    return _api.removeService(serviceId);
  }
}

final servicesRepositoryProvider = Provider<ServicesRepository>((ref) {
  return ServicesRepository(ref.watch(servicesApiProvider));
});
