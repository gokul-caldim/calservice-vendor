import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// One row inside a NavGroupSection — icon, label, chevron. 48dp+ touch
/// target via ListTile's default sizing plus extra vertical padding.
class NavItemTile extends StatelessWidget {
  const NavItemTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      minVerticalPadding: 14,
      leading: Icon(icon, size: 20, color: iconColor ?? AppColors.textSecondary),
      title: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      trailing: Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
    );
  }
}
