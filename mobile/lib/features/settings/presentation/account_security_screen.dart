import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../data/security_repository.dart';
import '../domain/security_models.dart';
import 'providers/security_providers.dart';
import 'widgets/settings_section_card.dart';

class AccountSecurityScreen extends StatelessWidget {
  const AccountSecurityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Account & Security')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: const [
          _ChangePasswordCard(),
          SizedBox(height: AppSpacing.md),
          _UpdateEmailCard(),
          SizedBox(height: AppSpacing.md),
          _TwoFactorCard(),
          SizedBox(height: AppSpacing.md),
          _ActiveSessionsCard(),
          SizedBox(height: AppSpacing.md),
          _SecurityLogCard(),
        ],
      ),
    );
  }
}

// ── Change Password ──────────────────────────────────────────────────────

class _ChangePasswordCard extends ConsumerStatefulWidget {
  const _ChangePasswordCard();

  @override
  ConsumerState<_ChangePasswordCard> createState() => _ChangePasswordCardState();
}

class _ChangePasswordCardState extends ConsumerState<_ChangePasswordCard> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool get _isValid =>
      _currentController.text.isNotEmpty &&
      _newController.text.length >= 6 &&
      _newController.text == _confirmController.text;

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      await ref
          .read(securityRepositoryProvider)
          .changePassword(
            currentPassword: _currentController.text,
            newPassword: _newController.text,
            confirmPassword: _confirmController.text,
          );
      _currentController.clear();
      _newController.clear();
      _confirmController.clear();
      setState(() => _success = 'Password updated successfully.');
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e, fallback: 'Failed to update password.'));
    } catch (_) {
      setState(() => _error = 'Failed to update password.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSectionCard(
      icon: Icons.vpn_key_outlined,
      title: 'Change Account Password',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) _InlineBanner(message: _error!, isError: true),
          if (_success != null) _InlineBanner(message: _success!, isError: false),
          if (_error != null || _success != null) const SizedBox(height: AppSpacing.sm),
          _PasswordField(
            label: 'Current Password',
            controller: _currentController,
            obscure: _obscureCurrent,
            onToggleObscure: () => setState(() => _obscureCurrent = !_obscureCurrent),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PasswordField(
            label: 'New Password (min 6 chars)',
            controller: _newController,
            obscure: _obscureNew,
            onToggleObscure: () => setState(() => _obscureNew = !_obscureNew),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PasswordField(
            label: 'Confirm New Password',
            controller: _confirmController,
            obscure: _obscureConfirm,
            onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_isValid && !_isSubmitting) ? _submit : null,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.save_outlined, size: 18),
              label: Text(_isSubmitting ? 'Updating...' : 'Update Password'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Update Email ──────────────────────────────────────────────────────────

class _UpdateEmailCard extends ConsumerStatefulWidget {
  const _UpdateEmailCard();

  @override
  ConsumerState<_UpdateEmailCard> createState() => _UpdateEmailCardState();
}

class _UpdateEmailCardState extends ConsumerState<_UpdateEmailCard> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool get _isValid =>
      _emailController.text.contains('@') &&
      _emailController.text.contains('.') &&
      _passwordController.text.isNotEmpty;

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      final message = await ref
          .read(securityRepositoryProvider)
          .changeEmail(currentPassword: _passwordController.text, newEmail: _emailController.text.trim());
      _emailController.clear();
      _passwordController.clear();
      setState(() => _success = message);
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e, fallback: 'Failed to update email address.'));
    } catch (_) {
      setState(() => _error = 'Failed to update email address.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSectionCard(
      icon: Icons.mail_outline_rounded,
      title: 'Update Email Address',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) _InlineBanner(message: _error!, isError: true),
          if (_success != null) _InlineBanner(message: _success!, isError: false),
          if (_error != null || _success != null) const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'New Email Address',
              hintText: 'new.email@example.com',
              prefixIcon: Icon(Icons.alternate_email_rounded),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PasswordField(
            label: 'Confirm With Current Password',
            controller: _passwordController,
            obscure: _obscurePassword,
            onToggleObscure: () => setState(() => _obscurePassword = !_obscurePassword),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_isValid && !_isSubmitting) ? _submit : null,
              child: Text(_isSubmitting ? 'Updating...' : 'Update Email'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Two-Factor Authentication ──────────────────────────────────────────────

class _TwoFactorCard extends ConsumerStatefulWidget {
  const _TwoFactorCard();

  @override
  ConsumerState<_TwoFactorCard> createState() => _TwoFactorCardState();
}

class _TwoFactorCardState extends ConsumerState<_TwoFactorCard> {
  bool _isToggling = false;

  Future<void> _confirmToggle(bool currentlyEnabled) async {
    final action = currentlyEnabled ? 'disable' : 'enable';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${currentlyEnabled ? 'Disable' : 'Enable'} Two-Factor Authentication?'),
        content: Text(
          currentlyEnabled
              ? 'You will no longer be asked for an OTP verification code when signing in.'
              : 'You will be asked for an OTP verification code when signing in to your workforce account.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(action[0].toUpperCase() + action.substring(1)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isToggling = true);
    try {
      final (_, message) = await ref.read(securityRepositoryProvider).toggle2FA();
      ref.invalidate(twoFactorStatusProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeDioError(e, fallback: 'Failed to update 2FA status.'))),
        );
      }
    } finally {
      if (mounted) setState(() => _isToggling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(twoFactorStatusProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: AsyncValueView<TwoFactorStatus>(
          value: statusAsync,
          onRetry: () => ref.invalidate(twoFactorStatusProvider),
          compact: true,
          builder: (context, status) {
            return Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.shield_outlined, size: 18, color: Color(0xFF059669)),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              'Two-Factor Authentication (2FA)',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Padding(
                        padding: const EdgeInsets.only(left: 26),
                        child: Text(
                          'Require OTP verification code when signing in to your workforce account.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                _isToggling
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : OutlinedButton(
                        onPressed: () => _confirmToggle(status.enabled),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 40),
                          foregroundColor: status.enabled ? const Color(0xFF059669) : null,
                          side: BorderSide(
                            color: status.enabled ? const Color(0xFF059669) : AppColors.border,
                          ),
                        ),
                        child: Text(status.enabled ? 'ENABLED ✓' : 'ENABLE 2FA'),
                      ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Active Device Sessions ──────────────────────────────────────────────────

class _ActiveSessionsCard extends ConsumerWidget {
  const _ActiveSessionsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(activeSessionsProvider);

    return SettingsSectionCard(
      icon: Icons.devices_other_outlined,
      title: 'Active Device Sessions',
      child: AsyncValueView<List<ActiveSession>>(
        value: sessionsAsync,
        onRetry: () => ref.invalidate(activeSessionsProvider),
        compact: true,
        builder: (context, sessions) {
          if (sessions.isEmpty) {
            return const EmptyState(
              icon: Icons.devices_other_outlined,
              title: 'No active session data',
              compact: true,
            );
          }
          return Column(
            children: [for (final session in sessions) _SessionTile(session: session)],
          );
        },
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.session});

  final ActiveSession session;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppRadius.chip),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(
            Icons.smartphone_rounded,
            size: 20,
            color: session.isCurrent ? const Color(0xFF059669) : AppColors.textMuted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.isCurrent ? 'This Device' : 'Session',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  'IP: ${session.ipAddress}',
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontFamily: 'monospace'),
                ),
                Text(
                  session.userAgent,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (session.isCurrent)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'CURRENT SESSION',
                style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Recent Security & Presence Logs ──────────────────────────────────────

class _SecurityLogCard extends ConsumerWidget {
  const _SecurityLogCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logAsync = ref.watch(securityLogProvider);

    return SettingsSectionCard(
      icon: Icons.history_rounded,
      title: 'Recent Security & Presence Logs',
      child: AsyncValueView<List<SecurityLogEntry>>(
        value: logAsync,
        onRetry: () => ref.invalidate(securityLogProvider),
        compact: true,
        builder: (context, entries) {
          if (entries.isEmpty) {
            return const EmptyState(
              icon: Icons.history_rounded,
              title: 'No recent security history found.',
              compact: true,
            );
          }
          return Column(
            children: [
              for (var i = 0; i < entries.length; i++)
                _LogTile(entry: entries[i], isLast: i == entries.length - 1),
            ],
          );
        },
      ),
    );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.entry, required this.isLast});

  final SecurityLogEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              entry.event,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (entry.timestamp != null)
                Text(
                  _formatTimestamp(entry.timestamp!),
                  style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                ),
              Text(
                'IP: ${entry.ip}',
                style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontFamily: 'monospace'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _twoDigits(int n) => n.toString().padLeft(2, '0');

String _formatTimestamp(DateTime dt) {
  return '${dt.day}/${dt.month}/${dt.year} ${_twoDigits(dt.hour)}:${_twoDigits(dt.minute)}';
}

// ── Shared small widgets ──────────────────────────────────────────────────

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.label,
    required this.controller,
    required this.obscure,
    required this.onToggleObscure,
    required this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final bool obscure;
  final VoidCallback onToggleObscure;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        hintText: '••••••••',
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
          onPressed: onToggleObscure,
        ),
      ),
    );
  }
}

class _InlineBanner extends StatelessWidget {
  const _InlineBanner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFDC2626) : const Color(0xFF059669);
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.chip),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
            size: 16,
            color: color,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(message, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
