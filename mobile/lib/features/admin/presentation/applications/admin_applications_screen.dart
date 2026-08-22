import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../../data/admin_dashboard_api.dart';
import '../../domain/admin_application.dart';
import '../../domain/admin_change_request.dart';
import '../admin_dashboard_providers.dart';
import '../widgets/admin_drawer.dart';

/// Admin Applications & Verification Queue Screen.
/// Contains two tabs:
/// 1. Onboarding Applications (with status & service filters, dossier cards)
/// 2. Profile Change Requests (with decision modal for field modifications)
class AdminApplicationsScreen extends ConsumerStatefulWidget {
  const AdminApplicationsScreen({super.key, this.statusFilter});

  final String? statusFilter;

  @override
  ConsumerState<AdminApplicationsScreen> createState() =>
      _AdminApplicationsScreenState();
}

class _AdminApplicationsScreenState
    extends ConsumerState<AdminApplicationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  String _searchTerm = '';
  late String _statusFilter;
  String _selectedService = 'ALL';
  int _currentPage = 1;
  static const int _pageSize = 10;

  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _statusFilter = widget.statusFilter?.toLowerCase() ?? 'all';
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final applicationsAsync = ref.watch(adminApplicationsListProvider(null));
    final changeRequestsAsync = ref.watch(adminChangeRequestsProvider);

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: Column(
        children: [
          // ── Header Title & Subtitle ────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.assignment_ind_rounded,
                        color: Color(0xFF2563EB),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Employee Applications & Verification Queue',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Inspect identity dossiers, audit trade qualifications, and review controlled field change requests',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Tab Bar with Counts ──────────────────────────────────────
                TabBar(
                  controller: _tabController,
                  labelColor: const Color(0xFF2563EB),
                  unselectedLabelColor: const Color(0xFF64748B),
                  indicatorColor: const Color(0xFF2563EB),
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                  tabs: [
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Applications'),
                          const SizedBox(width: 6),
                          applicationsAsync.maybeWhen(
                            data: (list) => _countBadge(list.length),
                            orElse: () => const SizedBox.shrink(),
                          ),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Change Requests'),
                          const SizedBox(width: 6),
                          changeRequestsAsync.maybeWhen(
                            data: (list) => _countBadge(list.where((c) => c.isPending).length,
                                color: const Color(0xFFFEF3C7), textColor: const Color(0xFF92400E)),
                            orElse: () => const SizedBox.shrink(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Tab Views ──────────────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Onboarding Applications
                _buildApplicationsTab(applicationsAsync),

                // Tab 2: Profile Change Requests
                _buildChangeRequestsTab(changeRequestsAsync),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _countBadge(int count, {Color? color, Color? textColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
      decoration: BoxDecoration(
        color: color ?? const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: textColor ?? const Color(0xFF2563EB),
        ),
      ),
    );
  }

  // ── Tab 1: Applications ────────────────────────────────────────────────────
  Widget _buildApplicationsTab(AsyncValue<List<AdminApplication>> applicationsAsync) {
    return applicationsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Failed to load applications: $err'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref.invalidate(adminApplicationsListProvider(null)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (allApps) {
        // Collect unique services for bottom sheet filter
        final uniqueServices = <String>{};
        for (final app in allApps) {
          for (final s in app.allRequestedServices) {
            if (s.name.isNotEmpty) uniqueServices.add(s.name);
          }
        }
        final serviceList = uniqueServices.toList()..sort();

        // Apply filters
        final filtered = allApps.where((app) {
          final term = _searchTerm.toLowerCase().trim();
          final name = (app.name ?? '').toLowerCase();
          final empId = (app.employeeId ?? '').toLowerCase();
          final phone = (app.phone ?? '').toLowerCase();
          final matchesSearch = term.isEmpty ||
              name.contains(term) ||
              empId.contains(term) ||
              phone.contains(term);

          // Status filter
          bool matchesStatus = true;
          final st = _statusFilter.toLowerCase();
          if (st == 'pending' || st == 'submitted') {
            matchesStatus = app.isPending;
          } else if (st == 'under_review') {
            matchesStatus = app.registrationStatus == 'under_review';
          } else if (st == 'correction_required') {
            matchesStatus = app.isCorrectionRequired;
          } else if (st == 'approved') {
            matchesStatus = app.isApproved;
          } else if (st == 'rejected') {
            matchesStatus = app.isRejected;
          }

          // Service filter
          bool matchesService = true;
          if (_selectedService != 'ALL') {
            matchesService = app.allRequestedServices.any((s) => s.name == _selectedService);
          }

          return matchesSearch && matchesStatus && matchesService;
        }).toList();

        final totalCount = filtered.length;
        final totalPages = (totalCount / _pageSize).ceil().clamp(1, 9999);
        final safePage = _currentPage.clamp(1, totalPages);
        final startIndex = (safePage - 1) * _pageSize;
        final endIndex = (startIndex + _pageSize).clamp(0, totalCount);
        final pageItems = startIndex < totalCount
            ? filtered.sublist(startIndex, endIndex)
            : <AdminApplication>[];

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminApplicationsListProvider(null));
            await ref.read(adminApplicationsListProvider(null).future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              // Search Field
              TextField(
                controller: _searchController,
                onChanged: (val) => setState(() {
                  _searchTerm = val;
                  _currentPage = 1;
                }),
                decoration: InputDecoration(
                  hintText: 'Search candidate name, ID, or phone...',
                  hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                  prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                  suffixIcon: _searchTerm.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchTerm = '';
                              _currentPage = 1;
                            });
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.input),
                    borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.input),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),

              // Filter Controls (Status & Service Selector)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _statusChip('All', _statusFilter == 'all', () {
                      setState(() {
                        _statusFilter = 'all';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 6),
                    _statusChip('Pending', _statusFilter == 'pending', () {
                      setState(() {
                        _statusFilter = 'pending';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 6),
                    _statusChip('Under Review', _statusFilter == 'under_review', () {
                      setState(() {
                        _statusFilter = 'under_review';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 6),
                    _statusChip('Correction Required', _statusFilter == 'correction_required', () {
                      setState(() {
                        _statusFilter = 'correction_required';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 6),
                    _statusChip('Approved', _statusFilter == 'approved', () {
                      setState(() {
                        _statusFilter = 'approved';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 6),
                    _statusChip('Rejected', _statusFilter == 'rejected', () {
                      setState(() {
                        _statusFilter = 'rejected';
                        _currentPage = 1;
                      });
                    }),
                    const SizedBox(width: 12),
                    // Service Selector Button
                    OutlinedButton.icon(
                      onPressed: () => _openServiceSelectorSheet(serviceList),
                      icon: const Icon(Icons.filter_list_rounded, size: 16),
                      label: Text(
                        _selectedService == 'ALL' ? 'Filter by Service' : _selectedService,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: _selectedService != 'ALL'
                            ? const Color(0xFFEFF6FF)
                            : Colors.white,
                        side: BorderSide(
                          color: _selectedService != 'ALL'
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFCBD5E1),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // Application Cards
              if (filtered.isEmpty)
                const EmptyState(
                  icon: Icons.folder_open_rounded,
                  title: 'No Applications Match Filters',
                  message: 'Try changing the status or service filter.',
                )
              else ...[
                ...pageItems.map((app) => _AdminApplicationCard(
                      app: app,
                      onReviewDossier: () =>
                          context.push('/admin/applications/${app.id}'),
                    )),

                const SizedBox(height: AppSpacing.md),

                // Pagination Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: safePage > 1
                            ? () => setState(() => _currentPage = safePage - 1)
                            : null,
                        icon: const Icon(Icons.chevron_left_rounded, size: 18),
                        label: const Text('Prev'),
                        style: OutlinedButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                      ),
                      Text(
                        'Page $safePage of $totalPages ($totalCount)',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF475569),
                        ),
                      ),
                      OutlinedButton(
                        onPressed: safePage < totalPages
                            ? () => setState(() => _currentPage = safePage + 1)
                            : null,
                        style: OutlinedButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Next'),
                            SizedBox(width: 4),
                            Icon(Icons.chevron_right_rounded, size: 18),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        );
      },
    );
  }

  Widget _statusChip(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  void _openServiceSelectorSheet(List<String> services) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.85,
        minChildSize: 0.35,
        expand: false,
        builder: (sheetCtx, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Filter by Service',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  if (_selectedService != 'ALL')
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _selectedService = 'ALL';
                          _currentPage = 1;
                        });
                        Navigator.of(ctx).pop();
                      },
                      child: const Text('Clear Filter'),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                itemCount: services.length + 1,
                itemBuilder: (context, idx) {
                  if (idx == 0) {
                    return ListTile(
                      dense: true,
                      title: const Text('All Services', style: TextStyle(fontWeight: FontWeight.w700)),
                      trailing: _selectedService == 'ALL'
                          ? const Icon(Icons.check_rounded, color: Color(0xFF2563EB))
                          : null,
                      onTap: () {
                        setState(() {
                          _selectedService = 'ALL';
                          _currentPage = 1;
                        });
                        Navigator.of(ctx).pop();
                      },
                    );
                  }
                  final serviceName = services[idx - 1];
                  final isSel = _selectedService == serviceName;
                  return ListTile(
                    dense: true,
                    title: Text(serviceName, style: TextStyle(fontWeight: isSel ? FontWeight.w800 : FontWeight.w500)),
                    trailing: isSel
                        ? const Icon(Icons.check_rounded, color: Color(0xFF2563EB))
                        : null,
                    onTap: () {
                      setState(() {
                        _selectedService = serviceName;
                        _currentPage = 1;
                      });
                      Navigator.of(ctx).pop();
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab 2: Profile Change Requests ─────────────────────────────────────────
  Widget _buildChangeRequestsTab(AsyncValue<List<AdminChangeRequest>> changeRequestsAsync) {
    return changeRequestsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Failed to load change requests: $err'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref.invalidate(adminChangeRequestsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (changeRequests) {
        if (changeRequests.isEmpty) {
          return const EmptyState(
            icon: Icons.check_circle_outline_rounded,
            title: 'No Pending Change Requests',
            message: 'All employee profile modifications have been decided.',
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminChangeRequestsProvider);
            await ref.read(adminChangeRequestsProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: changeRequests.length,
            itemBuilder: (context, idx) {
              final cr = changeRequests[idx];
              return _AdminChangeRequestCard(
                changeRequest: cr,
                onDecide: () => _openDecideCRModal(cr),
              );
            },
          ),
        );
      },
    );
  }

  void _openDecideCRModal(AdminChangeRequest cr) {
    final notesController = TextEditingController();
    showDialog(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        title: Text('Review: ${cr.displayField}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Technician: ${cr.employeeName ?? 'Employee'} (${cr.employeeId ?? ''})',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            Text('Current Value: ${cr.oldValue ?? '—'}',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5)),
            const SizedBox(height: 2),
            Text('Requested Value: ${cr.newValue ?? '—'}',
                style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF2563EB), fontSize: 13)),
            const SizedBox(height: 14),
            TextField(
              controller: notesController,
              decoration: const InputDecoration(
                labelText: 'Admin Notes (Optional)',
                hintText: 'Add decision rationale...',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dlgCtx).pop(),
            child: const Text('Cancel'),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
            onPressed: () async {
              Navigator.of(dlgCtx).pop();
              try {
                await ref.read(adminDashboardApiProvider).decideChangeRequest(
                      crId: cr.id,
                      action: 'reject',
                      notes: notesController.text.trim(),
                    );
                ref.invalidate(adminChangeRequestsProvider);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Change request rejected.')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFDC2626)),
                  );
                }
              }
            },
            child: const Text('Reject'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
            onPressed: () async {
              Navigator.of(dlgCtx).pop();
              try {
                await ref.read(adminDashboardApiProvider).decideChangeRequest(
                      crId: cr.id,
                      action: 'approve',
                      notes: notesController.text.trim(),
                    );
                ref.invalidate(adminChangeRequestsProvider);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Change request approved successfully!')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFDC2626)),
                  );
                }
              }
            },
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }
}

class _AdminApplicationCard extends StatelessWidget {
  const _AdminApplicationCard({
    required this.app,
    required this.onReviewDossier,
  });

  final AdminApplication app;
  final VoidCallback onReviewDossier;

  @override
  Widget build(BuildContext context) {
    final services = app.allRequestedServices.isNotEmpty
        ? app.allRequestedServices.map((s) => s.name).join(' • ')
        : 'No services selected';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFFEFF6FF),
                child: Text(
                  app.initial,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2563EB),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.name ?? 'Technician #${app.id}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '${app.employeeId ?? 'ID: Pending'}${app.phone != null ? ' • ${app.phone}' : ''}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        fontFamily: 'monospace',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              StatusChip(status: app.registrationStatus, dense: true),
            ],
          ),
          const SizedBox(height: 10),

          // Services
          Row(
            children: [
              const Text(
                'Services: ',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
              ),
              Text(
                '${app.allRequestedServices.length} Selected',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            services,
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),

          // Documents & Recency
          Row(
            children: [
              const Icon(Icons.description_outlined, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Text(
                'Documents: ${app.uploadedDocumentsCount} Uploaded',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569), fontWeight: FontWeight.w600),
              ),
              if (app.pendingDocumentsCount > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${app.pendingDocumentsCount} Pending',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 8),

          // Action
          Align(
            alignment: Alignment.centerRight,
            child: InkWell(
              onTap: onReviewDossier,
              borderRadius: BorderRadius.circular(4),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Review Dossiers',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF2563EB)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminChangeRequestCard extends StatelessWidget {
  const _AdminChangeRequestCard({
    required this.changeRequest,
    required this.onDecide,
  });

  final AdminChangeRequest changeRequest;
  final VoidCallback onDecide;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  changeRequest.displayField,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
              ),
              StatusChip(status: changeRequest.status, dense: true),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${changeRequest.employeeName ?? 'Employee'} • ${changeRequest.employeeId ?? ''}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Current', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                      Text(changeRequest.oldValue ?? '—',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_rounded, size: 16, color: Color(0xFF94A3B8)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Requested', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                      Text(changeRequest.newValue ?? '—',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF2563EB))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (changeRequest.isPending) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: onDecide,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text('Review / Decide'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
