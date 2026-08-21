/**
 * workforce-app/frontend/src/utils/jobPresentation.js
 * Centralized, authoritative presentation derivation for Technician Jobs & Offers.
 * 
 * Enforces Rule 1 & Rule 2:
 * 1. Backend is the ONLY acceptance authority.
 * 2. An offered job NEVER renders as ASSIGNED or ACCEPTED.
 * 3. Offer expiry countdown and 5-minute cancellation window are mutually exclusive.
 */

export function getEmployeeJobPresentation(job, hasActiveJob = false) {
  if (!job) return null;

  // 1. Authoritative Backend Acceptance Verification (active in-flight jobs only)
  const isAcceptedByMe = Boolean(
    (job.is_accepted_by_current_employee && !['completed', 'cancelled'].includes((job.status || '').toLowerCase())) ||
    (job.offer_status === 'ACCEPTED' && job.is_assigned_to_current_employee && !['completed', 'cancelled'].includes((job.status || '').toLowerCase())) ||
    (job.is_assigned_to_current_employee && [
      'accepted', 'on_the_way', 'en_route', 'arrived', 'in_progress',
      'proof_submitted'
    ].includes((job.status || '').toLowerCase()))
  );

  // 2. Authoritative Pending Offer Verification (strictly not accepted)
  const isOfferPending = Boolean(
    !isAcceptedByMe &&
    (job.is_offer === true || job.offer_status === 'OFFERED' || job.active_offer?.status === 'OFFERED') &&
    job.offer_status !== 'EXPIRED' &&
    job.offer_status !== 'SUPERSEDED_BY_ACCEPTANCE' &&
    !job.active_offer?.is_expired
  );

  // ── State A: Pending Job Offer ──────────────────────────────────────────────
  if (isOfferPending) {
    return {
      state: 'OFFERED',
      displayStatus: 'OFFERED',
      badgeStatus: 'submitted',
      badgeLabel: 'OFFERED',
      badgeColorClass: 'bg-amber-50 text-amber-800 border-amber-300',
      badgeDotClass: 'bg-amber-500 animate-pulse',
      isOffer: true,
      isAccepted: false,
      canAccept: !hasActiveJob,
      canDecline: true,
      canCancel: false,
      canTrack: false,
      showOfferCountdown: true,
      showCancellationCountdown: false,
      offerExpiresAt: job.offer_expires_at || job.active_offer?.expires_at || null,
      acceptedAt: null,
      cancellationDeadline: null,
    };
  }

  // ── State B: Authoritatively Accepted Job ──────────────────────────────────
  if (isAcceptedByMe) {
    const rawStatus = (job.status || 'accepted').toLowerCase();
    const isCancelAvail = Boolean(
      job.cancellation_info?.cancellation_available ??
      (job.cancellation_info?.can_cancel ?? ['accepted', 'on_the_way', 'en_route', 'arrived'].includes(rawStatus))
    );

    if (rawStatus === 'on_the_way' || rawStatus === 'en_route') {
      return {
        state: 'ON_THE_WAY',
        displayStatus: 'ON THE WAY',
        badgeStatus: 'on_the_way',
        badgeLabel: 'ON THE WAY',
        badgeColorClass: 'bg-sky-50 text-sky-800 border-sky-200',
        badgeDotClass: 'bg-sky-500 animate-pulse',
        isOffer: false,
        isAccepted: true,
        canAccept: false,
        canDecline: false,
        canCancel: isCancelAvail,
        canTrack: true,
        showOfferCountdown: false,
        showCancellationCountdown: false,
        offerExpiresAt: null,
        acceptedAt: job.accepted_at || job.cancellation_info?.accepted_at || null,
        cancellationDeadline: null,
      };
    }

    if (rawStatus === 'arrived') {
      return {
        state: 'ARRIVED',
        displayStatus: 'ARRIVED AT CUSTOMER SITE',
        badgeStatus: 'arrived',
        badgeLabel: 'ARRIVED',
        badgeColorClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        badgeDotClass: 'bg-cyan-500',
        isOffer: false,
        isAccepted: true,
        canAccept: false,
        canDecline: false,
        canCancel: isCancelAvail,
        canTrack: true,
        showOfferCountdown: false,
        showCancellationCountdown: false,
        offerExpiresAt: null,
        acceptedAt: job.accepted_at || job.cancellation_info?.accepted_at || null,
        cancellationDeadline: null,
      };
    }

    if (['in_progress', 'service_completed', 'proof_submitted', 'payment_pending'].includes(rawStatus)) {
      return {
        state: 'IN_PROGRESS',
        displayStatus: 'IN PROGRESS',
        badgeStatus: 'in_progress',
        badgeLabel: 'IN PROGRESS',
        badgeColorClass: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeDotClass: 'bg-amber-500',
        isOffer: false,
        isAccepted: true,
        canAccept: false,
        canDecline: false,
        canCancel: false,
        canTrack: false,
        showOfferCountdown: false,
        showCancellationCountdown: false,
        offerExpiresAt: null,
        acceptedAt: job.accepted_at || null,
        cancellationDeadline: null,
      };
    }

    if (rawStatus === 'completed') {
      return {
        state: 'COMPLETED',
        displayStatus: 'COMPLETED',
        badgeStatus: 'completed',
        badgeLabel: 'COMPLETED',
        badgeColorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeDotClass: 'bg-emerald-500',
        isOffer: false,
        isAccepted: true,
        canAccept: false,
        canDecline: false,
        canCancel: false,
        canTrack: false,
        showOfferCountdown: false,
        showCancellationCountdown: false,
        offerExpiresAt: null,
        acceptedAt: job.accepted_at || null,
        cancellationDeadline: null,
      };
    }

    // Default Accepted State (prior to heading out)
    return {
      state: 'ACCEPTED',
      displayStatus: 'ACCEPTED / ASSIGNED TO YOU',
      badgeStatus: 'accepted',
      badgeLabel: 'ACCEPTED',
      badgeColorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      badgeDotClass: 'bg-indigo-500',
      isOffer: false,
      isAccepted: true,
      canAccept: false,
      canDecline: false,
      canCancel: isCancelAvail,
      canTrack: true,
      showOfferCountdown: false,
      showCancellationCountdown: false,
      offerExpiresAt: null,
      acceptedAt: job.accepted_at || job.cancellation_info?.accepted_at || null,
      cancellationDeadline: null,
    };
  }

  // ── State C: Historical / Other Jobs ────────────────────────────────────────
  const rawStatus = (job.status || 'unassigned').toLowerCase();
  return {
    state: rawStatus.toUpperCase(),
    displayStatus: rawStatus.replace(/_/g, ' ').toUpperCase(),
    badgeStatus: rawStatus === 'assigned' ? 'submitted' : rawStatus,
    badgeLabel: rawStatus === 'assigned' ? 'AWAITING OFFER' : rawStatus.replace(/_/g, ' ').toUpperCase(),
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    badgeDotClass: 'bg-slate-400',
    isOffer: false,
    isAccepted: false,
    canAccept: false,
    canDecline: false,
    canCancel: false,
    canTrack: false,
    showOfferCountdown: false,
    showCancellationCountdown: false,
    offerExpiresAt: null,
    acceptedAt: null,
    cancellationDeadline: null,
  };
}
