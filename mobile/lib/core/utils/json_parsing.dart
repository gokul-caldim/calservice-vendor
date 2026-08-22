/// Small, null-safe helpers for reading values out of decoded API JSON.
/// The backend sends decimals as strings (Django REST Framework's default
/// for DecimalField) and dates as ISO-8601 strings, so every numeric/date
/// field needs defensive parsing rather than a direct cast.
library;

int? parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

double? parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

bool parseBool(dynamic value, {bool fallback = false}) {
  if (value == null) return fallback;
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

DateTime? parseDateTime(dynamic value) {
  if (value == null) return null;
  if (value is String && value.isEmpty) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

String? parseString(dynamic value) {
  if (value == null) return null;
  final str = value.toString();
  return str.isEmpty ? null : str;
}
