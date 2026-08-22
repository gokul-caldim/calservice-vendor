import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// A compact brand lockup for the Home AppBar — echoes the icon-badge +
/// company name + "WORKFORCE" tag from the web app's TopHeader.jsx brand
/// corner, scaled down for a mobile app bar. Deliberately carries no
/// action icons (notifications/profile) since those already have their own
/// bottom-nav destinations with persistent indicators.
class BrandBarTitle extends StatelessWidget {
  const BrandBarTitle({super.key, this.companyName});

  final String? companyName;

  @override
  Widget build(BuildContext context) {
    final name = (companyName != null && companyName!.isNotEmpty) ? companyName! : 'CalServices';

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxTextWidth = constraints.maxWidth.isFinite
            ? (constraints.maxWidth - 38).clamp(60.0, double.infinity)
            : 200.0;

        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(7),
              ),
              child: const Icon(Icons.build_rounded, size: 14, color: Colors.white),
            ),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxTextWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  Text(
                    'WORKFORCE',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Colors.blue.shade200,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
