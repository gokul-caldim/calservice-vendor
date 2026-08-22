import '../../../core/utils/json_parsing.dart';

/// Mirrors the 8 fields WorkforceSettingsPage.jsx actually exposes from
/// WorkforceNotificationPreferenceSerializer (backend/workforce_api/serializers.py:864-883).
/// The backend model has more fields (leave_updates, shift_reminders,
/// payroll_notifications, login_alerts) with no web UI control — PATCH is
/// partial, so this app only ever sends the 8 it lets the user edit.
class NotificationPreferences {
  const NotificationPreferences({
    required this.channelEmail,
    required this.channelInApp,
    required this.channelSms,
    required this.jobAssignments,
    required this.securityAlerts,
    required this.workspaceAnnouncements,
    required this.weeklyDigest,
    required this.productUpdates,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    return NotificationPreferences(
      channelEmail: parseBool(json['channel_email'], fallback: true),
      channelInApp: parseBool(json['channel_in_app'], fallback: true),
      channelSms: parseBool(json['channel_sms']),
      jobAssignments: parseBool(json['job_assignments'], fallback: true),
      securityAlerts: parseBool(json['security_alerts'], fallback: true),
      workspaceAnnouncements: parseBool(json['workspace_announcements'], fallback: true),
      weeklyDigest: parseBool(json['weekly_digest'], fallback: true),
      productUpdates: parseBool(json['product_updates']),
    );
  }

  static const defaults = NotificationPreferences(
    channelEmail: true,
    channelInApp: true,
    channelSms: false,
    jobAssignments: true,
    securityAlerts: true,
    workspaceAnnouncements: true,
    weeklyDigest: true,
    productUpdates: false,
  );

  final bool channelEmail;
  final bool channelInApp;
  final bool channelSms;
  final bool jobAssignments;
  final bool securityAlerts;
  final bool workspaceAnnouncements;
  final bool weeklyDigest;
  final bool productUpdates;

  Map<String, dynamic> toJson() => {
    'channel_email': channelEmail,
    'channel_in_app': channelInApp,
    'channel_sms': channelSms,
    'job_assignments': jobAssignments,
    'security_alerts': securityAlerts,
    'workspace_announcements': workspaceAnnouncements,
    'weekly_digest': weeklyDigest,
    'product_updates': productUpdates,
  };

  NotificationPreferences copyWith({
    bool? channelEmail,
    bool? channelInApp,
    bool? channelSms,
    bool? jobAssignments,
    bool? securityAlerts,
    bool? workspaceAnnouncements,
    bool? weeklyDigest,
    bool? productUpdates,
  }) {
    return NotificationPreferences(
      channelEmail: channelEmail ?? this.channelEmail,
      channelInApp: channelInApp ?? this.channelInApp,
      channelSms: channelSms ?? this.channelSms,
      jobAssignments: jobAssignments ?? this.jobAssignments,
      securityAlerts: securityAlerts ?? this.securityAlerts,
      workspaceAnnouncements: workspaceAnnouncements ?? this.workspaceAnnouncements,
      weeklyDigest: weeklyDigest ?? this.weeklyDigest,
      productUpdates: productUpdates ?? this.productUpdates,
    );
  }
}
