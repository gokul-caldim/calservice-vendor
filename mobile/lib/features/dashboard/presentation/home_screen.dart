import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../jobs/domain/job.dart';
import '../../jobs/presentation/jobs_providers.dart';
import '../../jobs/presentation/widgets/active_job_card.dart';
import '../../jobs/presentation/widgets/job_list_tile.dart';
import '../../jobs/presentation/widgets/offer_card.dart';
import '../../profile/presentation/profile_providers.dart';
import '../../../shared/widgets/workforce_app_bar.dart';
import 'widgets/greeting_header.dart';
import 'widgets/today_overview_card.dart';

/// The Home overview — deliberately not a copy of the desktop dashboard.
/// Shows only what the technician needs to understand at a glance: who they
/// are, whether they're online, an incoming offer or active job if there is
/// one, and a small recent-activity preview. Everything else lives on its
/// own tab.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeJobsAsync = ref.watch(activeJobsProvider);
    final completedJobsAsync = ref.watch(completedJobsProvider);

    return Scaffold(
      appBar: const WorkforceAppBar(showStatusSubBar: true),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeJobsProvider);
          ref.invalidate(completedJobsProvider);
          ref.invalidate(employeeProfileProvider);
          ref.invalidate(shiftStatusProvider);
          await ref.read(activeJobsProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            const GreetingHeader(),
            const SizedBox(height: AppSpacing.md),
            TodayOverviewCard(
              activeCount: activeJobsAsync.valueOrNull?.length,
              completedCount: completedJobsAsync.valueOrNull?.length,
            ),
            const SizedBox(height: AppSpacing.lg),
            AsyncValueView<List<Job>>(
              value: activeJobsAsync,
              onRetry: () => ref.invalidate(activeJobsProvider),
              builder: (context, activeJobs) => _HomeJobsSection(activeJobs: activeJobs),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeJobsSection extends ConsumerWidget {
  const _HomeJobsSection({required this.activeJobs});

  final List<Job> activeJobs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasActiveJob = ref.watch(hasActiveJobProvider);
    final incomingOffer = ref.watch(incomingOfferProvider);
    final currentActiveJob = ref.watch(currentActiveJobProvider);
    final completedJobs = ref.watch(completedJobsProvider).valueOrNull ?? const <Job>[];

    final remaining = activeJobs
        .where((j) => j.id != incomingOffer?.id && j.id != currentActiveJob?.id)
        .toList();
    final usingCompletedFallback = remaining.isEmpty;
    final pool = usingCompletedFallback ? completedJobs : remaining;
    final sectionTitle = usingCompletedFallback ? 'Recent Activity' : 'Upcoming';

    final nothingToShow = incomingOffer == null && currentActiveJob == null && pool.isEmpty;
    if (nothingToShow) {
      return const EmptyState(
        icon: Icons.task_alt_rounded,
        title: "You're all caught up",
        message: 'New job offers will appear here as soon as they come in.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (incomingOffer != null) ...[
          OfferCard(job: incomingOffer),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (currentActiveJob != null) ...[
          ActiveJobCard(job: currentActiveJob),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (pool.isNotEmpty) ...[
          Row(
            children: [
              Text(sectionTitle, style: Theme.of(context).textTheme.labelSmall),
              const Spacer(),
              TextButton(
                onPressed: () => context.go('/jobs'),
                style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32)),
                child: const Text('See all'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final job in pool.take(3)) JobListTile(job: job, hasActiveJob: hasActiveJob),
        ],
      ],
    );
  }
}
