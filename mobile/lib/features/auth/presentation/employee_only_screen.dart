import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/status_screen.dart';
import 'auth_controller.dart';

/// Shown when the authenticated account's role isn't "employee" (e.g. an
/// admin, manager, kiosk, or customer account). This app is employee-only —
/// no admin/manager screens are built here, and backend permissions are
/// never changed to enforce this; it's purely a client-side gate.
class EmployeeOnlyScreen extends ConsumerWidget {
  const EmployeeOnlyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      icon: Icons.block,
      iconColor: Colors.grey.shade700,
      title: 'Employees Only',
      message:
          'This mobile application is available for employees only. Please '
          'sign in with an employee account.',
      onLogout: () => ref.read(authControllerProvider.notifier).logout(),
      logoutLabel: 'Return to Login',
    );
  }
}
