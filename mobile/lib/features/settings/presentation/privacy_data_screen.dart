import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/privacy_repository.dart';

class PrivacyDataScreen extends ConsumerStatefulWidget {
  const PrivacyDataScreen({super.key});

  @override
  ConsumerState<PrivacyDataScreen> createState() => _PrivacyDataScreenState();
}

class _PrivacyDataScreenState extends ConsumerState<PrivacyDataScreen> {
  bool _isExporting = false;
  String? _exportError;
  String? _exportSuccess;

  Future<void> _exportData() async {
    final username = ref.read(authControllerProvider).user?.username ?? 'employee';
    setState(() {
      _isExporting = true;
      _exportError = null;
      _exportSuccess = null;
    });
    try {
      await ref.read(privacyRepositoryProvider).exportAndShareData(username: username);
      setState(() => _exportSuccess = 'Data export ready — choose where to save or send it.');
    } on DioException catch (e) {
      setState(() => _exportError = describeDioError(e, fallback: 'Failed to export your data.'));
    } catch (_) {
      setState(() => _exportError = 'Failed to export your data.');
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  Future<void> _openDeactivateDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => const _DeactivateAccountDialog(),
    );
    if (result == true && mounted) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Data')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.download_outlined, size: 18, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text('Export My Data & Records', style: Theme.of(context).textTheme.titleMedium),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Download a structured export of your verified profile, skills, territory '
                    'locations, and completed jobs history.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (_exportError != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _Banner(message: _exportError!, isError: true),
                  ],
                  if (_exportSuccess != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _Banner(message: _exportSuccess!, isError: false),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _isExporting ? null : _exportData,
                      icon: _isExporting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.download_outlined, size: 18),
                      label: Text(_isExporting ? 'Preparing export...' : 'Export JSON'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: const BorderSide(color: Color(0xFFFECDD3)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFDC2626)),
                      const SizedBox(width: AppSpacing.sm),
                      const Expanded(
                        child: Text(
                          'Account Deactivation',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF9F1239)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Safely deactivate your workforce account. Requires completion of all '
                    'in-progress service requests. In accordance with enterprise audit rules, '
                    'your operational and financial history is archived safely.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _openDeactivateDialog,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                      ),
                      icon: const Icon(Icons.delete_outline_rounded, size: 18),
                      label: const Text('Deactivate Account'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeactivateAccountDialog extends ConsumerStatefulWidget {
  const _DeactivateAccountDialog();

  @override
  ConsumerState<_DeactivateAccountDialog> createState() => _DeactivateAccountDialogState();
}

class _DeactivateAccountDialogState extends ConsumerState<_DeactivateAccountDialog> {
  final _passwordController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_passwordController.text.isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(privacyRepositoryProvider)
          .deactivateAccount(password: _passwordController.text, reason: _reasonController.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e, fallback: 'Account deactivation failed.'));
    } catch (_) {
      setState(() => _error = 'Account deactivation failed.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirm Account Deactivation'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Warning: Account will become inactive immediately.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF9F1239)),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'You will no longer receive automated dispatch offers or be able to clock in for shifts.',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF9F1239)),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              _Banner(message: _error!, isError: true),
            ],
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: 'Confirm Account Password',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _reasonController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Reason for Deactivation (Optional)',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: (_passwordController.text.isNotEmpty && !_isSubmitting) ? _confirm : null,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
          child: Text(_isSubmitting ? 'Deactivating...' : 'Confirm Deactivation'),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFDC2626) : const Color(0xFF059669);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.chip),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, size: 16, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Text(message, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
