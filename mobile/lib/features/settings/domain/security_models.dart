import '../../../core/utils/json_parsing.dart';

/// Mirrors GET /workforce/security/2fa/ (backend/workforce_api/views.py:6933-6960).
class TwoFactorStatus {
  const TwoFactorStatus({required this.enabled, required this.phoneConfigured, this.email});

  factory TwoFactorStatus.fromJson(Map<String, dynamic> json) {
    return TwoFactorStatus(
      enabled: parseBool(json['two_fa_enabled']),
      phoneConfigured: parseBool(json['phone_configured']),
      email: parseString(json['email']),
    );
  }

  final bool enabled;
  final bool phoneConfigured;
  final String? email;
}

/// Mirrors GET /workforce/security/sessions/ (backend/workforce_api/views.py:6963-6982).
/// The backend has no real multi-device session store — it always returns
/// exactly one synthetic row describing the current request, including a
/// hardcoded `device: "Current Web Session"` string. That field is web-
/// specific and not displayed verbatim here; `isCurrent`, `ipAddress`, and
/// `userAgent` are real and are what's shown.
class ActiveSession {
  const ActiveSession({
    required this.id,
    required this.ipAddress,
    required this.userAgent,
    required this.isCurrent,
    this.lastActive,
  });

  factory ActiveSession.fromJson(Map<String, dynamic> json) {
    return ActiveSession(
      id: parseString(json['id']) ?? '',
      ipAddress: parseString(json['ip_address']) ?? 'Unknown',
      userAgent: parseString(json['browser']) ?? 'Unknown',
      isCurrent: parseBool(json['is_current']),
      lastActive: parseDateTime(json['last_active']),
    );
  }

  final String id;
  final String ipAddress;
  final String userAgent;
  final bool isCurrent;
  final DateTime? lastActive;
}

/// Mirrors one entry from GET /workforce/security/login-history/
/// (backend/workforce_api/views.py:6985-7022) — a merge of PresenceLog
/// events and WorkforceEventLog security events.
class SecurityLogEntry {
  const SecurityLogEntry({required this.id, required this.event, required this.ip, this.timestamp});

  factory SecurityLogEntry.fromJson(Map<String, dynamic> json) {
    return SecurityLogEntry(
      id: parseString(json['id']) ?? '',
      event: parseString(json['event']) ?? 'Event',
      ip: parseString(json['ip']) ?? '—',
      timestamp: parseDateTime(json['timestamp']),
    );
  }

  final String id;
  final String event;
  final String ip;
  final DateTime? timestamp;
}
