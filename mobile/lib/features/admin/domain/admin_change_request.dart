import '../../../core/utils/json_parsing.dart';

/// Represents a field change request submitted by an employee for admin approval.
class AdminChangeRequest {
  const AdminChangeRequest({
    required this.id,
    this.employeeId,
    this.employeeName,
    required this.fieldName,
    this.fieldLabel,
    this.oldValue,
    this.newValue,
    required this.status,
    this.requestedAt,
    this.decidedAt,
    this.adminNotes,
  });

  factory AdminChangeRequest.fromJson(Map<String, dynamic> json) {
    return AdminChangeRequest(
      id: parseInt(json['id']) ?? 0,
      employeeId: parseString(json['employee_id']) ??
          (json['employee'] is Map ? parseString(json['employee']['employee_id']) : null),
      employeeName: parseString(json['employee_name']) ??
          (json['employee'] is Map
              ? '${parseString(json['employee']['first_name']) ?? ''} ${parseString(json['employee']['last_name']) ?? ''}'.trim()
              : null),
      fieldName: parseString(json['field_name']) ?? parseString(json['field_key']) ?? 'Field',
      fieldLabel: parseString(json['field_label']),
      oldValue: parseString(json['old_value']),
      newValue: parseString(json['new_value']) ?? parseString(json['requested_value']),
      status: parseString(json['status'])?.toLowerCase() ?? 'pending',
      requestedAt: parseDateTime(json['created_at']) ?? parseDateTime(json['requested_at']),
      decidedAt: parseDateTime(json['decided_at']),
      adminNotes: parseString(json['admin_notes']) ?? parseString(json['decision_notes']),
    );
  }

  final int id;
  final String? employeeId;
  final String? employeeName;
  final String fieldName;
  final String? fieldLabel;
  final String? oldValue;
  final String? newValue;
  final String status;
  final DateTime? requestedAt;
  final DateTime? decidedAt;
  final String? adminNotes;

  bool get isPending => status == 'pending' || status == 'submitted';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  String get displayField => fieldLabel ?? fieldName.replaceAll('_', ' ').toUpperCase();
}
