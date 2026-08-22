import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// A tappable title+description row with a trailing Switch — used for
/// every notification/appearance boolean preference so they all look and
/// behave the same way.
class ToggleRow extends StatelessWidget {
  const ToggleRow({
    super.key,
    required this.title,
    this.description,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String? description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.chip),
      onTap: () => onChanged(!value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                  if (description != null) ...[
                    const SizedBox(height: 2),
                    Text(description!, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}
