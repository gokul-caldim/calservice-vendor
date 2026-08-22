import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../jobs/domain/job.dart';
import '../domain/admin_application.dart';
import '../domain/admin_dashboard_metrics.dart';
import '../domain/fleet_member.dart';
import 'admin_dashboard_api.dart';

/// Repository coordinating operations center data fetching.
class AdminDashboardRepository {
  AdminDashboardRepository(this._api);

  final AdminDashboardApi _api;

  /// Fetches all dashboard datasets concurrently with error isolation.
  Future<AdminDashboardData> fetchDashboardData() async {
    final results = await Future.wait([
      _api.fetchApplications().then(
            (raw) => raw
                .whereType<Map<String, dynamic>>()
                .map(AdminApplication.fromJson)
                .toList(),
            onError: (_) => <AdminApplication>[],
          ),
      _api.fetchJobs().then(
            (raw) => raw
                .whereType<Map<String, dynamic>>()
                .map(Job.fromJson)
                .toList(),
            onError: (_) => <Job>[],
          ),
      _api.fetchFleetMap().then(
            (raw) => raw
                .whereType<Map<String, dynamic>>()
                .map(FleetMember.fromJson)
                .toList(),
            onError: (_) => <FleetMember>[],
          ),
    ]);

    return AdminDashboardData(
      applications: results[0] as List<AdminApplication>,
      jobs: results[1] as List<Job>,
      fleet: results[2] as List<FleetMember>,
    );
  }
}

final adminDashboardRepositoryProvider =
    Provider<AdminDashboardRepository>((ref) {
  return AdminDashboardRepository(ref.watch(adminDashboardApiProvider));
});
