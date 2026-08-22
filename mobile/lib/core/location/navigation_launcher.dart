import 'package:url_launcher/url_launcher.dart';

/// Opens the device's native maps app for turn-by-turn navigation to a
/// destination. This is a pure UI/platform adaptation — the web app renders
/// an embedded first-person map; on mobile we hand off to Google Maps
/// instead. It never touches job status: navigating is not itself a job
/// action anywhere in the backend, so this makes no API call.
Future<bool> launchNavigation({
  required double destinationLat,
  required double destinationLon,
}) async {
  final googleNavUri = Uri.parse(
    'google.navigation:q=$destinationLat,$destinationLon&mode=d',
  );
  if (await canLaunchUrl(googleNavUri)) {
    return launchUrl(googleNavUri, mode: LaunchMode.externalApplication);
  }

  // Fallback for devices without the Google Maps app installed.
  final geoUri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&destination=$destinationLat,$destinationLon&travelmode=driving',
  );
  return launchUrl(geoUri, mode: LaunchMode.externalApplication);
}
