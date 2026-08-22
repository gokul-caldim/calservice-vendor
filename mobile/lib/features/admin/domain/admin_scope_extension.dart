import '../../../core/utils/json_parsing.dart';

/// Represents a technician scope extension / additional work approval request.
class AdminScopeExtension {
  const AdminScopeExtension({
    required this.id,
    required this.jobId,
    this.requestId,
    this.customerName,
    this.customerPhone,
    this.employeeId,
    this.employeeName,
    required this.title,
    this.description = '',
    this.reason = '',
    this.additionalLaborCost = 0.0,
    this.additionalMaterialsCost = 0.0,
    this.requestedAmount = 0.0,
    this.approvedAmount,
    this.isCritical = false,
    this.requiresSpecialist = false,
    this.requiredSkillName,
    this.specialistTechnicianName,
    required this.status,
    this.createdAt,
  });

  factory AdminScopeExtension.fromJson(Map<String, dynamic> json) {
    // Some endpoints nest or flatten job/customer/cost fields
    final labor = parseDouble(json['additional_labor_cost']) ??
        parseDouble(json['estimated_labor_cost']) ??
        0.0;
    final materials = parseDouble(json['additional_materials_cost']) ??
        parseDouble(json['estimated_materials_cost']) ??
        0.0;
    final requested = parseDouble(json['requested_amount']) ?? (labor + materials);

    return AdminScopeExtension(
      id: parseInt(json['id']) ?? 0,
      jobId: parseInt(json['job_id']) ?? parseInt(json['job']) ?? 0,
      requestId: parseString(json['request_id']),
      customerName: parseString(json['customer_name']),
      customerPhone: parseString(json['customer_phone']),
      employeeId: parseString(json['technician_id']) ??
          parseString(json['employee_id']) ??
          parseString(json['employee_code']),
      employeeName: parseString(json['technician_name']) ??
          parseString(json['employee_name']),
      title: parseString(json['title']) ?? 'Scope Extension',
      description: parseString(json['description']) ?? '',
      reason: parseString(json['reason']) ?? '',
      additionalLaborCost: labor,
      additionalMaterialsCost: materials,
      requestedAmount: requested,
      approvedAmount: parseDouble(json['approved_amount']),
      isCritical: parseBool(json['is_critical']),
      requiresSpecialist: parseBool(json['requires_specialist']),
      requiredSkillName: parseString(json['required_skill_name']),
      specialistTechnicianName: parseString(json['specialist_technician_name']),
      status: parseString(json['status'])?.toUpperCase() ?? 'REQUESTED',
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final int jobId;
  final String? requestId;
  final String? customerName;
  final String? customerPhone;
  final String? employeeId;
  final String? employeeName;
  final String title;
  final String description;
  final String reason;
  final double additionalLaborCost;
  final double additionalMaterialsCost;
  final double requestedAmount;
  final double? approvedAmount;
  final bool isCritical;
  final bool requiresSpecialist;
  final String? requiredSkillName;
  final String? specialistTechnicianName;
  final String status;
  final DateTime? createdAt;

  double get totalCost => additionalLaborCost + additionalMaterialsCost;
  bool get isPending => status == 'REQUESTED' || status == 'PENDING_ASSIGNMENT' || status == 'PENDING';
}
