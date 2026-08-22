import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class PrivacyApi {
  PrivacyApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> exportData() async {
    final response = await _dio.get('/workforce/privacy/export/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> deactivateAccount({
    required String password,
    String reason = '',
  }) async {
    final response = await _dio.post(
      '/workforce/privacy/deactivate/',
      data: {'password': password, 'reason': reason},
    );
    return response.data as Map<String, dynamic>;
  }
}

final privacyApiProvider = Provider<PrivacyApi>((ref) {
  return PrivacyApi(ref.watch(apiClientProvider));
});
