import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Generic full-screen status message (icon + title + explanation), used for
/// every "you can't go further yet" screen: pending review, corrections
/// needed, rejected, incomplete registration, employees-only.
class StatusScreen extends StatelessWidget {
  const StatusScreen({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.iconColor,
    this.onLogout,
    this.logoutLabel = 'Log Out',
  });

  final IconData icon;
  final String title;
  final String message;
  final Color? iconColor;
  final VoidCallback? onLogout;
  final String logoutLabel;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CalServices Vendor')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 56, color: iconColor ?? AppColors.primary),
                const SizedBox(height: 20),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.darkSurface,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                  textAlign: TextAlign.center,
                ),
                if (onLogout != null) ...[
                  const SizedBox(height: 28),
                  OutlinedButton(onPressed: onLogout, child: Text(logoutLabel)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
