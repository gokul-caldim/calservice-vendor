import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/loading_button.dart';
import '../../data/job_actions_repository.dart';
import '../../domain/job.dart';
import '../jobs_providers.dart';

/// The exact 8 reason codes accepted by the backend
/// (WorkforceJobTechnicianCancelView.VALID_CANCELLATION_REASONS), and the
/// endpoint the web UI's cancel modal actually calls (`/cancel/`).
const _cancelReasons = [
  ('VEHICLE_ISSUE', 'Vehicle issue / Breakdown'),
  ('TRAFFIC_ROUTE_ISSUE', 'Heavy traffic / Road blockage'),
  ('TOO_FAR', 'Distance too far / Unreachable in time'),
  ('SERVICE_MISMATCH', 'Service requires different tools / equipment'),
  ('CUSTOMER_LOCATION_ISSUE', 'Customer site unreachable / unsafe access'),
  ('SAFETY_CONCERN', 'Safety concern / Hazardous conditions'),
  ('PERSONAL_EMERGENCY', 'Personal emergency'),
  ('OTHER', 'Other reason (explanation required)'),
];

/// Shown for status accepted/on_the_way/en_route — matches the web JSX
/// condition exactly. Disabled once the (informational) cancellation
/// countdown has hit zero, mirroring the web button's disabled state, even
/// though the backend itself doesn't actually enforce a time deadline on
/// this endpoint (only status + OTP-not-verified gates it).
class CancelAssignmentButton extends StatelessWidget {
  const CancelAssignmentButton({super.key, required this.job});

  final Job job;

  bool get _canCancelNow {
    final info = job.cancellationInfo;
    if (info == null) return true;
    if (info.canCancel == false && (info.remainingSeconds ?? 1) == 0) return false;
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return LoadingButton(
      label: 'Cancel Assignment',
      filled: false,
      onPressed: _canCancelNow
          ? () => showDialog<void>(
              context: context,
              builder: (context) => _CancelAssignmentDialog(job: job),
            )
          : null,
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFFDC2626),
        side: const BorderSide(color: Color(0xFFFECDD3)),
      ),
    );
  }
}

class _CancelAssignmentDialog extends ConsumerStatefulWidget {
  const _CancelAssignmentDialog({required this.job});

  final Job job;

  @override
  ConsumerState<_CancelAssignmentDialog> createState() => _CancelAssignmentDialogState();
}

class _CancelAssignmentDialogState extends ConsumerState<_CancelAssignmentDialog> {
  String _selectedCode = 'VEHICLE_ISSUE';
  final _detailController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _detailController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(jobActionsRepositoryProvider)
          .cancelJob(
            widget.job.id,
            reasonCode: _selectedCode,
            reasonDetail: _detailController.text.trim(),
          );
      ref.invalidate(activeJobsProvider);
      await ref.read(activeJobsProvider.future);
      if (mounted) Navigator.of(context).pop();
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      String message;
      switch (code) {
        case 'CANCELLATION_NOT_ALLOWED_IN_CURRENT_STATE':
          message = 'Cancellation is not allowed in the current state.';
          break;
        case 'CANCELLATION_LOCKED_AFTER_OTP':
          message = 'Cancellation is not allowed after customer OTP verification.';
          break;
        default:
          message = describeDioError(e, fallback: 'Failed to cancel job assignment.');
      }
      setState(() => _error = message);
    } catch (_) {
      setState(() => _error = 'Failed to cancel job assignment.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOther = _selectedCode == 'OTHER';
    final canConfirm = !isOther || _detailController.text.trim().isNotEmpty;

    return AlertDialog(
      title: const Text('Cancel Job Assignment'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: const Text(
                'This will unassign you from the job and redispatch it to another technician.',
                style: TextStyle(fontSize: 11.5, color: Color(0xFF9F1239)),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
            ],
            const SizedBox(height: AppSpacing.sm),
            RadioGroup<String>(
              groupValue: _selectedCode,
              onChanged: (value) {
                if (value != null) setState(() => _selectedCode = value);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final (code, label) in _cancelReasons)
                    RadioListTile<String>(
                      value: code,
                      title: Text(label, style: const TextStyle(fontSize: 13)),
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                    ),
                ],
              ),
            ),
            if (isOther) ...[
              const SizedBox(height: AppSpacing.xs),
              TextField(
                controller: _detailController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Explanation (required)'),
                maxLines: 2,
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Keep Job'),
        ),
        FilledButton(
          onPressed: (canConfirm && !_isSubmitting) ? _confirm : null,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
          child: Text(_isSubmitting ? 'Cancelling...' : 'Confirm Cancel'),
        ),
      ],
    );
  }
}
