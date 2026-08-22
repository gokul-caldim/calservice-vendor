import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Raw calls to the jobs endpoint. `GET /workforce/jobs/?status=` returns
/// both offers and in-flight/completed jobs in one list — see Job.fromJson
/// and job_presentation.dart for how "is this an offer?" is derived
/// client-side, same as the web app does.
class JobsApi {
  JobsApi(this._dio);

  final Dio _dio;

  Future<List<dynamic>> fetchJobs({required String status}) async {
    final response = await _dio.get(
      '/workforce/jobs/',
      queryParameters: {'status': status},
    );
    final data = response.data;
    return data is List ? data : const [];
  }
}

final jobsApiProvider = Provider<JobsApi>((ref) {
  return JobsApi(ref.watch(apiClientProvider));
});
