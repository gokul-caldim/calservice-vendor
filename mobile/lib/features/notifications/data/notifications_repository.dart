import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/app_notification.dart';
import 'notifications_api.dart';

class NotificationsRepository {
  NotificationsRepository(this._api);

  final NotificationsApi _api;

  Future<NotificationsResult> fetchNotifications() async {
    final json = await _api.fetchNotifications();
    return NotificationsResult.fromJson(json);
  }

  Future<void> markAsRead(int id) => _api.markAsRead(id);
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.watch(notificationsApiProvider));
});
