import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/appearance_preferences.dart';
import 'providers/appearance_providers.dart';
import 'widgets/settings_section_card.dart';
import 'widgets/toggle_row.dart';

class AppearanceScreen extends ConsumerStatefulWidget {
  const AppearanceScreen({super.key});

  @override
  ConsumerState<AppearanceScreen> createState() => _AppearanceScreenState();
}

class _AppearanceScreenState extends ConsumerState<AppearanceScreen> {
  AppearancePreferences? _draft;
  bool _isSaving = false;
  String? _error;
  String? _success;

  @override
  Widget build(BuildContext context) {
    final savedAsync = ref.watch(appearanceControllerProvider);

    // Seed the local draft once the real saved preferences arrive, so the
    // form reflects what's actually persisted rather than the defaults.
    ref.listen(appearanceControllerProvider, (previous, next) {
      if (_draft == null && next.hasValue) {
        setState(() => _draft = next.value);
      }
    });
    final draft = _draft ?? savedAsync.valueOrNull ?? AppearancePreferences.defaults;

    return Scaffold(
      appBar: AppBar(title: const Text('Appearance & UI')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: [
          SettingsSectionCard(
            icon: Icons.palette_outlined,
            title: 'Display & Visual Preferences',
            subtitle: 'Preferences are stored on the server and persist across devices.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) _Banner(message: _error!, isError: true),
                if (_success != null) _Banner(message: _success!, isError: false),
                if (_error != null || _success != null) const SizedBox(height: AppSpacing.sm),

                const _FieldLabel('Interface Theme'),
                const SizedBox(height: 6),
                _ThemeSelector(
                  value: draft.theme,
                  onChanged: (mode) => setState(() => _draft = draft.copyWith(theme: mode)),
                ),

                const SizedBox(height: AppSpacing.lg),
                const _FieldLabel('Accent Highlight Color'),
                const SizedBox(height: 8),
                _AccentSelector(
                  value: draft.accentColor,
                  onChanged: (accent) => setState(() => _draft = draft.copyWith(accentColor: accent)),
                ),

                const SizedBox(height: AppSpacing.lg),
                const _FieldLabel('Layout Density'),
                const SizedBox(height: 6),
                SegmentedButton<LayoutDensityOption>(
                  segments: LayoutDensityOption.values
                      .map((d) => ButtonSegment(value: d, label: Text(d.label)))
                      .toList(),
                  selected: {draft.layoutDensity},
                  onSelectionChanged: (selection) =>
                      setState(() => _draft = draft.copyWith(layoutDensity: selection.first)),
                ),

                const SizedBox(height: AppSpacing.md),
                const Divider(),
                ToggleRow(
                  title: 'Enable High Contrast Mode',
                  value: draft.highContrast,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(highContrast: v)),
                ),
                ToggleRow(
                  title: 'Reduce Animations & Transitions',
                  value: draft.reducedMotion,
                  onChanged: (v) => setState(() => _draft = draft.copyWith(reducedMotion: v)),
                ),

                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : () => _save(draft),
                    icon: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.save_outlined, size: 18),
                    label: Text(_isSaving ? 'Saving...' : 'Save Appearance Preferences'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save(AppearancePreferences draft) async {
    setState(() {
      _isSaving = true;
      _error = null;
      _success = null;
    });
    try {
      await ref.read(appearanceControllerProvider.notifier).save(draft);
      setState(() => _success = 'Appearance preferences saved.');
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e, fallback: 'Failed to save appearance preferences.'));
    } catch (_) {
      setState(() => _error = 'Failed to save appearance preferences.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700));
  }
}

class _ThemeSelector extends StatelessWidget {
  const _ThemeSelector({required this.value, required this.onChanged});

  final AppThemeMode value;
  final ValueChanged<AppThemeMode> onChanged;

  static const _options = [
    (AppThemeMode.light, 'Light', Icons.light_mode_outlined),
    (AppThemeMode.dark, 'Dark', Icons.dark_mode_outlined),
    (AppThemeMode.system, 'System', Icons.brightness_auto_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final option in _options)
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: option == _options.last ? 0 : AppSpacing.sm),
              child: _SelectableTile(
                selected: value == option.$1,
                icon: option.$3,
                label: option.$2,
                onTap: () => onChanged(option.$1),
              ),
            ),
          ),
      ],
    );
  }
}

class _SelectableTile extends StatelessWidget {
  const _SelectableTile({
    required this.selected,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.chip),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? primary.withValues(alpha: 0.1) : AppColors.background,
          borderRadius: BorderRadius.circular(AppRadius.chip),
          border: Border.all(color: selected ? primary : AppColors.border, width: selected ? 1.5 : 1),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: selected ? primary : AppColors.textMuted),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccentSelector extends StatelessWidget {
  const _AccentSelector({required this.value, required this.onChanged});

  final AccentColorOption value;
  final ValueChanged<AccentColorOption> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.sm,
      children: [
        for (final option in AccentColorOption.values)
          _AccentSwatch(
            option: option,
            selected: value == option,
            onTap: () => onChanged(option),
          ),
      ],
    );
  }
}

class _AccentSwatch extends StatelessWidget {
  const _AccentSwatch({required this.option, required this.selected, required this.onTap});

  final AccentColorOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = colorForAccent(option);
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: selected ? AppColors.textPrimary : Colors.transparent,
                width: 2,
              ),
              boxShadow: [
                BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 6, offset: const Offset(0, 2)),
              ],
            ),
            child: selected ? const Icon(Icons.check_rounded, color: Colors.white, size: 20) : null,
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: 64,
            child: Text(
              option.label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFDC2626) : const Color(0xFF059669);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.chip),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, size: 16, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Text(message, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
