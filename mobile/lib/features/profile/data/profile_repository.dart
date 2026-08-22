import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/employee_profile.dart';
import '../domain/shift_status.dart';
import 'profile_api.dart';

class ProfileRepository {
  ProfileRepository(this._api);

  final ProfileApi _api;

  Future<EmployeeProfile> fetchProfile() async {
    final json = await _api.fetchProfile();
    return EmployeeProfile.fromJson(json);
  }

  Future<EmployeeProfile> updateProfile(Map<String, dynamic> data) async {
    final json = await _api.updateProfile(data);
    final profJson = json['profile'];
    if (profJson is Map<String, dynamic>) {
      return EmployeeProfile.fromJson(profJson);
    }
    return fetchProfile();
  }

  Future<String> uploadAvatar(String filePath) async {
    final json = await _api.uploadAvatar(filePath);
    return json['avatar_url'] as String? ?? '';
  }

  Future<List<EmployeeChangeRequest>> fetchChangeRequests() async {
    final list = await _api.fetchChangeRequests();
    return list
        .whereType<Map<String, dynamic>>()
        .map(EmployeeChangeRequest.fromJson)
        .toList();
  }

  Future<EmployeeChangeRequest> submitChangeRequest({
    required String fieldName,
    required String fieldLabel,
    required String newValue,
    required String reason,
  }) async {
    final json = await _api.submitChangeRequest({
      'field_name': fieldName,
      'field_label': fieldLabel,
      'new_value': newValue,
      'reason': reason,
    });
    final crJson = json['change_request'];
    if (crJson is Map<String, dynamic>) {
      return EmployeeChangeRequest.fromJson(crJson);
    }
    throw Exception(json['message'] ?? 'Failed to submit change request');
  }

  Future<ShiftStatus?> fetchShiftStatus() async {
    final json = await _api.fetchShiftStatus();
    if (json == null) return null;
    return ShiftStatus.fromJson(json);
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(profileApiProvider));
});
