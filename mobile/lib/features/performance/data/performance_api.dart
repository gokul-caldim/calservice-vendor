import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class PerformanceApi {
  PerformanceApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> fetchPerformance() async {
    final response = await _dio.get('/workforce/performance/me/');
    return response.data as Map<String, dynamic>;
  }
}

final performanceApiProvider = Provider<PerformanceApi>((ref) {
  return PerformanceApi(ref.watch(apiClientProvider));
});
