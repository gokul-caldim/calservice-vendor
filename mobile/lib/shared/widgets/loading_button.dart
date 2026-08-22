import 'package:flutter/material.dart';

/// A button that shows a spinner and disables itself while its action is
/// in flight — used for every job-action button in this app so a slow
/// network can't be tapped twice and every action gets the same feel.
class LoadingButton extends StatelessWidget {
  const LoadingButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.icon,
    this.filled = true,
    this.style,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;
  final bool filled;
  final ButtonStyle? style;

  @override
  Widget build(BuildContext context) {
    final child = FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isLoading)
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: filled ? Colors.white : null),
            )
          else if (icon != null)
            Icon(icon, size: 18),
          if (isLoading || icon != null) const SizedBox(width: 6),
          Text(
            label,
            maxLines: 1,
          ),
        ],
      ),
    );

    if (filled) {
      return ElevatedButton(onPressed: isLoading ? null : onPressed, style: style, child: child);
    }
    return OutlinedButton(onPressed: isLoading ? null : onPressed, style: style, child: child);
  }
}
