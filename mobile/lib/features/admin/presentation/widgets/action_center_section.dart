import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../routing/app_routes.dart';
import '../../domain/admin_dashboard_metrics.dart';
import 'action_center_card.dart';

/// ACTION CENTER Section:
/// Displays the 4 operational queue cards requiring immediate attention.
class ActionCenterSection extends StatelessWidget {
  const ActionCenterSection({
    super.key,
    required this.data,
  });

  final AdminDashboardData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Row(
          children: [
            Container(
              width: 4,
              height: 14,
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'ACTION CENTER',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF475569),
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        const Text(
          'Items requiring immediate operational attention',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w400,
            color: Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        // Adaptive Grid of 4 Cards
        LayoutBuilder(
          builder: (context, constraints) {
            final isSmall = constraints.maxWidth < 340;
            final isWide = constraints.maxWidth >= 600;

            final card1 = ActionCenterCard(
              title: 'Pending Applications',
              description:
                  'Dossiers awaiting verification & service authorization',
              count: data.pendingApplicationsCount,
              icon: Icons.assignment_ind_outlined,
              badgeBgColor: const Color(0xFFFEF3C7),
              badgeTextColor: const Color(0xFF92400E),
              iconBgColor: const Color(0xFFFFFBEB),
              iconColor: const Color(0xFFD97706),
              onTap: () => context.push(
                '${AppRoutes.adminApplications}?status=submitted',
              ),
            );

            final card2 = ActionCenterCard(
              title: 'Documents to Verify',
              description:
                  'Identification & certification files in queue',
              count: data.documentsToVerifyCount,
              icon: Icons.file_copy_outlined,
              badgeBgColor: const Color(0xFFDBEAFE),
              badgeTextColor: const Color(0xFF1E40AF),
              iconBgColor: const Color(0xFFEFF6FF),
              iconColor: const Color(0xFF2563EB),
              onTap: () => context.push(AppRoutes.adminApplications),
            );

            final card3 = ActionCenterCard(
              title: 'Jobs Awaiting Assignment',
              description:
                  'Customer bookings requiring technician dispatch',
              count: data.unassignedJobsCount,
              icon: Icons.send_outlined,
              badgeBgColor: const Color(0xFFFFEDD5),
              badgeTextColor: const Color(0xFF9A3412),
              iconBgColor: const Color(0xFFFFF7ED),
              iconColor: const Color(0xFFEA580C),
              onTap: () => context.push(AppRoutes.adminDispatch),
            );

            final card4 = ActionCenterCard(
              title: 'Corrections Pending Resubmission',
              description:
                  'Technicians notified to re-upload flagged files',
              count: data.correctionsPendingCount,
              icon: Icons.edit_note_rounded,
              badgeBgColor: const Color(0xFFF1F5F9),
              badgeTextColor: const Color(0xFF334155),
              iconBgColor: const Color(0xFFF8FAFC),
              iconColor: const Color(0xFF64748B),
              onTap: () => context.push(
                '${AppRoutes.adminApplications}?status=correction_required',
              ),
            );

            if (isSmall) {
              return Column(
                children: [
                  card1,
                  const SizedBox(height: 10),
                  card2,
                  const SizedBox(height: 10),
                  card3,
                  const SizedBox(height: 10),
                  card4,
                ],
              );
            }

            if (isWide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: card1),
                  const SizedBox(width: 10),
                  Expanded(child: card2),
                  const SizedBox(width: 10),
                  Expanded(child: card3),
                  const SizedBox(width: 10),
                  Expanded(child: card4),
                ],
              );
            }

            return Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: card1),
                    const SizedBox(width: 10),
                    Expanded(child: card2),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: card3),
                    const SizedBox(width: 10),
                    Expanded(child: card4),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
