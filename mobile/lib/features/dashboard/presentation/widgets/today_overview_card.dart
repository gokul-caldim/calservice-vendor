import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// A compact "today" stat strip — deliberately just two numbers, not a
/// crowded metrics grid, so it doesn't compete for attention with the
/// offer/active-job cards below it.
class TodayOverviewCard extends StatelessWidget {
  const TodayOverviewCard({super.key, required this.activeCount, required this.completedCount});

  final int? activeCount;
  final int? completedCount;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: _Stat(icon: Icons.bolt_rounded, color: AppColors.primary, value: activeCount, label: 'Active'),
            ),
            Container(width: 1, height: 32, color: AppColors.border),
            Expanded(
              child: _Stat(
                icon: Icons.task_alt_rounded,
                color: const Color(0xFF10B981),
                value: completedCount,
                label: 'Completed',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.color, required this.value, required this.label});

  final IconData icon;
  final Color color;
  final int? value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value?.toString() ?? '—',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
