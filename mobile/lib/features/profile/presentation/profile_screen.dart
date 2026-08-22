import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/employee_profile.dart';
import 'profile_providers.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _phoneController = TextEditingController();
  final _bioController = TextEditingController();
  String _selectedTimezone = 'UTC';
  String _selectedLanguage = 'en';
  bool _formInitialized = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  void _initForm(EmployeeProfile profile) {
    if (!_formInitialized) {
      _phoneController.text = profile.displayPhone;
      _bioController.text = profile.bio ?? '';
      _selectedTimezone = profile.timezone ?? 'UTC';
      _selectedLanguage = profile.language ?? 'en';
      _formInitialized = true;
    }
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text('Are you sure you want to log out of Workforce?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(employeeProfileProvider);
    final changeRequestsAsync = ref.watch(changeRequestsProvider);
    final actionState = ref.watch(profileControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh profile',
            onPressed: () {
              ref.invalidate(employeeProfileProvider);
              ref.invalidate(changeRequestsProvider);
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            tooltip: 'Log Out',
            onPressed: _confirmLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(employeeProfileProvider);
          ref.invalidate(changeRequestsProvider);
          await ref.read(employeeProfileProvider.future);
        },
        child: AsyncValueView<EmployeeProfile>(
          value: profileAsync,
          onRetry: () {
            ref.invalidate(employeeProfileProvider);
            ref.invalidate(changeRequestsProvider);
          },
          builder: (context, profile) {
            _initForm(profile);

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                _ProfileHeader(
                  profile: profile,
                  onAvatarTap: _handleAvatarUpload,
                ),
                const SizedBox(height: AppSpacing.lg),
                _PreferencesCard(
                  phoneController: _phoneController,
                  bioController: _bioController,
                  selectedTimezone: _selectedTimezone,
                  selectedLanguage: _selectedLanguage,
                  isSaving: actionState.isLoading,
                  onTimezoneChanged: (val) => setState(() => _selectedTimezone = val),
                  onLanguageChanged: (val) => setState(() => _selectedLanguage = val),
                  onSave: _handleSavePreferences,
                ),
                const SizedBox(height: AppSpacing.lg),
                _ProtectedIdentityCard(
                  profile: profile,
                  onRequestEdit: (fieldKey, fieldLabel) =>
                      _openChangeRequestSheet(fieldKey, fieldLabel),
                ),
                const SizedBox(height: AppSpacing.lg),
                _ChangeRequestsHistorySection(
                  changeRequestsAsync: changeRequestsAsync,
                  onSubmitNew: () => _openChangeRequestSheet('first_name', 'Legal First Name'),
                ),
                const SizedBox(height: AppSpacing.xl),
                OutlinedButton.icon(
                  onPressed: _confirmLogout,
                  icon: const Icon(
                    Icons.logout_rounded,
                    color: Color(0xFFDC2626),
                  ),
                  label: const Text(
                    'Log Out',
                    style: TextStyle(
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFFECDD3)),
                    backgroundColor: const Color(0xFFFFF1F2),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.button),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _handleAvatarUpload() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take Profile Photo'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from Gallery'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );

    if (source == null) return;

    final image = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 800);
    if (image == null) return;

    final success = await ref.read(profileControllerProvider.notifier).uploadAvatar(image.path);
    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Avatar photo updated successfully.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to upload profile avatar.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _handleSavePreferences() async {
    final success = await ref.read(profileControllerProvider.notifier).savePreferences({
      'phone': _phoneController.text.trim(),
      'bio': _bioController.text.trim(),
      'timezone': _selectedTimezone,
      'language': _selectedLanguage,
    });

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile preferences saved successfully.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save profile preferences.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _openChangeRequestSheet(
    String defaultFieldKey,
    String defaultFieldLabel,
  ) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _SubmitChangeRequestSheet(
        initialFieldKey: defaultFieldKey,
        onSubmit: (fieldName, fieldLabel, newValue, reason) async {
          final success = await ref
              .read(profileControllerProvider.notifier)
              .submitChangeRequest(
                fieldName: fieldName,
                fieldLabel: fieldLabel,
                newValue: newValue,
                reason: reason,
              );

          if (!mounted) return false;

          if (success) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Change Request submitted for Admin review.'),
                backgroundColor: Color(0xFF10B981),
              ),
            );
            return true;
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Failed to submit change request.'),
                backgroundColor: Color(0xFFEF4444),
              ),
            );
            return false;
          }
        },
      ),
    );
  }
}

// ── 1. Profile Header ─────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.profile,
    required this.onAvatarTap,
  });

  final EmployeeProfile profile;
  final VoidCallback onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final initial = profile.firstName.isNotEmpty
        ? profile.firstName[0].toUpperCase()
        : (profile.lastName.isNotEmpty ? profile.lastName[0].toUpperCase() : 'T');
    final hasAvatar = profile.avatar != null && profile.avatar!.isNotEmpty;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 34,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                      backgroundImage: hasAvatar ? NetworkImage(profile.avatar!) : null,
                      child: !hasAvatar
                          ? Text(
                              initial,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: InkWell(
                        onTap: onAvatarTap,
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.fullName.isNotEmpty ? profile.fullName : 'Technician',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${profile.title ?? 'Certified Technician'} • ${profile.companyName ?? 'CalServices'}',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          StatusChip(
                            status: profile.registrationStatus,
                            dense: true,
                          ),
                          StatusChip(
                            status: profile.isOnline ? 'online' : 'offline',
                            dense: true,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.xs,
              children: [
                _HeaderMetaItem(
                  icon: Icons.badge_outlined,
                  text: 'ID: ${profile.employeeId ?? 'Pending'}',
                  isMono: true,
                ),
                if (profile.email != null && profile.email!.isNotEmpty)
                  _HeaderMetaItem(
                    icon: Icons.mail_outline_rounded,
                    text: profile.email!,
                  ),
                if (profile.displayPhone.isNotEmpty)
                  _HeaderMetaItem(
                    icon: Icons.phone_outlined,
                    text: profile.displayPhone,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderMetaItem extends StatelessWidget {
  const _HeaderMetaItem({
    required this.icon,
    required this.text,
    this.isMono = false,
  });

  final IconData icon;
  final String text;
  final bool isMono;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              color: AppColors.textSecondary,
              fontFamily: isMono ? 'monospace' : null,
              fontWeight: isMono ? FontWeight.bold : FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}

// ── 2. Personal Preferences (Directly Editable) ──────────────────────────────

class _PreferencesCard extends StatelessWidget {
  const _PreferencesCard({
    required this.phoneController,
    required this.bioController,
    required this.selectedTimezone,
    required this.selectedLanguage,
    required this.isSaving,
    required this.onTimezoneChanged,
    required this.onLanguageChanged,
    required this.onSave,
  });

  final TextEditingController phoneController;
  final TextEditingController bioController;
  final String selectedTimezone;
  final String selectedLanguage;
  final bool isSaving;
  final ValueChanged<String> onTimezoneChanged;
  final ValueChanged<String> onLanguageChanged;
  final VoidCallback onSave;

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
                      Icon(Icons.edit_note_rounded, size: 18, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'PERSONAL PREFERENCES',
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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: const Text(
                    'Directly Editable',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF065F46),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Contact Phone',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                TextFormField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'e.g. +91 9876543210',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Used for dispatch communications.',
                  style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Professional Bio / Notes',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                TextFormField(
                  controller: bioController,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'Short bio or technician specialization summary...',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Timezone',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          DropdownButtonFormField<String>(
                            initialValue: _validTimezones.contains(selectedTimezone) ? selectedTimezone : 'UTC',
                            isExpanded: true,
                            decoration: const InputDecoration(isDense: true),
                            items: const [
                              DropdownMenuItem(value: 'Asia/Kolkata', child: Text('Asia/Kolkata (IST)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'UTC', child: Text('UTC (Universal)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'America/New_York', child: Text('New York (EST)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'America/Los_Angeles', child: Text('Los Angeles (PST)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'Europe/London', child: Text('London (GMT)', style: TextStyle(fontSize: 12))),
                            ],
                            onChanged: (val) {
                              if (val != null) onTimezoneChanged(val);
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Language',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          DropdownButtonFormField<String>(
                            initialValue: _validLanguages.contains(selectedLanguage) ? selectedLanguage : 'en',
                            isExpanded: true,
                            decoration: const InputDecoration(isDense: true),
                            items: const [
                              DropdownMenuItem(value: 'en', child: Text('English (US/UK)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'hi', child: Text('Hindi (हिंदी)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'es', child: Text('Spanish (Español)', style: TextStyle(fontSize: 12))),
                              DropdownMenuItem(value: 'ta', child: Text('Tamil (தமிழ்)', style: TextStyle(fontSize: 12))),
                            ],
                            onChanged: (val) {
                              if (val != null) onLanguageChanged(val);
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton.icon(
                    onPressed: isSaving ? null : onSave,
                    icon: isSaving
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.save_rounded, size: 16),
                    label: Text(isSaving ? 'Saving...' : 'Save Preferences'),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(160, 42),
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static const _validTimezones = [
    'Asia/Kolkata',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
  ];

  static const _validLanguages = ['en', 'hi', 'es', 'ta'];
}

// ── 3. Verified Identity & Protected Fields ───────────────────────────────────

class _ProtectedIdentityCard extends StatelessWidget {
  const _ProtectedIdentityCard({
    required this.profile,
    required this.onRequestEdit,
  });

  final EmployeeProfile profile;
  final void Function(String key, String label) onRequestEdit;

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
                      const Icon(Icons.lock_outline_rounded, size: 18, color: Color(0xFFD97706)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'VERIFIED IDENTITY & EMPLOYMENT',
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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Text(
                    'Admin Approved / Verified',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.shield_outlined, size: 16, color: Color(0xFFD97706)),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Verified Data Governance Policy',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF92400E),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Legal identity, date of birth, company assignment, and bank details require an Employee Change Request with Admin verification before updating.',
                              style: TextStyle(
                                fontSize: 11,
                                height: 1.35,
                                color: Color(0xFF78350F),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _ProtectedFieldTile(
                  label: 'Legal First Name',
                  value: profile.firstName.isNotEmpty ? profile.firstName : '—',
                  onRequestEdit: () => onRequestEdit('first_name', 'Legal First Name'),
                ),
                _ProtectedFieldTile(
                  label: 'Legal Last Name',
                  value: profile.lastName.isNotEmpty ? profile.lastName : '—',
                  onRequestEdit: () => onRequestEdit('last_name', 'Legal Last Name'),
                ),
                _ProtectedFieldTile(
                  label: 'Date of Birth',
                  value: profile.dateOfBirth ?? '—',
                  onRequestEdit: () => onRequestEdit('date_of_birth', 'Date of Birth'),
                ),
                _ProtectedFieldTile(
                  label: 'Registered Mobile',
                  value: profile.mobileNumber ?? '—',
                  onRequestEdit: () => onRequestEdit('mobile_number', 'Registered Mobile'),
                  isMono: true,
                ),
                _ProtectedFieldTile(
                  label: 'Department',
                  value: profile.department ?? 'Field Services',
                  onRequestEdit: () => onRequestEdit('department', 'Department'),
                ),
                _ProtectedFieldTile(
                  label: 'State / Territory',
                  value: profile.state ?? 'California',
                  onRequestEdit: () => onRequestEdit('state', 'State / Territory'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProtectedFieldTile extends StatelessWidget {
  const _ProtectedFieldTile({
    required this.label,
    required this.value,
    required this.onRequestEdit,
    this.isMono = false,
  });

  final String label;
  final String value;
  final VoidCallback onRequestEdit;
  final bool isMono;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    fontFamily: isMono ? 'monospace' : null,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onRequestEdit,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              visualDensity: VisualDensity.compact,
            ),
            child: const Text('Request Edit', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

// ── 4. Change Requests History Section ────────────────────────────────────────

class _ChangeRequestsHistorySection extends StatelessWidget {
  const _ChangeRequestsHistorySection({
    required this.changeRequestsAsync,
    required this.onSubmitNew,
  });

  final AsyncValue<List<EmployeeChangeRequest>> changeRequestsAsync;
  final VoidCallback onSubmitNew;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
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
                      Icon(Icons.description_outlined, size: 16, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'EMPLOYEE CHANGE REQUESTS',
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
                TextButton.icon(
                  onPressed: onSubmitNew,
                  icon: const Icon(Icons.send_rounded, size: 13),
                  label: const Text('Submit New', style: TextStyle(fontSize: 11.5)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ),
          AsyncValueView<List<EmployeeChangeRequest>>(
            value: changeRequestsAsync,
            builder: (context, changeRequests) {
              if (changeRequests.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(AppSpacing.xl),
                  child: EmptyState(
                    icon: Icons.history_edu_outlined,
                    title: 'No change requests submitted',
                    message: 'All controlled records match your verified registration dossier.',
                    compact: true,
                  ),
                );
              }

              return ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: changeRequests.length,
                separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
                itemBuilder: (context, index) => _ChangeRequestCard(changeRequest: changeRequests[index]),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ChangeRequestCard extends StatelessWidget {
  const _ChangeRequestCard({required this.changeRequest});

  final EmployeeChangeRequest changeRequest;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    '#${changeRequest.id}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    changeRequest.fieldLabel,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              StatusChip(status: changeRequest.status.toLowerCase(), dense: true),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Old: ${changeRequest.oldValue ?? '—'}',
                style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, size: 12, color: Color(0xFF94A3B8)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'New: ${changeRequest.newValue}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Reason: "${changeRequest.reason}"',
            style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
          ),
          if (changeRequest.adminNotes != null && changeRequest.adminNotes!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Admin Note: ${changeRequest.adminNotes}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFD97706)),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Submit Change Request BottomSheet ────────────────────────────────────────

class _SubmitChangeRequestSheet extends StatefulWidget {
  const _SubmitChangeRequestSheet({
    required this.initialFieldKey,
    required this.onSubmit,
  });

  final String initialFieldKey;
  final Future<bool> Function(String fieldName, String fieldLabel, String newValue, String reason)
      onSubmit;

  @override
  State<_SubmitChangeRequestSheet> createState() => _SubmitChangeRequestSheetState();
}

class _SubmitChangeRequestSheetState extends State<_SubmitChangeRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _targetField;
  final _newValueController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;

  final _fieldMap = const {
    'first_name': 'Legal First Name',
    'last_name': 'Legal Last Name',
    'date_of_birth': 'Date of Birth',
    'mobile_number': 'Registered Mobile Number',
    'department': 'Department',
    'state': 'State / Territory',
    'bank_account': 'Bank Account / IFSC',
  };

  @override
  void initState() {
    super.initState();
    _targetField = _fieldMap.containsKey(widget.initialFieldKey)
        ? widget.initialFieldKey
        : 'first_name';
  }

  @override
  void dispose() {
    _newValueController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final success = await widget.onSubmit(
      _targetField,
      _fieldMap[_targetField] ?? _targetField,
      _newValueController.text.trim(),
      _reasonController.text.trim(),
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.of(context).pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Submit Profile Change Request',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Target Controlled Field',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                initialValue: _targetField,
                isExpanded: true,
                decoration: const InputDecoration(isDense: true),
                items: _fieldMap.entries
                    .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _targetField = val);
                },
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'New Requested Value',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              TextFormField(
                controller: _newValueController,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(
                  hintText: 'Enter new correct value...',
                  isDense: true,
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Please enter the new requested value' : null,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Reason for Change & Supporting Reference',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              TextFormField(
                controller: _reasonController,
                maxLines: 3,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(
                  hintText: 'Explain reason for correction or update...',
                  isDense: true,
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Please enter a valid business reason' : null,
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submit,
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.send_rounded, size: 15),
                    label: Text(_isSubmitting ? 'Submitting...' : 'Submit for Admin Review'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}
