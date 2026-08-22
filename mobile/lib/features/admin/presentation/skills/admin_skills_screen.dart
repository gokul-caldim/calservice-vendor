import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/workforce_app_bar.dart';
import '../../data/admin_dashboard_api.dart';
import '../../domain/admin_application.dart';
import '../../domain/skill.dart';
import '../admin_dashboard_providers.dart';
import '../widgets/admin_drawer.dart';

/// Admin Workforce Skills & Verification Matrix Screen.
/// Displays master skill catalog with search, categorization, and action modals
/// for creating and assigning skills.
class AdminSkillsScreen extends ConsumerStatefulWidget {
  const AdminSkillsScreen({super.key});

  @override
  ConsumerState<AdminSkillsScreen> createState() => _AdminSkillsScreenState();
}

class _AdminSkillsScreenState extends ConsumerState<AdminSkillsScreen> {
  String _searchTerm = '';
  String _selectedCategory = 'ALL';
  int _currentPage = 1;
  static const int _pageSize = 15;

  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final skillsAsync = ref.watch(adminSkillsProvider);
    final techniciansAsync = ref.watch(adminApplicationsListProvider(null));

    return Scaffold(
      appBar: const WorkforceAppBar(
        showStatusSubBar: false,
        showDrawerMenu: true,
      ),
      drawer: const AdminDrawer(),
      body: skillsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 40),
                const SizedBox(height: 12),
                Text('Failed to load skills catalog: $err', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(adminSkillsProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (allSkills) {
          // Extract unique categories
          final categories = <String>{};
          for (final sk in allSkills) {
            if (sk.category.isNotEmpty) categories.add(sk.category);
          }
          final categoryList = categories.toList()..sort();

          // Filter skills
          final filtered = allSkills.where((sk) {
            final term = _searchTerm.toLowerCase().trim();
            final matchesSearch = term.isEmpty ||
                sk.name.toLowerCase().contains(term) ||
                (sk.description ?? '').toLowerCase().contains(term) ||
                sk.category.toLowerCase().contains(term);

            final matchesCategory =
                _selectedCategory == 'ALL' || sk.category == _selectedCategory;

            return matchesSearch && matchesCategory;
          }).toList();

          final totalCount = filtered.length;
          final totalPages = (totalCount / _pageSize).ceil().clamp(1, 9999);
          final safePage = _currentPage.clamp(1, totalPages);
          final startIndex = (safePage - 1) * _pageSize;
          final endIndex = (startIndex + _pageSize).clamp(0, totalCount);
          final pageItems = startIndex < totalCount
              ? filtered.sublist(startIndex, endIndex)
              : <Skill>[];

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(adminSkillsProvider);
              await ref.read(adminSkillsProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // ── Header Title & Top Actions ───────────────────────────────
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
                        Icons.military_tech_rounded,
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
                            'Workforce Skills & Verification Matrix',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Manage skill certifications and verify technician service proficiency for dispatch qualification.',
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

                // Top Action Buttons: New Skill & Assign Skill
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _openNewSkillSheet(context),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('New Skill'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _openAssignSkillSheet(
                          context,
                          allSkills,
                          techniciansAsync.valueOrNull ?? [],
                        ),
                        icon: const Icon(Icons.verified_user_rounded, size: 18),
                        label: const Text('Assign Skill'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Search Field ─────────────────────────────────────────────
                TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() {
                    _searchTerm = val;
                    _currentPage = 1;
                  }),
                  decoration: InputDecoration(
                    hintText: 'Search skills catalog (${allSkills.length} skills)...',
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

                // ── Category Chips ───────────────────────────────────────────
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _categoryChip('All Categories', _selectedCategory == 'ALL', () {
                        setState(() {
                          _selectedCategory = 'ALL';
                          _currentPage = 1;
                        });
                      }),
                      ...categoryList.map((cat) => Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: _categoryChip(cat, _selectedCategory == cat, () {
                              setState(() {
                                _selectedCategory = cat;
                                _currentPage = 1;
                              });
                            }),
                          )),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Master Skills Catalog ────────────────────────────────────
                if (filtered.isEmpty)
                  const EmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'No Skills Found',
                    message: 'No skills match your query.',
                  )
                else ...[
                  ...pageItems.map((sk) => _AdminSkillCard(skill: sk)),

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
      ),
    );
  }

  Widget _categoryChip(String label, bool isSelected, VoidCallback onTap) {
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

  void _openNewSkillSheet(BuildContext context) {
    final nameCtrl = TextEditingController();
    final categoryCtrl = TextEditingController(text: 'General');
    final descCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.lg,
          right: AppSpacing.lg,
          top: AppSpacing.lg,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Add New Master Skill',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Skill Name *',
                hintText: 'e.g. AC Installation & Gas Refill',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: categoryCtrl,
              decoration: const InputDecoration(
                labelText: 'Category *',
                hintText: 'e.g. HVAC, Electrical, Plumbing',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (Optional)',
                hintText: 'Brief description of proficiency criteria...',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final category = categoryCtrl.text.trim();
                if (name.isEmpty || category.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please provide skill name and category.')),
                  );
                  return;
                }
                final messenger = ScaffoldMessenger.of(context);
                Navigator.of(ctx).pop();
                try {
                  await ref.read(adminDashboardApiProvider).createSkill(
                        name: name,
                        category: category,
                        description: descCtrl.text.trim(),
                      );
                  ref.invalidate(adminSkillsProvider);
                  if (mounted) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Skill created successfully!'),
                        backgroundColor: Color(0xFF059669),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('Creation failed: $e'),
                        backgroundColor: const Color(0xFFDC2626),
                      ),
                    );
                  }
                }
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                minimumSize: const Size.fromHeight(44),
              ),
              child: const Text('Create Skill'),
            ),
          ],
        ),
      ),
    );
  }

  void _openAssignSkillSheet(
    BuildContext context,
    List<Skill> skills,
    List<AdminApplication> techs,
  ) {
    if (skills.isEmpty || techs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No skills or technicians available to assign.')),
      );
      return;
    }

    int selectedEmpId = techs.first.id;
    int selectedSkillId = skills.first.id;
    String proficiency = 'INTERMEDIATE';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.lg,
            right: AppSpacing.lg,
            top: AppSpacing.lg,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Assign & Verify Skill for Technician',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: selectedEmpId,
                decoration: const InputDecoration(
                  labelText: 'Select Technician',
                  border: OutlineInputBorder(),
                ),
                items: techs
                    .map((t) => DropdownMenuItem<int>(
                          value: t.id,
                          child: Text('${t.name ?? 'Technician'} (${t.employeeId ?? 'ID'})',
                              overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setSheetState(() => selectedEmpId = val);
                },
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<int>(
                initialValue: selectedSkillId,
                decoration: const InputDecoration(
                  labelText: 'Select Skill',
                  border: OutlineInputBorder(),
                ),
                items: skills
                    .take(50) // reasonable display subset
                    .map((s) => DropdownMenuItem<int>(
                          value: s.id,
                          child: Text('${s.name} (${s.category})', overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setSheetState(() => selectedSkillId = val);
                },
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: proficiency,
                decoration: const InputDecoration(
                  labelText: 'Proficiency Level',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'BEGINNER', child: Text('Beginner')),
                  DropdownMenuItem(value: 'INTERMEDIATE', child: Text('Intermediate (Standard)')),
                  DropdownMenuItem(value: 'EXPERT', child: Text('Expert / Specialist')),
                ],
                onChanged: (val) {
                  if (val != null) setSheetState(() => proficiency = val);
                },
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  Navigator.of(ctx).pop();
                  try {
                    await ref.read(adminDashboardApiProvider).assignSkill(
                          employeeId: selectedEmpId,
                          skillId: selectedSkillId,
                          proficiencyLevel: proficiency,
                        );
                    if (mounted) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Skill verified & assigned to technician successfully!'),
                          backgroundColor: Color(0xFF059669),
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text('Assign failed: $e'),
                          backgroundColor: const Color(0xFFDC2626),
                        ),
                      );
                    }
                  }
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  minimumSize: const Size.fromHeight(44),
                ),
                child: const Text('Confirm Skill Assignment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AdminSkillCard extends StatelessWidget {
  const _AdminSkillCard({required this.skill});

  final Skill skill;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 1)),
        ],
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
              Icons.military_tech_rounded,
              color: Color(0xFF2563EB),
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        skill.name,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        skill.category.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  skill.description != null && skill.description!.isNotEmpty
                      ? skill.description!
                      : 'Master catalog trade qualification.',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
