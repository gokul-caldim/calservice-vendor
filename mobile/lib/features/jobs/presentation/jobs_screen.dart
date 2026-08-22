import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/workforce_app_bar.dart';
import '../../profile/presentation/profile_providers.dart';
import '../domain/job.dart';
import 'jobs_providers.dart';
import 'widgets/active_assignment_banner.dart';
import 'widgets/active_job_card.dart';
import 'widgets/authorized_services_card.dart';
import 'widgets/job_list_tile.dart';
import 'widgets/offer_card.dart';
import 'widgets/worker_status_header.dart';

enum _JobQueueTab { active, completed, all }

class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen> {
  _JobQueueTab _currentTab = _JobQueueTab.active;

  Future<void> _refreshAll() async {
    ref.invalidate(activeJobsProvider);
    ref.invalidate(completedJobsProvider);
    ref.invalidate(employeeProfileProvider);
    ref.invalidate(shiftStatusProvider);
    await Future.wait([
      ref.read(activeJobsProvider.future),
      ref.read(completedJobsProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final activeAsync = ref.watch(activeJobsProvider);
    final completedAsync = ref.watch(completedJobsProvider);
    final hasActiveJob = ref.watch(hasActiveJobProvider);
    final currentActiveJob = ref.watch(currentActiveJobProvider);
    final incomingOffer = ref.watch(incomingOfferProvider);

    final activeJobs = activeAsync.valueOrNull ?? const <Job>[];
    final completedJobs = completedAsync.valueOrNull ?? const <Job>[];

    // Combine active & completed for the "All" tab (id-deduplicated)
    final allJobsMap = <int, Job>{};
    for (final j in activeJobs) {
      allJobsMap[j.id] = j;
    }
    for (final j in completedJobs) {
      allJobsMap[j.id] = j;
    }
    final allJobs = allJobsMap.values.toList();

    final displayedJobs = switch (_currentTab) {
      _JobQueueTab.active => activeJobs,
      _JobQueueTab.completed => completedJobs,
      _JobQueueTab.all => allJobs,
    };

    final isInitialLoading = (_currentTab == _JobQueueTab.completed
            ? completedAsync.isLoading
            : activeAsync.isLoading) &&
        displayedJobs.isEmpty;

    return Scaffold(
      appBar: const WorkforceAppBar(
        titleText: 'Job Workspace',
        showBrand: false,
      ),
      body: RefreshIndicator(
        onRefresh: _refreshAll,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            // 1. Worker Profile / Current Status Header
            const WorkerStatusHeader(),
            const SizedBox(height: AppSpacing.md),

            // 2. Active Assignment In Progress Banner (when worker has an active assignment)
            if (hasActiveJob && currentActiveJob != null) ...[
              ActiveAssignmentBanner(job: currentActiveJob),
              const SizedBox(height: AppSpacing.md),
            ],

            // 3. Authorized Dispatch Services Card
            const AuthorizedServicesCard(),
            const SizedBox(height: AppSpacing.lg),

            // 4. Jobs Queue Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(Icons.work_outline_rounded, size: 18, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          'Jobs Queue (${displayedJobs.length})',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: _refreshAll,
                  icon: const Icon(Icons.refresh, size: 14),
                  label: const Text('Refresh'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: const Size(0, 32),
                    textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),

            // Tabs: Active (N) | Completed (N) | All (N)
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(AppRadius.chip),
              ),
              child: Row(
                children: [
                  _TabButton(
                    title: 'Active (${activeJobs.length})',
                    isSelected: _currentTab == _JobQueueTab.active,
                    selectedColor: AppColors.primary,
                    onTap: () => setState(() => _currentTab = _JobQueueTab.active),
                  ),
                  _TabButton(
                    title: 'Completed (${completedJobs.length})',
                    isSelected: _currentTab == _JobQueueTab.completed,
                    selectedColor: const Color(0xFF059669),
                    onTap: () {
                      setState(() => _currentTab = _JobQueueTab.completed);
                      ref.read(completedJobsProvider.future);
                    },
                  ),
                  _TabButton(
                    title: 'All (${allJobs.length})',
                    isSelected: _currentTab == _JobQueueTab.all,
                    selectedColor: const Color(0xFF334155),
                    onTap: () {
                      setState(() => _currentTab = _JobQueueTab.all);
                      ref.read(completedJobsProvider.future);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Queue Content
            if (isInitialLoading) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.xxl),
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              ),
            ] else if (displayedJobs.isEmpty) ...[
              EmptyState(
                icon: _currentTab == _JobQueueTab.active
                    ? Icons.inbox_outlined
                    : (_currentTab == _JobQueueTab.completed
                        ? Icons.task_alt_outlined
                        : Icons.work_off_outlined),
                title: _currentTab == _JobQueueTab.active
                    ? 'No active jobs'
                    : (_currentTab == _JobQueueTab.completed
                        ? 'No completed jobs yet'
                        : 'No jobs found'),
                message: _currentTab == _JobQueueTab.active
                    ? 'New exclusive job offers and dispatches will appear here automatically.'
                    : (_currentTab == _JobQueueTab.completed
                        ? 'Jobs you finish and confirm payment for will appear here.'
                        : 'No assigned service requests found.'),
              ),
            ] else ...[
              // For Active tab: separate pending offers from in-flight jobs
              if (_currentTab == _JobQueueTab.active) ...[
                if (incomingOffer != null) ...[
                  OfferCard(job: incomingOffer),
                  const SizedBox(height: AppSpacing.md),
                ],
                for (final job in activeJobs.where((j) => j.id != incomingOffer?.id))
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: job.isAssignedToCurrentEmployee && (job.id == currentActiveJob?.id)
                        ? ActiveJobCard(job: job)
                        : JobListTile(job: job, hasActiveJob: hasActiveJob),
                  ),
              ] else ...[
                for (final job in displayedJobs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: JobListTile(job: job, hasActiveJob: hasActiveJob),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.title,
    required this.isSelected,
    required this.selectedColor,
    required this.onTap,
  });

  final String title;
  final bool isSelected;
  final Color selectedColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.chip),
            boxShadow: isSelected
                ? const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 3,
                      offset: Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color: isSelected ? selectedColor : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }
}
