import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/job_actions_repository.dart';
import '../../domain/pre_service_status.dart';

/// Polls GET pre-service-status every 4s until geofence_passed — the exact
/// same cadence and stop condition as the web app's polling effect in
/// EmployeeDashboardPage.jsx. Once geofence passes, subsequent progress
/// (OTP, photos) comes from the direct action responses, not further
/// polling, matching web exactly.
final preServiceStatusProvider = StreamProvider.autoDispose.family<PreServiceStatus, int>((
  ref,
  jobId,
) async* {
  final repository = ref.watch(jobActionsRepositoryProvider);
  while (true) {
    try {
      final status = await repository.fetchPreServiceStatus(jobId);
      yield status;
      if (status.geofencePassed) {
        break;
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      if (e.response?.statusCode == 403 || code == 'PRE_SERVICE_ACCESS_DENIED') {
        // Forbidden: Stop polling if not assigned
        break;
      }
    } catch (_) {
      // Ignore transient network errors during background polling
    }
    await Future.delayed(const Duration(seconds: 4));
  }
});

