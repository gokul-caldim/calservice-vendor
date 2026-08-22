import 'package:flutter/material.dart';

import '../../../../core/location/navigation_launcher.dart';
import '../../domain/job.dart';

/// Opens native Google Maps navigation to the customer. This never calls
/// any backend endpoint and never changes job status — the web app's
/// embedded map view is likewise purely client-side (confirmed:
/// useTechnicianNavigation.js contains no API calls that affect job
/// status). This is a mobile-native adaptation of that same read-only
/// map/directions display, not a new business action.
class NavigateButton extends StatelessWidget {
  const NavigateButton({super.key, required this.job});

  final Job job;

  @override
  Widget build(BuildContext context) {
    if (!job.hasCoordinates) {
      return const SizedBox.shrink();
    }
    return OutlinedButton.icon(
      onPressed: () async {
        final launched = await launchNavigation(
          destinationLat: job.latitude!,
          destinationLon: job.longitude!,
        );
        if (!launched && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open a maps app for navigation.')),
          );
        }
      },
      icon: const Icon(Icons.directions_rounded, size: 18),
      label: const Text('Navigate'),
    );
  }
}
