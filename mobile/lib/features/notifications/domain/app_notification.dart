import '../../../core/utils/json_parsing.dart';

/// Mirrors one item from GET /workforce/notifications/
/// (backend/workforce_api/views.py:4970-5001).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    this.notificationType,
    this.relatedObjectId,
    required this.isRead,
    this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: parseInt(json['id']) ?? 0,
      title: parseString(json['title']) ?? 'Notification',
      message: parseString(json['message']) ?? '',
      notificationType: parseString(json['notification_type']),
      relatedObjectId: json['related_object_id'],
      isRead: parseBool(json['is_read']),
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final String title;
  final String message;
  final String? notificationType;
  final dynamic relatedObjectId;
  final bool isRead;
  final DateTime? createdAt;

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      notificationType: notificationType,
      relatedObjectId: relatedObjectId,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}

class NotificationsResult {
  const NotificationsResult({required this.unreadCount, required this.items});

  factory NotificationsResult.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['notifications'];
    return NotificationsResult(
      unreadCount: parseInt(json['unread_count']) ?? 0,
      items: itemsJson is List
          ? itemsJson.whereType<Map<String, dynamic>>().map(AppNotification.fromJson).toList()
          : const [],
    );
  }

  final int unreadCount;
  final List<AppNotification> items;
}
