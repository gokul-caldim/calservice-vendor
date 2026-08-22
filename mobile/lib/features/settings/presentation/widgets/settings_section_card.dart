import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// A titled card used consistently across every Settings sub-screen —
/// icon + title (+ optional subtitle) header, then arbitrary content.
class SettingsSectionCard extends StatelessWidget {
  const SettingsSectionCard({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.child,
    this.iconColor,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget child;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: iconColor ?? AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
              ],
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 3),
              Padding(
                padding: const EdgeInsets.only(left: 26),
                child: Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            child,
          ],
        ),
      ),
    );
  }
}
