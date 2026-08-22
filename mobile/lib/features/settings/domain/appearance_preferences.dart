import '../../../core/utils/json_parsing.dart';

enum AppThemeMode {
  light('light'),
  dark('dark'),
  system('system');

  const AppThemeMode(this.apiValue);
  final String apiValue;

  static AppThemeMode fromApi(String? value) {
    return AppThemeMode.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => AppThemeMode.light,
    );
  }
}

enum AccentColorOption {
  blue('blue', 'CalServices Blue'),
  emerald('emerald', 'Emerald Green'),
  indigo('indigo', 'Indigo Corporate'),
  violet('violet', 'Violet Modern'),
  amber('amber', 'Amber Warm');

  const AccentColorOption(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static AccentColorOption fromApi(String? value) {
    return AccentColorOption.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => AccentColorOption.blue,
    );
  }
}

enum LayoutDensityOption {
  comfortable('comfortable', 'Comfortable (Standard)'),
  compact('compact', 'Compact (Dense Enterprise)');

  const LayoutDensityOption(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static LayoutDensityOption fromApi(String? value) {
    return LayoutDensityOption.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => LayoutDensityOption.comfortable,
    );
  }
}

/// Mirrors WorkforceUserPreferenceSerializer
/// (backend/workforce_api/serializers.py:848-861), served by
/// GET/PATCH /workforce/preferences/. `fontSize` is stored by the backend
/// but has no editable control on web either — passed through unchanged.
class AppearancePreferences {
  const AppearancePreferences({
    required this.theme,
    required this.accentColor,
    required this.layoutDensity,
    this.fontSize,
    required this.highContrast,
    required this.reducedMotion,
  });

  factory AppearancePreferences.fromJson(Map<String, dynamic> json) {
    return AppearancePreferences(
      theme: AppThemeMode.fromApi(parseString(json['theme'])),
      accentColor: AccentColorOption.fromApi(parseString(json['accent_color'])),
      layoutDensity: LayoutDensityOption.fromApi(parseString(json['layout_density'])),
      fontSize: parseString(json['font_size']),
      highContrast: parseBool(json['high_contrast']),
      reducedMotion: parseBool(json['reduced_motion']),
    );
  }

  static const defaults = AppearancePreferences(
    theme: AppThemeMode.light,
    accentColor: AccentColorOption.blue,
    layoutDensity: LayoutDensityOption.comfortable,
    highContrast: false,
    reducedMotion: false,
  );

  final AppThemeMode theme;
  final AccentColorOption accentColor;
  final LayoutDensityOption layoutDensity;
  final String? fontSize;
  final bool highContrast;
  final bool reducedMotion;

  Map<String, dynamic> toJson() => {
    'theme': theme.apiValue,
    'accent_color': accentColor.apiValue,
    'layout_density': layoutDensity.apiValue,
    if (fontSize != null) 'font_size': fontSize,
    'high_contrast': highContrast,
    'reduced_motion': reducedMotion,
  };

  AppearancePreferences copyWith({
    AppThemeMode? theme,
    AccentColorOption? accentColor,
    LayoutDensityOption? layoutDensity,
    bool? highContrast,
    bool? reducedMotion,
  }) {
    return AppearancePreferences(
      theme: theme ?? this.theme,
      accentColor: accentColor ?? this.accentColor,
      layoutDensity: layoutDensity ?? this.layoutDensity,
      fontSize: fontSize,
      highContrast: highContrast ?? this.highContrast,
      reducedMotion: reducedMotion ?? this.reducedMotion,
    );
  }
}
