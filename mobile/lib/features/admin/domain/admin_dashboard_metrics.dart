import '../../jobs/domain/job.dart';
import 'admin_application.dart';
import 'fleet_member.dart';

/// Aggregated state and computed metrics for the Workforce Operations Center.
class AdminDashboardData {
  const AdminDashboardData({
    this.applications = const [],
    this.jobs = const [],
    this.fleet = const [],
  });

  final List<AdminApplication> applications;
  final List<Job> jobs;
  final List<FleetMember> fleet;

  // ── Action Center Counts ───────────────────────────────────────────────────

  /// Dossiers awaiting verification & service authorization (submitted / under_review).
  int get pendingApplicationsCount =>
      applications.where((a) => a.isPending).length;

  /// Documents requiring verification across all applications.
  /// Falls back to pendingApplicationsCount if 0 (matching web dashboard logic).
  int get documentsToVerifyCount {
    var totalDocs = 0;
    for (final app in applications) {
      totalDocs += app.pendingDocumentsCount;
    }
    return totalDocs > 0 ? totalDocs : pendingApplicationsCount;
  }

  /// Customer bookings requiring technician dispatch (unassigned / status == 'assigned' with no employee).
  int get unassignedJobsCount => jobs.where((j) {
        final st = j.status.toLowerCase();
        return st == 'unassigned' ||
            (st == 'assigned' && !j.isAssignedToCurrentEmployee) ||
            st == 'new_request';
      }).length;

  /// Technicians notified to re-upload flagged files (correction_required).
  int get correctionsPendingCount =>
      applications.where((a) => a.isCorrectionRequired).length;

  // ── Workforce Overview Metrics ─────────────────────────────────────────────

  /// Total technicians on roster.
  int get totalRegisteredCount => applications.length;

  /// Technicians approved & authorized for jobs.
  int get approvedAndActiveCount =>
      applications.where((a) => a.isApproved).length;

  /// Fleet members currently online and available for dispatch.
  int get onlineAndAvailableCount =>
      fleet.where((f) => f.isAvailable).length;

  /// Fleet members currently on active jobs in the field.
  int get onActiveJobsCount =>
      fleet.where((f) => f.isOnActiveJob).length;

  /// Applications pending review.
  int get pendingReviewCount => pendingApplicationsCount;

  // ── Recent Operations ──────────────────────────────────────────────────────

  /// Recent service requests sorted newest first (by id descending or created_at descending).
  List<Job> get recentJobs {
    final list = List<Job>.from(jobs);
    list.sort((a, b) {
      if (b.createdAt != null && a.createdAt != null) {
        return b.createdAt!.compareTo(a.createdAt!);
      }
      return b.id.compareTo(a.id);
    });
    return list;
  }
}
