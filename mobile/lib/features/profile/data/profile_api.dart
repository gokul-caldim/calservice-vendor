import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class ProfileApi {
  ProfileApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> fetchProfile() async {
    final response = await _dio.get('/workforce/profile/me/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final response = await _dio.patch('/workforce/profile/me/', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> uploadAvatar(String filePath) async {
    final fileName = filePath.split(RegExp(r'[/\\]')).last;
    final formData = FormData.fromMap({
      'avatar': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    final response = await _dio.post(
      '/workforce/profile/avatar/',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> fetchChangeRequests() async {
    final response = await _dio.get('/workforce/profile/change-requests/');
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> submitChangeRequest(Map<String, dynamic> data) async {
    final response = await _dio.post('/workforce/profile/change-requests/', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> fetchShiftStatus() async {
    try {
      final response = await _dio.get('/workforce/time-tracking/');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return null;
    }
  }
}

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(ref.watch(apiClientProvider));
});
