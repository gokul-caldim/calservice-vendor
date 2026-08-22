import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../routing/app_routes.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../domain/admin_dashboard_metrics.dart';
import 'recent_job_card.dart';

/// RECENT OPERATIONS & SERVICE BOOKINGS Section:
/// Displays the list of recent bookings converted into mobile responsive cards.
class RecentOperationsSection extends StatelessWidget {
  const RecentOperationsSection({
    super.key,
    required this.data,
  });

  final AdminDashboardData data;

  @override
  Widget build(BuildContext context) {
    final recentJobs = data.recentJobs;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                children: [
                  const Icon(
                    Icons.business_center_outlined,
                    size: 15,
                    color: Color(0xFF2563EB),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Recent Operations (${data.jobs.length})',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF475569),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: () => context.push(AppRoutes.adminJobs),
              borderRadius: BorderRadius.circular(4),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'View All Jobs',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 13,
                      color: Color(0xFF2563EB),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        // Empty State or List of Recent Job Cards
        if (recentJobs.isEmpty)
          const EmptyState(
            icon: Icons.assignment_outlined,
            title: 'No Active Operations',
            message: 'No active customer service operations in queue.',
          )
        else
          ...recentJobs.take(8).map((job) => RecentJobCard(job: job)),
      ],
    );
  }
}
