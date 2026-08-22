import '../../../core/utils/json_parsing.dart';

/// Mirrors the response of GET /workforce/time-tracking/
/// (backend/workforce_api/views.py:4090-4157). Display-only in this phase —
/// no clock-in/out actions yet.
class ShiftStatus {
  const ShiftStatus({
    required this.isClockedIn,
    required this.shiftStatus,
    this.clockInTime,
    this.clockOutTime,
    required this.hasActiveJob,
  });

  factory ShiftStatus.fromJson(Map<String, dynamic> json) {
    return ShiftStatus(
      isClockedIn: parseBool(json['is_clocked_in']),
      shiftStatus: parseString(json['shift_status']) ?? 'clocked_out',
      clockInTime: parseDateTime(json['clock_in_time']),
      clockOutTime: parseDateTime(json['clock_out_time']),
      hasActiveJob: parseBool(json['has_active_job']),
    );
  }

  final bool isClockedIn;
  final String shiftStatus; // clocked_in | on_break | clocked_out
  final DateTime? clockInTime;
  final DateTime? clockOutTime;
  final bool hasActiveJob;

  String get displayLabel {
    switch (shiftStatus) {
      case 'clocked_in':
        return 'Clocked In';
      case 'on_break':
        return 'On Break';
      default:
        return 'Off Duty';
    }
  }
}
