import '../../../core/utils/json_parsing.dart';

/// Mirrors the "metrics" object from GET /workforce/performance/me/
/// (backend/workforce_api/views.py:7183-7239).
class PerformanceMetrics {
  const PerformanceMetrics({
    required this.jobsCompleted,
    required this.totalJobsAssigned,
    required this.completionRate,
    required this.averageRating,
    required this.csatScore,
    required this.feedbackSubmissionsCount,
    required this.issueResolutionRate,
  });

  factory PerformanceMetrics.fromJson(Map<String, dynamic> json) {
    return PerformanceMetrics(
      jobsCompleted: parseInt(json['jobs_completed']) ?? 0,
      totalJobsAssigned: parseInt(json['total_jobs_assigned']) ?? 0,
      completionRate: parseDouble(json['completion_rate']) ?? 0,
      averageRating: parseDouble(json['average_rating']) ?? 0,
      csatScore: parseDouble(json['csat_score']) ?? 0,
      feedbackSubmissionsCount: parseInt(json['feedback_submissions_count']) ?? 0,
      issueResolutionRate: parseDouble(json['issue_resolution_rate']) ?? 0,
    );
  }

  final int jobsCompleted;
  final int totalJobsAssigned;
  final double completionRate;
  final double averageRating;
  final double csatScore;
  final int feedbackSubmissionsCount;
  final double issueResolutionRate;
}

/// One entry from "feedbacks" — WorkforceJobFeedbackSerializer
/// (backend/workforce_api/serializers.py:886-904).
class JobFeedback {
  const JobFeedback({
    required this.id,
    this.job,
    this.requestId,
    this.serviceTitle,
    required this.rating,
    this.review,
    this.csatScore,
    this.resolutionOntime,
    this.customerName,
    this.createdAt,
  });

  factory JobFeedback.fromJson(Map<String, dynamic> json) {
    return JobFeedback(
      id: parseInt(json['id']) ?? 0,
      job: parseInt(json['job']),
      requestId: parseString(json['request_id']),
      serviceTitle: parseString(json['service_title']),
      rating: parseInt(json['rating']) ?? 0,
      review: parseString(json['review']),
      csatScore: parseInt(json['csat_score']),
      resolutionOntime: parseBool(json['resolution_ontime']),
      customerName: parseString(json['customer_name']),
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final int? job;
  final String? requestId;
  final String? serviceTitle;
  final int rating;
  final String? review;
  final int? csatScore;
  final bool? resolutionOntime;
  final String? customerName;
  final DateTime? createdAt;
}

/// The full response of GET /workforce/performance/me/.
class PerformanceSummary {
  const PerformanceSummary({
    required this.metrics,
    required this.ratingDistribution,
    required this.feedbacks,
    required this.hasData,
  });

  factory PerformanceSummary.fromJson(Map<String, dynamic> json) {
    final metricsJson = json['metrics'];
    final distributionJson = json['rating_distribution'];
    final feedbacksJson = json['feedbacks'];

    final distribution = <int, int>{
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    if (distributionJson is Map) {
      for (var star = 1; star <= 5; star++) {
        distribution[star] =
            parseInt(distributionJson[star] ?? distributionJson['$star']) ?? 0;
      }
    }

    return PerformanceSummary(
      metrics: metricsJson is Map<String, dynamic>
          ? PerformanceMetrics.fromJson(metricsJson)
          : const PerformanceMetrics(
              jobsCompleted: 0,
              totalJobsAssigned: 0,
              completionRate: 0,
              averageRating: 0,
              csatScore: 0,
              feedbackSubmissionsCount: 0,
              issueResolutionRate: 0,
            ),
      ratingDistribution: distribution,
      feedbacks: feedbacksJson is List
          ? feedbacksJson.whereType<Map<String, dynamic>>().map(JobFeedback.fromJson).toList()
          : const [],
      hasData: parseBool(json['has_data']),
    );
  }

  final PerformanceMetrics metrics;
  final Map<int, int> ratingDistribution;
  final List<JobFeedback> feedbacks;
  final bool hasData;
}
