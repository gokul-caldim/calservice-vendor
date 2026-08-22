import '../../../core/utils/json_parsing.dart';

/// Represents a single lifecycle event within a job's correlated audit trail.
class JobTimelineEvent {
  const JobTimelineEvent({
    required this.title,
    this.description = '',
    required this.timestamp,
    this.actor = 'System',
    this.eventType = 'AUDIT',
  });

  factory JobTimelineEvent.fromJson(Map<String, dynamic> json) {
    return JobTimelineEvent(
      title: parseString(json['title']) ?? 'Event',
      description: parseString(json['description']) ?? '',
      timestamp: parseDateTime(json['timestamp']) ?? DateTime.now(),
      actor: parseString(json['actor']) ?? 'System',
      eventType: parseString(json['event_type']) ?? 'AUDIT',
    );
  }

  final String title;
  final String description;
  final DateTime timestamp;
  final String actor;
  final String eventType;
}

/// Represents the overall correlated lifecycle timeline for a job.
class JobTimelineData {
  const JobTimelineData({
    required this.jobId,
    this.requestId,
    this.status,
    this.eventCount = 0,
    this.events = const [],
    this.error,
  });

  factory JobTimelineData.fromJson(Map<String, dynamic> json) {
    final rawList = json['timeline'];
    final events = rawList is List
        ? rawList
            .whereType<Map<String, dynamic>>()
            .map(JobTimelineEvent.fromJson)
            .toList()
        : <JobTimelineEvent>[];

    return JobTimelineData(
      jobId: parseInt(json['job_id']) ?? 0,
      requestId: parseString(json['request_id']),
      status: parseString(json['status']),
      eventCount: parseInt(json['event_count']) ?? events.length,
      events: events,
      error: parseString(json['error']),
    );
  }

  final int jobId;
  final String? requestId;
  final String? status;
  final int eventCount;
  final List<JobTimelineEvent> events;
  final String? error;
}
