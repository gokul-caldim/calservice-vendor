import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../routing/app_routes.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../../../jobs/domain/job.dart';
import '../admin_dashboard_providers.dart';
import '../widgets/admin_drawer.dart';

/// Admin Operations: Customer Jobs & Field Work Orders.
/// Provides real-time lifecycle tracking across booking, dispatch, execution,
/// proof upload, and cash collection with responsive pagination and status filtering.
class AdminJobsScreen extends ConsumerStatefulWidget {
  const AdminJobsScreen({super.key});

  @override
  ConsumerState<AdminJobsScreen> createState() => _AdminJobsScreenState();
}

class _AdminJobsScreenState extends ConsumerState<AdminJobsScreen> {
  String _searchTerm = '';
  String _statusFilter = 'ALL';
  int _currentPage = 1;
  static const int _pageSize = 12;

  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Watches authoritative jobs list
    final jobsAsync = ref.watch(adminJobsListProvider(null));

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: jobsAsync.when(
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
                Text('Failed to load customer jobs: $err',
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(adminJobsListProvider(null)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (allJobs) {
          // Normalize and filter jobs
          final filtered = allJobs.where((job) {
            final term = _searchTerm.toLowerCase().trim();
            final reqId = job.requestId.toLowerCase();
            final custName = (job.customerName ?? '').toLowerCase();
            final service = (job.displayTitle).toLowerCase();
            final addr = (job.address ?? '').toLowerCase();
            final statusStr = job.status.toLowerCase();

            final matchesSearch = term.isEmpty ||
                reqId.contains(term) ||
                custName.contains(term) ||
                service.contains(term) ||
                addr.contains(term) ||
                statusStr.contains(term);

            // Filter logic matching the operational specifications
            bool matchesStatus = true;
            if (_statusFilter == 'ASSIGNED_QUEUED') {
              matchesStatus = statusStr == 'assigned' ||
                  statusStr == 'unassigned' ||
                  statusStr == 'new_request' ||
                  statusStr == 'confirmed' ||
                  statusStr == 'waiting_for_payment' ||
                  statusStr == 'offered';
            } else if (_statusFilter == 'ACCEPTED') {
              matchesStatus = statusStr == 'accepted';
            } else if (_statusFilter == 'ON_THE_WAY') {
              matchesStatus = statusStr == 'on_the_way' ||
                  statusStr == 'en_route' ||
                  statusStr == 'arrived';
            } else if (_statusFilter == 'IN_PROGRESS') {
              matchesStatus = statusStr == 'in_progress';
            } else if (_statusFilter == 'COMPLETED') {
              matchesStatus = statusStr == 'completed' || statusStr == 'cancelled';
            }

            return matchesSearch && matchesStatus;
          }).toList();

          final totalCount = filtered.length;
          final totalPages = (totalCount / _pageSize).ceil().clamp(1, 9999);
          final safePage = _currentPage.clamp(1, totalPages);
          final startIndex = totalCount == 0 ? 0 : (safePage - 1) * _pageSize;
          final endIndex = (startIndex + _pageSize).clamp(0, totalCount);
          final pageItems =
              totalCount == 0 ? <Job>[] : filtered.sublist(startIndex, endIndex);

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(adminJobsListProvider(null));
              ref.invalidate(adminDashboardDataProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // ── Header Title & Subtitle ──────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.work_rounded,
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
                              'Customer Jobs & Field Work Orders',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Real-time lifecycle tracking across booking, dispatch, execution, proof upload, and cash collection',
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
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Search Input Field ───────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) {
                      setState(() {
                        _searchTerm = val;
                        _currentPage = 1;
                      });
                    },
                    decoration: InputDecoration(
                      hintText: 'Search by ID, customer, service, or address...',
                      hintStyle: const TextStyle(
                          fontSize: 12.5, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search_rounded,
                          size: 20, color: Color(0xFF64748B)),
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
                      border: InputBorder.none,
                      contentPadding:
                          const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),

                // ── Status Filter Chips Bar ──────────────────────────────────
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  child: Row(
                    children: [
                      _buildFilterChip('All Statuses', _statusFilter == 'ALL', () {
                        setState(() {
                          _statusFilter = 'ALL';
                          _currentPage = 1;
                        });
                      }),
                      const SizedBox(width: 6),
                      _buildFilterChip(
                          'Assigned / Queued', _statusFilter == 'ASSIGNED_QUEUED', () {
                        setState(() {
                          _statusFilter = 'ASSIGNED_QUEUED';
                          _currentPage = 1;
                        });
                      }),
                      const SizedBox(width: 6),
                      _buildFilterChip('Accepted', _statusFilter == 'ACCEPTED', () {
                        setState(() {
                          _statusFilter = 'ACCEPTED';
                          _currentPage = 1;
                        });
                      }),
                      const SizedBox(width: 6),
                      _buildFilterChip(
                          'On The Way', _statusFilter == 'ON_THE_WAY', () {
                        setState(() {
                          _statusFilter = 'ON_THE_WAY';
                          _currentPage = 1;
                        });
                      }),
                      const SizedBox(width: 6),
                      _buildFilterChip(
                          'In Progress', _statusFilter == 'IN_PROGRESS', () {
                        setState(() {
                          _statusFilter = 'IN_PROGRESS';
                          _currentPage = 1;
                        });
                      }),
                      const SizedBox(width: 6),
                      _buildFilterChip('Completed', _statusFilter == 'COMPLETED', () {
                        setState(() {
                          _statusFilter = 'COMPLETED';
                          _currentPage = 1;
                        });
                      }),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Records Count Summary ────────────────────────────────────
                if (totalCount > 0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs, left: 2),
                    child: Text(
                      'Showing ${startIndex + 1} to $endIndex of $totalCount records',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),

                // ── Jobs List ────────────────────────────────────────────────
                if (filtered.isEmpty)
                  const EmptyState(
                    icon: Icons.work_off_outlined,
                    title: 'No Jobs Found',
                    message: 'No service bookings match the selected filters.',
                  )
                else ...[
                  ...pageItems.map((job) => _AdminJobCard(job: job)),

                  const SizedBox(height: AppSpacing.md),

                  // ── Mobile Pagination Bar ──────────────────────────────────
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                  const SizedBox(height: AppSpacing.xl),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildFilterChip(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}

/// Clean responsive mobile card representing a Customer Job & Field Work Order.
class _AdminJobCard extends StatelessWidget {
  const _AdminJobCard({required this.job});

  final Job job;

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

    // Payment display logic
    final amount = job.totalAmount;
    final paymentMethod = job.paymentMethod?.toUpperCase() ?? 'COD';
    final paymentStatus = job.paymentStatus?.toLowerCase() ?? '';
    String paymentText = '—';
    if (amount != null) {
      paymentText = '₹${amount.toStringAsFixed(2)} $paymentMethod';
      if (paymentStatus.isNotEmpty && paymentStatus != 'completed') {
        paymentText += ' (${paymentStatus.replaceAll('_', ' ')})';
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Job ID + Status Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    job.requestId,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF2563EB),
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                StatusChip(status: job.status, dense: true),
              ],
            ),
            const SizedBox(height: 8),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 8),

            // Customer Name
            if (customer != null && customer.isNotEmpty) ...[
              Row(
                children: [
                  const Icon(
                    Icons.person_rounded,
                    size: 15,
                    color: Color(0xFF64748B),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      customer,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
            ],

            // Service Title
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(
                    Icons.build_circle_outlined,
                    size: 15,
                    color: Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    job.displayTitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF334155),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Address (Location)
            if (address != null && address.isNotEmpty) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.location_on_outlined,
                      size: 15,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      address,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF64748B),
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
            ],

            // Payment Information
            Row(
              children: [
                const Icon(
                  Icons.payments_outlined,
                  size: 15,
                  color: Color(0xFF059669),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    paymentText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF059669),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Scheduled Date & Time
            Row(
              children: [
                const Icon(
                  Icons.schedule_rounded,
                  size: 15,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    formattedSchedule,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Bottom Actions Bar
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed']
                    .contains(job.status.toLowerCase())) ...[
                  OutlinedButton.icon(
                    onPressed: () {
                      context.push('/jobs/${job.id}');
                    },
                    icon: const Icon(Icons.navigation_outlined,
                        size: 13, color: Color(0xFF059669)),
                    label: const Text('Track'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF059669),
                      side: const BorderSide(color: Color(0xFFA7F3D0)),
                      backgroundColor: const Color(0xFFECFDF5),
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      textStyle: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],

                // Dispatch Action Button
                FilledButton.icon(
                  onPressed: () {
                    // Navigate to Dispatch module with this job selected
                    context.go(
                      '${AppRoutes.adminDispatch}?jobId=${job.id}',
                    );
                  },
                  icon: const Icon(Icons.send_rounded, size: 14),
                  label: const Text('Dispatch'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
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
    );
  }
}
