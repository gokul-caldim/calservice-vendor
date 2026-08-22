import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/countdown_text.dart';
import '../../../shared/widgets/otp_input_field.dart';
import '../../../shared/widgets/status_chip.dart';
import '../data/job_actions_repository.dart';
import '../domain/job.dart';
import '../domain/job_presentation.dart';
import 'jobs_providers.dart';
import 'widgets/arrival_checklist_section.dart';
import 'widgets/cancel_assignment_button.dart';
import 'widgets/cash_collection_sheet.dart';
import 'widgets/navigate_button.dart';
import 'widgets/offer_actions_section.dart';
import 'widgets/proof_submission_sheet.dart';

class JobDetailScreen extends ConsumerStatefulWidget {
  const JobDetailScreen({super.key, required this.jobId});

  final int jobId;

  @override
  ConsumerState<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends ConsumerState<JobDetailScreen> {
  String _paymentOtpValue = '';
  bool _isVerifyingPaymentOtp = false;
  String? _paymentError;

  Future<void> _refreshJob() async {
    ref.invalidate(activeJobsProvider);
    ref.invalidate(completedJobsProvider);
    await Future.wait([
      ref.read(activeJobsProvider.future),
      ref.read(completedJobsProvider.future),
    ]);
  }

  Future<void> _verifyPaymentOtp(int jobId) async {
    if (_paymentOtpValue.length != 6) return;
    setState(() {
      _isVerifyingPaymentOtp = true;
      _paymentError = null;
    });

    try {
      final message = await ref
          .read(jobActionsRepositoryProvider)
          .verifyPaymentOtp(jobId, _paymentOtpValue);

      await _refreshJob();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _paymentError = describeDioError(e, fallback: 'Invalid payment confirmation OTP.'));
      }
    } catch (_) {
      if (mounted) setState(() => _paymentError = 'Failed to verify payment confirmation OTP.');
    } finally {
      if (mounted) setState(() => _isVerifyingPaymentOtp = false);
    }
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final uri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _sendEmail(String email) async {
    final uri = Uri(scheme: 'mailto', path: email);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeAsync = ref.watch(activeJobsProvider);
    final completedAsync = ref.watch(completedJobsProvider);
    final hasActiveJob = ref.watch(hasActiveJobProvider);

    Job? job;
    for (final j in activeAsync.valueOrNull ?? const <Job>[]) {
      if (j.id == widget.jobId) {
        job = j;
        break;
      }
    }
    if (job == null) {
      for (final j in completedAsync.valueOrNull ?? const <Job>[]) {
        if (j.id == widget.jobId) {
          job = j;
          break;
        }
      }
    }

    final stillResolving = job == null && (activeAsync.isLoading || completedAsync.isLoading);

    return Scaffold(
      appBar: AppBar(
        title: Text(job?.requestId ?? 'Job Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refreshJob,
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshJob,
          child: stillResolving
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2.5))
              : job == null
                  ? _JobNotFound(onBack: () => Navigator.of(context).maybePop())
                  : _buildJobDetailsBody(context, job, hasActiveJob),
        ),
      ),
    );
  }

  Widget _buildJobDetailsBody(BuildContext context, Job job, bool hasActiveJob) {
    final presentation = buildJobPresentation(job, hasActiveJob: hasActiveJob);
    final offerExpiresAt = job.offerExpiresAt ?? job.activeOffer?.expiresAt;

    final isPreServiceWorkflow = presentation.isAccepted &&
        (presentation.state == JobPresentationState.accepted ||
            presentation.state == JobPresentationState.onTheWay ||
            presentation.state == JobPresentationState.arrived);

    final isInProgress = presentation.isAccepted &&
        presentation.state == JobPresentationState.inProgress &&
        job.status.toLowerCase() == 'in_progress';

    final isProofSubmitted = job.status.toLowerCase() == 'proof_submitted';

    final isCompleted = presentation.isAccepted &&
        (presentation.state == JobPresentationState.completed ||
            job.status.toLowerCase() == 'completed');

    final isOnlinePayment = (job.paymentMethod ?? '').toUpperCase() == 'ONLINE' ||
        (job.paymentMethod ?? '').toUpperCase() == 'PREPAID';

    final isPaymentPaid = (job.paymentStatus ?? '').toLowerCase() == 'paid' ||
        (job.paymentStatus ?? '').toLowerCase() == 'collected';

    final isCashPending = (job.paymentStatus ?? '').toLowerCase() == 'cash_pending';

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xxl,
      ),
      children: [
        // Top ID + Status badge
        Row(
          children: [
            Text(
              job.requestId,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: Color(0xFF2563EB),
              ),
            ),
            const Spacer(),
            StatusChip(status: presentation.badgeStatus, label: presentation.displayStatus),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(job.displayTitle, style: Theme.of(context).textTheme.headlineSmall),

        // Expiry Banner if Offer
        if (presentation.isOffer && offerExpiresAt != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _Banner(
            color: AppColors.accent,
            icon: Icons.timer_outlined,
            label: 'Offer expires in',
            trailing: CountdownText(
              target: offerExpiresAt,
              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
            ),
          ),
        ],

        // Cancellation Window Countdown Banner
        if (presentation.showCancellationCountdown && presentation.cancellationDeadline != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _Banner(
            color: AppColors.primary,
            icon: Icons.hourglass_bottom_rounded,
            label: 'Cancellation window closes in',
            trailing: CountdownText(
              target: presentation.cancellationDeadline!,
              style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primaryDark),
            ),
          ),
        ],

        const SizedBox(height: AppSpacing.md),

        // Action Buttons Bar for Accepted Pre-Service Jobs (Navigate & Cancel)
        if (isPreServiceWorkflow) ...[
          Row(
            children: [
              if (job.hasCoordinates) ...[
                Expanded(child: NavigateButton(job: job)),
                const SizedBox(width: AppSpacing.sm),
              ],
              Expanded(child: CancelAssignmentButton(job: job)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        // Customer Info Card
        _SectionCard(
          title: 'Customer Information',
          icon: Icons.person_outline_rounded,
          rows: [
            _InfoRow(icon: Icons.person_outline, label: 'Customer', value: job.customerName ?? 'Customer'),
            if (job.phone != null && job.phone!.isNotEmpty)
              _InfoRow(
                icon: Icons.phone_outlined,
                label: 'Phone',
                value: job.phone!,
                action: IconButton(
                  icon: const Icon(Icons.call_rounded, size: 18, color: Color(0xFF059669)),
                  onPressed: () => _makePhoneCall(job.phone!),
                  tooltip: 'Call Customer',
                ),
              ),
            if (job.email != null && job.email!.isNotEmpty)
              _InfoRow(
                icon: Icons.email_outlined,
                label: 'Email',
                value: job.email!,
                action: IconButton(
                  icon: const Icon(Icons.mail_outline_rounded, size: 18, color: AppColors.primary),
                  onPressed: () => _sendEmail(job.email!),
                  tooltip: 'Send Email',
                ),
              ),
            _InfoRow(icon: Icons.place_outlined, label: 'Address', value: job.address ?? 'Customer destination address'),
            if (job.hasCoordinates)
              _InfoRow(
                icon: Icons.my_location_rounded,
                label: 'Coordinates',
                value: '${job.latitude!.toStringAsFixed(6)}, ${job.longitude!.toStringAsFixed(6)}',
              ),
            if (job.distanceKm != null)
              _InfoRow(
                icon: Icons.navigation_outlined,
                label: 'Distance',
                value: '${job.distanceKm!.toStringAsFixed(1)} km away',
              ),
          ],
        ),

        const SizedBox(height: AppSpacing.md),

        // Schedule Info Card
        _SectionCard(
          title: 'Schedule',
          icon: Icons.calendar_today_outlined,
          rows: [
            _InfoRow(
              icon: Icons.calendar_month_outlined,
              label: 'Preferred Date',
              value: job.preferredDate ?? 'Not specified',
            ),
            _InfoRow(
              icon: Icons.schedule_outlined,
              label: 'Preferred Time',
              value: job.preferredTime ?? 'Not specified',
            ),
          ],
        ),

        const SizedBox(height: AppSpacing.md),

        // Payment Info Card
        _SectionCard(
          title: 'Payment Details',
          icon: Icons.payments_outlined,
          rows: [
            _InfoRow(
              icon: Icons.currency_rupee_rounded,
              label: 'Total Amount',
              value: job.totalAmount != null ? '₹${job.totalAmount!.toStringAsFixed(2)}' : '0.00',
              valueStyle: const TextStyle(fontWeight: FontWeight.w900, fontFamily: 'monospace', fontSize: 14),
            ),
            _InfoRow(
              icon: Icons.credit_card_outlined,
              label: 'Payment Method',
              value: isOnlinePayment ? 'ONLINE (Prepaid)' : 'Cash on Service (COD)',
            ),
            _InfoRow(
              icon: Icons.receipt_long_outlined,
              label: 'Payment Status',
              value: isPaymentPaid
                  ? 'PAID ✓'
                  : (isCashPending ? 'CASH PENDING' : (job.paymentStatus?.replaceAll('_', ' ').toUpperCase() ?? 'PENDING')),
              valueStyle: TextStyle(
                fontWeight: FontWeight.w800,
                color: isPaymentPaid
                    ? const Color(0xFF059669)
                    : (isCashPending ? const Color(0xFFD97706) : const Color(0xFF334155)),
              ),
            ),
          ],
        ),

        // Booked Services & Cart Section
        if (job.cartData.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _SectionCard(
            title: 'Booked Services & Cart (${job.cartData.length})',
            icon: Icons.shopping_bag_outlined,
            customContent: Column(
              children: [
                for (final item in job.cartData)
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(AppRadius.chip),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.name,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                              ),
                              if (item.selectedOption != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  'Option: ${item.selectedOption}',
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.primary),
                                ),
                              ],
                              if (item.description != null && item.description!.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  item.description!,
                                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (item.quantity != null) ...[
                          const SizedBox(width: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE2E8F0),
                              borderRadius: BorderRadius.circular(AppRadius.chip),
                            ),
                            child: Text(
                              'Qty: ${item.quantity}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF334155),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],

        if (job.description != null && job.description!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _SectionCard(
            title: 'Notes & Instructions',
            icon: Icons.notes_rounded,
            freeText: job.description,
          ),
        ],

        const SizedBox(height: AppSpacing.lg),

        // ══════════════════════════════════════════════════════════════════════
        // DYNAMIC STATE-DRIVEN ACTION STEPS SECTION
        // ══════════════════════════════════════════════════════════════════════
        const Text(
          'ACTION STEPS',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: Color(0xFF475569),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),

        // 1. OFFERED STATE
        if (presentation.isOffer) ...[
          OfferActionsSection(job: job),
        ]

        // 2. ACCEPTED / ON_THE_WAY / ARRIVED (Phase D & E Arrival Checklist)
        else if (isPreServiceWorkflow) ...[
          ArrivalChecklistSection(job: job),
        ]

        // 3. IN PROGRESS STATE
        else if (isInProgress) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const Expanded(
                      child: Text(
                        'Active Work Session — Job In Progress',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF065F46),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF059669),
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: const Text(
                        'IN PROGRESS',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Clocked in on site. When repairs and service are finished, upload completion photos below to complete the service.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF047857), height: 1.35),
                ),
                const SizedBox(height: AppSpacing.md),
                ElevatedButton.icon(
                  onPressed: () => ProofSubmissionSheet.show(context, job),
                  icon: const Icon(Icons.camera_alt_rounded, size: 16),
                  label: const Text('SUBMIT COMPLETION PROOF'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(46),
                    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                ),
              ],
            ),
          ),
        ]

        // 4. PROOF SUBMITTED STATE
        else if (isProofSubmitted) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle_rounded, size: 24, color: Color(0xFF2563EB)),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Service Completed — Proof Submitted',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A)),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'After-service proof verified. Please settle and confirm payment below to close and complete this job.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF1D4ED8)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1D4ED8),
                    borderRadius: BorderRadius.circular(AppRadius.chip),
                  ),
                  child: const Text(
                    'PROOF SUBMITTED',
                    style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ]

        // 5. COMPLETED STATE
        else if (isCompleted) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: const Row(
              children: [
                Icon(Icons.task_alt_rounded, size: 24, color: Color(0xFF059669)),
                SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Job Successfully Completed',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'All service tasks finished, completion proof submitted, and payment recorded.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF047857)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],

        // ══════════════════════════════════════════════════════════════════════
        // PAYMENT SETTLEMENT & CASH COLLECTION SECTION
        // (Appears for in_progress, proof_submitted, and completed jobs)
        // ══════════════════════════════════════════════════════════════════════
        if (isInProgress || isProofSubmitted || isCompleted) ...[
          const SizedBox(height: AppSpacing.md),
          if (isOnlinePayment) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, size: 20, color: Color(0xFF059669)),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Payment: ONLINE (Prepaid)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                        ),
                        Text(
                          'Amount: ₹${job.totalAmount?.toStringAsFixed(2) ?? "0.00"} • No cash collection required.',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(AppRadius.chip),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: const Text(
                      'PAID ONLINE ✓',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (isPaymentPaid) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, size: 20, color: Color(0xFF059669)),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Cash Payment Confirmed & Collected',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                        ),
                        Text(
                          'Amount: ₹${job.totalAmount?.toStringAsFixed(2) ?? "0.00"} • Received by Technician',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF047857)),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF059669),
                      borderRadius: BorderRadius.circular(AppRadius.chip),
                    ),
                    child: const Text(
                      'PAID ✓',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (isCashPending) ...[
            // CASH PENDING: Awaiting Customer Confirmation via OTP or Customer Dashboard
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.hourglass_top_rounded, size: 18, color: Color(0xFFD97706)),
                      const SizedBox(width: AppSpacing.sm),
                      const Expanded(
                        child: Text(
                          'Cash Collection Reported — Awaiting Confirmation',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(AppRadius.chip),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: const Text(
                          'CASH PENDING',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Amount Received: ₹${job.totalAmount?.toStringAsFixed(2) ?? "0.00"}',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF78350F)),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Customer can confirm in their dashboard, or share the 6-digit payment confirmation OTP with you:',
                    style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  if (_paymentError != null) ...[
                    Text(
                      _paymentError!,
                      style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                  ],

                  OtpInputField(
                    onChanged: (val) => setState(() => _paymentOtpValue = val),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _paymentOtpValue.length == 6 && !_isVerifyingPaymentOtp
                              ? () => _verifyPaymentOtp(job.id)
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD97706),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                          ),
                          child: Text(_isVerifyingPaymentOtp ? 'Verifying...' : 'Verify Payment OTP'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      TextButton(
                        onPressed: () => CashCollectionSheet.show(context, job),
                        child: const Text(
                          'Re-record cash',
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF92400E)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ] else ...[
            // Cash on Service (Uncollected)
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.payments_outlined, size: 16, color: Color(0xFFD97706)),
                          SizedBox(width: 6),
                          Text(
                            'Payment Collection (Cash on Service)',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                          ),
                        ],
                      ),
                      Text(
                        '₹${job.totalAmount?.toStringAsFixed(2) ?? "0.00"} DUE',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          fontFamily: 'monospace',
                          color: Color(0xFF78350F),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Collect cash payment from the customer upon completing work.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  ElevatedButton.icon(
                    onPressed: () => CashCollectionSheet.show(context, job),
                    icon: const Icon(Icons.payments_rounded, size: 16),
                    label: Text('COLLECT ₹${job.totalAmount?.toStringAsFixed(0) ?? "0"} CASH'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(44),
                      textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _JobNotFound extends StatelessWidget {
  const _JobNotFound({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.65,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.search_off_rounded, size: 44, color: AppColors.textMuted),
                  const SizedBox(height: AppSpacing.md),
                  Text('Job not found', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'This job may have been reassigned or is no longer available.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  OutlinedButton(onPressed: onBack, child: const Text('Go Back')),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.color,
    required this.icon,
    required this.label,
    required this.trailing,
  });

  final Color color;
  final IconData icon;
  final String label;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    this.icon,
    this.rows = const [],
    this.customContent,
    this.freeText,
  });

  final String title;
  final IconData? icon;
  final List<_InfoRow> rows;
  final Widget? customContent;
  final String? freeText;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.xs),
                ],
                Text(title, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            if (freeText != null)
              Text(
                freeText!,
                style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
              )
            else if (customContent != null)
              customContent!
            else
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: AppSpacing.md),
                rows[i],
              ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueStyle,
    this.action,
  });

  final IconData icon;
  final String label;
  final String value;
  final TextStyle? valueStyle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: AppSpacing.sm),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 95, minWidth: 60),
          child: Text(
            label,
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            value,
            style: valueStyle ?? Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        ?action,
      ],
    );
  }
}
