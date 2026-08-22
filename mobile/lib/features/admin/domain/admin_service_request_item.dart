import '../../../core/utils/json_parsing.dart';

/// Represents a technician's pending service authorization/removal request.
class AdminServiceRequestItem {
  const AdminServiceRequestItem({
    required this.employeeId,
    this.employeeCode,
    required this.employeeName,
    required this.serviceId,
    required this.serviceName,
    required this.requestType,
    this.requestedAt,
  });

  factory AdminServiceRequestItem.fromJson(Map<String, dynamic> json) {
    return AdminServiceRequestItem(
      employeeId: parseInt(json['employee_id']) ?? 0,
      employeeCode: parseString(json['employee_code']),
      employeeName: parseString(json['employee_name']) ?? 'Technician',
      serviceId: parseInt(json['service_id']) ?? 0,
      serviceName: parseString(json['service_name']) ?? 'Service',
      requestType: parseString(json['request_type'])?.toLowerCase() ?? 'add',
      requestedAt: parseDateTime(json['requested_at']),
    );
  }

  final int employeeId;
  final String? employeeCode;
  final String employeeName;
  final int serviceId;
  final String serviceName;
  final String requestType;
  final DateTime? requestedAt;

  bool get isRemoval => requestType == 'remove';
}
