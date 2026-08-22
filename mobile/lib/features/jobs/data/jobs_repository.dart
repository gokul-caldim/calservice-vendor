import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/job.dart';
import 'jobs_api.dart';

class JobsRepository {
  JobsRepository(this._api);

  final JobsApi _api;

  Future<List<Job>> fetchActiveJobs() async {
    final raw = await _api.fetchJobs(status: 'active');
    return raw.whereType<Map<String, dynamic>>().map(Job.fromJson).toList();
  }

  Future<List<Job>> fetchCompletedJobs() async {
    final raw = await _api.fetchJobs(status: 'completed');
    return raw.whereType<Map<String, dynamic>>().map(Job.fromJson).toList();
  }
}

final jobsRepositoryProvider = Provider<JobsRepository>((ref) {
  return JobsRepository(ref.watch(jobsApiProvider));
});
