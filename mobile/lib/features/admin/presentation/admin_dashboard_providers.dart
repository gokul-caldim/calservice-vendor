import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../jobs/domain/job.dart';
import '../data/admin_dashboard_api.dart';
import '../data/admin_dashboard_repository.dart';
import '../domain/admin_application.dart';
import '../domain/admin_change_request.dart';
import '../domain/admin_dashboard_metrics.dart';
import '../domain/admin_report_data.dart';
import '../domain/admin_scope_extension.dart';
import '../domain/admin_service_request_item.dart';
import '../domain/eligible_technician.dart';
import '../domain/fleet_member.dart';
import '../domain/job_timeline_data.dart';
import '../domain/skill.dart';
import '../domain/work_location.dart';

/// Provider for aggregated admin dashboard data.
final adminDashboardDataProvider =
    FutureProvider.autoDispose<AdminDashboardData>((ref) async {
  final repository = ref.watch(adminDashboardRepositoryProvider);
  return repository.fetchDashboardData();
});

/// Provider for raw applications list (optional status filter).
final adminApplicationsListProvider =
    FutureProvider.autoDispose.family<List<AdminApplication>, String?>((ref, statusFilter) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchApplications(statusFilter: statusFilter);
  return raw
      .whereType<Map<String, dynamic>>()
      .map(AdminApplication.fromJson)
      .toList();
});

/// Provider for change requests list.
final adminChangeRequestsProvider =
    FutureProvider.autoDispose<List<AdminChangeRequest>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchChangeRequests();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(AdminChangeRequest.fromJson)
      .toList();
});

/// Provider for master skills catalog.
final adminSkillsProvider =
    FutureProvider.autoDispose<List<Skill>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchSkills();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(Skill.fromJson)
      .toList();
});

/// Provider for single application detailed dossier.
final adminApplicationDetailProvider =
    FutureProvider.autoDispose.family<AdminApplication, int>((ref, id) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchApplicationDetail(id);
  return AdminApplication.fromJson(raw);
});

/// Provider for admin jobs list.
final adminJobsListProvider =
    FutureProvider.autoDispose.family<List<Job>, String?>((ref, statusFilter) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchJobs(statusFilter: statusFilter);
  return raw
      .whereType<Map<String, dynamic>>()
      .map(Job.fromJson)
      .toList();
});

/// Provider for live fleet telemetry members.
final adminFleetListProvider =
    FutureProvider.autoDispose<List<FleetMember>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchFleetMap();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(FleetMember.fromJson)
      .toList();
});

/// Provider for eligible technician candidates matching a job.
final adminEligibleTechniciansProvider =
    FutureProvider.autoDispose.family<List<EligibleTechnician>, int>((ref, jobId) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchEligibleTechnicians(jobId: jobId);
  return raw
      .whereType<Map<String, dynamic>>()
      .map(EligibleTechnician.fromJson)
      .toList();
});

/// Provider for pending technician scope extensions awaiting review.
final adminPendingExtensionsProvider =
    FutureProvider.autoDispose<List<AdminScopeExtension>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchPendingExtensions();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(AdminScopeExtension.fromJson)
      .toList();
});

/// Provider for pending technician service authorization requests.
final adminPendingServicesProvider =
    FutureProvider.autoDispose<List<AdminServiceRequestItem>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchPendingServices();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(AdminServiceRequestItem.fromJson)
      .toList();
});

/// Provider for company authorized work locations.
final adminLocationsProvider =
    FutureProvider.autoDispose<List<WorkLocation>>((ref) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchLocations();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(WorkLocation.fromJson)
      .toList();
});

/// Provider for job lifecycle timeline events.
final adminJobTimelineProvider =
    FutureProvider.autoDispose.family<JobTimelineData, int>((ref, jobId) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchJobTimeline(jobId);
  return JobTimelineData.fromJson(raw);
});

/// Provider for dynamic reports query results.
final adminReportProvider = FutureProvider.autoDispose
    .family<AdminReportData, AdminReportParams>((ref, params) async {
  final api = ref.watch(adminDashboardApiProvider);
  final raw = await api.fetchReport(
    type: params.type,
    queryParams: params.toQueryParameters(),
  );
  return AdminReportData.fromJson(raw);
});

