import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/notifications/presentation/notifications_providers.dart';

/// The Material 3 bottom-navigation shell for the four real, working tabs:
/// Home, Jobs, Notifications, More. Wraps go_router's
/// StatefulNavigationShell so each tab keeps its own navigation stack (e.g.
/// pushing a job detail from the Jobs tab doesn't disturb Home).
class AppShellScaffold extends ConsumerWidget {
  const AppShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount = ref.watch(unreadNotificationsCountProvider);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.work_outline_rounded),
            selectedIcon: Icon(Icons.work_rounded),
            label: 'Jobs',
          ),
          NavigationDestination(
            icon: _NotificationsIcon(icon: Icons.notifications_outlined, unreadCount: unreadCount),
            selectedIcon: _NotificationsIcon(icon: Icons.notifications_rounded, unreadCount: unreadCount),
            label: 'Notifications',
          ),
          const NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'More',
          ),
        ],
      ),
    );
  }
}

class _NotificationsIcon extends StatelessWidget {
  const _NotificationsIcon({required this.icon, required this.unreadCount});

  final IconData icon;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    if (unreadCount <= 0) return Icon(icon);
    return Badge(
      label: Text(unreadCount > 99 ? '99+' : '$unreadCount'),
      child: Icon(icon),
    );
  }
}
