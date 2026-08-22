import 'job.dart';

/// The one "state" a job is in from the technician's point of view. Mirrors
/// the states derived by the web app's utils/jobPresentation.js, minus the
/// action flags (canAccept/canDecline/etc.) — this phase is display-only,
/// so those actions aren't wired to anything yet, but the states they'd
/// attach to are still needed to decide what a card/detail screen shows.
enum JobPresentationState {
  offered,
  onTheWay,
  arrived,
  inProgress,
  completed,
  accepted,
  other,
}

class JobPresentation {
  const JobPresentation({
    required this.state,
    required this.displayStatus,
    required this.badgeStatus,
    required this.isOffer,
    required this.isAccepted,
    required this.showOfferCountdown,
    required this.showCancellationCountdown,
    this.offerExpiresAt,
    this.acceptedAt,
    this.cancellationDeadline,
  });

  final JobPresentationState state;
  final String displayStatus;
  final String badgeStatus;
  final bool isOffer;
  final bool isAccepted;
  final bool showOfferCountdown;
  final bool showCancellationCountdown;
  final DateTime? offerExpiresAt;
  final DateTime? acceptedAt;
  final DateTime? cancellationDeadline;
}

/// Port of getEmployeeJobPresentation() from the web app's
/// utils/jobPresentation.js. Same three-branch structure:
/// 1. a pending offer (not yet accepted, not expired, not busy elsewhere)
/// 2. authoritatively accepted by this technician (backend-confirmed)
/// 3. anything else (historical/other)
JobPresentation buildJobPresentation(Job job, {bool hasActiveJob = false}) {
  final status = job.status.toLowerCase();

  final isAcceptedByMe =
      (job.isAcceptedByCurrentEmployee && !['completed', 'cancelled'].contains(status)) ||
      (job.isAssignedToCurrentEmployee &&
          [
            'accepted',
            'on_the_way',
            'en_route',
            'arrived',
            'in_progress',
            'proof_submitted',
          ].contains(status));

  final isOfferPending =
      !hasActiveJob &&
      !isAcceptedByMe &&
      (job.isOffer || job.activeOffer?.status == 'OFFERED') &&
      job.activeOffer?.status != 'EXPIRED' &&
      job.activeOffer?.status != 'SUPERSEDED_BY_ACCEPTANCE' &&
      !(job.activeOffer?.isExpired ?? false);

  if (isOfferPending) {
    return JobPresentation(
      state: JobPresentationState.offered,
      displayStatus: 'Offered',
      badgeStatus: 'offered',
      isOffer: true,
      isAccepted: false,
      showOfferCountdown: true,
      showCancellationCountdown: false,
      offerExpiresAt: job.offerExpiresAt ?? job.activeOffer?.expiresAt,
    );
  }

  if (isAcceptedByMe) {
    switch (status) {
      case 'on_the_way':
        return JobPresentation(
          state: JobPresentationState.onTheWay,
          displayStatus: 'On The Way',
          badgeStatus: 'on_the_way',
          isOffer: false,
          isAccepted: true,
          showOfferCountdown: false,
          showCancellationCountdown: job.cancellationInfo?.cancellationDeadline != null,
          acceptedAt: job.acceptedAt ?? job.cancellationInfo?.acceptedAt,
          cancellationDeadline: job.cancellationDeadline ?? job.cancellationInfo?.cancellationDeadline,
        );
      case 'arrived':
        return JobPresentation(
          state: JobPresentationState.arrived,
          displayStatus: 'Arrived At Customer Site',
          badgeStatus: 'arrived',
          isOffer: false,
          isAccepted: true,
          showOfferCountdown: false,
          showCancellationCountdown: false,
          acceptedAt: job.acceptedAt,
        );
      case 'in_progress':
      case 'service_completed':
      case 'proof_submitted':
      case 'payment_pending':
        return JobPresentation(
          state: JobPresentationState.inProgress,
          displayStatus: 'In Progress',
          badgeStatus: 'in_progress',
          isOffer: false,
          isAccepted: true,
          showOfferCountdown: false,
          showCancellationCountdown: false,
          acceptedAt: job.acceptedAt,
        );
      case 'completed':
        return JobPresentation(
          state: JobPresentationState.completed,
          displayStatus: 'Completed',
          badgeStatus: 'completed',
          isOffer: false,
          isAccepted: true,
          showOfferCountdown: false,
          showCancellationCountdown: false,
          acceptedAt: job.acceptedAt,
        );
      default:
        return JobPresentation(
          state: JobPresentationState.accepted,
          displayStatus: 'Accepted / Assigned To You',
          badgeStatus: 'accepted',
          isOffer: false,
          isAccepted: true,
          showOfferCountdown: false,
          showCancellationCountdown: job.cancellationInfo?.cancellationDeadline != null,
          acceptedAt: job.acceptedAt ?? job.cancellationInfo?.acceptedAt,
          cancellationDeadline: job.cancellationDeadline ?? job.cancellationInfo?.cancellationDeadline,
        );
    }
  }

  final label = status.replaceAll('_', ' ');
  return JobPresentation(
    state: status == 'completed' ? JobPresentationState.completed : JobPresentationState.other,
    displayStatus: label.isEmpty ? 'Unassigned' : (status == 'completed' ? 'Completed' : label),
    badgeStatus: status == 'assigned' ? 'submitted' : status,
    isOffer: false,
    isAccepted: false,
    showOfferCountdown: false,
    showCancellationCountdown: false,
  );
}

/// True if the technician is actively assigned to a job that's still moving
/// through the queue — used to hide new offers while busy (mirrors
/// hasActiveJob in EmployeeRuntimeContext.jsx).
bool computeHasActiveJob(List<Job> jobs) {
  return jobs.any(
    (j) => j.isAssignedToCurrentEmployee && kActiveQueueStatuses.contains(j.status.toLowerCase()),
  );
}

/// The single most relevant pending offer to show, if any (mirrors
/// incomingOffer in EmployeeRuntimeContext.jsx).
Job? findIncomingOffer(List<Job> jobs, {required bool hasActiveJob}) {
  if (hasActiveJob) return null;
  for (final job in jobs) {
    final isOffered = job.isOffer || job.activeOffer?.status == 'OFFERED';
    final isExpired = job.activeOffer?.isExpired ?? false;
    if (isOffered && !isExpired && !job.isAssignedToCurrentEmployee) {
      return job;
    }
  }
  return null;
}
