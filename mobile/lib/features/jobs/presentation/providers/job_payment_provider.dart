import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/job_actions_repository.dart';
import '../../domain/job_payment.dart';

final jobPaymentProvider = FutureProvider.autoDispose.family<JobPaymentInfo, int>((
  ref,
  jobId,
) async {
  return ref.watch(jobActionsRepositoryProvider).fetchPayment(jobId);
});
