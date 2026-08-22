import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../domain/saved_location.dart';
import 'locations_providers.dart';
import 'widgets/location_picker_map.dart';

const Map<String, IconData> _labelIcons = {
  'home': Icons.home_outlined,
  'work': Icons.business_center_outlined,
  'other': Icons.place_outlined,
};

class LocationsScreen extends ConsumerStatefulWidget {
  const LocationsScreen({super.key});

  @override
  ConsumerState<LocationsScreen> createState() => _LocationsScreenState();
}

class _LocationsScreenState extends ConsumerState<LocationsScreen> {
  // 'list' | 'add' | 'edit'
  String _view = 'list';
  int? _editingId;

  // Form state matching web EMPTY_FORM
  String _label = 'other';
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _localityController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _landmarkController = TextEditingController();
  double? _selectedLat;
  double? _selectedLng;
  bool _isDefault = false;
  bool _isGeocoding = false;

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _localityController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  void _openAdd() {
    setState(() {
      _view = 'add';
      _editingId = null;
      _label = 'other';
      _nameController.clear();
      _addressController.clear();
      _localityController.clear();
      _cityController.clear();
      _stateController.clear();
      _pincodeController.clear();
      _landmarkController.clear();
      _selectedLat = null;
      _selectedLng = null;
      _isDefault = false;
      _isGeocoding = false;
    });
  }

  void _openEdit(SavedLocation loc) {
    setState(() {
      _view = 'edit';
      _editingId = loc.id;
      _label = loc.label;
      _nameController.text = loc.name ?? '';
      _addressController.text = loc.address ?? '';
      _localityController.text = loc.locality ?? '';
      _cityController.text = loc.city ?? '';
      _stateController.text = loc.state ?? '';
      _pincodeController.text = loc.pincode ?? '';
      _landmarkController.text = loc.landmark ?? '';
      _selectedLat = loc.latitude;
      _selectedLng = loc.longitude;
      _isDefault = loc.isDefault;
      _isGeocoding = false;
    });
  }

  void _closeForm() {
    setState(() {
      _view = 'list';
      _editingId = null;
      _isGeocoding = false;
    });
  }

  Future<void> _handlePositionChange(double lat, double lng) async {
    setState(() {
      _selectedLat = lat;
      _selectedLng = lng;
      _isGeocoding = true;
    });

    try {
      final addr = await ref.read(locationsControllerProvider.notifier).reverseGeocode(lat, lng);
      if (addr != null && mounted) {
        setState(() {
          final formatted = addr.formattedAddress;
          final locality = addr.locality;
          final city = addr.city;
          final state = addr.state;
          final pincode = addr.pincode;

          if (formatted != null && formatted.isNotEmpty) {
            _addressController.text = formatted;
          }
          if (locality != null && locality.isNotEmpty) {
            _localityController.text = locality;
          }
          if (city != null && city.isNotEmpty) {
            _cityController.text = city;
          }
          if (state != null && state.isNotEmpty) {
            _stateController.text = state;
          }
          if (pincode != null && pincode.isNotEmpty) {
            _pincodeController.text = pincode;
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isGeocoding = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationsAsync = ref.watch(savedLocationsProvider);
    final actionState = ref.watch(locationsControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _view == 'list'
              ? 'My Saved Locations'
              : (_view == 'add' ? 'Add New Location' : 'Edit Location'),
        ),
        leading: _view != 'list'
            ? IconButton(
                icon: const Icon(Icons.chevron_left_rounded, size: 28),
                tooltip: 'Back to list',
                onPressed: _closeForm,
              )
            : null,
        actions: [
          if (_view == 'list') ...[
            IconButton(
              icon: const Icon(Icons.add_location_alt_outlined),
              tooltip: 'Add Location',
              onPressed: _openAdd,
            ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh locations',
              onPressed: () => ref.refresh(savedLocationsProvider.future),
            ),
          ],
        ],
      ),
      body: _view == 'list'
          ? _buildListView(locationsAsync, actionState)
          : _buildFormView(actionState),
    );
  }

  Widget _buildListView(
    AsyncValue<List<SavedLocation>> locationsAsync,
    AsyncValue<void> actionState,
  ) {
    return RefreshIndicator(
      onRefresh: () => ref.refresh(savedLocationsProvider.future),
      child: AsyncValueView<List<SavedLocation>>(
        value: locationsAsync,
        onRetry: () => ref.invalidate(savedLocationsProvider),
        builder: (context, locations) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              _LocationsHeader(onAdd: _openAdd),
              const SizedBox(height: AppSpacing.md),
              if (locations.isEmpty)
                const EmptyState(
                  icon: Icons.location_on_outlined,
                  title: 'No saved locations yet',
                  message: 'Click "Add Location" to save your home, work, or any frequently visited place.',
                )
              else
                for (final location in locations)
                  _LocationCard(
                    location: location,
                    isLoading: actionState.isLoading,
                    onEdit: () => _openEdit(location),
                    onSetDefault: () => _handleSetDefault(location.id),
                    onDelete: () => _confirmDeleteLocation(location),
                    onNavigate: () => _handleNavigate(location),
                  ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFormView(AsyncValue<void> actionState) {
    final isSaving = actionState.isLoading;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.xxl,
      ),
      children: [
        // Top breadcrumb navigation matching web
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: _closeForm,
              icon: const Icon(Icons.chevron_left, size: 16),
              label: const Text('Back to list', style: TextStyle(fontSize: 12)),
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 32),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          _view == 'add' ? 'Add New Location' : 'Edit Location',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        Text(
          'Select a position on the map, then fill in the details below.',
          style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.md),

        // Section 1: Select Location on Map
        Card(
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.navigation_outlined, size: 16, color: Color(0xFF2563EB)),
                    const SizedBox(width: 6),
                    const Flexible(
                      child: Text(
                        'Select Location on Map',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                LocationPickerMap(
                  latitude: _selectedLat,
                  longitude: _selectedLng,
                  onPositionChange: _handlePositionChange,
                  isResolvingAddress: _isGeocoding,
                  height: 240,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Section 2: Location Details Form
        Card(
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Location Details',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: AppSpacing.md),

                LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 340;

                    if (isCompact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Label', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _label,
                                isExpanded: true,
                                style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
                                items: const [
                                  DropdownMenuItem(value: 'home', child: Text('Home')),
                                  DropdownMenuItem(value: 'work', child: Text('Work')),
                                  DropdownMenuItem(value: 'other', child: Text('Other')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _label = val);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          const Row(
                            children: [
                              Text('Location Name ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              Text('*', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
                            ],
                          ),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _nameController,
                            style: const TextStyle(fontSize: 12.5),
                            decoration: const InputDecoration(
                              hintText: 'e.g. My Home / Office',
                              isDense: true,
                            ),
                          ),
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 4,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Label', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: DropdownButtonHideUnderline(
                                  child: DropdownButton<String>(
                                    value: _label,
                                    isExpanded: true,
                                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
                                    items: const [
                                      DropdownMenuItem(value: 'home', child: Text('Home')),
                                      DropdownMenuItem(value: 'work', child: Text('Work')),
                                      DropdownMenuItem(value: 'other', child: Text('Other')),
                                    ],
                                    onChanged: (val) {
                                      if (val != null) setState(() => _label = val);
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 6,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Text('Location Name ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                                  Text('*', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
                                ],
                              ),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: _nameController,
                                style: const TextStyle(fontSize: 12.5),
                                decoration: const InputDecoration(
                                  hintText: 'e.g. My Home / Office',
                                  isDense: true,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),

                // Full Address
                const Text('Full Address', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                TextFormField(
                  controller: _addressController,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 12.5),
                  decoration: const InputDecoration(
                    hintText: 'Auto-filled from map selection (you can edit)',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Area / Locality & City
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 340;

                    if (isCompact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Area / Locality', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _localityController,
                            style: const TextStyle(fontSize: 12.5),
                            decoration: const InputDecoration(isDense: true),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          const Text('City', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _cityController,
                            style: const TextStyle(fontSize: 12.5),
                            decoration: const InputDecoration(isDense: true),
                          ),
                        ],
                      );
                    }

                    return Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Area / Locality', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: _localityController,
                                style: const TextStyle(fontSize: 12.5),
                                decoration: const InputDecoration(isDense: true),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('City', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: _cityController,
                                style: const TextStyle(fontSize: 12.5),
                                decoration: const InputDecoration(isDense: true),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),

                // State & Pincode
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 340;

                    if (isCompact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('State', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _stateController,
                            style: const TextStyle(fontSize: 12.5),
                            decoration: const InputDecoration(isDense: true),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          const Text('Pincode', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _pincodeController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontSize: 12.5),
                            decoration: const InputDecoration(isDense: true),
                          ),
                        ],
                      );
                    }

                    return Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('State', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: _stateController,
                                style: const TextStyle(fontSize: 12.5),
                                decoration: const InputDecoration(isDense: true),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Pincode', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: _pincodeController,
                                keyboardType: TextInputType.number,
                                style: const TextStyle(fontSize: 12.5),
                                decoration: const InputDecoration(isDense: true),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),

                // Landmark
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Landmark (optional)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _landmarkController,
                      style: const TextStyle(fontSize: 12.5),
                      decoration: const InputDecoration(
                        hintText: 'e.g. Near Metro',
                        isDense: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // Set as default checkbox
                CheckboxListTile(
                  title: const Text('Set as my default location', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  value: _isDefault,
                  onChanged: (val) => setState(() => _isDefault = val ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
                const SizedBox(height: AppSpacing.md),

                // Actions matching web
                Align(
                  alignment: Alignment.centerRight,
                  child: Wrap(
                    alignment: WrapAlignment.end,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      OutlinedButton.icon(
                        onPressed: isSaving ? null : _closeForm,
                        icon: const Icon(Icons.close, size: 14),
                        label: const Text('Cancel', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: (isSaving || _selectedLat == null) ? null : _handleSaveLocation,
                        icon: isSaving
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.save_outlined, size: 15),
                        label: Text(
                          isSaving ? 'Saving…' : (_view == 'edit' ? 'Update Location' : 'Save Location'),
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _handleSaveLocation() async {
    final lat = _selectedLat;
    final lng = _selectedLng;
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a location on the map before saving.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location name is required.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    final payload = {
      'label': _label,
      'name': name,
      'address': _addressController.text.trim(),
      'locality': _localityController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateController.text.trim(),
      'pincode': _pincodeController.text.trim(),
      'landmark': _landmarkController.text.trim(),
      'latitude': double.parse(lat.toStringAsFixed(7)),
      'longitude': double.parse(lng.toStringAsFixed(7)),
      'is_default': _isDefault,
    };

    bool success;
    final editId = _editingId;
    if (_view == 'edit' && editId != null) {
      success = await ref.read(locationsControllerProvider.notifier).updateLocation(editId, payload);
    } else {
      success = await ref.read(locationsControllerProvider.notifier).createLocation(payload);
    }

    if (!mounted) return;

    if (success) {
      _closeForm();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_view == 'edit' ? 'Location updated successfully.' : 'Location saved successfully.'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save location.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _handleSetDefault(int id) async {
    final success = await ref.read(locationsControllerProvider.notifier).setDefault(id);
    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Default location updated.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to set default location.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _confirmDeleteLocation(SavedLocation loc) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete "${loc.displayTitle}"?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final success = await ref.read(locationsControllerProvider.notifier).deleteLocation(loc.id);
    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location deleted.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to delete location.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  void _handleNavigate(SavedLocation loc) {
    if (!loc.hasCoordinates) return;
    final url = 'https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}';
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}

// ── Locations Header ──────────────────────────────────────────────────────────

class _LocationsHeader extends StatelessWidget {
  const _LocationsHeader({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 340;

        if (isCompact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'My Saved Locations',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 2),
              Text(
                'Manage your personal saved locations for quick access during jobs.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              ElevatedButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Location', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          );
        }

        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'My Saved Locations',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Manage your personal saved locations for quick access during jobs.',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            ElevatedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add Location', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        );
      },
    );
  }
}

// ── Location Card ─────────────────────────────────────────────────────────────

class _LocationCard extends StatelessWidget {
  const _LocationCard({
    required this.location,
    required this.isLoading,
    required this.onEdit,
    required this.onSetDefault,
    required this.onDelete,
    required this.onNavigate,
  });

  final SavedLocation location;
  final bool isLoading;
  final VoidCallback onEdit;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;
  final VoidCallback onNavigate;

  @override
  Widget build(BuildContext context) {
    final icon = _labelIcons[location.label] ?? Icons.place_outlined;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              location.displayTitle,
                              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                          if (location.isDefault)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFFA7F3D0)),
                              ),
                              child: const Text(
                                'DEFAULT',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF065F46),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(location.fullAddress, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
            if (location.hasCoordinates) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${location.latitude?.toStringAsFixed(5)}, ${location.longitude?.toStringAsFixed(5)}',
                style: const TextStyle(fontSize: 10.5, fontFamily: 'monospace', color: Color(0xFF94A3B8)),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: [
                Wrap(
                  spacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (!location.isDefault)
                      TextButton(
                        onPressed: isLoading ? null : onSetDefault,
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          visualDensity: VisualDensity.compact,
                        ),
                        child: const Text('Set as Default', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    if (location.hasCoordinates)
                      TextButton.icon(
                        onPressed: onNavigate,
                        icon: const Icon(Icons.navigation_outlined, size: 13),
                        label: const Text('Directions', style: TextStyle(fontSize: 11)),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      tooltip: 'Edit location',
                      visualDensity: VisualDensity.compact,
                      onPressed: onEdit,
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                      tooltip: 'Delete location',
                      visualDensity: VisualDensity.compact,
                      onPressed: onDelete,
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
