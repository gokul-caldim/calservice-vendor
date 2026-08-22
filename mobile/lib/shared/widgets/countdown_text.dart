import 'dart:async';

import 'package:flutter/material.dart';

/// A small live-updating "mm:ss remaining" label. Used for offer expiry and
/// cancellation-window countdowns — the one place in this phase where a
/// ticking update is genuinely useful information, not just decoration.
class CountdownText extends StatefulWidget {
  const CountdownText({
    super.key,
    required this.target,
    required this.style,
    this.expiredText = 'Expired',
  });

  final DateTime target;
  final TextStyle style;
  final String expiredText;

  @override
  State<CountdownText> createState() => _CountdownTextState();
}

class _CountdownTextState extends State<CountdownText> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.target.difference(DateTime.now());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final next = widget.target.difference(DateTime.now());
      setState(() => _remaining = next);
      if (next.isNegative) {
        _timer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_remaining.isNegative) {
      return Text(widget.expiredText, style: widget.style);
    }
    final minutes = _remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = _remaining.inSeconds.remainder(60).toString().padLeft(2, '0');
    return Text('$minutes:$seconds', style: widget.style);
  }
}
