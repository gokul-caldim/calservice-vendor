import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/performance_summary.dart';
import 'performance_api.dart';

class PerformanceRepository {
  PerformanceRepository(this._api);

  final PerformanceApi _api;

  Future<PerformanceSummary> fetchPerformance() async {
    final json = await _api.fetchPerformance();
    return PerformanceSummary.fromJson(json);
  }
}

final performanceRepositoryProvider = Provider<PerformanceRepository>((ref) {
  return PerformanceRepository(ref.watch(performanceApiProvider));
});
