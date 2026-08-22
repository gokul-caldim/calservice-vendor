import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _SettingsMenuCard(
            icon: Icons.lock_outline_rounded,
            iconColor: const Color(0xFF2563EB),
            title: 'Account & Security',
            subtitle: 'Password, email, 2FA, sessions & activity',
            onTap: () => context.push('/more/settings/security'),
          ),
          const SizedBox(height: AppSpacing.md),
          _SettingsMenuCard(
            icon: Icons.palette_outlined,
            iconColor: const Color(0xFF7C3AED),
            title: 'Appearance & UI',
            subtitle: 'Theme, accent color, density & accessibility',
            onTap: () => context.push('/more/settings/appearance'),
          ),
          const SizedBox(height: AppSpacing.md),
          _SettingsMenuCard(
            icon: Icons.notifications_outlined,
            iconColor: const Color(0xFFD97706),
            title: 'Notifications',
            subtitle: 'Alert channels & subscription preferences',
            onTap: () => context.push('/more/settings/notifications'),
          ),
          const SizedBox(height: AppSpacing.md),
          _SettingsMenuCard(
            icon: Icons.shield_outlined,
            iconColor: const Color(0xFF059669),
            title: 'Privacy & Data',
            subtitle: 'Export your data or deactivate your account',
            onTap: () => context.push('/more/settings/privacy'),
          ),
        ],
      ),
    );
  }
}

class _SettingsMenuCard extends StatelessWidget {
  const _SettingsMenuCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 22, color: iconColor),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 2),
                    Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
