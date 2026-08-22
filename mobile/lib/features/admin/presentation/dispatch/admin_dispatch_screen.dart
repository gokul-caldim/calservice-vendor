import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../../../jobs/domain/job.dart';
import '../../data/admin_dashboard_api.dart';
import '../../domain/admin_scope_extension.dart';
import '../../domain/admin_service_request_item.dart';
import '../../domain/eligible_technician.dart';
import '../../domain/fleet_member.dart';
import '../../domain/work_location.dart';
import '../admin_dashboard_providers.dart';
import '../widgets/admin_drawer.dart';

/// Admin Operations: Dynamic Dispatch & Fleet Operations.
/// Real-time GPS telemetry radar, fleet presence, 9-Gate matching, scope extensions,
/// service authorization requests, and geofenced work locations.
class AdminDispatchScreen extends ConsumerStatefulWidget {
  const AdminDispatchScreen({
    super.key,
    this.jobId,
    this.initialTabIndex = 0,
  });

  final String? jobId;
  final int initialTabIndex;

  @override
  ConsumerState<AdminDispatchScreen> createState() => _AdminDispatchScreenState();
}

class _AdminDispatchScreenState extends ConsumerState<AdminDispatchScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Job? _selectedJob;
  String _selectedBand = 'all';
  bool _isActionInProgress = false;
  FleetMember? _selectedMapMember;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 5,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 4),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _refreshAll() async {
    ref.invalidate(adminDashboardDataProvider);
    ref.invalidate(adminJobsListProvider(null));
    ref.invalidate(adminFleetListProvider);
    ref.invalidate(adminPendingExtensionsProvider);
    ref.invalidate(adminPendingServicesProvider);
    ref.invalidate(adminLocationsProvider);
    if (_selectedJob != null) {
      ref.invalidate(adminEligibleTechniciansProvider(_selectedJob!.id));
      ref.invalidate(adminJobTimelineProvider(_selectedJob!.id));
    }
  }

  void _selectJob(Job job) {
    setState(() {
      _selectedJob = job;
    });
  }

  // ── Auto-Dispatch Re-evaluation ────────────────────────────────────────────
  Future<void> _triggerAutoDispatch(Job job) async {
    setState(() => _isActionInProgress = true);
    try {
      final api = ref.read(adminDashboardApiProvider);
      final res = await api.triggerAutoDispatch(job.id);
      if (mounted) {
        final msg = res['message']?.toString() ??
            'Auto-dispatch re-evaluated for ${job.requestId}.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        await _refreshAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Auto-dispatch failed: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // ── Manual Dispatch Assignment ─────────────────────────────────────────────
  Future<void> _assignTechnician(Job job, EligibleTechnician tech) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card)),
        title: const Text('Confirm Dispatch Offer',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Dispatch job offer ${job.requestId} to ${tech.name}?'),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Service: ${job.displayTitle}',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  if (job.customerName != null)
                    Text('Customer: ${job.customerName}',
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF475569))),
                  if (tech.employeeId != null)
                    Text('Technician ID: ${tech.employeeId}',
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF475569))),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
            ),
            child: const Text('Dispatch Offer'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionInProgress = true);
    try {
      final api = ref.read(adminDashboardApiProvider);
      final result = await api.assignTechnician(
        jobId: job.id,
        employeeId: tech.id,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result['message']?.toString() ??
                  'Job ${job.requestId} offer dispatched to ${tech.name}.',
            ),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        await _refreshAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Dispatch assignment failed: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // ── View Job Lifecycle Timeline ────────────────────────────────────────────
  void _openJobTimeline(Job job) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _JobTimelineBottomSheet(job: job),
    );
  }

  // ── Decide Scope Extension ─────────────────────────────────────────────────
  Future<void> _decideScopeExtension(
    AdminScopeExtension ext,
    String action,
  ) async {
    double? approvedAmount;
    String reason = '';

    if (action == 'APPROVED') {
      final amountController = TextEditingController(
        text: ext.requestedAmount > 0
            ? ext.requestedAmount.toStringAsFixed(2)
            : ext.totalCost.toStringAsFixed(2),
      );
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card)),
          title: const Text('Approve Scope Extension',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Review approved amount for #${ext.requestId ?? 'Job ${ext.jobId}'}:'),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Approved Amount (₹)',
                  border: OutlineInputBorder(),
                  prefixText: '₹ ',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
              child: const Text('Approve Extension'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      approvedAmount = double.tryParse(amountController.text.trim());
    } else {
      final reasonController = TextEditingController(
        text: 'Scope expansion not authorized.',
      );
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card)),
          title: const Text('Reject Scope Extension',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Enter rejection reason for technician:'),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Rejection Reason',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              child: const Text('Reject Extension'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      reason = reasonController.text.trim();
    }

    setState(() => _isActionInProgress = true);
    try {
      final api = ref.read(adminDashboardApiProvider);
      await api.decideExtension(
        jobId: ext.jobId,
        extId: ext.id,
        action: action,
        reason: reason,
        approvedAmount: approvedAmount,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Extension marked as $action.'),
            backgroundColor: action == 'APPROVED'
                ? const Color(0xFF059669)
                : const Color(0xFFDC2626),
          ),
        );
        ref.invalidate(adminPendingExtensionsProvider);
        await _refreshAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Extension review failed: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // ── Decide Service Request ─────────────────────────────────────────────────
  Future<void> _decideServiceRequest(
    AdminServiceRequestItem req,
    String action,
  ) async {
    String reason = '';
    if (action == 'reject') {
      final reasonController = TextEditingController(
        text: 'Qualifications do not meet minimum threshold',
      );
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card)),
          title: const Text('Reject Service Authorization',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: reasonController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Rejection Reason',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              child: const Text('Reject Request'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      reason = reasonController.text.trim();
    }

    setState(() => _isActionInProgress = true);
    try {
      final api = ref.read(adminDashboardApiProvider);
      await api.decideService(
        employeeId: req.employeeId,
        serviceId: req.serviceId,
        action: action,
        reason: reason,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Service request ${action}d successfully.'),
            backgroundColor: action == 'approve'
                ? const Color(0xFF059669)
                : const Color(0xFFDC2626),
          ),
        );
        ref.invalidate(adminPendingServicesProvider);
        await _refreshAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Service decision failed: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // ── Toggle / Delete / Edit Work Location ───────────────────────────────────
  Future<void> _toggleLocationActive(WorkLocation loc) async {
    try {
      final api = ref.read(adminDashboardApiProvider);
      await api.toggleLocationActive(loc.id, !loc.isActive);
      ref.invalidate(adminLocationsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to toggle location: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  Future<void> _deleteLocation(WorkLocation loc) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card)),
        title: const Text('Delete Location?',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        content: Text(
          'Delete "${loc.name}"? This removes the authorized boundary. Historical shift records referencing this location remain intact.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Delete Location'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final api = ref.read(adminDashboardApiProvider);
      await api.deleteLocation(loc.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location "${loc.name}" deleted.'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        ref.invalidate(adminLocationsProvider);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete location: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  void _openLocationFormModal({WorkLocation? editingLocation}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _LocationFormBottomSheet(
        editingLocation: editingLocation,
        onSaved: (msg) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(msg),
              backgroundColor: const Color(0xFF059669),
            ),
          );
          ref.invalidate(adminLocationsProvider);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dashboardAsync = ref.watch(adminDashboardDataProvider);
    final fleetAsync = ref.watch(adminFleetListProvider);
    final pendingExtAsync = ref.watch(adminPendingExtensionsProvider);
    final pendingSvcAsync = ref.watch(adminPendingServicesProvider);
    final locationsAsync = ref.watch(adminLocationsProvider);

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded,
                    color: Color(0xFFDC2626), size: 40),
                const SizedBox(height: 12),
                Text('Unable to load operations data: $err',
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _refreshAll,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          final allJobs = data.jobs;
          final fleet = fleetAsync.valueOrNull ?? data.fleet;
          final pendingExtensions = pendingExtAsync.valueOrNull ?? [];
          final pendingServices = pendingSvcAsync.valueOrNull ?? [];
          final locations = locationsAsync.valueOrNull ?? [];

          // Initial selection handling from route param
          if (_selectedJob == null && widget.jobId != null) {
            final targetId = widget.jobId!.trim();
            _selectedJob = allJobs.where((j) =>
                j.id.toString() == targetId ||
                j.requestId.toLowerCase() == targetId.toLowerCase()).firstOrNull;
          }
          if (_selectedJob == null && allJobs.isNotEmpty) {
            _selectedJob = allJobs.first;
          }

          final onlineCount = data.onlineAndAvailableCount;
          final offlineCount = (fleet.length - onlineCount).clamp(0, 99999);
          final activeBookingsCount = allJobs.length;

          return RefreshIndicator(
            onRefresh: _refreshAll,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // ── Header Title & Refresh Action ────────────────────────────
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
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.radar_rounded,
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
                                  'Dynamic Dispatch & Fleet Operations',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Skill-based technician matching and real-time GPS telemetry radar',
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
                          OutlinedButton.icon(
                            onPressed: _isActionInProgress ? null : _refreshAll,
                            icon: const Icon(Icons.refresh_rounded, size: 16),
                            label: const Text('Refresh Fleet Data'),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 6),
                              textStyle: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Summary Metric Cards Strip (4 Cards) ─────────────────────
                _buildMetricsSection(
                  totalFleet: fleet.length,
                  onlineCount: onlineCount,
                  offlineCount: offlineCount,
                  activeBookings: activeBookingsCount,
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Tab Bar Navigation (5 Tabs) ──────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    labelColor: const Color(0xFF2563EB),
                    unselectedLabelColor: const Color(0xFF64748B),
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    indicator: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0A0F172A),
                          blurRadius: 2,
                          offset: Offset(0, 1),
                        ),
                      ],
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    dividerColor: Colors.transparent,
                    padding: const EdgeInsets.all(4),
                    tabs: [
                      const Tab(
                        icon: Icon(Icons.send_rounded, size: 16),
                        text: 'Dispatch Monitor',
                      ),
                      Tab(
                        icon: const Icon(Icons.near_me_rounded, size: 16),
                        text: 'Live Fleet (${fleet.length})',
                      ),
                      Tab(
                        icon: const Icon(Icons.add_circle_outline_rounded, size: 16),
                        text: 'Scope Extensions (${pendingExtensions.length})',
                      ),
                      Tab(
                        icon: const Icon(Icons.build_circle_outlined, size: 16),
                        text: 'Service Requests (${pendingServices.length})',
                      ),
                      Tab(
                        icon: const Icon(Icons.location_on_outlined, size: 16),
                        text: 'Work Locations (${locations.length})',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Tab Content Views ────────────────────────────────────────
                _buildActiveTabContent(
                  allJobs: allJobs,
                  fleet: fleet,
                  pendingExtensions: pendingExtensions,
                  pendingServices: pendingServices,
                  locations: locations,
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          );
        },
      ),
    );
  }

  // ── Metrics Strip Grid ─────────────────────────────────────────────────────
  Widget _buildMetricsSection({
    required int totalFleet,
    required int onlineCount,
    required int offlineCount,
    required int activeBookings,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 360;
        final cardWidth = isNarrow
            ? constraints.maxWidth
            : (constraints.maxWidth - AppSpacing.sm) / 2;

        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _MetricCard(
              title: 'Total Fleet',
              value: '$totalFleet',
              subtitle: 'Technicians on roster',
              icon: Icons.groups_rounded,
              color: const Color(0xFF2563EB),
              width: cardWidth,
            ),
            _MetricCard(
              title: 'Online & Ready',
              value: '$onlineCount',
              subtitle: 'Available for work',
              icon: Icons.check_circle_rounded,
              color: const Color(0xFF059669),
              width: cardWidth,
            ),
            _MetricCard(
              title: 'Offline Fleet',
              value: '$offlineCount',
              subtitle: 'Off duty / break',
              icon: Icons.pause_circle_rounded,
              color: const Color(0xFF64748B),
              width: cardWidth,
            ),
            _MetricCard(
              title: 'Active Bookings',
              value: '$activeBookings',
              subtitle: 'In queue / assigned',
              icon: Icons.work_outline_rounded,
              color: const Color(0xFFD97706),
              width: cardWidth,
            ),
          ],
        );
      },
    );
  }

  // ── Tab Content Builder ────────────────────────────────────────────────────
  Widget _buildActiveTabContent({
    required List<Job> allJobs,
    required List<FleetMember> fleet,
    required List<AdminScopeExtension> pendingExtensions,
    required List<AdminServiceRequestItem> pendingServices,
    required List<WorkLocation> locations,
  }) {
    return AnimatedBuilder(
      animation: _tabController,
      builder: (context, _) {
        switch (_tabController.index) {
          case 0:
            return _buildDispatchMonitorTab(allJobs);
          case 1:
            return _buildLiveFleetTelemetryTab(fleet);
          case 2:
            return _buildScopeExtensionsTab(pendingExtensions);
          case 3:
            return _buildServiceRequestsTab(pendingServices);
          case 4:
            return _buildWorkLocationsTab(locations);
          default:
            return const SizedBox.shrink();
        }
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: AUTOMATED DISPATCH MONITOR
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildDispatchMonitorTab(List<Job> allJobs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. Customer Service Requests Section
        _buildSectionHeader(
          title: '1. Customer Service Requests (${allJobs.length})',
          badgeText: 'Auto-Dispatched',
          icon: Icons.assignment_outlined,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (allJobs.isEmpty)
          const EmptyState(
            icon: Icons.check_circle_outline_rounded,
            title: 'No Active Bookings',
            message: 'No active service bookings in queue.',
          )
        else
          ...allJobs.map((j) {
            final isSelected = _selectedJob?.id == j.id;
            return _DispatchJobItemCard(
              job: j,
              isSelected: isSelected,
              onTap: () => _selectJob(j),
            );
          }),
        const SizedBox(height: AppSpacing.lg),

        // 2. Live Automated Geo-Dispatch Engine Monitor Section
        _buildSectionHeader(
          title: '2. Live Automated Geo-Dispatch Engine Monitor',
          icon: Icons.radar_rounded,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildGeoDispatchMonitorCard(_selectedJob),
        const SizedBox(height: AppSpacing.md),

        // Candidate Matching Section
        if (_selectedJob != null) ...[
          _buildCandidateMatchingSection(_selectedJob!),
        ],
      ],
    );
  }

  Widget _buildGeoDispatchMonitorCard(Job? selectedJob) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(Icons.hub_outlined,
                    color: Color(0xFF2563EB), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Autonomous Dispatch Active',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E40AF),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      selectedJob != null
                          ? 'Inspecting Job: ${selectedJob.requestId} (${selectedJob.status.toUpperCase()})'
                          : 'Inspecting Job: None Selected',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'monospace',
                        color: selectedJob != null
                            ? const Color(0xFF2563EB)
                            : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Autonomous Dispatch Active: Jobs are automatically assigned to nearest eligible technicians using the 9-Gate Employee Eligibility Engine.',
            style: TextStyle(
              fontSize: 11.5,
              color: Color(0xFF64748B),
              height: 1.35,
            ),
          ),
          if (selectedJob != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openJobTimeline(selectedJob),
                    icon: const Icon(Icons.history_rounded, size: 15),
                    label: const Text('View Timeline'),
                    style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      textStyle: const TextStyle(
                          fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _isActionInProgress
                        ? null
                        : () => _triggerAutoDispatch(selectedJob),
                    icon: const Icon(Icons.auto_awesome_rounded, size: 15),
                    label: const Text('Re-evaluate Auto-Dispatch'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      visualDensity: VisualDensity.compact,
                      textStyle: const TextStyle(
                          fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCandidateMatchingSection(Job selectedJob) {
    final candidatesAsync =
        ref.watch(adminEligibleTechniciansProvider(selectedJob.id));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 20 KM Geographic Dispatch Banner
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.check_circle_rounded,
                  size: 16, color: Color(0xFF059669)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  '20 KM Geographic Dispatch Active: Candidate pool evaluated across a 20 km circular radius using geodesic Haversine calculation and 9-Gate qualification.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF065F46),
                    height: 1.3,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),

        // Distance Bands Classification Buttons
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              const Text(
                'Distance Rings: ',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B),
                ),
              ),
              ...[
                'all',
                '0-1km',
                '1-2km',
                '2-5km',
                '5-10km',
                '10-15km',
                '15-20km',
              ].map((band) {
                final isBandSelected = _selectedBand == band;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(band == 'all' ? 'All 20km' : band),
                    selected: isBandSelected,
                    onSelected: (val) => setState(() => _selectedBand = band),
                    labelStyle: TextStyle(
                      fontSize: 11,
                      fontWeight: isBandSelected
                          ? FontWeight.w800
                          : FontWeight.w600,
                      color: isBandSelected
                          ? Colors.white
                          : const Color(0xFF334155),
                    ),
                    selectedColor: const Color(0xFF2563EB),
                    backgroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    side: BorderSide(
                      color: isBandSelected
                          ? const Color(0xFF2563EB)
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // Candidate Cards List
        candidatesAsync.when(
          loading: () => Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Column(
                children: [
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Scanning 20 km candidate pool across all directions...',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          ),
          error: (err, _) => Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFFECACA)),
            ),
            child: Column(
              children: [
                Text('Failed to scan candidates: $err',
                    textAlign: TextAlign.center,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF991B1B))),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => ref.invalidate(
                      adminEligibleTechniciansProvider(selectedJob.id)),
                  child: const Text('Retry Scan'),
                ),
              ],
            ),
          ),
          data: (candidates) {
            final filtered = candidates.where((tech) {
              if (_selectedBand == 'all') return true;
              return tech.distanceBand == _selectedBand;
            }).toList();

            if (filtered.isEmpty) {
              return EmptyState(
                icon: Icons.person_off_outlined,
                title: 'No Qualified Technicians',
                message: _selectedBand == 'all'
                    ? 'No online qualified technicians currently within operational radius for this service request.'
                    : 'No qualified technicians found in the $_selectedBand distance ring.',
              );
            }

            return Column(
              children: filtered.map((tech) {
                return _EligibleTechnicianCard(
                  technician: tech,
                  isAssigning: _isActionInProgress,
                  onAssign: () => _assignTechnician(selectedJob, tech),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: LIVE FLEET TELEMETRY
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildLiveFleetTelemetryTab(List<FleetMember> fleet) {
    final withGps = fleet.where((f) => f.hasLocation && f.latitude != null && f.longitude != null).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Real-Time GPS Telemetry Radar',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Live coordinate locations and dispatch statuses',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Text(
                '${withGps.length}/${fleet.length} GPS Active',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF065F46),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),

        // Interactive Map Widget
        Container(
          height: 260,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          clipBehavior: Clip.antiAlias,
          child: withGps.isEmpty
              ? Container(
                  color: const Color(0xFFF8FAFC),
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_off_rounded,
                            size: 32, color: Color(0xFF94A3B8)),
                        SizedBox(height: 8),
                        Text(
                          'No live GPS coordinates reported yet.',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                )
              : FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(
                      withGps.first.latitude!,
                      withGps.first.longitude!,
                    ),
                    initialZoom: withGps.length == 1 ? 14.0 : 9.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.calservices.workforce',
                    ),
                    MarkerLayer(
                      markers: withGps.map((member) {
                        final isOnline = member.isOnline;
                        return Marker(
                          point: LatLng(member.latitude!, member.longitude!),
                          width: 38,
                          height: 38,
                          child: GestureDetector(
                            onTap: () {
                              setState(() => _selectedMapMember = member);
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isOnline
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF94A3B8),
                                border: Border.all(color: Colors.white, width: 2.5),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x33000000),
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Text(
                                  member.name.isNotEmpty
                                      ? member.name[0].toUpperCase()
                                      : 'T',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 8),

        // Map Legend
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF10B981),
              ),
            ),
            const SizedBox(width: 4),
            const Text('Online',
                style: TextStyle(fontSize: 11, color: Color(0xFF475569))),
            const SizedBox(width: 12),
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(width: 4),
            const Text('Offline',
                style: TextStyle(fontSize: 11, color: Color(0xFF475569))),
            const Spacer(),
            const Text('Auto-refreshes on tab focus',
                style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
          ],
        ),

        // Selected Pin Detail Card
        if (_selectedMapMember != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedMapMember!.name,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'ID: ${_selectedMapMember!.employeeId ?? '—'} • ${_selectedMapMember!.isOnline ? 'Online' : 'Offline'}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF2563EB)),
                      ),
                      if (_selectedMapMember!.activeJob != null)
                        Text(
                          'Job: ${_selectedMapMember!.activeJob}',
                          style: const TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => setState(() => _selectedMapMember = null),
                  icon: const Icon(Icons.close_rounded, size: 16),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: AppSpacing.md),

        // Telemetry Detailed Cards List
        if (fleet.isEmpty)
          const EmptyState(
            icon: Icons.location_off_outlined,
            title: 'No Telemetry Data',
            message: 'No fleet members reporting telemetry.',
          )
        else
          ...fleet.map((m) => _FleetMemberTelemetryCard(member: m)),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 3: SCOPE EXTENSIONS
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildScopeExtensionsTab(List<AdminScopeExtension> pendingExtensions) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Scope Extensions (${pendingExtensions.length})',
          badgeText: 'Awaiting Decision',
          icon: Icons.add_circle_outline_rounded,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (pendingExtensions.isEmpty)
          const EmptyState(
            icon: Icons.check_circle_outline_rounded,
            title: 'No Pending Scope Extensions',
            message: 'All work extensions and scope expansions have been reviewed.',
          )
        else
          ...pendingExtensions.map((ext) {
            return _ScopeExtensionCard(
              extension: ext,
              isProcessing: _isActionInProgress,
              onApprove: () => _decideScopeExtension(ext, 'APPROVED'),
              onReject: () => _decideScopeExtension(ext, 'REJECTED'),
            );
          }),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 4: SERVICE REQUESTS
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildServiceRequestsTab(List<AdminServiceRequestItem> pendingServices) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Service Requests (${pendingServices.length})',
          badgeText: 'Authorization Queue',
          icon: Icons.build_circle_outlined,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (pendingServices.isEmpty)
          const EmptyState(
            icon: Icons.check_circle_outline_rounded,
            title: 'No Pending Service Authorizations',
            message: 'No technician service authorization requests in queue.',
          )
        else
          ...pendingServices.map((req) {
            return _ServiceRequestItemCard(
              item: req,
              isProcessing: _isActionInProgress,
              onApprove: () => _decideServiceRequest(req, 'approve'),
              onReject: () => _decideServiceRequest(req, 'reject'),
            );
          }),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 5: WORK LOCATIONS
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildWorkLocationsTab(List<WorkLocation> locations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Company Work Locations',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Configured shift sites & geofence boundaries',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: () => _openLocationFormModal(),
              icon: const Icon(Icons.add_location_alt_rounded, size: 15),
              label: const Text('Add Location'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                visualDensity: VisualDensity.compact,
                textStyle: const TextStyle(
                    fontSize: 11.5, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        if (locations.isEmpty)
          const EmptyState(
            icon: Icons.location_off_outlined,
            title: 'No Locations Configured',
            message:
                'No authorized company locations configured yet. Tap "Add Location" to create one.',
          )
        else
          ...locations.map((loc) {
            return _WorkLocationCard(
              location: loc,
              onToggleActive: () => _toggleLocationActive(loc),
              onEdit: () => _openLocationFormModal(editingLocation: loc),
              onDelete: () => _deleteLocation(loc),
            );
          }),
      ],
    );
  }

  // ── Section Header Helper ──────────────────────────────────────────────────
  Widget _buildSectionHeader({
    required String title,
    String? badgeText,
    required IconData icon,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFF1E293B)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
              letterSpacing: 0.2,
            ),
          ),
        ),
        if (badgeText != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Text(
              badgeText,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF475569),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT WIDGETS
// ─────────────────────────────────────────────────────────────────────────────

// ── Metric Card Widget ───────────────────────────────────────────────────────
class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.width,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final double width;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x040F172A),
            blurRadius: 2,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF64748B),
                ),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Dispatch Service Request Card ───────────────────────────────────────────
class _DispatchJobItemCard extends StatelessWidget {
  const _DispatchJobItemCard({
    required this.job,
    required this.isSelected,
    required this.onTap,
  });

  final Job job;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final customer = job.customerName?.trim();
    final address = job.address?.trim();
    final scheduledDate = job.preferredDate?.trim();
    final scheduledTime = job.preferredTime?.trim();

    String formattedSchedule = 'Schedule not specified';
    if (scheduledDate != null && scheduledDate.isNotEmpty) {
      formattedSchedule = scheduledDate;
      if (scheduledTime != null && scheduledTime.isNotEmpty) {
        formattedSchedule += ' • $scheduledTime';
      }
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x142563EB),
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ]
              : const [
                  BoxShadow(
                    color: Color(0x040F172A),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        isSelected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_off_rounded,
                        size: 16,
                        color: isSelected
                            ? const Color(0xFF2563EB)
                            : const Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          job.requestId,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            color: isSelected
                                ? const Color(0xFF1E40AF)
                                : const Color(0xFF2563EB),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusChip(status: job.status, dense: true),
              ],
            ),
            const SizedBox(height: 6),
            if (customer != null && customer.isNotEmpty) ...[
              Text(
                customer,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 2),
            ],
            Text(
              job.displayTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF334155),
              ),
            ),
            if (address != null && address.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(Icons.location_on_outlined,
                        size: 13, color: Color(0xFF94A3B8)),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.schedule_rounded,
                    size: 13, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    formattedSchedule,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Live Fleet Member Telemetry Card ────────────────────────────────────────
class _FleetMemberTelemetryCard extends StatelessWidget {
  const _FleetMemberTelemetryCard({required this.member});

  final FleetMember member;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (member.employeeId != null)
                      Text(
                        member.employeeId!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: Color(0xFF64748B),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _buildPresenceBadge(member),
            ],
          ),
          const SizedBox(height: 6),
          if (member.activeJob != null && member.activeJob!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.engineering_rounded,
                      size: 13, color: Color(0xFF2563EB)),
                  const SizedBox(width: 4),
                  Text(
                    'Active Job: ${member.activeJob}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E40AF),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
          ],
          Row(
            children: [
              Icon(
                member.hasLocation
                    ? Icons.gps_fixed_rounded
                    : Icons.gps_off_rounded,
                size: 13,
                color: member.hasLocation
                    ? const Color(0xFF059669)
                    : const Color(0xFF94A3B8),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  member.hasLocation &&
                          member.latitude != null &&
                          member.longitude != null
                      ? 'GPS: ${member.latitude!.toStringAsFixed(4)}, ${member.longitude!.toStringAsFixed(4)}'
                      : (member.locationStatus ?? 'Location unavailable'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPresenceBadge(FleetMember member) {
    final isOnline = member.isOnline;
    final isBusy = member.isOnActiveJob;

    Color bg = const Color(0xFFF1F5F9);
    Color fg = const Color(0xFF475569);
    String label = 'Offline';

    if (isOnline) {
      if (isBusy) {
        bg = const Color(0xFFEFF6FF);
        fg = const Color(0xFF1E40AF);
        label = 'Busy (On Job)';
      } else {
        bg = const Color(0xFFECFDF5);
        fg = const Color(0xFF065F46);
        label = 'Online & Ready';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: fg,
        ),
      ),
    );
  }
}

// ── Eligible Candidate Card ─────────────────────────────────────────────────
class _EligibleTechnicianCard extends StatelessWidget {
  const _EligibleTechnicianCard({
    required this.technician,
    required this.isAssigning,
    required this.onAssign,
  });

  final EligibleTechnician technician;
  final bool isAssigning;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: technician.isDispatchReady
              ? const Color(0xFFBFDBFE)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      technician.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (technician.employeeId != null)
                      Text(
                        technician.employeeId!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: Color(0xFF64748B),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: technician.isDispatchReady
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  technician.isDispatchReady ? '✓ Qualified' : 'Ineligible',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: technician.isDispatchReady
                        ? const Color(0xFF065F46)
                        : const Color(0xFFC2410C),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Distance, Band & Match Score
          Wrap(
            spacing: 6,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (technician.distanceKm != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${technician.distanceKm!.toStringAsFixed(1)} km away',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E40AF),
                    ),
                  ),
                ),
              if (technician.distanceBand != null &&
                  technician.distanceBand != 'unknown')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Ring: ${technician.distanceBand}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              if (technician.gpsFreshness != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: technician.gpsFreshness == 'LIVE'
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'GPS: ${technician.gpsFreshness}',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: technician.gpsFreshness == 'LIVE'
                          ? const Color(0xFF065F46)
                          : const Color(0xFFB45309),
                    ),
                  ),
                ),
              Text(
                'Score: ${technician.score.toStringAsFixed(1)}',
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF2563EB),
                ),
              ),
            ],
          ),

          // 9-Gate Audit Badges
          if (technician.gateAudit.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: technician.gateAudit.map((g) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: g.passed
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: g.passed
                          ? const Color(0xFFA7F3D0)
                          : const Color(0xFFFECACA),
                    ),
                  ),
                  child: Text(
                    '${g.passed ? "✓" : "✗"} ${g.name}',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: g.passed
                          ? const Color(0xFF065F46)
                          : const Color(0xFF991B1B),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],

          if (!technician.isDispatchReady &&
              technician.ineligibilityReason.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Ineligible: ${technician.ineligibilityReason}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFFDC2626),
              ),
            ),
          ],

          if (technician.isDispatchReady) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                FilledButton.icon(
                  onPressed: isAssigning ? null : onAssign,
                  icon: const Icon(Icons.send_rounded, size: 14),
                  label: const Text('Dispatch Offer'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    textStyle: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ── Scope Extension Card ─────────────────────────────────────────────────────
class _ScopeExtensionCard extends StatelessWidget {
  const _ScopeExtensionCard({
    required this.extension,
    required this.isProcessing,
    required this.onApprove,
    required this.onReject,
  });

  final AdminScopeExtension extension;
  final bool isProcessing;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                  'Job #${extension.requestId ?? extension.jobId}',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2563EB),
                  ),
                ),
              ),
              if (extension.isCritical)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: const Text(
                    'CRITICAL',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ),
              if (extension.requiresSpecialist) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Text(
                    'SPECIALIST',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFD97706),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text(
            extension.title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          if (extension.reason.isNotEmpty)
            Text(
              'Reason: ${extension.reason}',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
            ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Labor: ₹${extension.additionalLaborCost.toStringAsFixed(2)} • Materials: ₹${extension.additionalMaterialsCost.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            'Total Requested: ₹${extension.requestedAmount.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Color(0xFF059669),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(
                onPressed: isProcessing ? null : onReject,
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFFECACA)),
                ),
                child: const Text('Reject'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: isProcessing ? null : onApprove,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text('Approve'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Service Request Card ─────────────────────────────────────────────────────
class _ServiceRequestItemCard extends StatelessWidget {
  const _ServiceRequestItemCard({
    required this.item,
    required this.isProcessing,
    required this.onApprove,
    required this.onReject,
  });

  final AdminServiceRequestItem item;
  final bool isProcessing;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.employeeName,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w800),
                    ),
                    if (item.employeeCode != null)
                      Text(
                        item.employeeCode!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: Color(0xFF64748B),
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: item.isRemoval
                      ? const Color(0xFFFEF2F2)
                      : const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  item.isRemoval ? 'REMOVAL' : 'AUTHORIZATION',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: item.isRemoval
                        ? const Color(0xFFDC2626)
                        : const Color(0xFF2563EB),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Service: ${item.serviceName} (ID #${item.serviceId})',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(
                onPressed: isProcessing ? null : onReject,
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFFECACA)),
                ),
                child: const Text('Reject'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: isProcessing ? null : onApprove,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text('Approve'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Work Location Card ───────────────────────────────────────────────────────
class _WorkLocationCard extends StatelessWidget {
  const _WorkLocationCard({
    required this.location,
    required this.onToggleActive,
    required this.onEdit,
    required this.onDelete,
  });

  final WorkLocation location;
  final VoidCallback onToggleActive;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                  location.name,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w800),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: location.isActive
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  location.isActive ? 'Active' : 'Inactive',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: location.isActive
                        ? const Color(0xFF065F46)
                        : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          if (location.address.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              location.address,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            'GPS: ${location.lat != null ? location.lat!.toStringAsFixed(4) : "—"}, ${location.lng != null ? location.lng!.toStringAsFixed(4) : "—"} • Geofence: ${location.geofenceRadius}m (${location.geofenceType})',
            style: const TextStyle(
              fontSize: 11,
              fontFamily: 'monospace',
              color: Color(0xFF475569),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              IconButton(
                onPressed: onToggleActive,
                icon: Icon(
                  location.isActive
                      ? Icons.toggle_on_rounded
                      : Icons.toggle_off_rounded,
                  color: location.isActive
                      ? const Color(0xFF059669)
                      : const Color(0xFF94A3B8),
                  size: 24,
                ),
                tooltip: location.isActive ? 'Deactivate' : 'Activate',
              ),
              IconButton(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 18),
                color: const Color(0xFF2563EB),
                tooltip: 'Edit',
              ),
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                color: const Color(0xFFDC2626),
                tooltip: 'Delete',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Location Form Bottom Sheet ───────────────────────────────────────────────
class _LocationFormBottomSheet extends ConsumerStatefulWidget {
  const _LocationFormBottomSheet({
    this.editingLocation,
    required this.onSaved,
  });

  final WorkLocation? editingLocation;
  final ValueChanged<String> onSaved;

  @override
  ConsumerState<_LocationFormBottomSheet> createState() =>
      _LocationFormBottomSheetState();
}

class _LocationFormBottomSheetState
    extends ConsumerState<_LocationFormBottomSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _addressController;
  late final TextEditingController _latController;
  late final TextEditingController _lngController;
  late final TextEditingController _radiusController;
  String _geofenceType = 'circle';
  bool _isActive = true;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final loc = widget.editingLocation;
    _nameController = TextEditingController(text: loc?.name ?? '');
    _addressController = TextEditingController(text: loc?.address ?? '');
    _latController =
        TextEditingController(text: loc?.lat?.toString() ?? '');
    _lngController =
        TextEditingController(text: loc?.lng?.toString() ?? '');
    _radiusController =
        TextEditingController(text: (loc?.geofenceRadius ?? 500).toString());
    _geofenceType = loc?.geofenceType ?? 'circle';
    _isActive = loc?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _latController.dispose();
    _lngController.dispose();
    _radiusController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final lat = double.tryParse(_latController.text.trim());
    final lng = double.tryParse(_lngController.text.trim());
    final radius = int.tryParse(_radiusController.text.trim()) ?? 500;

    if (name.isEmpty) {
      setState(() => _errorMessage = 'Location name is required.');
      return;
    }
    if (lat == null || lng == null) {
      setState(() => _errorMessage =
          'Valid latitude and longitude coordinates are required.');
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final payload = {
        'name': name,
        'address': _addressController.text.trim(),
        'lat': lat,
        'lng': lng,
        'geofence_radius': radius,
        'geofence_type': _geofenceType,
        'is_active': _isActive,
      };

      final api = ref.read(adminDashboardApiProvider);
      final isEditing = widget.editingLocation != null;
      if (isEditing) {
        await api.updateLocation(widget.editingLocation!.id, payload);
      } else {
        await api.createLocation(payload);
      }

      if (mounted) {
        Navigator.of(context).pop();
        widget.onSaved(
          'Location "$name" ${isEditing ? "updated" : "created"} successfully.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Failed to save location: $e');
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.editingLocation != null;

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 16,
        left: 16,
        right: 16,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isEditing ? 'Edit Authorized Location' : 'Add Authorized Location',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                ),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Location Name *',
                hintText: 'e.g. Central Hub / Headquarters',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(
                labelText: 'Address (Optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _latController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true, signed: true),
                    decoration: const InputDecoration(
                      labelText: 'Latitude *',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _lngController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true, signed: true),
                    decoration: const InputDecoration(
                      labelText: 'Longitude *',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _radiusController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Radius (metres)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _geofenceType,
                    decoration: const InputDecoration(
                      labelText: 'Geofence Type',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'circle', child: Text('Circle')),
                      DropdownMenuItem(value: 'polygon', child: Text('Polygon')),
                      DropdownMenuItem(value: 'hybrid', child: Text('Hybrid')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _geofenceType = val);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Active (visible to employees for clock-in)',
                  style: TextStyle(fontSize: 12.5)),
              value: _isActive,
              onChanged: (val) => setState(() => _isActive = val ?? true),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: Text(
                  _isSaving
                      ? 'Saving...'
                      : isEditing
                          ? 'Update Location'
                          : 'Save Location',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Job Lifecycle Timeline Bottom Sheet ──────────────────────────────────────
class _JobTimelineBottomSheet extends ConsumerWidget {
  const _JobTimelineBottomSheet({required this.job});

  final Job job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timelineAsync = ref.watch(adminJobTimelineProvider(job.id));

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.history_rounded,
                        color: Color(0xFF2563EB), size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Timeline — #${job.requestId}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${job.displayTitle} • Customer: ${job.customerName ?? "—"}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
          ),
          const Divider(height: 16),
          Expanded(
            child: timelineAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Text('Failed to load timeline: $err',
                    style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
              ),
              data: (timelineData) {
                if (timelineData.events.isEmpty) {
                  return const Center(
                    child: Text('No lifecycle events recorded for this job yet.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  );
                }

                return ListView.separated(
                  itemCount: timelineData.events.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final item = timelineData.events[idx];
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFEFF6FF),
                            border: Border.all(color: const Color(0xFF2563EB)),
                          ),
                          child: Center(
                            child: Text(
                              '${idx + 1}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        style: const TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                    Text(
                                      '${item.timestamp.hour.toString().padLeft(2, "0")}:${item.timestamp.minute.toString().padLeft(2, "0")}',
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontFamily: 'monospace',
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                                if (item.description.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    item.description,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: Color(0xFF475569),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Actor: ${item.actor}',
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF334155),
                                      ),
                                    ),
                                    Text(
                                      item.eventType,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontFamily: 'monospace',
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
