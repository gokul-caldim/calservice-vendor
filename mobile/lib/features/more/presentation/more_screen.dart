import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/nav_group_section.dart';
import '../../../shared/widgets/nav_item_tile.dart';
import '../../../shared/widgets/workforce_app_bar.dart';
import '../../auth/presentation/auth_controller.dart';

/// Mirrors the web sidebar's grouped navigation for approved employees
/// (Sidebar.jsx): MY WORK (Jobs, Performance) and PROFILE (My Profile,
/// Documents, Services, My Locations). Jobs is intentionally listed here
/// even though it also has its own bottom-nav tab — reusing the same
/// route — to match the web structure exactly, per explicit request.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final displayName = user?.displayName ?? 'Technician';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';
    final subtitle = (user?.email ?? '').isNotEmpty ? user!.email : 'View profile';

    return Scaffold(
      appBar: const WorkforceAppBar(titleText: 'More', showBrand: false),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadius.card),
              onTap: () => context.push('/more/profile'),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                      child: Text(
                        initial,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(displayName, style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 2),
                          Text(subtitle, style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          NavGroupSection(
            title: 'My Work',
            children: [
              NavItemTile(
                icon: Icons.work_outline_rounded,
                iconColor: AppColors.primary,
                label: 'Jobs',
                onTap: () => context.go('/jobs'),
              ),
              NavItemTile(
                icon: Icons.star_outline_rounded,
                iconColor: const Color(0xFFF59E0B),
                label: 'Performance',
                onTap: () => context.push('/more/performance'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          NavGroupSection(
            title: 'Profile',
            children: [
              NavItemTile(
                icon: Icons.person_outline_rounded,
                label: 'My Profile',
                onTap: () => context.push('/more/profile'),
              ),
              NavItemTile(
                icon: Icons.shield_outlined,
                label: 'Documents',
                onTap: () => context.push('/more/documents'),
              ),
              NavItemTile(
                icon: Icons.build_outlined,
                label: 'Services',
                onTap: () => context.push('/more/services'),
              ),
              NavItemTile(
                icon: Icons.place_outlined,
                label: 'My Locations',
                onTap: () => context.push('/more/locations'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text('SETTINGS', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: AppSpacing.sm),
          Card(
            clipBehavior: Clip.antiAlias,
            child: NavItemTile(
              icon: Icons.settings_outlined,
              iconColor: AppColors.textSecondary,
              label: 'Settings',
              onTap: () => context.push('/more/settings'),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          // Prominent, accessible Logout Action
          OutlinedButton.icon(
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Log Out'),
                  content: const Text(
                    'Are you sure you want to log out of Workforce?',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                      ),
                      onPressed: () => Navigator.of(ctx).pop(true),
                      child: const Text('Log Out'),
                    ),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await ref.read(authControllerProvider.notifier).logout();
              }
            },
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            label: const Text(
              'Log Out',
              style: TextStyle(
                color: Color(0xFFDC2626),
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFFECDD3)),
              backgroundColor: const Color(0xFFFFF1F2),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.button),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ),
    );
  }
}
