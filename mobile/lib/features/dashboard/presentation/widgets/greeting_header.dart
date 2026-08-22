import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../profile/presentation/profile_providers.dart';

String _greetingForHour(int hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/// Identity + online/offline + shift status, all in one compact card so the
/// technician understands who they are and their current state within a
/// glance — this is the very first thing Home shows.
class GreetingHeader extends ConsumerWidget {
  const GreetingHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final profileAsync = ref.watch(employeeProfileProvider);
    final shiftAsync = ref.watch(shiftStatusProvider);

    final displayName = user?.displayName ?? 'Technician';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';
    final greeting = _greetingForHour(DateTime.now().hour);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              child: Text(
                initial,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    greeting,
                    style: TextStyle(fontSize: 12.5, color: AppColors.textMuted, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      profileAsync.maybeWhen(
                        data: (profile) => StatusChip(status: profile.isOnline ? 'online' : 'offline'),
                        orElse: () => const SizedBox.shrink(),
                      ),
                      shiftAsync.maybeWhen(
                        data: (shift) => shift == null
                            ? const SizedBox.shrink()
                            : StatusChip(status: shift.shiftStatus, label: shift.displayLabel),
                        orElse: () => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
