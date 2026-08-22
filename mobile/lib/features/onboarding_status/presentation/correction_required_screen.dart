import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/status_screen.dart';
import '../../auth/presentation/auth_controller.dart';

class CorrectionRequiredScreen extends ConsumerWidget {
  const CorrectionRequiredScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      icon: Icons.edit_note,
      iconColor: Colors.amber.shade800,
      title: 'Corrections Needed',
      message:
          'Your application needs some corrections before it can be '
          'approved. Please make the requested corrections on the '
          'CalServices Workforce web portal, then check back here.',
      onLogout: () => ref.read(authControllerProvider.notifier).logout(),
    );
  }
}
