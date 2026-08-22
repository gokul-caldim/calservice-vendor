import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/notification_preferences.dart';
import 'notification_settings_api.dart';

class NotificationSettingsRepository {
  NotificationSettingsRepository(this._api);

  final NotificationSettingsApi _api;

  Future<NotificationPreferences> fetchPreferences() async {
    final json = await _api.fetchPreferences();
    return NotificationPreferences.fromJson(json);
  }

  Future<NotificationPreferences> savePreferences(NotificationPreferences preferences) async {
    final json = await _api.savePreferences(preferences.toJson());
    final saved = json['preferences'];
    return saved is Map<String, dynamic> ? NotificationPreferences.fromJson(saved) : preferences;
  }
}

final notificationSettingsRepositoryProvider = Provider<NotificationSettingsRepository>((ref) {
  return NotificationSettingsRepository(ref.watch(notificationSettingsApiProvider));
});
