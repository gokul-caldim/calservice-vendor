import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/security_repository.dart';
import '../../domain/security_models.dart';

final twoFactorStatusProvider = FutureProvider.autoDispose<TwoFactorStatus>((ref) async {
  return ref.watch(securityRepositoryProvider).fetch2FAStatus();
});

final activeSessionsProvider = FutureProvider.autoDispose<List<ActiveSession>>((ref) async {
  return ref.watch(securityRepositoryProvider).fetchActiveSessions();
});

final securityLogProvider = FutureProvider.autoDispose<List<SecurityLogEntry>>((ref) async {
  return ref.watch(securityRepositoryProvider).fetchLoginHistory();
});
