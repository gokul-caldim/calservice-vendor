import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class AppearanceApi {
  AppearanceApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> fetchPreferences() async {
    final response = await _dio.get('/workforce/preferences/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> savePreferences(Map<String, dynamic> payload) async {
    final response = await _dio.patch('/workforce/preferences/', data: payload);
    return response.data as Map<String, dynamic>;
  }
}

final appearanceApiProvider = Provider<AppearanceApi>((ref) {
  return AppearanceApi(ref.watch(apiClientProvider));
});
