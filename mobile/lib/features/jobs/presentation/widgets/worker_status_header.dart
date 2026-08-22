import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../profile/presentation/profile_providers.dart';
import '../jobs_providers.dart';

/// Worker Profile / Current Status Header matching the web app:
/// Displays worker avatar initial, name, worker ID, availability status badge,
/// and live busy/online state.
class WorkerStatusHeader extends ConsumerWidget {
  const WorkerStatusHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final profileAsync = ref.watch(employeeProfileProvider);
    final hasActiveJob = ref.watch(hasActiveJobProvider);
    final profile = profileAsync.valueOrNull;

    final displayName = profile != null && profile.fullName.trim().isNotEmpty
        ? profile.fullName
        : (user?.displayName.isNotEmpty == true ? user!.displayName : 'Technician');
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';
    final workerId = profile?.employeeId ?? user?.employeeId ?? user?.username ?? '—';
    final isOnline = profile?.isOnline ?? false;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 340;

        return Container(
          padding: EdgeInsets.all(isCompact ? AppSpacing.sm : AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x08000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Avatar
                  Container(
                    width: isCompact ? 38 : 44,
                    height: isCompact ? 38 : 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initial,
                      style: TextStyle(
                        fontSize: isCompact ? 16 : 18,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                  ),
                  SizedBox(width: isCompact ? AppSpacing.sm : AppSpacing.md),
                  // Name + Status + ID
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: isCompact ? 13.5 : 14.5,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            StatusChip(
                              status: hasActiveJob ? 'busy' : (isOnline ? 'online' : 'offline'),
                              label: hasActiveJob
                                  ? 'ON JOB'
                                  : (isOnline ? 'AVAILABLE' : 'OFFLINE'),
                              dense: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              'ID: ',
                              style: TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: AppColors.textMuted,
                              ),
                            ),
                            Flexible(
                              child: Text(
                                workerId,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF334155),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              // Status Strip / Banner
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
                decoration: BoxDecoration(
                  color: hasActiveJob
                      ? const Color(0xFFEFF6FF)
                      : (isOnline ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC)),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                  border: Border.all(
                    color: hasActiveJob
                        ? const Color(0xFFBFDBFE)
                        : (isOnline ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0)),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      hasActiveJob
                          ? Icons.bolt_rounded
                          : (isOnline ? Icons.check_circle_rounded : Icons.pause_circle_outline_rounded),
                      size: 14,
                      color: hasActiveJob
                          ? const Color(0xFF1D4ED8)
                          : (isOnline ? const Color(0xFF059669) : const Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        hasActiveJob
                            ? 'BUSY • ON ACTIVE JOB'
                            : (isOnline ? 'ONLINE • READY FOR DISPATCH' : 'OFFLINE • DISPATCH PAUSED'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: hasActiveJob
                              ? const Color(0xFF1D4ED8)
                              : (isOnline ? const Color(0xFF059669) : const Color(0xFF64748B)),
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
