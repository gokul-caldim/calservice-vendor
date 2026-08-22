import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/performance/domain/performance_summary.dart';
import 'package:mobile/features/performance/presentation/performance_providers.dart';
import 'package:mobile/features/performance/presentation/performance_screen.dart';

void main() {
  group('PerformanceScreen Widget Tests', () {
    final populatedSummary = PerformanceSummary(
      metrics: const PerformanceMetrics(
        jobsCompleted: 3,
        totalJobsAssigned: 4,
        completionRate: 75.0,
        averageRating: 4.5,
        csatScore: 100.0,
        feedbackSubmissionsCount: 2,
        issueResolutionRate: 100.0,
      ),
      ratingDistribution: const {5: 1, 4: 1, 3: 0, 2: 0, 1: 0},
      feedbacks: [
        JobFeedback(
          id: 101,
          job: 42,
          requestId: 'SR-20260821-0042',
          serviceTitle: 'AC Filter Deep Clean',
          rating: 5,
          review: 'Excellent punctuality and thorough service.',
          customerName: 'Amit Verma',
          csatScore: 5,
          resolutionOntime: true,
          createdAt: DateTime.parse('2026-08-21T10:30:00Z'),
        ),
        JobFeedback(
          id: 102,
          job: 43,
          requestId: 'SR-20260821-0043',
          serviceTitle: 'Fan Motor Repair',
          rating: 4,
          review: 'Good job overall.',
          customerName: 'Pooja Sharma',
          csatScore: 4,
          resolutionOntime: true,
          createdAt: DateTime.parse('2026-08-20T14:15:00Z'),
        ),
      ],
      hasData: true,
    );

    final emptySummary = PerformanceSummary(
      metrics: const PerformanceMetrics(
        jobsCompleted: 0,
        totalJobsAssigned: 0,
        completionRate: 0.0,
        averageRating: 0.0,
        csatScore: 0.0,
        feedbackSubmissionsCount: 0,
        issueResolutionRate: 0.0,
      ),
      ratingDistribution: const {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
      feedbacks: const [],
      hasData: false,
    );

    testWidgets('renders all 5 metric cards, benchmarks, and reviews when data is loaded', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            performanceProvider.overrideWith((ref) => Future.value(populatedSummary)),
          ],
          child: const MaterialApp(
            home: PerformanceScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify screen title
      expect(find.text('Performance'), findsOneWidget);

      // Verify 5 metric cards titles and values
      expect(find.text('JOBS COMPLETED'), findsOneWidget);
      expect(find.text('4 assigned total'), findsOneWidget);

      expect(find.text('AVERAGE RATING'), findsOneWidget);
      expect(find.text('4.5 / 5.0'), findsOneWidget);
      expect(find.text('2 ratings recorded'), findsOneWidget);

      expect(find.text('CSAT SCORE'), findsOneWidget);
      expect(find.text('100%'), findsNWidgets(2)); // CSAT and On-Time Resolution both 100%
      expect(find.text('4★ & 5★ satisfaction share'), findsOneWidget);

      expect(find.text('COMPLETION RATE'), findsOneWidget);
      expect(find.text('75%'), findsOneWidget);
      expect(find.text('Fulfilled vs. assigned'), findsOneWidget);

      expect(find.text('ON-TIME RESOLUTION'), findsOneWidget);
      expect(find.text('Without revisit or delay'), findsOneWidget);

      // Verify Rating Distribution
      expect(find.text('RATING DISTRIBUTION (2 REVIEWS)'), findsOneWidget);
      expect(find.text('1 (50%)'), findsNWidgets(2)); // 5 star has 1 (50%), 4 star has 1 (50%)
      expect(find.text('0 (0%)'), findsNWidgets(3)); // 3, 2, 1 stars have 0 (0%)

      // Verify Benchmark & Notice
      expect(find.text('WORKFORCE SERVICE QUALITY BENCHMARK'), findsOneWidget);
      expect(find.text('Target CSAT Standard'), findsOneWidget);
      expect(find.text('Proof of Work Compliance'), findsOneWidget);
      expect(find.text('Authoritative Data Integration Notice'), findsOneWidget);

      // Verify Customer Feedback section
      expect(find.text('CUSTOMER FEEDBACK & REVIEWS (2)'), findsOneWidget);
      expect(find.text('Amit Verma'), findsOneWidget);
      expect(find.text('Pooja Sharma'), findsOneWidget);
      expect(find.text('SR-20260821-0042'), findsOneWidget);
      expect(find.text('SR-20260821-0043'), findsOneWidget);
      expect(find.text('"Excellent punctuality and thorough service."'), findsOneWidget);
      expect(find.text('"Good job overall."'), findsOneWidget);
      expect(find.text('AC Filter Deep Clean'), findsOneWidget);
      expect(find.text('Fan Motor Repair'), findsOneWidget);
    });

    testWidgets('renders empty states for ratings and reviews when no feedback exists', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            performanceProvider.overrideWith((ref) => Future.value(emptySummary)),
          ],
          child: const MaterialApp(
            home: PerformanceScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Empty state dashes for ratings and CSAT
      expect(find.text('—'), findsNWidgets(2)); // Avg Rating & CSAT Score
      expect(find.text('0 ratings recorded'), findsOneWidget);
      expect(find.text('0%'), findsNWidgets(2)); // Completion rate & On-time resolution

      // Rating distribution empty state
      expect(find.text('RATING DISTRIBUTION (0 REVIEWS)'), findsOneWidget);
      expect(find.text('No customer ratings yet'), findsOneWidget);
      expect(
        find.text(
          'Ratings will be calculated automatically when customers review your completed service requests.',
        ),
        findsOneWidget,
      );

      // Customer reviews empty state
      expect(find.text('CUSTOMER FEEDBACK & REVIEWS (0)'), findsOneWidget);
      expect(find.text('No customer feedback yet'), findsOneWidget);
      expect(
        find.text(
          'Customer feedback will appear here as soon as clients review your completed work orders.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('renders error state and allows retry on network failure', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            performanceProvider.overrideWith((ref) => Future.error(Exception('Connection timeout'))),
          ],
          child: const MaterialApp(
            home: PerformanceScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
