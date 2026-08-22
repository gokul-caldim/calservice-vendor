import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/locations_repository.dart';
import '../domain/saved_location.dart';

final savedLocationsProvider = FutureProvider.autoDispose<List<SavedLocation>>((ref) async {
  return ref.watch(locationsRepositoryProvider).fetchSavedLocations();
});

class LocationsController extends StateNotifier<AsyncValue<void>> {
  LocationsController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  Future<bool> createLocation(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(locationsRepositoryProvider).createLocation(data);
      _ref.invalidate(savedLocationsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateLocation(int id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(locationsRepositoryProvider).updateLocation(id, data);
      _ref.invalidate(savedLocationsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> setDefault(int id) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(locationsRepositoryProvider).patchLocation(id, {'is_default': true});
      _ref.invalidate(savedLocationsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deleteLocation(int id) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(locationsRepositoryProvider).deleteLocation(id);
      _ref.invalidate(savedLocationsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<GeocodeAddress?> reverseGeocode(double lat, double lng) async {
    return _ref.read(locationsRepositoryProvider).reverseGeocode(lat, lng);
  }
}

final locationsControllerProvider =
    StateNotifierProvider<LocationsController, AsyncValue<void>>((ref) {
  return LocationsController(ref);
});
