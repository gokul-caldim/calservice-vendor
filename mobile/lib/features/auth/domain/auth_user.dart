/// Mirrors the user object returned by `/auth/login/` and `/auth/me/`.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.username,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.companyId,
    required this.companyName,
    required this.isSuperuser,
    required this.employeeId,
    required this.registrationStatus,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as int,
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      role: (json['role'] as String? ?? 'employee').toLowerCase(),
      companyId: (json['company'] as num?)?.toInt(),
      companyName: json['company_name'] as String?,
      isSuperuser: json['is_superuser'] as bool? ?? false,
      employeeId: json['employee_id'] as String?,
      registrationStatus:
          (json['registration_status'] as String?) ?? 'not_started',
    );
  }

  final int id;
  final String username;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final int? companyId;
  final String? companyName;
  final bool isSuperuser;
  final String? employeeId;
  final String registrationStatus;

  /// The backend already normalizes `role` to "employee" for anyone with an
  /// Employee profile who isn't admin/manager, so a plain equality check is
  /// authoritative here — see accounts/views.py.
  bool get isEmployee => role == 'employee';

  /// True for Platform Admins (superuser/staff) and Vendor Admins/Managers.
  bool get isAdmin =>
      role == 'admin' ||
      role == 'manager' ||
      role == 'company_admin' ||
      role == 'vendor_admin' ||
      isSuperuser;

  String get displayName => firstName.isNotEmpty ? firstName : username;
}
