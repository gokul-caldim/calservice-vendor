import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../../domain/admin_report_data.dart';
import '../admin_dashboard_providers.dart';
import '../widgets/admin_drawer.dart';

/// Admin Reports & Analytics Suite.
/// Query real database aggregations with multi-dimensional filtering across workforce operations.
class AdminReportsScreen extends ConsumerStatefulWidget {
  const AdminReportsScreen({super.key});

  @override
  ConsumerState<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends ConsumerState<AdminReportsScreen> {
  String _selectedReportType = 'employee';
  final TextEditingController _serviceFilterController = TextEditingController();
  final TextEditingController _statusFilterController = TextEditingController();
  final TextEditingController _empFilterController = TextEditingController();

  AdminReportParams _activeParams = const AdminReportParams(type: 'employee');

  @override
  void dispose() {
    _serviceFilterController.dispose();
    _statusFilterController.dispose();
    _empFilterController.dispose();
    super.dispose();
  }

  void _onReportTypeChanged(String type) {
    setState(() {
      _selectedReportType = type;
      _activeParams = AdminReportParams(
        type: type,
        service: _serviceFilterController.text.trim(),
        status: _statusFilterController.text.trim(),
        employeeId: _empFilterController.text.trim(),
      );
    });
  }

  void _applyQuery() {
    setState(() {
      _activeParams = AdminReportParams(
        type: _selectedReportType,
        service: _serviceFilterController.text.trim(),
        status: _statusFilterController.text.trim(),
        employeeId: _empFilterController.text.trim(),
      );
    });
  }

  Future<void> _exportCSV(AdminReportData data) async {
    if (data.rows.isEmpty) return;

    final columns = data.columns;
    final csvRows = <String>[];
    csvRows.add(columns.join(','));

    for (final row in data.rows) {
      final line = columns.map((col) {
        final val = row[col];
        final str = (val?.toString() ?? '').replaceAll('"', '""');
        return '"$str"';
      }).join(',');
      csvRows.add(line);
    }

    final csvContent = csvRows.join('\n');
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/workforce_${_selectedReportType}_report.csv');
      await file.writeAsString(csvContent);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'text/csv')],
          subject: 'CalServices Workforce ${_selectedReportType.toUpperCase()} Report',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Export failed: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final reportAsync = ref.watch(adminReportProvider(_activeParams));

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminReportProvider(_activeParams));
        },
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // ── Top Header Card ──────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.bar_chart_rounded,
                          color: Color(0xFF4F46E5),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Workforce Enterprise Reporting Suite',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Query real database aggregations with multi-dimensional filtering across workforce operations.',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF64748B),
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      reportAsync.maybeWhen(
                        data: (reportData) => FilledButton.icon(
                          onPressed: reportData.rows.isEmpty
                              ? null
                              : () => _exportCSV(reportData),
                          icon: const Icon(Icons.download_rounded, size: 15),
                          label: const Text('Export CSV'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF059669),
                            visualDensity: VisualDensity.compact,
                            textStyle: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        orElse: () => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Report Type Selector Tabs ────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _ReportTypeChip(
                          label: 'Employee Roster',
                          isSelected: _selectedReportType == 'employee',
                          onTap: () => _onReportTypeChanged('employee'),
                        ),
                        const SizedBox(width: 8),
                        _ReportTypeChip(
                          label: 'Field Jobs',
                          isSelected: _selectedReportType == 'job',
                          onTap: () => _onReportTypeChanged('job'),
                        ),
                        const SizedBox(width: 8),
                        _ReportTypeChip(
                          label: 'Payroll Summary',
                          isSelected: _selectedReportType == 'payroll',
                          onTap: () => _onReportTypeChanged('payroll'),
                        ),
                        const SizedBox(width: 8),
                        _ReportTypeChip(
                          label: 'Compliance Records',
                          isSelected: _selectedReportType == 'compliance',
                          onTap: () => _onReportTypeChanged('compliance'),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 20),

                  // Filter Controls
                  const Row(
                    children: [
                      Icon(Icons.filter_list_rounded,
                          size: 15, color: Color(0xFF475569)),
                      SizedBox(width: 6),
                      Text(
                        'Query Filters',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_selectedReportType == 'job') ...[
                    TextField(
                      controller: _serviceFilterController,
                      decoration: const InputDecoration(
                        labelText: 'Service Category Filter',
                        hintText: 'e.g. Electrician, Plumbing...',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _statusFilterController,
                          decoration: const InputDecoration(
                            labelText: 'Status Filter',
                            hintText: 'e.g. active, completed...',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton.icon(
                        onPressed: _applyQuery,
                        icon: const Icon(Icons.refresh_rounded, size: 15),
                        label: const Text('Apply Query'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0F172A),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Dynamic Report Results ───────────────────────────────────────
            reportAsync.when(
              loading: () => Container(
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Executing database aggregation query...',
                        style:
                            TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              ),
              error: (err, _) => Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 28, color: Color(0xFFDC2626)),
                    const SizedBox(height: 8),
                    Text(
                      'Failed to execute report query: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF991B1B)),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: () =>
                          ref.invalidate(adminReportProvider(_activeParams)),
                      child: const Text('Retry Query'),
                    ),
                  ],
                ),
              ),
              data: (reportData) {
                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Report Summary Bar
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md, vertical: 10),
                        decoration: const BoxDecoration(
                          color: Color(0xFFF8FAFC),
                          borderRadius:
                              BorderRadius.vertical(top: Radius.circular(10)),
                          border: Border(
                              bottom: BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                '${reportData.reportType.toUpperCase()} REPORT (${reportData.totalRecords} RECORDS)',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1E293B),
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'System Report',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  fontFamily: 'monospace',
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Rows View
                      if (reportData.rows.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(AppSpacing.xl),
                          child: EmptyState(
                            icon: Icons.description_outlined,
                            title: 'No Matching Records',
                            message:
                                'No records found matching this query filter.',
                          ),
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: reportData.rows.length,
                          separatorBuilder: (_, _) =>
                              const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          itemBuilder: (ctx, idx) {
                            final row = reportData.rows[idx];
                            return _ReportRowCard(
                              row: row,
                              rowIndex: idx + 1,
                              reportType: reportData.reportType,
                            );
                          },
                        ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

// ── Report Type Chip Widget ──────────────────────────────────────────────────
class _ReportTypeChip extends StatelessWidget {
  const _ReportTypeChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x204F46E5),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF334155),
          ),
        ),
      ),
    );
  }
}

// ── Report Row Card Widget ───────────────────────────────────────────────────
class _ReportRowCard extends StatelessWidget {
  const _ReportRowCard({
    required this.row,
    required this.rowIndex,
    required this.reportType,
  });

  final Map<String, dynamic> row;
  final int rowIndex;
  final String reportType;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Center(
                  child: Text(
                    '$rowIndex',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _getTitle(row),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              if (row.containsKey('status')) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    row['status']?.toString().toUpperCase() ?? '',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: row.entries
                .where((e) =>
                    e.key != 'status' &&
                    e.key != 'name' &&
                    e.key != 'request_id' &&
                    e.key != 'employee_name')
                .map((e) {
              final formattedKey =
                  e.key.replaceAll('_', ' ').toLowerCase();
              final formattedVal = e.value == true
                  ? 'Yes'
                  : e.value == false
                      ? 'No'
                      : e.value?.toString() ?? '—';

              return Text(
                '$formattedKey: $formattedVal',
                style: const TextStyle(
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: Color(0xFF475569),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  String _getTitle(Map<String, dynamic> row) {
    if (row.containsKey('name')) {
      final name = row['name']?.toString() ?? '';
      final empId = row['employee_id']?.toString();
      return empId != null ? '$name ($empId)' : name;
    }
    if (row.containsKey('request_id')) {
      final reqId = row['request_id']?.toString() ?? '';
      final cat = row['service_category']?.toString() ?? '';
      return cat.isNotEmpty ? '$reqId • $cat' : reqId;
    }
    if (row.containsKey('employee_name')) {
      final empName = row['employee_name']?.toString() ?? '';
      final period = row['pay_period']?.toString() ?? '';
      return period.isNotEmpty ? '$empName • $period' : empName;
    }
    if (row.containsKey('requirement')) {
      return row['requirement']?.toString() ?? 'Compliance Record';
    }
    return 'Record #$rowIndex';
  }
}
