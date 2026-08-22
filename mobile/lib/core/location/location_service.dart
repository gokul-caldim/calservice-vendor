import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// A single resolved GPS fix, in the shape every job-action call needs
/// (lat/lon/accuracy/timestamp) — mirrors what the web app's
/// getGPSPosition() hands to its callers.
class LocationResult {
  const LocationResult({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    required this.timestamp,
  });

  final double latitude;
  final double longitude;
  final double? accuracy;
  final DateTime timestamp;
}

class LocationFailure implements Exception {
  const LocationFailure(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Wraps geolocator with the same two-stage resolution strategy as the web
/// app's useGPSPosition.js: try a high-accuracy fix first, fall back to a
/// looser one if that times out, rather than failing outright.
class LocationService {
  Future<LocationResult> getCurrentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationFailure(
        'Location services are turned off. Please enable GPS to continue.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw const LocationFailure('Location permission was denied.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationFailure(
        'Location permission is permanently denied. Please enable it in Android Settings.',
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 6),
        ),
      );
      return _fromPosition(position);
    } catch (_) {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            timeLimit: Duration(seconds: 10),
          ),
        );
        return _fromPosition(position);
      } catch (_) {
        throw const LocationFailure(
          'Unable to determine your current location. Please try again outdoors or with GPS enabled.',
        );
      }
    }
  }

  LocationResult _fromPosition(Position position) {
    return LocationResult(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      timestamp: position.timestamp,
    );
  }
}

final locationServiceProvider = Provider<LocationService>((ref) => LocationService());
