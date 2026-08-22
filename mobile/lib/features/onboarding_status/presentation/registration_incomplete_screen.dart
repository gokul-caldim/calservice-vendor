import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/status_screen.dart';
import '../../auth/presentation/auth_controller.dart';

class RegistrationIncompleteScreen extends ConsumerWidget {
  const RegistrationIncompleteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      icon: Icons.assignment_late_outlined,
      title: 'Registration Incomplete',
      message:
          'Your employee registration has not been completed yet. Please '
          'finish your registration on the CalServices Workforce web '
          'portal, then come back and sign in here.',
      onLogout: () => ref.read(authControllerProvider.notifier).logout(),
    );
  }
}
