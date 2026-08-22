import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/countdown_text.dart';
import '../../data/job_actions_repository.dart';
import '../../domain/job.dart';
import '../jobs_providers.dart';

/// Prominent card for an incoming job offer with full details,
/// live countdown timer, and direct Accept & Decline actions matching the web UI.
class OfferCard extends ConsumerStatefulWidget {
  const OfferCard({super.key, required this.job});

  final Job job;

  @override
  ConsumerState<OfferCard> createState() => _OfferCardState();
}

class _OfferCardState extends ConsumerState<OfferCard> {
  bool _isAccepting = false;
  bool _isDeclining = false;
  String? _error;

  Future<void> _refreshJobs() async {
    ref.invalidate(activeJobsProvider);
    await ref.read(activeJobsProvider.future);
  }

  Future<void> _accept() async {
    setState(() {
      _isAccepting = true;
      _error = null;
    });
    try {
      await ref.read(jobActionsRepositoryProvider).acceptOffer(widget.job.id);
      await _refreshJobs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Job offer accepted! Heading to customer site.'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      String message;
      switch (code) {
        case 'JOB_ALREADY_ACCEPTED':
          message = 'This job was already accepted by another technician.';
          break;
        case 'OFFER_EXPIRED':
          message = 'This job offer has expired.';
          break;
        case 'EMPLOYEE_ALREADY_BUSY':
          message = 'You already have an active job in progress.';
          break;
        default:
          message = describeDioError(e, fallback: 'Failed to accept job offer.');
      }
      if (mounted) setState(() => _error = message);
      if (code == 'JOB_ALREADY_ACCEPTED' || code == 'OFFER_EXPIRED') {
        await _refreshJobs();
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to accept job offer.');
    } finally {
      if (mounted) setState(() => _isAccepting = false);
    }
  }

  Future<void> _decline() async {
    final reason = await _showDeclineReasonModal(context);
    if (reason == null || !mounted) return;

    setState(() {
      _isDeclining = true;
      _error = null;
    });
    try {
      await ref.read(jobActionsRepositoryProvider).rejectOffer(widget.job.id, reason);
      await _refreshJobs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Job offer declined.')),
        );
      }
    } on DioException catch (e) {
      if (mounted) setState(() => _error = describeDioError(e, fallback: 'Failed to decline job offer.'));
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to decline job offer.');
    } finally {
      if (mounted) setState(() => _isDeclining = false);
    }
  }

  Future<String?> _showDeclineReasonModal(BuildContext context) {
    String selectedReason = 'Too far';
    String customReason = '';

    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.cancel_outlined, size: 20, color: Color(0xFFDC2626)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Decline Job Offer — ${widget.job.requestId}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text(
                    'Please select a reason for declining this job offer. The system will dispatch the job to the next available professional.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  ...[
                    'Too far',
                    'Busy / Heavy traffic',
                    'Vehicle issue',
                    'Service mismatch',
                    'Personal reason',
                    'Other',
                  ].map((reason) {
                    final isSelected = selectedReason == reason;
                    return InkWell(
                      onTap: () => setModalState(() => selectedReason = reason),
                      borderRadius: BorderRadius.circular(AppRadius.chip),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                        child: Row(
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              margin: const EdgeInsets.only(right: 10, left: 4),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? const Color(0xFFDC2626) : const Color(0xFF94A3B8),
                                  width: isSelected ? 5 : 1.5,
                                ),
                              ),
                            ),
                            Text(
                              reason,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: const Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  if (selectedReason == 'Other') ...[
                    const SizedBox(height: AppSpacing.xs),
                    TextField(
                      autofocus: true,
                      onChanged: (val) => customReason = val,
                      decoration: const InputDecoration(
                        hintText: 'Specify reason...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Keep Offer'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            final finalReason = selectedReason == 'Other'
                                ? (customReason.trim().isNotEmpty ? customReason.trim() : 'Other')
                                : selectedReason;
                            Navigator.of(context).pop(finalReason);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('Confirm Decline'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final expiresAt = widget.job.offerExpiresAt ?? widget.job.activeOffer?.expiresAt;
    final scheduleText = widget.job.preferredDate != null && widget.job.preferredTime != null
        ? '${widget.job.preferredDate} • ${widget.job.preferredTime}'
        : (widget.job.preferredDate ?? widget.job.preferredTime ?? 'Flexible schedule');

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFFBBF24), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14D97706),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.card),
          onTap: () => context.push('/jobs/${widget.job.id}'),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Offer Header: Badge + Expiry
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: AppSpacing.sm,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFFD97706),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Text(
                            'EXCLUSIVE JOB OFFER',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF92400E),
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (expiresAt != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(AppRadius.chip),
                          border: Border.all(color: const Color(0xFFFECDD3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.timer_outlined, size: 12, color: Color(0xFFB91C1C)),
                            const SizedBox(width: 4),
                            CountdownText(
                              target: expiresAt,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFB91C1C),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),

                // Job ID & Title
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.job.requestId,
                            style: const TextStyle(
                              fontSize: 12,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2563EB),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.job.displayTitle,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (widget.job.totalAmount != null)
                      Text(
                        '₹${widget.job.totalAmount!.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          fontFamily: 'monospace',
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: AppSpacing.sm),

                // Details Box (Customer, Location, Schedule, Distance)
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.chip),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Column(
                    children: [
                      if (widget.job.customerName != null && widget.job.customerName!.isNotEmpty)
                        _DetailRow(
                          icon: Icons.person_outline_rounded,
                          text: widget.job.customerName!,
                          bold: true,
                        ),
                      if (widget.job.address != null && widget.job.address!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        _DetailRow(
                          icon: Icons.place_outlined,
                          text: widget.job.address!,
                          trailing: widget.job.distanceKm != null
                              ? '${widget.job.distanceKm!.toStringAsFixed(1)} km away'
                              : null,
                        ),
                      ],
                      const SizedBox(height: 4),
                      _DetailRow(
                        icon: Icons.calendar_today_outlined,
                        text: scheduleText,
                      ),
                    ],
                  ),
                ),

                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _error!,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                  ),
                ],

                const SizedBox(height: AppSpacing.md),

                // Accept & Decline Action Buttons
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: (_isAccepting || _isDeclining) ? null : _accept,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.chip)),
                          elevation: 0,
                        ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_isAccepting)
                                const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              else
                                const Icon(Icons.check_circle_rounded, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                _isAccepting ? 'ACCEPTING...' : 'ACCEPT',
                                maxLines: 1,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        onPressed: (_isAccepting || _isDeclining) ? null : _decline,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFFECDD3)),
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.chip)),
                        ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            _isDeclining ? '...' : 'DECLINE',
                            maxLines: 1,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.text, this.bold = false, this.trailing});

  final IconData icon;
  final String text;
  final bool bold;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: AppColors.textMuted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: const Color(0xFF334155),
            ),
          ),
        ),
        if (trailing != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(AppRadius.chip),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Text(
              trailing!,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Color(0xFF065F46),
              ),
            ),
          ),
      ],
    );
  }
}
