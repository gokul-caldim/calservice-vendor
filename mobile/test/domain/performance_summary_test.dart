import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/performance/domain/performance_summary.dart';

void main() {
  group('Performance Domain Models & JSON Parsing', () {
    test('parses full PerformanceSummary JSON matching backend schema', () {
      final json = {
        'metrics': {
          'jobs_completed': 3,
          'total_jobs_assigned': 4,
          'completion_rate': 75.0,
          'average_rating': 4.5,
          'csat_score': 100.0,
          'work_orders_completed': 3,
          'feedback_submissions_count': 2,
          'average_customer_rating': 4.5,
          'feedback_received_count': 2,
          'issue_resolution_rate': 100.0,
        },
        'rating_distribution': {
          '5': 1,
          '4': 1,
          '3': 0,
          '2': 0,
          '1': 0,
        },
        'feedbacks': [
          {
            'id': 101,
            'job': 42,
            'request_id': 'SR-20260821-0042',
            'service_title': 'AC Filter Deep Clean',
            'rating': 5,
            'review': 'Excellent punctuality and thorough service.',
            'csat_score': 5,
            'resolution_ontime': true,
            'customer_name': 'Amit Verma',
            'created_at': '2026-08-21T10:30:00Z',
          },
          {
            'id': 102,
            'job': 43,
            'request_id': 'SR-20260821-0043',
            'service_title': 'Fan Motor Repair',
            'rating': 4,
            'review': 'Good job overall.',
            'csat_score': 4,
            'resolution_ontime': true,
            'customer_name': 'Pooja Sharma',
            'created_at': '2026-08-20T14:15:00Z',
          },
        ],
        'has_data': true,
      };

      final summary = PerformanceSummary.fromJson(json);

      expect(summary.hasData, isTrue);
      expect(summary.metrics.jobsCompleted, 3);
      expect(summary.metrics.totalJobsAssigned, 4);
      expect(summary.metrics.completionRate, 75.0);
      expect(summary.metrics.averageRating, 4.5);
      expect(summary.metrics.csatScore, 100.0);
      expect(summary.metrics.feedbackSubmissionsCount, 2);
      expect(summary.metrics.issueResolutionRate, 100.0);

      expect(summary.ratingDistribution[5], 1);
      expect(summary.ratingDistribution[4], 1);
      expect(summary.ratingDistribution[3], 0);
      expect(summary.ratingDistribution[2], 0);
      expect(summary.ratingDistribution[1], 0);

      expect(summary.feedbacks.length, 2);
      final fb1 = summary.feedbacks[0];
      expect(fb1.id, 101);
      expect(fb1.job, 42);
      expect(fb1.requestId, 'SR-20260821-0042');
      expect(fb1.serviceTitle, 'AC Filter Deep Clean');
      expect(fb1.rating, 5);
      expect(fb1.review, 'Excellent punctuality and thorough service.');
      expect(fb1.customerName, 'Amit Verma');
      expect(fb1.csatScore, 5);
      expect(fb1.resolutionOntime, isTrue);
      expect(fb1.createdAt, isNotNull);
    });

    test('handles empty / zero state gracefully with fallback defaults', () {
      final json = <String, dynamic>{
        'metrics': null,
        'rating_distribution': null,
        'feedbacks': null,
        'has_data': false,
      };

      final summary = PerformanceSummary.fromJson(json);

      expect(summary.hasData, isFalse);
      expect(summary.metrics.jobsCompleted, 0);
      expect(summary.metrics.totalJobsAssigned, 0);
      expect(summary.metrics.completionRate, 0.0);
      expect(summary.metrics.averageRating, 0.0);
      expect(summary.metrics.csatScore, 0.0);
      expect(summary.metrics.feedbackSubmissionsCount, 0);
      expect(summary.metrics.issueResolutionRate, 0.0);
      expect(summary.feedbacks, isEmpty);
      for (var star = 1; star <= 5; star++) {
        expect(summary.ratingDistribution[star], 0);
      }
    });

    test('handles integer star keys in rating_distribution', () {
      final json = {
        'rating_distribution': {
          5: 10,
          4: 3,
          3: 2,
          2: 1,
          1: 0,
        },
      };

      final summary = PerformanceSummary.fromJson(json);
      expect(summary.ratingDistribution[5], 10);
      expect(summary.ratingDistribution[4], 3);
      expect(summary.ratingDistribution[3], 2);
      expect(summary.ratingDistribution[2], 1);
      expect(summary.ratingDistribution[1], 0);
    });
  });
}
