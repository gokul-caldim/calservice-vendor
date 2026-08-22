import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/notifications_repository.dart';
import '../domain/app_notification.dart';

class NotificationsNotifier extends AutoDisposeAsyncNotifier<NotificationsResult> {
  @override
  Future<NotificationsResult> build() {
    return ref.watch(notificationsRepositoryProvider).fetchNotifications();
  }

  /// Optimistically marks one notification read, then confirms with the
  /// server; reverts on failure so the UI never shows a state the backend
  /// didn't actually accept.
  Future<void> markAsRead(int id) async {
    final current = state.valueOrNull;
    if (current == null) return;

    AppNotification? target;
    for (final n in current.items) {
      if (n.id == id) {
        target = n;
        break;
      }
    }
    if (target == null || target.isRead) return;

    final optimistic = NotificationsResult(
      unreadCount: current.unreadCount > 0 ? current.unreadCount - 1 : 0,
      items: [for (final n in current.items) n.id == id ? n.copyWith(isRead: true) : n],
    );
    state = AsyncData(optimistic);

    try {
      await ref.read(notificationsRepositoryProvider).markAsRead(id);
    } catch (_) {
      state = AsyncData(current);
      rethrow;
    }
  }
}

final notificationsProvider =
    AutoDisposeAsyncNotifierProvider<NotificationsNotifier, NotificationsResult>(
      NotificationsNotifier.new,
    );

/// Watched by the bottom-nav shell to badge the Notifications tab, without
/// needing its own separate fetch.
final unreadNotificationsCountProvider = Provider.autoDispose<int>((ref) {
  return ref.watch(notificationsProvider).valueOrNull?.unreadCount ?? 0;
});
