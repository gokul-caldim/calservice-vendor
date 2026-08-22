import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../profile/presentation/profile_providers.dart';
import '../data/services_repository.dart';
import '../domain/service_catalog.dart';

final serviceCatalogProvider = FutureProvider.autoDispose<List<CatalogCategory>>((ref) async {
  return ref.watch(servicesRepositoryProvider).fetchCatalog();
});

final employeeSkillsProvider = FutureProvider.autoDispose<List<EmployeeSkill>>((ref) async {
  return ref.watch(servicesRepositoryProvider).fetchMySkills();
});

class ServicesController extends StateNotifier<AsyncValue<void>> {
  ServicesController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  Future<bool> requestService({
    required dynamic serviceId,
    String name = '',
  }) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(servicesRepositoryProvider).requestService(serviceId: serviceId, name: name);
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> bulkRequestServices(List<dynamic> serviceIds) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(servicesRepositoryProvider).bulkRequestServices(serviceIds);
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> removeService(dynamic serviceId) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(servicesRepositoryProvider).removeService(serviceId);
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final servicesControllerProvider =
    StateNotifierProvider<ServicesController, AsyncValue<void>>((ref) {
  return ServicesController(ref);
});
