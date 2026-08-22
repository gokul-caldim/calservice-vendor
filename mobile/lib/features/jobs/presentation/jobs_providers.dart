import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/jobs_repository.dart';
import '../domain/job.dart';
import '../domain/job_presentation.dart';

/// Active jobs (offers + in-flight assignments) — fetched once and shared
/// by Home, Jobs, and Job Detail so switching screens never re-fetches.
final activeJobsProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  return ref.watch(jobsRepositoryProvider).fetchActiveJobs();
});

/// Completed jobs are fetched lazily — only once something actually reads
/// this provider (the Jobs screen's Completed segment), same lazy-load
/// behavior as the web dashboard.
final completedJobsProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  return ref.watch(jobsRepositoryProvider).fetchCompletedJobs();
});

/// True while the technician is actively working an assignment — derived
/// from activeJobsProvider, not a separate API call.
final hasActiveJobProvider = Provider.autoDispose<bool>((ref) {
  final jobs = ref.watch(activeJobsProvider).valueOrNull ?? const [];
  return computeHasActiveJob(jobs);
});

/// The single most relevant incoming offer, if any.
final incomingOfferProvider = Provider.autoDispose<Job?>((ref) {
  final jobs = ref.watch(activeJobsProvider).valueOrNull ?? const [];
  final hasActiveJob = ref.watch(hasActiveJobProvider);
  return findIncomingOffer(jobs, hasActiveJob: hasActiveJob);
});

/// The technician's current active (non-offer) job, if any — the one
/// they're actually working through right now.
final currentActiveJobProvider = Provider.autoDispose<Job?>((ref) {
  final jobs = ref.watch(activeJobsProvider).valueOrNull ?? const [];
  for (final job in jobs) {
    if (job.isAssignedToCurrentEmployee && kActiveQueueStatuses.contains(job.status.toLowerCase())) {
      return job;
    }
  }
  return null;
});

/// Looks a job up by id across both the active and completed lists,
/// whichever is already loaded — Job Detail never issues its own request.
Job? findJobById(WidgetRef ref, int id) {
  final active = ref.watch(activeJobsProvider).valueOrNull ?? const [];
  for (final job in active) {
    if (job.id == id) return job;
  }
  final completed = ref.watch(completedJobsProvider).valueOrNull ?? const [];
  for (final job in completed) {
    if (job.id == id) return job;
  }
  return null;
}
