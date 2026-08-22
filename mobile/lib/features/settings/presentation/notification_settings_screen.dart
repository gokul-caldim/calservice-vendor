import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_theme.dart';
import '../data/notification_settings_repository.dart';
import '../domain/notification_preferences.dart';
import 'providers/notification_settings_providers.dart';
import 'widgets/settings_section_card.dart';
import 'widgets/toggle_row.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  NotificationPreferences? _draft;
  bool _isSaving = false;
  String? _error;
  String? _success;

  @override
  Widget build(BuildContext context) {
    final savedAsync = ref.watch(notificationSettingsProvider);

    ref.listen(notificationSettingsProvider, (previous, next) {
      if (_draft == null && next.hasValue) {
        setState(() => _draft = next.value);
      }
    });
    final draft = _draft ?? savedAsync.valueOrNull ?? NotificationPreferences.defaults;

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: [
          SettingsSectionCard(
            icon: Icons.campaign_outlined,
            title: 'Notification Alerts & Communication Channels',
            subtitle: 'Configure operational alerts and authorized delivery channels.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) _Banner(message: _error!, isError: true),
                if (_success != null) _Banner(message: _success!, isError: false),
                if (_error != null || _success != null) const SizedBox(height: AppSpacing.sm),

                Text('ACTIVE NOTIFICATION CHANNELS', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 4),
                ToggleRow(
                  title: 'Email Notifications',
                  value: draft.channelEmail,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(channelEmail: v)),
                ),
                ToggleRow(
                  title: 'In-App Popups & Bell',
                  value: draft.channelInApp,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(channelInApp: v)),
                ),
                ToggleRow(
                  title: 'SMS Text Alerts',
                  value: draft.channelSms,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(channelSms: v)),
                ),

                const SizedBox(height: AppSpacing.md),
                const Divider(),
                const SizedBox(height: 4),
                Text('ALERT SUBSCRIPTIONS', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 4),
                ToggleRow(
                  title: 'Field Job Offers & Automatic Assignments',
                  description: 'Alert immediately when new service requests match your skills',
                  value: draft.jobAssignments,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(jobAssignments: v)),
                ),
                ToggleRow(
                  title: 'Security & Critical Account Alerts',
                  description: 'Notices on new logins, password changes, or 2FA updates',
                  value: draft.securityAlerts,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(securityAlerts: v)),
                ),
                ToggleRow(
                  title: 'Company & Operations Announcements',
                  description: 'Broad organizational updates from your workforce administrator',
                  value: draft.workspaceAnnouncements,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(workspaceAnnouncements: v)),
                ),
                ToggleRow(
                  title: 'Weekly Summary & Performance Digest',
                  description: 'Weekly roundup of completed jobs and customer CSAT metrics',
                  value: draft.weeklyDigest,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(weeklyDigest: v)),
                ),
                ToggleRow(
                  title: 'Product & Platform Enhancements',
                  description: 'New feature updates and technical enhancements',
                  value: draft.productUpdates,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(productUpdates: v)),
                ),

                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : () => _save(draft),
                    icon: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.save_outlined, size: 18),
                    label: Text(_isSaving ? 'Saving...' : 'Save Notification Settings'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save(NotificationPreferences draft) async {
    setState(() {
      _isSaving = true;
      _error = null;
      _success = null;
    });
    try {
      final saved = await ref.read(notificationSettingsRepositoryProvider).savePreferences(draft);
      setState(() {
        _draft = saved;
        _success = 'Notification preferences saved.';
      });
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e, fallback: 'Failed to save notification preferences.'));
    } catch (_) {
      setState(() => _error = 'Failed to save notification preferences.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
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
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
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
