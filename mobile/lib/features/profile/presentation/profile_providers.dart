import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/profile_repository.dart';
import '../domain/employee_profile.dart';
import '../domain/shift_status.dart';

/// Shared across Home, Profile, and Documents — cached and refreshable.
final employeeProfileProvider = FutureProvider.autoDispose<EmployeeProfile>((ref) async {
  return ref.watch(profileRepositoryProvider).fetchProfile();
});

final changeRequestsProvider = FutureProvider.autoDispose<List<EmployeeChangeRequest>>((ref) async {
  return ref.watch(profileRepositoryProvider).fetchChangeRequests();
});

final shiftStatusProvider = FutureProvider.autoDispose<ShiftStatus?>((ref) async {
  return ref.watch(profileRepositoryProvider).fetchShiftStatus();
});

class ProfileController extends StateNotifier<AsyncValue<void>> {
  ProfileController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  Future<bool> savePreferences(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(profileRepositoryProvider).updateProfile(data);
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> uploadAvatar(String filePath) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(profileRepositoryProvider).uploadAvatar(filePath);
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> submitChangeRequest({
    required String fieldName,
    required String fieldLabel,
    required String newValue,
    required String reason,
  }) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(profileRepositoryProvider).submitChangeRequest(
            fieldName: fieldName,
            fieldLabel: fieldLabel,
            newValue: newValue,
            reason: reason,
          );
      _ref.invalidate(changeRequestsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final profileControllerProvider = StateNotifierProvider<ProfileController, AsyncValue<void>>((ref) {
  return ProfileController(ref);
});
