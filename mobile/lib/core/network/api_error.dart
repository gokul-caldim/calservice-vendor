import 'package:dio/dio.dart';

/// Turns a failed API call into a short, user-facing message.
///
/// Matches the error shapes the existing backend actually returns:
/// `{"error": "...", "code": "..."}` for auth-flow errors, or DRF's default
/// `{"detail": "..."}` for generic authentication failures.
String describeDioError(
  DioException error, {
  String fallback = 'Unable to complete sign-in. Please try again.',
}) {
  final data = error.response?.data;
  if (data is Map) {
    final apiError = data['error'];
    if (apiError is String && apiError.isNotEmpty) {
      return apiError;
    }
    final detail = data['detail'];
    if (detail is String && detail.isNotEmpty) {
      return detail;
    }
  }

  switch (error.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
      return 'Network error. Please check your internet connection.';
    default:
      return fallback;
  }
}
