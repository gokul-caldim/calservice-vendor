import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/presentation/auth_controller.dart';

/// Intentional placeholder — the real employee dashboard (jobs, GPS,
/// notifications, etc.) is built in a later phase.
class EmployeeHomePlaceholderScreen extends ConsumerWidget {
  const EmployeeHomePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CalServices Vendor'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle, size: 56, color: Colors.green),
              const SizedBox(height: 16),
              const Text(
                'Employee authentication successful.',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: AppColors.darkSurface,
                ),
                textAlign: TextAlign.center,
              ),
              if (user != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Welcome, ${user.displayName}.',
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 12),
              Text(
                'The employee dashboard will be built in the next phase.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
