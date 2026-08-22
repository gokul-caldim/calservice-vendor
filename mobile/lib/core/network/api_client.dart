import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';
import 'auth_events.dart';

bool _isAuthEndpoint(String path) =>
    path.contains('/auth/login') || path.contains('/auth/refresh');

/// Calls `POST /auth/refresh/` with the stored refresh token and saves the
/// new token pair. Returns false (without throwing) if refresh isn't
/// possible or the backend rejects it — the caller decides what to do next.
Future<bool> _refreshTokens(Dio dio, TokenStorage tokenStorage) async {
  final refreshToken = await tokenStorage.readRefreshToken();
  if (refreshToken == null || refreshToken.isEmpty) {
    return false;
  }

  try {
    final response = await dio.post(
      '/auth/refresh/',
      data: {'refresh_token': refreshToken},
    );
    final data = response.data as Map<String, dynamic>;
    final newAccessToken =
        data['access_token'] as String? ?? data['token'] as String?;
    final newRefreshToken =
        data['refresh_token'] as String? ?? data['refresh'] as String?;

    if (newAccessToken == null || newAccessToken.isEmpty) {
      return false;
    }

    await tokenStorage.saveTokens(
      accessToken: newAccessToken,
      refreshToken: newRefreshToken ?? refreshToken,
    );
    return true;
  } on DioException {
    return false;
  }
}

/// Shared Dio instance every API call in the app uses.
///
/// - Attaches `Authorization: Bearer <access_token>` to every request except
///   login/refresh (an expired token on the refresh call itself would make
///   the backend reject the refresh before it even runs).
/// - On a 401 from any other request, refreshes the token once and retries
///   the original request. If refresh fails, clears tokens and notifies
///   [AuthEvents] so the app can send the user back to login.
final apiClientProvider = Provider<Dio>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final authEvents = ref.watch(authEventsProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  // Dedupes concurrent refresh attempts so two 401s in flight at once don't
  // trigger two refresh calls.
  Completer<bool>? refreshCompleter;
  Future<bool> refreshOnce() {
    final inFlight = refreshCompleter;
    if (inFlight != null) {
      return inFlight.future;
    }
    final completer = Completer<bool>();
    refreshCompleter = completer;
    _refreshTokens(dio, tokenStorage).then((ok) {
      completer.complete(ok);
      refreshCompleter = null;
    });
    return completer.future;
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (!_isAuthEndpoint(options.path)) {
          final accessToken = await tokenStorage.readAccessToken();
          if (accessToken != null && accessToken.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $accessToken';
          }
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final requestOptions = error.requestOptions;
        final alreadyRetried = requestOptions.extra['retried'] == true;

        if (error.response?.statusCode != 401 ||
            _isAuthEndpoint(requestOptions.path) ||
            alreadyRetried) {
          handler.next(error);
          return;
        }

        final refreshed = await refreshOnce();
        if (!refreshed) {
          await tokenStorage.clear();
          authEvents.notifySessionExpired();
          handler.next(error);
          return;
        }

        try {
          requestOptions.extra['retried'] = true;
          final response = await dio.fetch(requestOptions);
          handler.resolve(response);
        } on DioException catch (retryError) {
          handler.next(retryError);
        }
      },
    ),
  );

  return dio;
});
