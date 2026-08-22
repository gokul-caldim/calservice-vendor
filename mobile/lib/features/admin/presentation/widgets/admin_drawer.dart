import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/auth_controller.dart';

/// The official Admin Navigation Drawer for Workforce Mobile.
/// Provides grouped, collapsible navigation matching the web sidebar structure:
/// - HOME: Home
/// - WORKFORCE: Employees, Applications, Services, Skills
/// - OPERATIONS: Jobs, Dispatch, Live Workforce
/// - REPORTS: Reports
/// - SETTINGS: Settings
class AdminDrawer extends ConsumerStatefulWidget {
  const AdminDrawer({super.key});

  @override
  ConsumerState<AdminDrawer> createState() => _AdminDrawerState();
}

class _AdminDrawerState extends ConsumerState<AdminDrawer> {
  bool _workforceExpanded = true;
  bool _operationsExpanded = true;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final displayName = user?.displayName ?? 'Admin';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'A';
    final email = user?.email ?? '';

    // Active route detection
    final currentLocation = GoRouterState.of(context).matchedLocation;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // ── Drawer Header ──────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
                border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.grid_view_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'CALSERVICES',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                            Container(
                              margin: const EdgeInsets.only(top: 2),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 1.5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'WORKFORCE ADMIN',
                                style: TextStyle(
                                  color: Color(0xFF93C5FD),
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFF334155),
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (email.isNotEmpty)
                              Text(
                                email,
                                style: const TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'ADMIN',
                          style: TextStyle(
                            color: Color(0xFF92400E),
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── Scrollable Menu ────────────────────────────────────────────
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.md,
                ),
                children: [
                  // 1. HOME
                  _DrawerNavItem(
                    icon: Icons.home_rounded,
                    label: 'Home',
                    route: '/admin/home',
                    isActive: currentLocation == '/admin/home' ||
                        currentLocation == '/workforce/admin',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.go('/admin/home');
                    },
                  ),

                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.xs),

                  // 2. WORKFORCE GROUP
                  _DrawerGroupHeader(
                    title: 'WORKFORCE',
                    isExpanded: _workforceExpanded,
                    onToggle: () => setState(() => _workforceExpanded = !_workforceExpanded),
                  ),
                  if (_workforceExpanded) ...[
                    _DrawerNavItem(
                      icon: Icons.people_alt_rounded,
                      label: 'Employees',
                      route: '/admin/employees',
                      isActive: currentLocation.startsWith('/admin/employees'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/employees');
                      },
                    ),
                    _DrawerNavItem(
                      icon: Icons.assignment_ind_rounded,
                      iconColor: const Color(0xFF2563EB),
                      label: 'Applications',
                      route: '/admin/applications',
                      isActive: currentLocation.startsWith('/admin/applications'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/applications');
                      },
                    ),
                    _DrawerNavItem(
                      icon: Icons.build_circle_rounded,
                      label: 'Services',
                      route: '/admin/services',
                      isActive: currentLocation.startsWith('/admin/services'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/services');
                      },
                    ),
                    _DrawerNavItem(
                      icon: Icons.military_tech_rounded,
                      label: 'Skills',
                      route: '/admin/skills',
                      isActive: currentLocation.startsWith('/admin/skills'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/skills');
                      },
                    ),
                  ],

                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.xs),

                  // 3. OPERATIONS GROUP
                  _DrawerGroupHeader(
                    title: 'OPERATIONS',
                    isExpanded: _operationsExpanded,
                    onToggle: () => setState(() => _operationsExpanded = !_operationsExpanded),
                  ),
                  if (_operationsExpanded) ...[
                    _DrawerNavItem(
                      icon: Icons.work_rounded,
                      label: 'Jobs',
                      route: '/admin/jobs',
                      isActive: currentLocation.startsWith('/admin/jobs'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/jobs');
                      },
                    ),
                    _DrawerNavItem(
                      icon: Icons.send_rounded,
                      iconColor: const Color(0xFF059669),
                      label: 'Dispatch',
                      route: '/admin/dispatch',
                      isActive: currentLocation.startsWith('/admin/dispatch'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/dispatch');
                      },
                    ),
                    _DrawerNavItem(
                      icon: Icons.near_me_rounded,
                      label: 'Live Workforce',
                      route: '/admin/live-workforce',
                      isActive: currentLocation.startsWith('/admin/live-workforce'),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go('/admin/live-workforce');
                      },
                    ),
                  ],

                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.xs),

                  // 4. REPORTS
                  _DrawerNavItem(
                    icon: Icons.bar_chart_rounded,
                    label: 'Reports',
                    route: '/admin/reports',
                    isActive: currentLocation.startsWith('/admin/reports'),
                    onTap: () {
                      Navigator.of(context).pop();
                      context.go('/admin/reports');
                    },
                  ),

                  // 5. SETTINGS
                  _DrawerNavItem(
                    icon: Icons.settings_rounded,
                    label: 'Settings',
                    route: '/admin/settings',
                    isActive: currentLocation.startsWith('/admin/settings'),
                    onTap: () {
                      Navigator.of(context).pop();
                      context.go('/admin/settings');
                    },
                  ),
                ],
              ),
            ),

            // ── Drawer Footer / Logout ─────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: ListTile(
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                leading: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
                title: const Text(
                  'Log Out',
                  style: TextStyle(
                    color: Color(0xFFDC2626),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                onTap: () async {
                  Navigator.of(context).pop();
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Log Out'),
                      content: const Text('Are you sure you want to log out of Workforce?'),
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
                  if (confirmed == true) {
                    await ref.read(authControllerProvider.notifier).logout();
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerGroupHeader extends StatelessWidget {
  const _DrawerGroupHeader({
    required this.title,
    required this.isExpanded,
    required this.onToggle,
  });

  final String title;
  final bool isExpanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF94A3B8),
                letterSpacing: 0.8,
              ),
            ),
            Icon(
              isExpanded ? Icons.keyboard_arrow_down_rounded : Icons.keyboard_arrow_right_rounded,
              size: 16,
              color: const Color(0xFF94A3B8),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerNavItem extends StatelessWidget {
  const _DrawerNavItem({
    required this.icon,
    this.iconColor,
    required this.label,
    required this.route,
    required this.isActive,
    required this.onTap,
  });

  final IconData icon;
  final Color? iconColor;
  final String label;
  final String route;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = isActive
        ? const Color(0xFF2563EB)
        : (iconColor ?? const Color(0xFF64748B));

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 1.5),
      child: Material(
        color: isActive ? const Color(0xFFEFF6FF) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Container(
            decoration: isActive
                ? const BoxDecoration(
                    border: Border(left: BorderSide(color: Color(0xFF2563EB), width: 3)),
                  )
                : null,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              children: [
                Icon(icon, color: effectiveIconColor, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.w800 : FontWeight.w500,
                      color: isActive ? const Color(0xFF1D4ED8) : const Color(0xFF334155),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
