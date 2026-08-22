import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/performance_repository.dart';
import '../domain/performance_summary.dart';

final performanceProvider = FutureProvider.autoDispose<PerformanceSummary>((ref) async {
  return ref.watch(performanceRepositoryProvider).fetchPerformance();
});
