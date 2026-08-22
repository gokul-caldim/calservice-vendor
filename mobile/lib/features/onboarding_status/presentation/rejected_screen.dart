import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/status_screen.dart';
import '../../auth/presentation/auth_controller.dart';

class RejectedScreen extends ConsumerWidget {
  const RejectedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      icon: Icons.cancel_outlined,
      iconColor: Colors.red.shade700,
      title: 'Application Declined',
      message:
          'Your technician application was not approved. Please contact '
          'CalServices support if you have questions about this decision.',
      onLogout: () => ref.read(authControllerProvider.notifier).logout(),
    );
  }
}
