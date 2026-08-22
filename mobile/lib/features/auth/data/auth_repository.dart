// ignore_for_file: prefer_initializing_formals — named constructor params
// keep readable public names (authApi/tokenStorage) while backing private
// fields, instead of exposing underscore-prefixed named arguments.
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/token_storage.dart';
import '../domain/auth_user.dart';
import 'auth_api.dart';

/// Combines AuthApi (network) with TokenStorage (secure storage) into the
/// operations the rest of the app actually needs: restore a session on
/// startup, log in, log out.
class AuthRepository {
  AuthRepository({required AuthApi authApi, required TokenStorage tokenStorage})
    : _authApi = authApi,
      _tokenStorage = tokenStorage;

  final AuthApi _authApi;
  final TokenStorage _tokenStorage;

  /// Called once on app start. Returns null if there's no session to
  /// restore (no stored token, the token is unrecoverable, or secure
  /// storage itself is unavailable).
  Future<AuthUser?> restoreSession() async {
    try {
      final accessToken = await _tokenStorage.readAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        return null;
      }
      final json = await _authApi.fetchMe();
      return AuthUser.fromJson(json);
    } on DioException {
      await _tokenStorage.clear();
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<AuthUser> login({
    required String identifier,
    required String password,
  }) async {
    final json = await _authApi.login(identifier: identifier, password: password);

    final accessToken =
        json['access_token'] as String? ?? json['token'] as String?;
    final refreshToken = json['refresh_token'] as String?;
    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      throw StateError('Login response did not include valid tokens.');
    }
    await _tokenStorage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );

    final userJson = json['user'] as Map<String, dynamic>?;
    if (userJson != null) {
      return AuthUser.fromJson(userJson);
    }
    // Defensive fallback in case the login response ever stops embedding
    // the user object — /auth/me/ returns the same fields flattened.
    final meJson = await _authApi.fetchMe();
    return AuthUser.fromJson(meJson);
  }

  Future<void> logout() async {
    await _tokenStorage.clear();
    try {
      await _authApi.logout();
    } on DioException {
      // Best-effort: the local session is already cleared either way.
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    authApi: ref.watch(authApiProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});
