import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../profile/domain/employee_profile.dart';
import '../../profile/presentation/profile_providers.dart';
import '../domain/service_catalog.dart';
import 'services_providers.dart';

class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  final Set<dynamic> _selectedServiceIds = {};

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(employeeProfileProvider);
    final catalogAsync = ref.watch(serviceCatalogProvider);
    final skillsAsync = ref.watch(employeeSkillsProvider);
    final actionState = ref.watch(servicesControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Services & Skills'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh services',
            onPressed: () {
              ref.invalidate(employeeProfileProvider);
              ref.invalidate(serviceCatalogProvider);
              ref.invalidate(employeeSkillsProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(employeeProfileProvider);
          ref.invalidate(serviceCatalogProvider);
          ref.invalidate(employeeSkillsProvider);
          await ref.read(employeeProfileProvider.future);
        },
        child: AsyncValueView<EmployeeProfile>(
          value: profileAsync,
          onRetry: () {
            ref.invalidate(employeeProfileProvider);
            ref.invalidate(serviceCatalogProvider);
            ref.invalidate(employeeSkillsProvider);
          },
          builder: (context, profile) {
            final approvedServices = profile.approvedServices;
            final allRequestedServices = profile.allRequestedServices;
            final pendingServices = allRequestedServices.where((s) => s.status.toLowerCase() == 'pending').toList();
            final rejectedServices = allRequestedServices.where((s) => s.status.toLowerCase() == 'rejected').toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                _WorkerSummaryCard(profile: profile),
                const SizedBox(height: AppSpacing.lg),
                _SectionTitleHeader(
                  title: 'Employee Service Authorizations & Skills',
                  subtitle: 'Select available services from the company catalog to request operational dispatch authorization.',
                ),
                const SizedBox(height: AppSpacing.md),
                _AuthorizedServicesCard(
                  approvedServices: approvedServices,
                  isLoading: actionState.isLoading,
                  onRemove: (serviceId, name) => _confirmRemoveService(serviceId, name),
                ),
                if (pendingServices.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  _PendingServicesCard(pendingServices: pendingServices),
                ],
                if (rejectedServices.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  _RejectedServicesCard(
                    rejectedServices: rejectedServices,
                    isLoading: actionState.isLoading,
                    onReapply: (serviceId, name) => _handleRequestService(serviceId, name),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                AsyncValueView<List<CatalogCategory>>(
                  value: catalogAsync,
                  onRetry: () => ref.invalidate(serviceCatalogProvider),
                  builder: (context, categories) {
                    return _AvailableCatalogSection(
                      categories: categories,
                      allRequestedServices: allRequestedServices,
                      selectedServiceIds: _selectedServiceIds,
                      isLoading: actionState.isLoading,
                      onToggleSelect: (id) {
                        setState(() {
                          if (_selectedServiceIds.contains(id)) {
                            _selectedServiceIds.remove(id);
                          } else {
                            _selectedServiceIds.add(id);
                          }
                        });
                      },
                      onToggleCategory: (categoryRequestableIds) {
                        setState(() {
                          final allInCatSelected = categoryRequestableIds.isNotEmpty &&
                              categoryRequestableIds.every(_selectedServiceIds.contains);
                          if (allInCatSelected) {
                            _selectedServiceIds.removeAll(categoryRequestableIds);
                          } else {
                            _selectedServiceIds.addAll(categoryRequestableIds);
                          }
                        });
                      },
                      onToggleAll: (allRequestableIds) {
                        setState(() {
                          final allSelected = allRequestableIds.isNotEmpty &&
                              allRequestableIds.every(_selectedServiceIds.contains);
                          if (allSelected) {
                            _selectedServiceIds.removeAll(allRequestableIds);
                          } else {
                            _selectedServiceIds.addAll(allRequestableIds);
                          }
                        });
                      },
                      onRequestService: (id, name) => _handleRequestService(id, name),
                      onBulkRequest: () => _handleBulkRequest(),
                      onClearSelection: () => setState(() => _selectedServiceIds.clear()),
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                AsyncValueView<List<EmployeeSkill>>(
                  value: skillsAsync,
                  onRetry: () => ref.invalidate(employeeSkillsProvider),
                  builder: (context, skills) {
                    return _VerifiedSkillsSection(skills: skills);
                  },
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _handleRequestService(dynamic serviceId, String name) async {
    final success = await ref
        .read(servicesControllerProvider.notifier)
        .requestService(serviceId: serviceId, name: name);

    if (!mounted) return;

    if (success) {
      setState(() => _selectedServiceIds.remove(serviceId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Service authorization request for "$name" submitted for Admin review.'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to submit service authorization request.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _handleBulkRequest() async {
    final ids = _selectedServiceIds.toList();
    if (ids.isEmpty) return;

    final success = await ref
        .read(servicesControllerProvider.notifier)
        .bulkRequestServices(ids);

    if (!mounted) return;

    if (success) {
      final count = ids.length;
      setState(() => _selectedServiceIds.clear());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Authorization requests for $count service(s) submitted for Admin review.'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to submit bulk authorization requests.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _confirmRemoveService(dynamic serviceId, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Request Removal of "$name"?'),
        content: const Text(
          'This will submit a service removal request to Admin for review. You will remain authorized until the request is reviewed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Request Removal'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final success = await ref
        .read(servicesControllerProvider.notifier)
        .removeService(serviceId);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Removal request for "$name" submitted to Admin for review.'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to submit service removal request.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }
}

// ── Worker Summary Card ───────────────────────────────────────────────────────

class _WorkerSummaryCard extends StatelessWidget {
  const _WorkerSummaryCard({required this.profile});

  final EmployeeProfile profile;

  @override
  Widget build(BuildContext context) {
    final initial = profile.firstName.isNotEmpty
        ? profile.firstName[0].toUpperCase()
        : (profile.lastName.isNotEmpty ? profile.lastName[0].toUpperCase() : 'T');
    final hasAvatar = profile.avatar != null && profile.avatar!.isNotEmpty;

    final availabilityStatus = profile.liveAvailability?.toLowerCase() == 'busy'
        ? 'busy'
        : (profile.isOnline ? 'online' : 'offline');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              backgroundImage: hasAvatar ? NetworkImage(profile.avatar!) : null,
              child: !hasAvatar
                  ? Text(
                      initial,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profile.fullName.isNotEmpty ? profile.fullName : 'Technician',
                    style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'ID: ${profile.employeeId ?? 'Pending'} • ${profile.companyName ?? 'CalServices'}',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            StatusChip(status: availabilityStatus, dense: true),
          ],
        ),
      ),
    );
  }
}

// ── Section Title Header ──────────────────────────────────────────────────────

class _SectionTitleHeader extends StatelessWidget {
  const _SectionTitleHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
        ),
      ],
    );
  }
}

// ── 1. Authorized Services Card ───────────────────────────────────────────────

class _AuthorizedServicesCard extends StatelessWidget {
  const _AuthorizedServicesCard({
    required this.approvedServices,
    required this.isLoading,
    required this.onRemove,
  });

  final List<ApprovedService> approvedServices;
  final bool isLoading;
  final void Function(dynamic serviceId, String name) onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, size: 16, color: Color(0xFF059669)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'AUTHORIZED SERVICES (${approvedServices.length})',
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const Text(
                  'Eligible for Dispatch',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF059669),
                  ),
                ),
              ],
            ),
          ),
          if (approvedServices.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.xl),
              child: EmptyState(
                icon: Icons.build_outlined,
                title: 'No services authorized yet',
                message: 'Browse the catalog below to request service dispatch authorization.',
                compact: true,
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: approvedServices.length,
              separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, index) {
                final svc = approvedServices[index];
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: const Icon(Icons.check, size: 16, color: Color(0xFF059669)),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              svc.name,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            const Text(
                              'Authorized ✓',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton(
                        onPressed: isLoading ? null : () => onRemove(svc.id, svc.name),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFFECACA)),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          visualDensity: VisualDensity.compact,
                          minimumSize: const Size(100, 32),
                        ),
                        child: const Text('Request Removal', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

// ── 2. Pending Admin Review Card ──────────────────────────────────────────────

class _PendingServicesCard extends StatelessWidget {
  const _PendingServicesCard({required this.pendingServices});

  final List<RequestedService> pendingServices;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              border: Border(bottom: BorderSide(color: const Color(0xFFFDE68A))),
            ),
            child: Row(
              children: [
                const Icon(Icons.hourglass_top_rounded, size: 15, color: Color(0xFFD97706)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'PENDING ADMIN REVIEW (${pendingServices.length})',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: pendingServices.length,
            separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
            itemBuilder: (context, index) {
              final svc = pendingServices[index];
              final isRemoval = svc.requestType == 'remove';

              return Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            svc.name,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isRemoval ? 'REMOVAL PENDING REVIEW' : 'AUTHORIZATION PENDING REVIEW',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const StatusChip(status: 'pending', dense: true),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── 3. Rejected Service Requests Card ─────────────────────────────────────────

class _RejectedServicesCard extends StatelessWidget {
  const _RejectedServicesCard({
    required this.rejectedServices,
    required this.isLoading,
    required this.onReapply,
  });

  final List<RequestedService> rejectedServices;
  final bool isLoading;
  final void Function(dynamic serviceId, String name) onReapply;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              border: Border(bottom: BorderSide(color: const Color(0xFFFECACA))),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, size: 15, color: Color(0xFFDC2626)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'REJECTED SERVICE REQUESTS (${rejectedServices.length})',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF991B1B),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: rejectedServices.length,
            separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
            itemBuilder: (context, index) {
              final svc = rejectedServices[index];

              return Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            svc.name,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const StatusChip(status: 'rejected', dense: true),
                      ],
                    ),
                    if (svc.rejectionReason != null && svc.rejectionReason!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Reason: ${svc.rejectionReason}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFFB91C1C)),
                      ),
                    ],
                    const SizedBox(height: 6),
                    TextButton(
                      onPressed: isLoading ? null : () => onReapply(svc.id, svc.name),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        visualDensity: VisualDensity.compact,
                      ),
                      child: const Text('Re-apply for Authorization', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── 4. Available Service Catalog Section ──────────────────────────────────────

class _AvailableCatalogSection extends StatelessWidget {
  const _AvailableCatalogSection({
    required this.categories,
    required this.allRequestedServices,
    required this.selectedServiceIds,
    required this.isLoading,
    required this.onToggleSelect,
    required this.onToggleCategory,
    required this.onToggleAll,
    required this.onRequestService,
    required this.onBulkRequest,
    required this.onClearSelection,
  });

  final List<CatalogCategory> categories;
  final List<RequestedService> allRequestedServices;
  final Set<dynamic> selectedServiceIds;
  final bool isLoading;
  final void Function(dynamic id) onToggleSelect;
  final void Function(List<dynamic> categoryRequestableIds) onToggleCategory;
  final void Function(List<dynamic> allRequestableIds) onToggleAll;
  final void Function(dynamic id, String name) onRequestService;
  final VoidCallback onBulkRequest;
  final VoidCallback onClearSelection;

  bool _isServiceApproved(dynamic id) {
    return allRequestedServices.any((r) => r.id.toString() == id.toString() && r.status.toLowerCase() == 'approved');
  }

  bool _isServicePending(dynamic id) {
    return allRequestedServices.any((r) => r.id.toString() == id.toString() && r.status.toLowerCase() == 'pending');
  }

  bool _isRequestable(dynamic id) {
    return !_isServiceApproved(id) && !_isServicePending(id);
  }

  @override
  Widget build(BuildContext context) {
    final allRequestableServices = categories
        .expand((c) => c.services)
        .where((s) => _isRequestable(s.id))
        .toList();
    final allRequestableIds = allRequestableServices.map((s) => s.id).toList();

    final isAllSelected = allRequestableIds.isNotEmpty &&
        allRequestableIds.every(selectedServiceIds.contains);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionTitleHeader(
          title: 'Available Service Catalog',
          subtitle: 'Select the services you are qualified to deliver and request administrative authorization.',
        ),
        const SizedBox(height: AppSpacing.sm),

        // Global Select All and Bulk Bar
        if (allRequestableIds.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Checkbox(
                        value: isAllSelected,
                        onChanged: (val) => onToggleAll(allRequestableIds),
                        visualDensity: VisualDensity.compact,
                      ),
                      Flexible(
                        child: Text(
                          'Select All Available (${allRequestableIds.length})',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                if (selectedServiceIds.isNotEmpty) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: isLoading ? null : onBulkRequest,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          visualDensity: VisualDensity.compact,
                          minimumSize: const Size(0, 32),
                        ),
                        child: Text(
                          'Request (${selectedServiceIds.length})',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16),
                        tooltip: 'Clear selection',
                        onPressed: onClearSelection,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        // Category Groups
        for (final cat in categories) ...[
          _CategoryCard(
            category: cat,
            selectedServiceIds: selectedServiceIds,
            isLoading: isLoading,
            isApprovedCheck: _isServiceApproved,
            isPendingCheck: _isServicePending,
            isRequestableCheck: _isRequestable,
            onToggleSelect: onToggleSelect,
            onToggleCategory: onToggleCategory,
            onRequestService: onRequestService,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.category,
    required this.selectedServiceIds,
    required this.isLoading,
    required this.isApprovedCheck,
    required this.isPendingCheck,
    required this.isRequestableCheck,
    required this.onToggleSelect,
    required this.onToggleCategory,
    required this.onRequestService,
  });

  final CatalogCategory category;
  final Set<dynamic> selectedServiceIds;
  final bool isLoading;
  final bool Function(dynamic id) isApprovedCheck;
  final bool Function(dynamic id) isPendingCheck;
  final bool Function(dynamic id) isRequestableCheck;
  final void Function(dynamic id) onToggleSelect;
  final void Function(List<dynamic> requestableIds) onToggleCategory;
  final void Function(dynamic id, String name) onRequestService;

  @override
  Widget build(BuildContext context) {
    final catRequestableServices = category.services.where((s) => isRequestableCheck(s.id)).toList();
    final catRequestableIds = catRequestableServices.map((s) => s.id).toList();

    final isCatAllSelected = catRequestableIds.isNotEmpty &&
        catRequestableIds.every(selectedServiceIds.contains);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          category.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '${category.services.length} services',
                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (catRequestableIds.isNotEmpty)
                  Row(
                    children: [
                      Checkbox(
                        value: isCatAllSelected,
                        onChanged: (val) => onToggleCategory(catRequestableIds),
                        visualDensity: VisualDensity.compact,
                      ),
                      Text(
                        'Select All (${catRequestableIds.length})',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  )
                else
                  Text(
                    'All requested/authorized',
                    style: TextStyle(fontSize: 10, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                  ),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: category.services.length,
            separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
            itemBuilder: (context, index) {
              final s = category.services[index];
              final isApproved = isApprovedCheck(s.id);
              final isPending = isPendingCheck(s.id);
              final isRequestable = isRequestableCheck(s.id);
              final isChecked = selectedServiceIds.contains(s.id);

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    if (isRequestable)
                      Checkbox(
                        value: isChecked,
                        onChanged: (val) => onToggleSelect(s.id),
                        visualDensity: VisualDensity.compact,
                      )
                    else
                      const SizedBox(width: 32),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.name,
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Approx. ${s.durationMinutes} mins',
                            style: TextStyle(fontSize: 10.5, fontFamily: 'monospace', color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    if (isApproved)
                      const StatusChip(status: 'approved', dense: true)
                    else if (isPending)
                      const StatusChip(status: 'pending', dense: true)
                    else
                      ElevatedButton(
                        onPressed: isLoading ? null : () => onRequestService(s.id, s.name),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          visualDensity: VisualDensity.compact,
                          minimumSize: const Size(90, 30),
                        ),
                        child: const Text('Request', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── 5. Verified Skill Ratings Section ─────────────────────────────────────────

class _VerifiedSkillsSection extends StatelessWidget {
  const _VerifiedSkillsSection({required this.skills});

  final List<EmployeeSkill> skills;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                const Icon(Icons.star_outline_rounded, size: 16, color: Color(0xFF2563EB)),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'VERIFIED SKILL RATINGS (${skills.length})',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
            ),
          ),
          if (skills.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.xl),
              child: EmptyState(
                icon: Icons.military_tech_outlined,
                title: 'No skill certifications assigned yet',
                message: 'Verified skill ratings will be displayed once evaluated by Workforce administration.',
                compact: true,
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: skills.length,
              separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, index) {
                final sk = skills[index];
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sk.skillName,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            if (sk.category != null && sk.category!.isNotEmpty)
                              Text(
                                sk.category!,
                                style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Text(
                          sk.proficiencyLevel.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1D4ED8),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
