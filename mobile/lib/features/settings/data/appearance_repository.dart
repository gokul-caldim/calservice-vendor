import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/appearance_preferences.dart';
import 'appearance_api.dart';

class AppearanceRepository {
  AppearanceRepository(this._api);

  final AppearanceApi _api;

  Future<AppearancePreferences> fetchPreferences() async {
    final json = await _api.fetchPreferences();
    return AppearancePreferences.fromJson(json);
  }

  Future<AppearancePreferences> savePreferences(AppearancePreferences preferences) async {
    final json = await _api.savePreferences(preferences.toJson());
    final saved = json['preferences'];
    return saved is Map<String, dynamic> ? AppearancePreferences.fromJson(saved) : preferences;
  }
}

final appearanceRepositoryProvider = Provider<AppearanceRepository>((ref) {
  return AppearanceRepository(ref.watch(appearanceApiProvider));
});
