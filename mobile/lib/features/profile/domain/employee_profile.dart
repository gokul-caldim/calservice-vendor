import '../../../core/utils/json_parsing.dart';

class ApprovedService {
  const ApprovedService({required this.id, required this.name});

  factory ApprovedService.fromJson(Map<String, dynamic> json) {
    return ApprovedService(id: json['id'], name: parseString(json['name']) ?? 'Service');
  }

  final dynamic id;
  final String name;
}

/// One entry from `all_requested_services` — every service the technician
/// has ever requested authorization for, whatever its current status.
class RequestedService {
  const RequestedService({
    required this.id,
    required this.name,
    required this.status,
    this.requestType,
    this.categoryName,
    this.rejectionReason,
  });

  factory RequestedService.fromJson(Map<String, dynamic> json) {
    return RequestedService(
      id: json['id'],
      name: parseString(json['name']) ?? 'Service',
      status: parseString(json['status']) ?? 'pending',
      requestType: parseString(json['request_type']) ?? 'add',
      categoryName: parseString(json['category_name']),
      rejectionReason: parseString(json['rejection_reason']),
    );
  }

  final dynamic id;
  final String name;
  final String status; // approved | pending | rejected
  final String? requestType; // add | remove
  final String? categoryName;
  final String? rejectionReason;
}

/// One entry from `documents_status` (backend/workforce_api/serializers.py:125-150).
/// The map is keyed by category; each value has this shape.
class EmployeeDocument {
  const EmployeeDocument({
    required this.category,
    required this.title,
    this.documentNumber,
    this.fileUrl,
    required this.status,
    this.issueDate,
    this.expiryDate,
    this.uploadedAt,
    this.rejectionReason,
  });

  factory EmployeeDocument.fromEntry(String category, Map<String, dynamic> json) {
    return EmployeeDocument(
      category: category,
      title: parseString(json['title']) ?? category.replaceAll('_', ' '),
      documentNumber: parseString(json['document_number']),
      fileUrl: parseString(json['file_url']),
      status: parseString(json['status']) ?? 'approved',
      issueDate: parseString(json['issue_date']),
      expiryDate: parseString(json['expiry_date']),
      uploadedAt: parseDateTime(json['uploaded_at']),
      rejectionReason: parseString(json['rejection_reason']),
    );
  }

  final String category;
  final String title;
  final String? documentNumber;
  final String? fileUrl;
  final String status; // approved | pending | rejected | uploaded | under_review | expired
  final String? issueDate;
  final String? expiryDate;
  final DateTime? uploadedAt;
  final String? rejectionReason;

  bool get hasFile => fileUrl != null && fileUrl!.isNotEmpty;
  bool get isApproved => status.toLowerCase() == 'approved' || status.toLowerCase() == 'verified';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isPending => status.toLowerCase() == 'pending' || status.toLowerCase() == 'uploaded' || status.toLowerCase() == 'under_review';
}

/// Employee Controlled Change Request (backend/workforce_api/serializers.py:797-830).
class EmployeeChangeRequest {
  const EmployeeChangeRequest({
    required this.id,
    required this.fieldName,
    required this.fieldLabel,
    this.oldValue,
    required this.newValue,
    required this.reason,
    required this.status,
    this.adminNotes,
    this.createdAt,
  });

  factory EmployeeChangeRequest.fromJson(Map<String, dynamic> json) {
    return EmployeeChangeRequest(
      id: parseInt(json['id']) ?? 0,
      fieldName: parseString(json['field_name']) ?? '',
      fieldLabel: parseString(json['field_label']) ?? parseString(json['field_name']) ?? '',
      oldValue: parseString(json['old_value']),
      newValue: parseString(json['new_value']) ?? '',
      reason: parseString(json['reason']) ?? '',
      status: parseString(json['status']) ?? 'PENDING',
      adminNotes: parseString(json['admin_notes']),
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final String fieldName;
  final String fieldLabel;
  final String? oldValue;
  final String newValue;
  final String reason;
  final String status; // PENDING | APPROVED | REJECTED | CANCELLED
  final String? adminNotes;
  final DateTime? createdAt;
}

class ControlledFieldsConfig {
  const ControlledFieldsConfig({
    required this.isLocked,
    required this.lockedFields,
  });

  factory ControlledFieldsConfig.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ControlledFieldsConfig(isLocked: true, lockedFields: []);
    }
    final lockedList = json['locked_fields'];
    return ControlledFieldsConfig(
      isLocked: parseBool(json['is_locked']),
      lockedFields: lockedList is List ? lockedList.map((e) => e.toString()).toList() : const [],
    );
  }

  final bool isLocked;
  final List<String> lockedFields;
}

/// Mirrors WorkforceEmployeeProfileSerializer (backend/workforce_api/serializers.py:42-100),
/// returned by GET /workforce/profile/me/ and GET /workforce/onboarding/me/.
class EmployeeProfile {
  const EmployeeProfile({
    this.employeeId,
    required this.firstName,
    required this.lastName,
    this.email,
    this.mobileNumber,
    this.phone,
    this.bio,
    this.timezone,
    this.language,
    this.avatar,
    this.title,
    this.companyName,
    this.department,
    this.state,
    this.country,
    this.hourlyRate,
    this.dateOfBirth,
    required this.isOnline,
    this.liveAvailability,
    required this.registrationStatus,
    required this.approvedServices,
    required this.allRequestedServices,
    required this.documents,
    required this.controlledFields,
  });

  factory EmployeeProfile.fromJson(Map<String, dynamic> json) {
    final approvedJson = json['approved_services'];
    final requestedJson = json['all_requested_services'];
    final docsJson = json['documents_status'];
    final controlledJson = json['controlled_fields'];

    return EmployeeProfile(
      employeeId: parseString(json['employee_id']),
      firstName: parseString(json['first_name']) ?? '',
      lastName: parseString(json['last_name']) ?? '',
      email: parseString(json['email']),
      mobileNumber: parseString(json['mobile_number']),
      phone: parseString(json['phone']),
      bio: parseString(json['bio']),
      timezone: parseString(json['timezone']) ?? 'UTC',
      language: parseString(json['language']) ?? 'en',
      avatar: parseString(json['avatar']),
      title: parseString(json['title']),
      companyName: parseString(json['company_name']),
      department: parseString(json['department']),
      state: parseString(json['state']),
      country: parseString(json['country']),
      hourlyRate: parseDouble(json['hourly_rate']),
      dateOfBirth: parseString(json['date_of_birth']),
      isOnline: parseBool(json['is_online']),
      liveAvailability: parseString(json['live_availability']),
      registrationStatus: parseString(json['registration_status']) ?? 'not_started',
      approvedServices: approvedJson is List
          ? approvedJson.whereType<Map<String, dynamic>>().map(ApprovedService.fromJson).toList()
          : const [],
      allRequestedServices: requestedJson is List
          ? requestedJson.whereType<Map<String, dynamic>>().map(RequestedService.fromJson).toList()
          : const [],
      documents: docsJson is Map<String, dynamic>
          ? docsJson.entries
              .where((e) => e.value is Map<String, dynamic>)
              .map((e) => EmployeeDocument.fromEntry(e.key, e.value as Map<String, dynamic>))
              .toList()
          : const [],
      controlledFields: ControlledFieldsConfig.fromJson(
        controlledJson is Map<String, dynamic> ? controlledJson : null,
      ),
    );
  }

  final String? employeeId;
  final String firstName;
  final String lastName;
  final String? email;
  final String? mobileNumber;
  final String? phone;
  final String? bio;
  final String? timezone;
  final String? language;
  final String? avatar;
  final String? title;
  final String? companyName;
  final String? department;
  final String? state;
  final String? country;
  final double? hourlyRate;
  final String? dateOfBirth;
  final bool isOnline;
  final String? liveAvailability;
  final String registrationStatus;
  final List<ApprovedService> approvedServices;
  final List<RequestedService> allRequestedServices;
  final List<EmployeeDocument> documents;
  final ControlledFieldsConfig controlledFields;

  String get fullName => [firstName, lastName].where((s) => s.isNotEmpty).join(' ');
  String get displayPhone => (phone?.isNotEmpty == true ? phone : mobileNumber) ?? '';
}
