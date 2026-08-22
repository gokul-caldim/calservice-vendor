import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/location/location_service.dart';
import '../../../../core/theme/app_theme.dart';

class LocationPickerMap extends StatefulWidget {
  const LocationPickerMap({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.onPositionChange,
    this.height = 240,
    this.isResolvingAddress = false,
  });

  final double? latitude;
  final double? longitude;
  final void Function(double lat, double lng) onPositionChange;
  final double height;
  final bool isResolvingAddress;

  @override
  State<LocationPickerMap> createState() => _LocationPickerMapState();
}

class _LocationPickerMapState extends State<LocationPickerMap> {
  late final MapController _mapController;
  bool _isGpsLoading = false;
  String? _gpsError;

  // Default centre: India (20.5937, 78.9629) matching web LocationPickerMap.jsx
  static const double _defaultLat = 20.5937;
  static const double _defaultLng = 78.9629;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
  }

  @override
  void didUpdateWidget(covariant LocationPickerMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final lat = widget.latitude;
    final lng = widget.longitude;
    if (lat != null &&
        lng != null &&
        (lat != oldWidget.latitude || lng != oldWidget.longitude)) {
      try {
        _mapController.move(LatLng(lat, lng), 16);
      } catch (_) {
        // Map controller might not be attached yet
      }
    }
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _handleUseCurrentLocation() async {
    setState(() {
      _isGpsLoading = true;
      _gpsError = null;
    });

    try {
      final pos = await LocationService().getCurrentPosition();
      final lat = pos.latitude;
      final lng = pos.longitude;

      if (!mounted) return;

      try {
        _mapController.move(LatLng(lat, lng), 16);
      } catch (_) {}

      widget.onPositionChange(lat, lng);
    } on LocationFailure catch (e) {
      if (!mounted) return;
      setState(() {
        if (e.message.toLowerCase().contains('denied')) {
          _gpsError = 'Location access denied. Please allow location permissions in Android Settings.';
        } else {
          _gpsError = 'Could not obtain GPS position. Try again.';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _gpsError = 'Could not obtain GPS position. Try again.';
      });
    } finally {
      if (mounted) {
        setState(() => _isGpsLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lat = widget.latitude;
    final lng = widget.longitude;
    final hasCoords = lat != null && lng != null;
    final center = hasCoords ? LatLng(lat, lng) : const LatLng(_defaultLat, _defaultLng);
    final initialZoom = hasCoords ? 15.0 : 5.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Map Container with explicit finite height
        SizedBox(
          height: widget.height,
          width: double.infinity,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: center,
                    initialZoom: initialZoom,
                    minZoom: 3,
                    maxZoom: 19,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.all,
                    ),
                    onTap: (tapPosition, point) {
                      if (mounted) {
                        setState(() => _gpsError = null);
                      }
                      widget.onPositionChange(point.latitude, point.longitude);
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'online.caldimservices.vendor',
                      maxZoom: 19,
                    ),
                    if (hasCoords)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(lat, lng),
                            width: 44,
                            height: 44,
                            alignment: Alignment.topCenter,
                            child: const Icon(
                              Icons.location_pin,
                              size: 40,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),

                // Zoom In/Out Buttons overlay
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Material(
                        color: Colors.white.withValues(alpha: 0.92),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        child: InkWell(
                          onTap: () {
                            try {
                              final currentZoom = _mapController.camera.zoom;
                              _mapController.move(_mapController.camera.center, currentZoom + 1);
                            } catch (_) {}
                          },
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(Icons.add, size: 20, color: Color(0xFF334155)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Material(
                        color: Colors.white.withValues(alpha: 0.92),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        child: InkWell(
                          onTap: () {
                            try {
                              final currentZoom = _mapController.camera.zoom;
                              _mapController.move(_mapController.camera.center, currentZoom - 1);
                            } catch (_) {}
                          },
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(Icons.remove, size: 20, color: Color(0xFF334155)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Instructions Chip Overlay (if no pin yet)
                if (!hasCoords)
                  Positioned(
                    top: 8,
                    left: 8,
                    right: 8,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.72),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'Tap anywhere on the map to place a pin',
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // Controls row matching web LocationPickerMap.jsx
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            OutlinedButton.icon(
              onPressed: _isGpsLoading ? null : _handleUseCurrentLocation,
              icon: _isGpsLoading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.near_me_outlined, size: 16, color: Color(0xFF2563EB)),
              label: Text(
                _isGpsLoading ? 'Getting GPS…' : 'Use Current Location',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                visualDensity: VisualDensity.compact,
              ),
            ),
            if (hasCoords)
              Text(
                '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontFamily: 'monospace',
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),

        if (widget.isResolvingAddress)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Row(
              children: [
                SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF2563EB)),
                ),
                SizedBox(width: 6),
                Text(
                  'Resolving address…',
                  style: TextStyle(fontSize: 11, color: Color(0xFF2563EB), fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

        if (_gpsError != null && _gpsError!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              _gpsError ?? '',
              style: const TextStyle(fontSize: 11, color: Color(0xFFE11D48), fontWeight: FontWeight.bold),
            ),
          ),
      ],
    );
  }
}
