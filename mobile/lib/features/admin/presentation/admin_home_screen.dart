import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../domain/admin_dashboard_metrics.dart';
import 'admin_dashboard_providers.dart';
import 'widgets/action_center_section.dart';
import 'widgets/admin_drawer.dart';
import 'widgets/admin_title_section.dart';
import 'widgets/recent_operations_section.dart';
import 'widgets/workforce_overview_section.dart';

/// The Workforce Operations Center / Admin Home Screen.
///
/// Designed natively for Android portrait mobile devices while preserving the
/// exact hierarchy, information, actions, and visual identity from the live
/// enterprise Operations Center.
class AdminHomeScreen extends ConsumerWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(adminDashboardDataProvider);

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminDashboardDataProvider);
          await ref.read(adminDashboardDataProvider.future);
        },
        child: AsyncValueView<AdminDashboardData>(
          value: dashboardAsync,
          onRetry: () => ref.invalidate(adminDashboardDataProvider),
          builder: (context, data) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                // 1. Page Title & Primary Actions
                AdminTitleSection(
                  onRefresh: () => ref.invalidate(adminDashboardDataProvider),
                  isRefreshing: dashboardAsync.isLoading,
                ),
                const SizedBox(height: AppSpacing.lg),

                // 2. Action Center (4 Priority Operational Cards)
                ActionCenterSection(data: data),
                const SizedBox(height: AppSpacing.lg),

                // 3. Workforce Overview (5 Metric Cards)
                WorkforceOverviewSection(data: data),
                const SizedBox(height: AppSpacing.lg),

                // 4. Recent Operations & Service Bookings
                RecentOperationsSection(data: data),
              ],
            );
          },
        ),
      ),
    );
  }
}
