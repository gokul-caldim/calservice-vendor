import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/security_models.dart';
import 'security_api.dart';

class SecurityRepository {
  SecurityRepository(this._api);

  final SecurityApi _api;

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return _api.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
  }

  /// Returns the confirmation message from the backend.
  Future<String> changeEmail({required String currentPassword, required String newEmail}) async {
    final json = await _api.changeEmail(currentPassword: currentPassword, newEmail: newEmail);
    return json['message'] as String? ?? 'Email address updated successfully.';
  }

  Future<TwoFactorStatus> fetch2FAStatus() async {
    final json = await _api.fetch2FAStatus();
    return TwoFactorStatus.fromJson(json);
  }

  /// Returns (new enabled state, confirmation message).
  Future<(bool, String)> toggle2FA() async {
    final json = await _api.toggle2FA();
    final enabled = json['two_fa_enabled'] as bool? ?? false;
    final message = json['message'] as String? ?? 'Two-Factor Authentication updated.';
    return (enabled, message);
  }

  Future<List<ActiveSession>> fetchActiveSessions() async {
    final raw = await _api.fetchActiveSessions();
    return raw.whereType<Map<String, dynamic>>().map(ActiveSession.fromJson).toList();
  }

  Future<List<SecurityLogEntry>> fetchLoginHistory() async {
    final raw = await _api.fetchLoginHistory();
    return raw.whereType<Map<String, dynamic>>().map(SecurityLogEntry.fromJson).toList();
  }
}

final securityRepositoryProvider = Provider<SecurityRepository>((ref) {
  return SecurityRepository(ref.watch(securityApiProvider));
});
