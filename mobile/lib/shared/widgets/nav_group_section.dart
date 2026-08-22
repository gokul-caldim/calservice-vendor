import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A styled, expandable group of navigation items — the mobile equivalent
/// of a collapsible sidebar section on web (e.g. "MY WORK", "PROFILE").
class NavGroupSection extends StatelessWidget {
  const NavGroupSection({
    super.key,
    required this.title,
    required this.children,
    this.initiallyExpanded = true,
  });

  final String title;
  final List<Widget> children;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 2),
          childrenPadding: const EdgeInsets.only(bottom: AppSpacing.sm),
          title: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: AppColors.textMuted,
            ),
          ),
          children: children,
        ),
      ),
    );
  }
}
