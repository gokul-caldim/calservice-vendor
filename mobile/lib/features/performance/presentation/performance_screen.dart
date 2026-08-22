import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../domain/performance_summary.dart';
import 'performance_providers.dart';

/// Authoritative technician performance dashboard, mirroring the web
/// EmployeePerformancePage.jsx with mobile-optimized layout and responsiveness.
class PerformanceScreen extends ConsumerWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(performanceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh performance',
            onPressed: () => ref.refresh(performanceProvider.future),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(performanceProvider.future),
        child: AsyncValueView<PerformanceSummary>(
          value: summaryAsync,
          onRetry: () => ref.invalidate(performanceProvider),
          builder: (context, summary) => ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              _MetricsSection(metrics: summary.metrics),
              const SizedBox(height: AppSpacing.lg),
              _RatingDistributionCard(
                distribution: summary.ratingDistribution,
                totalFeedback: summary.metrics.feedbackSubmissionsCount,
              ),
              const SizedBox(height: AppSpacing.lg),
              const _BenchmarkCard(),
              const SizedBox(height: AppSpacing.lg),
              _FeedbackSection(
                feedbacks: summary.feedbacks,
                onRefresh: () => ref.refresh(performanceProvider.future),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 1. Summary Metrics Cards ──────────────────────────────────────────────────

class _MetricsSection extends StatelessWidget {
  const _MetricsSection({required this.metrics});

  final PerformanceMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final cards = [
      _MetricData(
        title: 'Jobs Completed',
        value: '${metrics.jobsCompleted}',
        change: '${metrics.totalJobsAssigned} assigned total',
        icon: Icons.check_circle_outline_rounded,
        iconColor: AppColors.primary,
      ),
      _MetricData(
        title: 'Average Rating',
        value: metrics.averageRating > 0 ? '${metrics.averageRating.toStringAsFixed(1)} / 5.0' : '—',
        change: '${metrics.feedbackSubmissionsCount} ratings recorded',
        icon: Icons.star_rounded,
        iconColor: const Color(0xFFF59E0B),
      ),
      _MetricData(
        title: 'CSAT Score',
        value: metrics.csatScore > 0 ? '${_formatNumber(metrics.csatScore)}%' : '—',
        change: '4★ & 5★ satisfaction share',
        icon: Icons.thumb_up_outlined,
        iconColor: const Color(0xFF10B981),
      ),
      _MetricData(
        title: 'Completion Rate',
        value: '${_formatNumber(metrics.completionRate)}%',
        change: 'Fulfilled vs. assigned',
        icon: Icons.percent_rounded,
        iconColor: const Color(0xFF6366F1),
      ),
      _MetricData(
        title: 'On-Time Resolution',
        value: '${_formatNumber(metrics.issueResolutionRate)}%',
        change: 'Without revisit or delay',
        icon: Icons.trending_up_rounded,
        iconColor: const Color(0xFF10B981),
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 520 ? 3 : (constraints.maxWidth < 280 ? 1 : 2);
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (var i = 0; i < cards.length; i++)
              SizedBox(
                width: _calculateCardWidth(constraints.maxWidth, crossAxisCount, i, cards.length),
                child: _MetricCardItem(data: cards[i]),
              ),
          ],
        );
      },
    );
  }

  double _calculateCardWidth(double totalWidth, int crossAxisCount, int index, int totalItems) {
    const spacing = AppSpacing.sm;
    if (crossAxisCount == 1) {
      return totalWidth;
    }
    if (crossAxisCount == 2) {
      // If 5 items on a 2-col layout, the 5th item takes full width
      if (totalItems % 2 != 0 && index == totalItems - 1) {
        return totalWidth;
      }
      return (totalWidth - spacing) / 2;
    }
    return (totalWidth - (spacing * (crossAxisCount - 1))) / crossAxisCount;
  }

  String _formatNumber(double val) {
    if (val % 1 == 0) return val.toInt().toString();
    return val.toStringAsFixed(1);
  }
}

class _MetricData {
  const _MetricData({
    required this.title,
    required this.value,
    required this.change,
    required this.icon,
    required this.iconColor,
  });

  final String title;
  final String value;
  final String change;
  final IconData icon;
  final Color iconColor;
}

class _MetricCardItem extends StatelessWidget {
  const _MetricCardItem({required this.data});

  final _MetricData data;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    data.title.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(data.icon, size: 14, color: data.iconColor),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              data.value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 2),
            Text(
              data.change,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 2. Rating Distribution ────────────────────────────────────────────────────

class _RatingDistributionCard extends StatelessWidget {
  const _RatingDistributionCard({
    required this.distribution,
    required this.totalFeedback,
  });

  final Map<int, int> distribution;
  final int totalFeedback;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                const Icon(Icons.star_rounded, size: 16, color: Color(0xFFF59E0B)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'RATING DISTRIBUTION ($totalFeedback REVIEWS)',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: totalFeedback == 0
                ? const EmptyState(
                    icon: Icons.star_border_rounded,
                    title: 'No customer ratings yet',
                    message:
                        'Ratings will be calculated automatically when customers review your completed service requests.',
                    compact: true,
                  )
                : Column(
                    children: [
                      for (var star = 5; star >= 1; star--)
                        _RatingBarRow(
                          star: star,
                          count: distribution[star] ?? 0,
                          total: totalFeedback,
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _RatingBarRow extends StatelessWidget {
  const _RatingBarRow({
    required this.star,
    required this.count,
    required this.total,
  });

  final int star;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (count / total) : 0.0;
    final pctInt = (pct * 100).round();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$star',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.star_rounded, size: 13, color: Color(0xFFF59E0B)),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 10,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.border, width: 0.8),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: pct.clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          SizedBox(
            width: 58,
            child: Text(
              '$count ($pctInt%)',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: AppColors.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 3. Workforce Service Quality Benchmark & Notice ───────────────────────────

class _BenchmarkCard extends StatelessWidget {
  const _BenchmarkCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Icon(Icons.military_tech_outlined, size: 16, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'WORKFORCE SERVICE QUALITY BENCHMARK',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BenchmarkItem(
                  title: 'Target CSAT Standard',
                  description:
                      'Maintain an average CSAT ≥ 85% to remain eligible for priority automated dispatching.',
                  highlightText: '85%',
                ),
                const SizedBox(height: AppSpacing.md),
                const _BenchmarkItem(
                  title: 'Proof of Work Compliance',
                  description:
                      '100% of jobs require valid arrival GPS geofencing, customer work start OTP, and before/after photos.',
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Authoritative Data Integration Notice',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'All metrics displayed here are computed directly from completed ServiceRequest records and customer feedback submissions stored in PostgreSQL.',
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.35,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BenchmarkItem extends StatelessWidget {
  const _BenchmarkItem({
    required this.title,
    required this.description,
    this.highlightText,
  });

  final String title;
  final String description;
  final String? highlightText;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 3),
          if (highlightText != null && description.contains(highlightText!))
            _buildHighlightedText()
          else
            Text(
              description,
              style: TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.35),
            ),
        ],
      ),
    );
  }

  Widget _buildHighlightedText() {
    final parts = description.split(highlightText!);
    return RichText(
      text: TextSpan(
        style: TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.35),
        children: [
          TextSpan(text: parts[0]),
          TextSpan(
            text: highlightText,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          if (parts.length > 1) TextSpan(text: parts[1]),
        ],
      ),
    );
  }
}

// ── 4. Customer Feedback & Reviews ────────────────────────────────────────────

class _FeedbackSection extends StatelessWidget {
  const _FeedbackSection({
    required this.feedbacks,
    required this.onRefresh,
  });

  final List<JobFeedback> feedbacks;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.forum_outlined, size: 16, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'CUSTOMER FEEDBACK & REVIEWS (${feedbacks.length})',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: onRefresh,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    visualDensity: VisualDensity.compact,
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 14),
                  label: const Text('Refresh', style: TextStyle(fontSize: 11)),
                ),
              ],
            ),
          ),
          if (feedbacks.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.xl),
              child: EmptyState(
                icon: Icons.forum_outlined,
                title: 'No customer feedback yet',
                message:
                    'Customer feedback will appear here as soon as clients review your completed work orders.',
                compact: true,
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: feedbacks.length,
              separatorBuilder: (context, index) => Divider(
                height: 1,
                color: AppColors.border,
              ),
              itemBuilder: (context, index) => _FeedbackItemTile(feedback: feedbacks[index]),
            ),
        ],
      ),
    );
  }
}

class _FeedbackItemTile extends StatelessWidget {
  const _FeedbackItemTile({required this.feedback});

  final JobFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final dateStr = _formatDate(feedback.createdAt);
    final jobIdStr = feedback.requestId ?? (feedback.job != null ? 'SR-${feedback.job}' : 'Job');

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < feedback.rating ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 15,
                    color: i < feedback.rating ? const Color(0xFFF59E0B) : const Color(0xFFCBD5E1),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '${feedback.rating}.0',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 6),
              Text('•', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  feedback.customerName?.trim().isNotEmpty == true
                      ? feedback.customerName!
                      : 'Customer',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text(
                'Job: ',
                style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
              ),
              Text(
                jobIdStr,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                  color: AppColors.primary,
                ),
              ),
              if (dateStr.isNotEmpty) ...[
                const SizedBox(width: 6),
                Text('•', style: TextStyle(color: AppColors.textMuted, fontSize: 10.5)),
                const SizedBox(width: 6),
                Text(
                  dateStr,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontFamily: 'monospace',
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '"${feedback.review?.trim().isNotEmpty == true ? feedback.review : 'Service completed satisfactorily according to scope.'}"',
            style: TextStyle(
              fontSize: 12.5,
              fontStyle: FontStyle.italic,
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          if (feedback.serviceTitle?.trim().isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                feedback.serviceTitle!,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime? dt) {
    if (dt == null) return '';
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }
}
