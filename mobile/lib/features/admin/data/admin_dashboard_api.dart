import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Comprehensive API client for all Admin Operations & Workforce endpoints.
class AdminDashboardApi {
  AdminDashboardApi(this._dio);

  final Dio _dio;

  static final _adminReqOptions = Options(
    receiveTimeout: const Duration(seconds: 30),
    sendTimeout: const Duration(seconds: 30),
  );

  /// Admin list endpoints backed by `GET /workforce/jobs/` are measurably
  /// slower than the rest of the API: that view's admin branch serializes up
  /// to 50 ServiceRequests without the bulk-prefetch context its employee
  /// branch builds, so every computed field (payment, extensions, customer)
  /// falls back to per-row queries. Measured against production on-device:
  /// 39.3s for a 75 KB / 50-item response.
  ///
  /// This longer budget is a MITIGATION so the screen can complete at all —
  /// it is not a fix. The real fix is server-side (mirror the employee
  /// branch's select_related + bulk maps for admins, and/or paginate).
  static final _adminSlowListOptions = Options(
    receiveTimeout: const Duration(seconds: 60),
    sendTimeout: const Duration(seconds: 30),
  );

  /// Fetches applicant/technician dossiers.
  Future<List<dynamic>> fetchApplications({String? statusFilter}) async {
    final response = await _dio.get(
      '/workforce/admin/applications/',
      queryParameters: statusFilter != null && statusFilter.isNotEmpty
          ? {'status': statusFilter}
          : null,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Fetches application detailed dossier for a single applicant.
  Future<Map<String, dynamic>> fetchApplicationDetail(int id) async {
    final response = await _dio.get(
      '/workforce/admin/applications/$id/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Approves an applicant's dossier.
  Future<Map<String, dynamic>> approveApplication(int id) async {
    final response = await _dio.post(
      '/workforce/admin/applications/$id/approve/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Rejects an applicant's dossier.
  Future<Map<String, dynamic>> rejectApplication(int id, {String reason = ''}) async {
    final response = await _dio.post(
      '/workforce/admin/applications/$id/reject/',
      data: {'reason': reason},
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Requests correction for an applicant's dossier.
  Future<Map<String, dynamic>> requestCorrection(int id, {required String notes}) async {
    final response = await _dio.post(
      '/workforce/admin/applications/$id/request-correction/',
      data: {'notes': notes},
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches pending profile change requests.
  Future<List<dynamic>> fetchChangeRequests() async {
    final response = await _dio.get(
      '/workforce/admin/change-requests/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Decides on an employee change request (approve / reject).
  Future<Map<String, dynamic>> decideChangeRequest({
    required int crId,
    required String action,
    String notes = '',
  }) async {
    final response = await _dio.post(
      '/workforce/admin/change-requests/$crId/decide/',
      data: {'action': action, 'notes': notes},
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches master skills catalog.
  Future<List<dynamic>> fetchSkills() async {
    final response = await _dio.get(
      '/workforce/skills/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Creates a new skill in the catalog.
  Future<Map<String, dynamic>> createSkill({
    required String name,
    required String category,
    String? description,
  }) async {
    final response = await _dio.post(
      '/workforce/skills/',
      data: {
        'name': name,
        'category': category,
        if (description != null && description.isNotEmpty)
          'description': description,
      },
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Assigns a skill to an employee.
  Future<Map<String, dynamic>> assignSkill({
    required int employeeId,
    required int skillId,
    String proficiencyLevel = 'INTERMEDIATE',
  }) async {
    final response = await _dio.post(
      '/workforce/skills/employee/$employeeId/',
      data: {
        'skill_id': skillId,
        'proficiency_level': proficiencyLevel,
        'action': 'assign',
      },
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches workforce operations jobs.
  Future<List<dynamic>> fetchJobs({String? statusFilter}) async {
    final response = await _dio.get(
      '/workforce/jobs/',
      queryParameters: statusFilter != null && statusFilter.isNotEmpty
          ? {'status': statusFilter}
          : null,
      options: _adminSlowListOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Fetches fleet presence and telemetry.
  Future<List<dynamic>> fetchFleetMap() async {
    final response = await _dio.get(
      '/workforce/presence/fleet-map/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Fetches eligible technicians for a given job.
  Future<List<dynamic>> fetchEligibleTechnicians({
    required int jobId,
    double? radiusKm,
    String? service,
  }) async {
    final params = <String, dynamic>{
      'job_id': jobId,
      'radius_km': ?radiusKm,
      if (service != null && service.isNotEmpty) 'service': service,
    };
    final response = await _dio.get(
      '/workforce/dispatch/eligible-technicians/',
      queryParameters: params,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Manually assigns a technician to a job.
  Future<Map<String, dynamic>> assignTechnician({
    required int jobId,
    required int employeeId,
  }) async {
    final response = await _dio.post(
      '/workforce/dispatch/assign/',
      data: {
        'job_id': jobId,
        'employee_id': employeeId,
      },
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Triggers automatic geo-dispatch for a job.
  Future<Map<String, dynamic>> triggerAutoDispatch(int jobId) async {
    final response = await _dio.post(
      '/workforce/dispatch/auto-dispatch/$jobId/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches pending technician scope extensions awaiting admin review.
  Future<List<dynamic>> fetchPendingExtensions() async {
    final response = await _dio.get(
      '/workforce/admin/extensions/pending/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Decides on a pending work extension (APPROVED / REJECTED).
  Future<Map<String, dynamic>> decideExtension({
    required int jobId,
    required int extId,
    required String action,
    String reason = '',
    double? approvedAmount,
  }) async {
    final payload = <String, dynamic>{
      'action': action,
      'reason': reason,
      'approved_amount': ?approvedAmount,
    };
    final response = await _dio.post(
      '/workforce/admin/jobs/$jobId/extension/$extId/decide/',
      data: payload,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches pending service authorization requests from technicians.
  Future<List<dynamic>> fetchPendingServices() async {
    final response = await _dio.get(
      '/workforce/admin/services/pending-requests/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is List ? data : const [];
  }

  /// Decides on a technician service request (approve / reject).
  Future<Map<String, dynamic>> decideService({
    required int employeeId,
    required int serviceId,
    required String action,
    String reason = '',
  }) async {
    final response = await _dio.post(
      '/workforce/admin/applications/$employeeId/service/$serviceId/decide/',
      data: {'action': action, 'reason': reason},
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches company authorized locations & geofences.
  Future<List<dynamic>> fetchLocations() async {
    final response = await _dio.get(
      '/workforce/time-tracking/locations/',
      options: _adminReqOptions,
    );
    final data = response.data;
    if (data is List) return data;
    if (data is Map<String, dynamic> && data['results'] is List) {
      return data['results'] as List;
    }
    return const [];
  }

  /// Creates a new authorized location.
  Future<Map<String, dynamic>> createLocation(Map<String, dynamic> payload) async {
    final response = await _dio.post(
      '/workforce/time-tracking/locations/',
      data: payload,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Updates an authorized location.
  Future<Map<String, dynamic>> updateLocation(
    int id,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.patch(
      '/workforce/time-tracking/locations/$id/',
      data: payload,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Deletes an authorized location.
  Future<void> deleteLocation(int id) async {
    await _dio.delete(
      '/workforce/time-tracking/locations/$id/',
      options: _adminReqOptions,
    );
  }

  /// Toggles an authorized location active / inactive.
  Future<Map<String, dynamic>> toggleLocationActive(int id, bool isActive) async {
    return updateLocation(id, {'is_active': isActive});
  }

  /// Fetches observable correlated lifecycle timeline for a job.
  Future<Map<String, dynamic>> fetchJobTimeline(int jobId) async {
    final response = await _dio.get(
      '/workforce/jobs/$jobId/timeline/',
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Fetches dynamic aggregation reports.
  Future<Map<String, dynamic>> fetchReport({
    required String type,
    Map<String, dynamic>? queryParams,
  }) async {
    final params = <String, dynamic>{
      'type': type,
      ...?queryParams,
    };
    final response = await _dio.get(
      '/workforce/reports/',
      queryParameters: params,
      options: _adminReqOptions,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }
}

final adminDashboardApiProvider = Provider<AdminDashboardApi>((ref) {
  return AdminDashboardApi(ref.watch(apiClientProvider));
});
