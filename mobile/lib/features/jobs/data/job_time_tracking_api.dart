import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Time-tracking calls invoked from the job workflow. Clock-in here is
/// job-scoped (passes job_id) — verified against the backend's ClockInView:
/// a single call both opens the shift TimeLog AND transitions the job to
/// in_progress atomically. There is no separate "start work" endpoint.
class JobTimeTrackingApi {
  JobTimeTrackingApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> clockIn({
    required int jobId,
    required double lat,
    required double lon,
    double? accuracy,
    DateTime? timestamp,
    String? address,
  }) async {
    final response = await _dio.post(
      '/workforce/time-tracking/clock-in/',
      data: {
        'job_id': jobId,
        'lat': lat,
        'lon': lon,
        'accuracy': ?accuracy,
        'timestamp': ?timestamp?.toIso8601String(),
        if (address != null && address.isNotEmpty) 'address': address,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> clockOut() async {
    final response = await _dio.post('/workforce/time-tracking/clock-out/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> startBreak(String breakType) async {
    final response = await _dio.post(
      '/workforce/time-tracking/break/start/',
      data: {'break_type': breakType},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> endBreak() async {
    final response = await _dio.post('/workforce/time-tracking/break/end/');
    return response.data as Map<String, dynamic>;
  }
}

final jobTimeTrackingApiProvider = Provider<JobTimeTrackingApi>((ref) {
  return JobTimeTrackingApi(ref.watch(apiClientProvider));
});
