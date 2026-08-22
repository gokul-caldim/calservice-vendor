/// Central place for environment-level configuration such as the API base URL.
class AppConfig {
  AppConfig._();

  static const String productionApiBaseUrl =
      'https://vendor.caldimservices.online/api';

  /// The API base URL the app talks to.
  ///
  /// Defaults to the production API. Override for local backend testing with:
  /// `flutter run --dart-define=API_BASE_URL=http://your-lan-ip:8001/api`
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: productionApiBaseUrl,
  );
}
