import 'package:flutter/material.dart';

/// Status colors ported 1:1 from the web app's StatusBadge.jsx color table,
/// so a given status always means the same color on web and mobile.
class _StatusStyle {
  const _StatusStyle(this.label, this.background, this.foreground, this.dot);

  final String label;
  final Color background;
  final Color foreground;
  final Color dot;
}

const _neutral = _StatusStyle(
  '',
  Color(0xFFF1F5F9),
  Color(0xFF334155),
  Color(0xFF94A3B8),
);

const Map<String, _StatusStyle> _statusStyles = {
  'approved': _StatusStyle(
    'Approved',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'active': _StatusStyle(
    'Active',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'online': _StatusStyle(
    'Online',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'available': _StatusStyle(
    'Available',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'busy': _StatusStyle(
    'Busy (On Job)',
    Color(0xFFEFF6FF),
    Color(0xFF1E40AF),
    Color(0xFF3B82F6),
  ),
  'submitted': _StatusStyle(
    'Submitted',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'under_review': _StatusStyle(
    'Under Review',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'pending': _StatusStyle(
    'Pending',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'offered': _StatusStyle(
    'Offered',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'correction_required': _StatusStyle(
    'Correction Required',
    Color(0xFFFFF7ED),
    Color(0xFF9A3412),
    Color(0xFFF97316),
  ),
  'rejected': _StatusStyle(
    'Rejected',
    Color(0xFFFFF1F2),
    Color(0xFF9F1239),
    Color(0xFFF43F5E),
  ),
  'offline': _StatusStyle(
    'Offline',
    Color(0xFFF1F5F9),
    Color(0xFF334155),
    Color(0xFF94A3B8),
  ),
  'not_started': _StatusStyle(
    'Not Started',
    Color(0xFFF1F5F9),
    Color(0xFF334155),
    Color(0xFF94A3B8),
  ),
  'assigned': _StatusStyle(
    'Assigned',
    Color(0xFFEFF6FF),
    Color(0xFF1E40AF),
    Color(0xFF3B82F6),
  ),
  'accepted': _StatusStyle(
    'Accepted',
    Color(0xFFEEF2FF),
    Color(0xFF3730A3),
    Color(0xFF6366F1),
  ),
  'on_the_way': _StatusStyle(
    'On The Way',
    Color(0xFFF0F9FF),
    Color(0xFF075985),
    Color(0xFF0EA5E9),
  ),
  'arrived': _StatusStyle(
    'Arrived',
    Color(0xFFECFEFF),
    Color(0xFF155E75),
    Color(0xFF06B6D4),
  ),
  'in_progress': _StatusStyle(
    'In Progress',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'completed': _StatusStyle(
    'Completed',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'cancelled': _StatusStyle(
    'Cancelled',
    Color(0xFFF1F5F9),
    Color(0xFF334155),
    Color(0xFF94A3B8),
  ),
  'waiting_for_payment': _StatusStyle(
    'Waiting for Payment',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
  'new_request': _StatusStyle(
    'New Request',
    Color(0xFFF0F9FF),
    Color(0xFF0369A1),
    Color(0xFF0EA5E9),
  ),
  'unassigned': _StatusStyle(
    'Unassigned',
    Color(0xFFFFF7ED),
    Color(0xFFC2410C),
    Color(0xFFF97316),
  ),
  'en_route': _StatusStyle(
    'En Route',
    Color(0xFFF0F9FF),
    Color(0xFF075985),
    Color(0xFF0EA5E9),
  ),
  'collected': _StatusStyle(
    'Cash Collected',
    Color(0xFFECFDF5),
    Color(0xFF065F46),
    Color(0xFF10B981),
  ),
  'confirmed': _StatusStyle(
    'Confirmed',
    Color(0xFFEFF6FF),
    Color(0xFF1E40AF),
    Color(0xFF3B82F6),
  ),
  'pending_collection': _StatusStyle(
    'COD Pending',
    Color(0xFFFFFBEB),
    Color(0xFF92400E),
    Color(0xFFF59E0B),
  ),
};

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.label, this.dense = false});

  final String status;
  final String? label;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final key = status.toLowerCase().trim().replaceAll(RegExp(r'[\s-]+'), '_');
    final style = _statusStyles[key] ?? _neutral;
    final text = label ?? (style.label.isNotEmpty ? style.label : status.replaceAll('_', ' '));

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 6 : 8,
        vertical: dense ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: style.dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            text.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: dense ? 9.5 : 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
              color: style.foreground,
            ),
          ),
        ],
      ),
    );
  }
}
