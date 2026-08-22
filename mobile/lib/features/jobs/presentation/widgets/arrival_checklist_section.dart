import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/location/location_service.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/loading_button.dart';
import '../../../../shared/widgets/otp_input_field.dart';
import '../../../../shared/widgets/photo_source_sheet.dart';
import '../../../profile/presentation/profile_providers.dart';
import '../../data/job_actions_repository.dart';
import '../../data/job_time_tracking_repository.dart';
import '../../domain/job.dart';
import '../../domain/pre_service_status.dart';
import '../jobs_providers.dart';
import '../providers/pre_service_status_provider.dart';

/// The Arrival & Verification Checklist matching the web application workflow:
/// 1. Location Verification (Geofence ≤ 250m)
/// 2. Required Pre-Service Evidence (Customer OTP & 3 Photos: presence, appliance, work_area)
/// 3. Service Gate Banner: "CLOCK IN & START WORK" once verified
class ArrivalChecklistSection extends ConsumerStatefulWidget {
  const ArrivalChecklistSection({super.key, required this.job});

  final Job job;

  @override
  ConsumerState<ArrivalChecklistSection> createState() => _ArrivalChecklistSectionState();
}

class _ArrivalChecklistSectionState extends ConsumerState<ArrivalChecklistSection> {
  bool _isVerifyingArrival = false;
  bool _isVerifyingOtp = false;
  bool _isResendingOtp = false;
  bool _isClockingIn = false;
  PreServicePhotoType? _uploadingPhotoType;
  String _otpValue = '';
  String? _error;
  String? _info;

  Future<void> _refreshActiveJobs() async {
    ref.invalidate(activeJobsProvider);
    await ref.read(activeJobsProvider.future);
  }

  void _setError(String message) => setState(() {
    _error = message;
    _info = null;
  });

  void _setInfo(String message) => setState(() {
    _info = message;
    _error = null;
  });

  Future<void> _verifyArrival() async {
    setState(() {
      _isVerifyingArrival = true;
      _error = null;
      _info = null;
    });
    try {
      final position = await ref.read(locationServiceProvider).getCurrentPosition();
      final message = await ref
          .read(jobActionsRepositoryProvider)
          .verifyArrival(widget.job.id, lat: position.latitude, lon: position.longitude);
      ref.invalidate(preServiceStatusProvider(widget.job.id));
      await _refreshActiveJobs();
      if (mounted) _setInfo(message);
    } on LocationFailure catch (e) {
      if (mounted) _setError(e.message);
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      if (code == 'OUTSIDE_GEOFENCE') {
        if (mounted) {
          _setError('Arrival failed: You are outside the 250m geofence of the customer site. Please get closer to verify arrival.');
        }
      } else {
        if (mounted) _setError(describeDioError(e, fallback: 'Failed to verify arrival. Ensure you are within 250m of the job site.'));
      }
    } catch (_) {
      if (mounted) _setError('Failed to verify arrival.');
    } finally {
      if (mounted) setState(() => _isVerifyingArrival = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (_otpValue.length != 6) return;
    setState(() {
      _isVerifyingOtp = true;
      _error = null;
      _info = null;
    });
    try {
      final message = await ref.read(jobActionsRepositoryProvider).verifyOtp(widget.job.id, _otpValue);
      ref.invalidate(preServiceStatusProvider(widget.job.id));
      await _refreshActiveJobs();
      if (mounted) _setInfo(message);
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      if (code == 'MAX_OTP_ATTEMPTS_EXCEEDED') {
        if (mounted) _setError('Maximum OTP attempts exceeded (5/5). Please click "Resend OTP" to generate a fresh code.');
      } else if (code == 'OTP_EXPIRED') {
        if (mounted) _setError('Customer OTP has expired. Please click "Resend OTP" to generate a fresh code.');
      } else if (code == 'INVALID_OTP') {
        if (mounted) _setError('Invalid Customer OTP code. Ask customer for the 6-digit code displayed in their app.');
      } else {
        if (mounted) _setError(describeDioError(e, fallback: 'Invalid Customer OTP code.'));
      }
    } catch (_) {
      if (mounted) _setError('Invalid Customer OTP code.');
    } finally {
      if (mounted) setState(() => _isVerifyingOtp = false);
    }
  }

  Future<void> _resendOtp() async {
    setState(() {
      _isResendingOtp = true;
      _error = null;
      _info = null;
    });
    try {
      final message = await ref.read(jobActionsRepositoryProvider).resendOtp(widget.job.id);
      if (mounted) _setInfo(message);
    } on DioException catch (e) {
      if (mounted) _setError(describeDioError(e, fallback: 'Failed to resend OTP.'));
    } catch (_) {
      if (mounted) _setError('Failed to resend OTP.');
    } finally {
      if (mounted) setState(() => _isResendingOtp = false);
    }
  }

  Future<void> _uploadPhoto(PreServicePhotoType type) async {
    final path = await pickJobPhoto(context);
    if (path == null || !mounted) return;

    setState(() {
      _uploadingPhotoType = type;
      _error = null;
      _info = null;
    });
    try {
      final message = await ref
          .read(jobActionsRepositoryProvider)
          .uploadPreServicePhoto(widget.job.id, photoType: type, filePath: path);
      ref.invalidate(preServiceStatusProvider(widget.job.id));
      await _refreshActiveJobs();
      if (mounted) _setInfo(message);
    } on DioException catch (e) {
      if (mounted) _setError(describeDioError(e, fallback: 'Photo upload failed.'));
    } catch (_) {
      if (mounted) _setError('Photo upload failed.');
    } finally {
      if (mounted) setState(() => _uploadingPhotoType = null);
    }
  }

  Future<void> _clockIn() async {
    setState(() {
      _isClockingIn = true;
      _error = null;
      _info = null;
    });
    try {
      final position = await ref.read(locationServiceProvider).getCurrentPosition();
      await ref
          .read(jobTimeTrackingRepositoryProvider)
          .clockIn(
            jobId: widget.job.id,
            lat: position.latitude,
            lon: position.longitude,
            accuracy: position.accuracy,
            timestamp: position.timestamp,
            address: widget.job.address,
          );
      await _refreshActiveJobs();
      ref.invalidate(shiftStatusProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Clocked in successfully! Job is now IN PROGRESS.'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }
    } on LocationFailure catch (e) {
      if (mounted) _setError(e.message);
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      if (code == 'OUTSIDE_GEOFENCE') {
        if (mounted) _setError('Clock-In failed: You are outside the authorized geofence radius. You must be within 250m of the customer destination to clock in.');
      } else if (code == 'ARRIVAL_REQUIRED' || code == 'PRE_SERVICE_VERIFICATION_REQUIRED') {
        if (mounted) _setError('Clock-In rejected: Pre-service verification incomplete. Arrival, OTP, and presence selfie required.');
      } else if (code == 'OTP_REQUIRED') {
        if (mounted) _setError('Clock-In rejected: Customer Work Start OTP verification is required first.');
      } else if (code == 'ALREADY_CLOCKED_IN') {
        if (mounted) _setError('Technician is already clocked in.');
      } else {
        if (mounted) _setError(describeDioError(e, fallback: 'Clock-in failed.'));
      }
    } catch (_) {
      if (mounted) _setError('Clock-in failed.');
    } finally {
      if (mounted) setState(() => _isClockingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(preServiceStatusProvider(widget.job.id));
    final status = statusAsync.valueOrNull ?? PreServiceStatus.initial;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            runSpacing: 4,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified_user_outlined, size: 18, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  // Flexible so the label can wrap/ellipsize instead of
                  // overflowing on narrow screens or at large font scales.
                  Flexible(
                    child: Text(
                      'ARRIVAL & VERIFICATION CHECKLIST',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: status.isComplete ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                  border: Border.all(
                    color: status.isComplete ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                  ),
                ),
                child: Text(
                  status.isComplete ? 'VERIFIED' : 'VERIFICATION REQUIRED',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: status.isComplete ? const Color(0xFF065F46) : const Color(0xFF92400E),
                  ),
                ),
              ),
            ],
          ),

          if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _MessageBanner(message: _error!, isError: true),
          ],
          if (_info != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _MessageBanner(message: _info!, isError: false),
          ],

          const SizedBox(height: AppSpacing.md),

          // Step 1: Location Verification (Geofence ≤250m)
          _ChecklistCard(
            stepNumber: 1,
            title: '1. Location Verification (Geofence ≤250m)',
            done: status.geofencePassed,
            child: status.geofencePassed
                ? Row(
                    children: [
                      const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF10B981)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Arrival verified! You are inside the authorized 250m customer site geofence.',
                          style: TextStyle(fontSize: 12.5, color: const Color(0xFF065F46), fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Travel toward customer destination. Backend verifies arrival automatically once inside the 250m geofence.',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final isCompact = constraints.maxWidth < 340;

                          if (isCompact) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(AppRadius.chip),
                                    border: Border.all(color: const Color(0xFFBFDBFE)),
                                  ),
                                  child: Row(
                                    children: [
                                      const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'Auto-detecting arrival...',
                                          style: TextStyle(fontSize: 11.5, color: AppColors.primaryDark, fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.sm),
                                LoadingButton(
                                  label: 'Verify Arrival Now',
                                  icon: Icons.my_location_rounded,
                                  isLoading: _isVerifyingArrival,
                                  onPressed: _verifyArrival,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFF59E0B),
                                    foregroundColor: Colors.white,
                                    textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                  ),
                                ),
                              ],
                            );
                          }

                          return Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(AppRadius.chip),
                                    border: Border.all(color: const Color(0xFFBFDBFE)),
                                  ),
                                  child: Row(
                                    children: [
                                      const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'Auto-detecting arrival...',
                                          style: TextStyle(fontSize: 11.5, color: AppColors.primaryDark, fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              LoadingButton(
                                label: 'Verify Arrival Now',
                                icon: Icons.my_location_rounded,
                                isLoading: _isVerifyingArrival,
                                onPressed: _verifyArrival,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFF59E0B),
                                  foregroundColor: Colors.white,
                                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
          ),

          const SizedBox(height: AppSpacing.md),

          // Step 2: Required Pre-Service Evidence (OTP & Photos)
          if (!status.geofencePassed) ...[
            _LockedCard(
              title: '2. Required Pre-Service Evidence (OTP & Photos)',
              subtitle: 'Customer OTP input and 3 photo upload buttons will unlock immediately once Step 1 Arrival is verified.',
            ),
          ] else ...[
            _ChecklistCard(
              stepNumber: 2,
              title: '2. Required Pre-Service Evidence',
              done: status.otpVerified && status.presencePhoto && status.appliancePhoto && status.workAreaPhoto,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // OTP Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Customer Work Start OTP', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                            Text('Ask customer for the 6-digit code received on arrival', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          ],
                        ),
                      ),
                      if (status.otpVerified) ...[
                        const SizedBox(width: AppSpacing.xs),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1FAE5),
                            borderRadius: BorderRadius.circular(AppRadius.chip),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF065F46)),
                              SizedBox(width: 4),
                              Text('Verified ✓', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF065F46))),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (!status.otpVerified) ...[
                    const SizedBox(height: AppSpacing.sm),
                    OtpInputField(
                      onChanged: (value) => setState(() => _otpValue = value),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: LoadingButton(
                            label: 'Verify OTP',
                            isLoading: _isVerifyingOtp,
                            onPressed: _otpValue.length == 6 ? _verifyOtp : null,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          flex: 1,
                          child: LoadingButton(
                            label: 'Resend',
                            filled: false,
                            isLoading: _isResendingOtp,
                            onPressed: _resendOtp,
                          ),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: AppSpacing.md),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.sm),

                  // Photos Section
                  Text('Required Photos', style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: AppSpacing.xs),
                  _PhotoRow(
                    type: PreServicePhotoType.presence,
                    title: 'Before Face Selfie (Technician Identity)',
                    subtitle: 'Live selfie at job location showing identity',
                    done: status.presencePhoto,
                    uploading: _uploadingPhotoType == PreServicePhotoType.presence,
                    onTap: () => _uploadPhoto(PreServicePhotoType.presence),
                  ),
                  const Divider(height: 1),
                  _PhotoRow(
                    type: PreServicePhotoType.appliance,
                    title: 'Before Product / Appliance Photo',
                    subtitle: 'Photo of appliance/product condition before work',
                    done: status.appliancePhoto,
                    uploading: _uploadingPhotoType == PreServicePhotoType.appliance,
                    onTap: () => _uploadPhoto(PreServicePhotoType.appliance),
                  ),
                  const Divider(height: 1),
                  _PhotoRow(
                    type: PreServicePhotoType.workArea,
                    title: 'Before Work-Area Photo',
                    subtitle: 'Photo of work area condition before work',
                    done: status.workAreaPhoto,
                    uploading: _uploadingPhotoType == PreServicePhotoType.workArea,
                    onTap: () => _uploadPhoto(PreServicePhotoType.workArea),
                  ),
                ],
              ),
            ),
          ],

          // Step 3 / Service Gate Banner
          if (status.isComplete) ...[
            const SizedBox(height: AppSpacing.lg),
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
                  const Row(
                    children: [
                      Icon(Icons.check_circle_rounded, size: 20, color: Color(0xFF059669)),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Pre-Service Verification Complete!',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF065F46),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'All arrival, OTP, and evidence verified. Click below to verify fresh GPS and clock in.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF047857)),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  LoadingButton(
                    label: 'CLOCK IN & START WORK',
                    icon: Icons.play_arrow_rounded,
                    isLoading: _isClockingIn,
                    onPressed: _clockIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(50),
                      textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ChecklistCard extends StatelessWidget {
  const _ChecklistCard({
    required this.stepNumber,
    required this.title,
    required this.done,
    required this.child,
  });

  final int stepNumber;
  final String title;
  final bool done;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: done ? const Color(0xFF10B981) : AppColors.background,
                  shape: BoxShape.circle,
                  border: Border.all(color: done ? const Color(0xFF10B981) : AppColors.border),
                ),
                child: done
                    ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                    : Center(
                        child: Text(
                          '$stepNumber',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _LockedCard extends StatelessWidget {
  const _LockedCard({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.xs,
            runSpacing: 4,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_outline_rounded, size: 16, color: Color(0xFF64748B)),
                  const SizedBox(width: AppSpacing.xs),
                  Flexible(
                    child: Text(
                      title,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: const Text(
                  '🔒 UNLOCKS ON ARRIVAL',
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}

class _PhotoRow extends StatelessWidget {
  const _PhotoRow({
    required this.type,
    required this.title,
    required this.subtitle,
    required this.done,
    required this.uploading,
    required this.onTap,
  });

  final PreServicePhotoType type;
  final String title;
  final String subtitle;
  final bool done;
  final bool uploading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.photo_camera_outlined,
            size: 20,
            color: done ? const Color(0xFF10B981) : AppColors.textMuted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                Text(subtitle, style: TextStyle(fontSize: 10.5, color: AppColors.textMuted)),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          if (done)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFD1FAE5),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Text(
                'Uploaded ✓',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
              ),
            )
          else if (uploading)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            )
          else
            OutlinedButton.icon(
              onPressed: onTap,
              icon: const Icon(Icons.camera_alt_outlined, size: 14),
              label: const Text('Capture', style: TextStyle(fontSize: 11.5)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: const Size(0, 32),
              ),
            ),
        ],
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFDC2626) : const Color(0xFF2563EB);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.chip),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(message, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
