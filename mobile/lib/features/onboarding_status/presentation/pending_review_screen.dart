import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/status_screen.dart';
import '../../auth/presentation/auth_controller.dart';

class PendingReviewScreen extends ConsumerWidget {
  const PendingReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      icon: Icons.hourglass_top,
      title: 'Application Under Review',
      message:
          'Your technician application has been submitted and is being '
          'reviewed by CalServices. You will be able to access the app once '
          'your application is approved.',
      onLogout: () => ref.read(authControllerProvider.notifier).logout(),
    );
  }
}
