import '../../../core/utils/json_parsing.dart';

/// Represents a service requested or approved for a technician.
class AdminServiceItem {
  const AdminServiceItem({
    required this.id,
    required this.name,
    this.status = 'pending',
    this.category,
    this.rejectionReason,
  });

  factory AdminServiceItem.fromJson(Map<String, dynamic> json) {
    return AdminServiceItem(
      id: parseInt(json['id']) ?? parseInt(json['service_id']) ?? 0,
      name: parseString(json['name']) ?? parseString(json['service_name']) ?? 'Service',
      status: parseString(json['status'])?.toLowerCase() ?? 'pending',
      category: parseString(json['category']),
      rejectionReason: parseString(json['rejection_reason']),
    );
  }

  final int id;
  final String name;
  final String status;
  final String? category;
  final String? rejectionReason;

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending' || status == 'requested';
}

/// Represents an uploaded identity or trade qualification document.
class AdminDocumentItem {
  const AdminDocumentItem({
    required this.category,
    required this.title,
    this.status = 'pending',
    this.fileUrl,
    this.rejectionReason,
    this.uploadedAt,
  });

  factory AdminDocumentItem.fromJson(Map<String, dynamic> json) {
    return AdminDocumentItem(
      category: parseString(json['category']) ?? 'document',
      title: parseString(json['title']) ?? parseString(json['category']) ?? 'Document',
      status: parseString(json['status'])?.toLowerCase() ?? 'pending',
      fileUrl: parseString(json['file_url']) ?? parseString(json['file']),
      rejectionReason: parseString(json['rejection_reason']),
      uploadedAt: parseDateTime(json['uploaded_at']) ?? parseDateTime(json['created_at']),
    );
  }

  final String category;
  final String title;
  final String status;
  final String? fileUrl;
  final String? rejectionReason;
  final DateTime? uploadedAt;

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending' || status == 'submitted';
  bool get isRejected => status == 'rejected';
}

/// Represents an applicant / technician dossier record returned by
/// `GET /workforce/admin/applications/`.
class AdminApplication {
  const AdminApplication({
    required this.id,
    this.employeeId,
    this.name,
    this.firstName,
    this.lastName,
    this.email,
    this.phone,
    required this.registrationStatus,
    this.isOnline = false,
    this.allRequestedServices = const [],
    this.documentsList = const [],
    this.documentsStatus = const {},
    this.onboardingData = const {},
    this.createdAt,
    this.companyId,
    this.companyName,
  });

  factory AdminApplication.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : null;

    final firstName = parseString(json['first_name']) ?? parseString(userJson?['first_name']);
    final lastName = parseString(json['last_name']) ?? parseString(userJson?['last_name']);

    final nameFromJson = parseString(json['name']) ??
        parseString(json['full_name']) ??
        ((firstName != null || lastName != null)
            ? '${firstName ?? ''} ${lastName ?? ''}'.trim()
            : null);

    final resolvedName = (nameFromJson != null && nameFromJson.isNotEmpty)
        ? nameFromJson
        : parseString(userJson?['username']) ?? 'Technician #${json['id']}';

    final emailFromJson = parseString(json['email']) ?? parseString(userJson?['email']);
    final phoneFromJson = parseString(json['phone']) ??
        parseString(json['mobile_number']) ??
        parseString(userJson?['mobile_number']) ??
        parseString(userJson?['phone']);

    // Parse services
    final servicesRaw = json['all_requested_services'] ?? json['services'] ?? json['requested_services'];
    final List<AdminServiceItem> parsedServices = [];
    if (servicesRaw is List) {
      for (final s in servicesRaw) {
        if (s is Map<String, dynamic>) {
          parsedServices.add(AdminServiceItem.fromJson(s));
        }
      }
    }

    // Parse documents list
    final docsRaw = json['documents'];
    final List<AdminDocumentItem> parsedDocs = [];
    if (docsRaw is List) {
      for (final d in docsRaw) {
        if (d is Map<String, dynamic>) {
          parsedDocs.add(AdminDocumentItem.fromJson(d));
        }
      }
    }

    final isOnlineVal = parseBool(json['is_online']) ||
        (userJson != null && parseBool(userJson['is_online']));

    return AdminApplication(
      id: parseInt(json['id']) ?? 0,
      employeeId: parseString(json['employee_id']),
      name: resolvedName,
      firstName: firstName,
      lastName: lastName,
      email: emailFromJson,
      phone: phoneFromJson,
      registrationStatus:
          parseString(json['registration_status'])?.toLowerCase() ?? 'not_started',
      isOnline: isOnlineVal,
      allRequestedServices: parsedServices,
      documentsList: parsedDocs,
      documentsStatus: json['documents_status'] is Map<String, dynamic>
          ? json['documents_status'] as Map<String, dynamic>
          : const {},
      onboardingData: json['onboarding_data'] is Map<String, dynamic>
          ? json['onboarding_data'] as Map<String, dynamic>
          : const {},
      createdAt: parseDateTime(json['created_at']) ?? parseDateTime(json['applied_date']),
      companyId: parseInt(json['company']),
      companyName: parseString(json['company_name']),
    );
  }

  final int id;
  final String? employeeId;
  final String? name;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? phone;
  final String registrationStatus;
  final bool isOnline;
  final List<AdminServiceItem> allRequestedServices;
  final List<AdminDocumentItem> documentsList;
  final Map<String, dynamic> documentsStatus;
  final Map<String, dynamic> onboardingData;
  final DateTime? createdAt;
  final int? companyId;
  final String? companyName;

  bool get isPending =>
      registrationStatus == 'submitted' || registrationStatus == 'under_review';

  bool get isApproved => registrationStatus == 'approved';

  bool get isCorrectionRequired => registrationStatus == 'correction_required';

  bool get isRejected => registrationStatus == 'rejected';

  String get initial {
    final n = (name ?? '').trim();
    return n.isNotEmpty ? n[0].toUpperCase() : 'T';
  }

  List<AdminServiceItem> get approvedServices =>
      allRequestedServices.where((s) => s.isApproved).toList();

  int get approvedServicesCount => approvedServices.length;

  int get requestedServicesCount => allRequestedServices.length;

  int get uploadedDocumentsCount {
    if (documentsList.isNotEmpty) return documentsList.length;
    final docs = documentsStatus.isNotEmpty
        ? documentsStatus
        : (onboardingData['documents'] is Map<String, dynamic>
            ? onboardingData['documents'] as Map<String, dynamic>
            : const <String, dynamic>{});
    return docs.length;
  }

  /// Counts pending/submitted documents across this application's documents dictionary.
  int get pendingDocumentsCount {
    if (documentsList.isNotEmpty) {
      return documentsList.where((d) => d.isPending).length;
    }
    var count = 0;
    final docs = documentsStatus.isNotEmpty
        ? documentsStatus
        : (onboardingData['documents'] is Map<String, dynamic>
            ? onboardingData['documents'] as Map<String, dynamic>
            : const <String, dynamic>{});

    for (final doc in docs.values) {
      if (doc is Map<String, dynamic>) {
        final st = parseString(doc['status'])?.toLowerCase();
        if (st == 'pending' || st == 'submitted') {
          count++;
        }
      }
    }
    return count;
  }
}
