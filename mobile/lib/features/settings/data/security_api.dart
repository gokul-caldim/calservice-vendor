import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class SecurityApi {
  SecurityApi(this._dio);

  final Dio _dio;

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _dio.post(
      '/workforce/security/change-password/',
      data: {
        'current_password': currentPassword,
        'new_password': newPassword,
        'confirm_password': confirmPassword,
      },
    );
  }

  Future<Map<String, dynamic>> changeEmail({
    required String currentPassword,
    required String newEmail,
  }) async {
    final response = await _dio.post(
      '/workforce/security/change-email/',
      data: {'current_password': currentPassword, 'new_email': newEmail},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetch2FAStatus() async {
    final response = await _dio.get('/workforce/security/2fa/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> toggle2FA() async {
    final response = await _dio.post('/workforce/security/2fa/toggle/');
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> fetchActiveSessions() async {
    final response = await _dio.get('/workforce/security/sessions/');
    final data = response.data;
    return data is List ? data : const [];
  }

  Future<List<dynamic>> fetchLoginHistory() async {
    final response = await _dio.get('/workforce/security/login-history/');
    final data = response.data;
    return data is List ? data : const [];
  }
}

final securityApiProvider = Provider<SecurityApi>((ref) {
  return SecurityApi(ref.watch(apiClientProvider));
});
