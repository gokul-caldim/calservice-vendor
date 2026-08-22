import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/notification_settings_repository.dart';
import '../../domain/notification_preferences.dart';

final notificationSettingsProvider = FutureProvider.autoDispose<NotificationPreferences>((ref) async {
  return ref.watch(notificationSettingsRepositoryProvider).fetchPreferences();
});
