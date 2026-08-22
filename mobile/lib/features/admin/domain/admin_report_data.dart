import '../../../core/utils/json_parsing.dart';

/// Parameters for querying the reports engine.
class AdminReportParams {
  const AdminReportParams({
    this.type = 'employee',
    this.service = '',
    this.status = '',
    this.employeeId = '',
  });

  final String type;
  final String service;
  final String status;
  final String employeeId;

  Map<String, dynamic> toQueryParameters() {
    final params = <String, dynamic>{'type': type};
    if (service.isNotEmpty) params['service'] = service;
    if (status.isNotEmpty) params['status'] = status;
    if (employeeId.isNotEmpty) params['employee_id'] = employeeId;
    return params;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminReportParams &&
          runtimeType == other.runtimeType &&
          type == other.type &&
          service == other.service &&
          status == other.status &&
          employeeId == other.employeeId;

  @override
  int get hashCode => Object.hash(type, service, status, employeeId);
}

/// Represents the tabular data returned by `GET /workforce/reports/`.
class AdminReportData {
  const AdminReportData({
    required this.reportType,
    required this.totalRecords,
    required this.rows,
  });

  factory AdminReportData.fromJson(Map<String, dynamic> json) {
    final rawRows = json['rows'];
    final rows = rawRows is List
        ? rawRows.whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    return AdminReportData(
      reportType: parseString(json['report_type']) ?? 'employee',
      totalRecords: parseInt(json['total_records']) ?? rows.length,
      rows: rows,
    );
  }

  final String reportType;
  final int totalRecords;
  final List<Map<String, dynamic>> rows;

  List<String> get columns {
    if (rows.isEmpty) return const [];
    return rows.first.keys.toList();
  }
}
