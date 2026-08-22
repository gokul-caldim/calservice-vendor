import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'job_time_tracking_api.dart';

class JobTimeTrackingRepository {
  JobTimeTrackingRepository(this._api);

  final JobTimeTrackingApi _api;

  /// Clock in for a specific job. On success the backend has already
  /// transitioned that job to in_progress — the caller must refresh job
  /// state after this, same as every other action.
  Future<String> clockIn({
    required int jobId,
    required double lat,
    required double lon,
    double? accuracy,
    DateTime? timestamp,
    String? address,
  }) async {
    final json = await _api.clockIn(
      jobId: jobId,
      lat: lat,
      lon: lon,
      accuracy: accuracy,
      timestamp: timestamp,
      address: address,
    );
    return json['message'] as String? ?? 'Clocked in.';
  }

  Future<String> clockOut() async {
    final json = await _api.clockOut();
    return json['message'] as String? ?? 'Clocked out.';
  }

  Future<String> startBreak(String breakType) async {
    final json = await _api.startBreak(breakType);
    return json['message'] as String? ?? 'Break started.';
  }

  Future<String> endBreak() async {
    final json = await _api.endBreak();
    return json['message'] as String? ?? 'Break ended.';
  }
}

final jobTimeTrackingRepositoryProvider = Provider<JobTimeTrackingRepository>((ref) {
  return JobTimeTrackingRepository(ref.watch(jobTimeTrackingApiProvider));
});
