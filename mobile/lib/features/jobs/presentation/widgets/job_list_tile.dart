import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/job.dart';
import '../../domain/job_presentation.dart';

/// A compact row for a job in a list — used on the Jobs screen and Home's
/// recent-jobs preview.
class JobListTile extends StatelessWidget {
  const JobListTile({super.key, required this.job, this.hasActiveJob = false});

  final Job job;
  final bool hasActiveJob;

  @override
  Widget build(BuildContext context) {
    final presentation = buildJobPresentation(job, hasActiveJob: hasActiveJob);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: () => context.push('/jobs/${job.id}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      job.displayTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      job.requestId,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontFamily: 'monospace',
                        color: AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    StatusChip(status: presentation.badgeStatus, label: presentation.displayStatus, dense: true),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (job.totalAmount != null)
                    Text(
                      '₹${job.totalAmount!.toStringAsFixed(0)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  if (job.distanceKm != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${job.distanceKm!.toStringAsFixed(1)} km',
                      style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textMuted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
