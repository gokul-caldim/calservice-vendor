import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../features/auth/domain/auth_user.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/jobs/presentation/jobs_providers.dart';
import '../../features/notifications/presentation/notifications_providers.dart';
import '../../features/profile/presentation/profile_providers.dart';

/// The official Workforce Mobile Header / AppBar.
/// Features:
/// - Left: Calservices brand icon badge + Company Name + "WORKFORCE" tag
/// - Right: Search icon + Notification bell with unread badge + Circular profile avatar
/// - Optional Sub-header: Live workforce status (AVAILABLE / ON JOB / OFFLINE)
class WorkforceAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const WorkforceAppBar({
    super.key,
    this.titleText,
    this.showBrand = true,
    this.showSearch = true,
    this.showNotifications = true,
    this.showAvatar = true,
    this.showStatusSubBar = false,
    this.showDrawerMenu = false,
    this.onSearchPressed,
  });

  final String? titleText;
  final bool showBrand;
  final bool showSearch;
  final bool showNotifications;
  final bool showAvatar;
  final bool showStatusSubBar;
  final bool showDrawerMenu;
  final VoidCallback? onSearchPressed;

  @override
  Size get preferredSize => Size.fromHeight(
        kToolbarHeight + (showStatusSubBar ? 36.0 : 0.0),
      );

  void _defaultSearchAction(BuildContext context) {
    showSearchDialog(context);
  }

  static void showSearchDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) => const _QuickSearchSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final unreadCount = ref.watch(unreadNotificationsCountProvider);
    final profileAsync = ref.watch(employeeProfileProvider);
    // Only subscribe to the technician workload when the status sub-bar is
    // actually rendered. hasActiveJobProvider resolves through
    // activeJobsProvider, which hits GET /workforce/jobs/?status=active —
    // watching it unconditionally fired that request on every screen using
    // this AppBar (including all admin screens, where the value is unused
    // and the same endpoint is already the slow one being loaded).
    final hasActiveJob = showStatusSubBar ? ref.watch(hasActiveJobProvider) : false;
    final isOnline = profileAsync.valueOrNull?.isOnline ?? true;

    final companyName = (user?.companyName != null && user!.companyName!.isNotEmpty)
        ? user.companyName!
        : 'CalServices';

    final displayName = user?.displayName ?? 'Tech';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';
    final photoUrl = profileAsync.valueOrNull?.avatar;

    return AppBar(
      titleSpacing: showDrawerMenu ? 0 : AppSpacing.md,
      leading: showDrawerMenu
          ? Builder(
              builder: (ctx) => IconButton(
                icon: const Icon(Icons.menu_rounded, color: Colors.white),
                tooltip: 'Navigation Menu',
                onPressed: () => Scaffold.of(ctx).openDrawer(),
              ),
            )
          : null,
      title: Row(
        children: [
          if (showBrand) ...[
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(7),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x332563EB),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: const Icon(Icons.build_rounded, size: 15, color: Colors.white),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    titleText ?? companyName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.2,
                    ),
                  ),
                  Text(
                    'WORKFORCE',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: Colors.blue.shade200,
                    ),
                  ),
                ],
              ),
            ),
          ] else if (titleText != null) ...[
            Expanded(
              child: Text(
                titleText!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ] else ...[
            const Spacer(),
          ],
        ],
      ),
      actions: [
        if (showSearch)
          IconButton(
            icon: const Icon(Icons.search_rounded, size: 22, color: Colors.white),
            tooltip: 'Search Jobs',
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            onPressed: onSearchPressed ?? () => _defaultSearchAction(context),
          ),
        if (showNotifications)
          IconButton(
            icon: unreadCount > 0
                ? Badge(
                    label: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                    backgroundColor: const Color(0xFFEF4444),
                    child: const Icon(Icons.notifications_outlined, size: 22, color: Colors.white),
                  )
                : const Icon(Icons.notifications_outlined, size: 22, color: Colors.white),
            tooltip: 'Notifications',
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            onPressed: () => context.go('/notifications'),
          ),
        if (showAvatar)
          Padding(
            padding: const EdgeInsets.only(left: 4, right: AppSpacing.md),
            child: InkWell(
              onTap: () => _showUserMenu(context, ref, user, displayName, initial, photoUrl),
              borderRadius: BorderRadius.circular(999),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.5),
                  color: const Color(0xFF1E293B),
                ),
                child: ClipOval(
                  child: photoUrl != null && photoUrl.isNotEmpty
                      ? Image.network(
                          photoUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => _InitialAvatar(initial: initial),
                        )
                      : _InitialAvatar(initial: initial),
                ),
              ),
            ),
          ),
      ],
      bottom: showStatusSubBar
          ? PreferredSize(
              preferredSize: const Size.fromHeight(36),
              child: _StatusSubBar(
                hasActiveJob: hasActiveJob,
                isOnline: isOnline,
              ),
            )
          : null,
    );
  }

  void _showUserMenu(
    BuildContext context,
    WidgetRef ref,
    AuthUser? user,
    String displayName,
    String initial,
    String? photoUrl,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? '',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: user?.isAdmin == true
                          ? const Color(0xFFFEF3C7)
                          : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      user?.isAdmin == true ? 'ADMIN' : 'EMPLOYEE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: user?.isAdmin == true
                            ? const Color(0xFF92400E)
                            : const Color(0xFF1E40AF),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              const Divider(height: 1),
              const SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person_outline_rounded, color: Color(0xFF475569)),
                title: const Text('View Profile', style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  Navigator.of(ctx).pop();
                  context.push('/more/profile');
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.logout_rounded,
                  color: Color(0xFFDC2626),
                ),
                title: const Text(
                  'Log Out',
                  style: TextStyle(
                    color: Color(0xFFDC2626),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () async {
                  Navigator.of(ctx).pop();
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (dCtx) => AlertDialog(
                      title: const Text('Log Out'),
                      content: const Text(
                        'Are you sure you want to log out of Workforce?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(dCtx).pop(false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                          ),
                          onPressed: () => Navigator.of(dCtx).pop(true),
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
            ],
          ),
        ),
      ),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.initial});

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w900,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _StatusSubBar extends StatelessWidget {
  const _StatusSubBar({
    required this.hasActiveJob,
    required this.isOnline,
  });

  final bool hasActiveJob;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    final statusText = hasActiveJob
        ? 'ON JOB (BUSY)'
        : (isOnline ? 'AVAILABLE FOR DISPATCH' : 'OFFLINE');

    final statusColor = hasActiveJob
        ? const Color(0xFFF59E0B)
        : (isOnline ? const Color(0xFF10B981) : const Color(0xFF94A3B8));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.18),
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: statusColor.withValues(alpha: 0.6),
                  blurRadius: 4,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Text(
            'WORKFORCE STATUS:',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Colors.blue.shade100,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              statusText,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w900,
                color: statusColor,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickSearchSheet extends ConsumerStatefulWidget {
  const _QuickSearchSheet();

  @override
  ConsumerState<_QuickSearchSheet> createState() => _QuickSearchSheetState();
}

class _QuickSearchSheetState extends ConsumerState<_QuickSearchSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeJobs = ref.watch(activeJobsProvider).valueOrNull ?? [];
    final filtered = _query.isEmpty
        ? activeJobs
        : activeJobs.where((j) {
            final q = _query.toLowerCase();
            return j.requestId.toLowerCase().contains(q) ||
                j.displayTitle.toLowerCase().contains(q) ||
                (j.customerName?.toLowerCase().contains(q) ?? false) ||
                (j.address?.toLowerCase().contains(q) ?? false);
          }).toList();

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Search Jobs & Requests',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.of(context).pop(),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _searchController,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Search by ID (e.g. SR-), customer, or title...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _query = '');
                      },
                    )
                  : null,
              isDense: true,
            ),
            onChanged: (val) => setState(() => _query = val.trim()),
          ),
          const SizedBox(height: AppSpacing.md),
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  _query.isEmpty ? 'No active jobs found.' : 'No results matching "$_query"',
                  style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                ),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 260),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: filtered.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (ctx, idx) {
                  final job = filtered[idx];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(
                      '${job.requestId} — ${job.displayTitle}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    subtitle: job.address != null
                        ? Text(job.address!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11))
                        : null,
                    trailing: const Icon(Icons.chevron_right, size: 18),
                    onTap: () {
                      Navigator.of(ctx).pop();
                      context.push('/jobs/${job.id}');
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
