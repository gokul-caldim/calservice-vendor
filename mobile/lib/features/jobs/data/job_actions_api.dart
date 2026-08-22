import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Every job-lifecycle action endpoint, verified against the web app's
/// api/workforceService.js and the backend views directly — no invented
/// paths or bodies. See job_actions_repository.dart for the typed layer on
/// top of this.
class JobActionsApi {
  JobActionsApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> acceptOffer(int jobId) async {
    final response = await _dio.post('/workforce/jobs/$jobId/accept-offer/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> rejectOffer(int jobId, String reason) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/reject-offer/',
      data: {'reason': reason},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Matches the endpoint the web UI's cancel-assignment modal actually
  /// calls (`apiCancelJob` → `/cancel/`) — NOT `/cancel-assignment/`, which
  /// exists in the backend but is dead code on web.
  Future<Map<String, dynamic>> cancelJob(
    int jobId, {
    required String reasonCode,
    String reasonDetail = '',
  }) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/cancel/',
      data: {'reason_code': reasonCode, 'reason_detail': reasonDetail},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyArrival(
    int jobId, {
    required double lat,
    required double lon,
  }) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/arrive/',
      data: {'lat': lat, 'lon': lon},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetchPreServiceStatus(int jobId) async {
    final response = await _dio.get('/workforce/jobs/$jobId/pre-service-status/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyOtp(int jobId, String otp) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/verify-otp/',
      data: {'otp': otp},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> resendOtp(int jobId) async {
    final response = await _dio.post('/workforce/jobs/$jobId/resend-otp/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> uploadPreServicePhoto(
    int jobId, {
    required String photoType,
    required String filePath,
  }) async {
    final formData = FormData.fromMap({
      'photo_type': photoType,
      'file': await MultipartFile.fromFile(filePath),
    });
    final response = await _dio.post(
      '/workforce/jobs/$jobId/pre-service-photo/',
      data: formData,
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> uploadProof(
    int jobId, {
    required String afterPresencePhotoPath,
    String? afterAppliancePhotoPath,
    String? afterWorkAreaPhotoPath,
    String? notes,
  }) async {
    final formData = FormData.fromMap({
      'after_presence_photo': await MultipartFile.fromFile(afterPresencePhotoPath),
      if (afterAppliancePhotoPath != null)
        'after_appliance_photo': await MultipartFile.fromFile(afterAppliancePhotoPath),
      if (afterWorkAreaPhotoPath != null)
        'after_work_area_photo': await MultipartFile.fromFile(afterWorkAreaPhotoPath),
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    final response = await _dio.post('/workforce/jobs/$jobId/proof/', data: formData);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetchPayment(int jobId) async {
    final response = await _dio.get('/workforce/jobs/$jobId/payment/');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> collectCash(int jobId, double amountReceived) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/payment/collect/',
      data: {'amount_received': amountReceived},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyPaymentOtp(int jobId, String otp) async {
    final response = await _dio.post(
      '/workforce/jobs/$jobId/payment/verify-otp/',
      data: {'otp': otp},
    );
    return response.data as Map<String, dynamic>;
  }
}

final jobActionsApiProvider = Provider<JobActionsApi>((ref) {
  return JobActionsApi(ref.watch(apiClientProvider));
});
