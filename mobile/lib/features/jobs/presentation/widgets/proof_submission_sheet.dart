import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/loading_button.dart';
import '../../../../shared/widgets/photo_source_sheet.dart';
import '../../data/job_actions_repository.dart';
import '../../domain/job.dart';
import '../jobs_providers.dart';

/// Modal bottom sheet for submitting after-service completion proof matching web app.
class ProofSubmissionSheet extends ConsumerStatefulWidget {
  const ProofSubmissionSheet({super.key, required this.job});

  final Job job;

  static Future<bool?> show(BuildContext context, Job job) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (context) => ProofSubmissionSheet(job: job),
    );
  }

  @override
  ConsumerState<ProofSubmissionSheet> createState() => _ProofSubmissionSheetState();
}

class _ProofSubmissionSheetState extends ConsumerState<ProofSubmissionSheet> {
  String? _afterPresencePath;
  String? _afterAppliancePath;
  String? _afterWorkAreaPath;
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_afterPresencePath == null) {
      setState(() => _error = 'After Face Selfie is required before submitting proof.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final message = await ref.read(jobActionsRepositoryProvider).uploadProof(
        widget.job.id,
        afterPresencePhotoPath: _afterPresencePath!,
        afterAppliancePhotoPath: _afterAppliancePath,
        afterWorkAreaPhotoPath: _afterWorkAreaPath,
        notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
      );

      ref.invalidate(activeJobsProvider);
      ref.invalidate(completedJobsProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _error = describeDioError(e, fallback: 'Failed to submit completion proof.'));
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to submit completion proof.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.camera_alt_outlined, size: 22, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Proof of Work Completion — ${widget.job.requestId}',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Capture completion photos to verify service execution before collecting customer payment.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: AppSpacing.md),

            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 8),
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                ),
              ),
            ],

            // Step 1: After Face Selfie (Mandatory)
            _PhotoSlot(
              title: 'After Face Selfie (Technician Identity)',
              subtitle: 'Live selfie at customer location showing identity at completion',
              required: true,
              filePath: _afterPresencePath,
              onPick: () async {
                final path = await pickJobPhoto(context);
                if (path != null && mounted) setState(() => _afterPresencePath = path);
              },
              onRemove: () => setState(() => _afterPresencePath = null),
            ),

            const SizedBox(height: AppSpacing.sm),

            // Step 2: Appliance Photo (Optional)
            _PhotoSlot(
              title: 'Completed Product / Appliance Photo',
              subtitle: 'Photo of finished product or appliance condition',
              required: false,
              filePath: _afterAppliancePath,
              onPick: () async {
                final path = await pickJobPhoto(context);
                if (path != null && mounted) setState(() => _afterAppliancePath = path);
              },
              onRemove: () => setState(() => _afterAppliancePath = null),
            ),

            const SizedBox(height: AppSpacing.sm),

            // Step 3: Work Area Photo (Optional)
            _PhotoSlot(
              title: 'Cleaned Work-Area Photo',
              subtitle: 'Photo showing work site left clean and finished',
              required: false,
              filePath: _afterWorkAreaPath,
              onPick: () async {
                final path = await pickJobPhoto(context);
                if (path != null && mounted) setState(() => _afterWorkAreaPath = path);
              },
              onRemove: () => setState(() => _afterWorkAreaPath = null),
            ),

            const SizedBox(height: AppSpacing.md),

            // Work Notes
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Completion Notes (optional)',
                hintText: 'Any special remarks or customer instructions...',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.all(12),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            LoadingButton(
              label: 'SUBMIT COMPLETION PROOF',
              icon: Icons.check_circle_outline_rounded,
              isLoading: _isSubmitting,
              onPressed: _afterPresencePath != null ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(48),
                textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, letterSpacing: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoSlot extends StatelessWidget {
  const _PhotoSlot({
    required this.title,
    required this.subtitle,
    required this.required,
    required this.filePath,
    required this.onPick,
    required this.onRemove,
  });

  final String title;
  final String subtitle;
  final bool required;
  final String? filePath;
  final VoidCallback onPick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          if (filePath != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.chip),
              child: Image.file(
                File(filePath!),
                width: 48,
                height: 48,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: required ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(
                  color: required ? const Color(0xFFBFDBFE) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Icon(
                Icons.camera_alt_rounded,
                size: 22,
                color: required ? const Color(0xFF2563EB) : const Color(0xFF64748B),
              ),
            ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (required) ...[
                      const SizedBox(width: 4),
                      const Text('*', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
                    ],
                  ],
                ),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          if (filePath != null)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFDC2626)),
              onPressed: onRemove,
              tooltip: 'Remove photo',
            )
          else
            TextButton.icon(
              onPressed: onPick,
              icon: const Icon(Icons.add_a_photo_outlined, size: 14),
              label: Text(required ? 'Capture *' : 'Add Photo'),
              style: TextButton.styleFrom(
                textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              ),
            ),
        ],
      ),
    );
  }
}
