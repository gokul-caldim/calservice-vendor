import 'package:flutter/material.dart';

import '../../features/settings/domain/appearance_preferences.dart';

/// Brand colors, matched to the existing web app's Tailwind palette.
///
/// `background`/`surface`/`border`/`textPrimary`/`textSecondary`/`textMuted`
/// are computed getters, not literal constants, driven by [configure] —
/// called once per frame from app.dart's build(), before any child widget
/// builds. This is a deliberate, pragmatic choice: the app has hundreds of
/// widgets that reference `AppColors.textPrimary` etc. directly (not via
/// `Theme.of(context)`), inherited from earlier phases. Converting every
/// call site to be theme-aware was out of scope for the Settings phase, so
/// this makes the existing call sites automatically pick up dark mode and
/// high contrast without changing them, at the cost of a small global-state
/// pattern instead of Flutter's usual InheritedWidget theming.
class AppColors {
  AppColors._();

  static Brightness _brightness = Brightness.light;
  static bool _highContrast = false;

  static void configure({required Brightness brightness, required bool highContrast}) {
    _brightness = brightness;
    _highContrast = highContrast;
  }

  static bool get _isDark => _brightness == Brightness.dark;

  // Brand colors — these don't invert with theme.
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color accent = Color(0xFFF59E0B);
  static const Color darkSurface = Color(0xFF0F172A);

  static Color get background =>
      _isDark ? const Color(0xFF0B1220) : const Color(0xFFF8FAFC);

  static Color get surface => _isDark ? const Color(0xFF151E2E) : Colors.white;

  static Color get border {
    if (_isDark) return _highContrast ? Colors.white54 : const Color(0xFF243044);
    return _highContrast ? Colors.black54 : const Color(0xFFE2E8F0);
  }

  static Color get textPrimary {
    if (_isDark) return _highContrast ? Colors.white : const Color(0xFFF1F5F9);
    return _highContrast ? Colors.black : const Color(0xFF0F172A);
  }

  static Color get textSecondary =>
      _isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569);

  static Color get textMuted => _isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
}

/// A small, consistent spacing scale used across every screen so padding
/// and gaps don't drift screen-to-screen.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

class AppRadius {
  AppRadius._();

  static const double card = 14;
  static const double chip = 8;
  static const double button = 10;
  static const double input = 10;
}

/// A page transition that swaps instantly — used app-wide when the user
/// enables "Reduce Animations & Transitions".
class InstantPageTransitionsBuilder extends PageTransitionsBuilder {
  const InstantPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return child;
  }
}

Color colorForAccent(AccentColorOption accent) {
  switch (accent) {
    case AccentColorOption.blue:
      return const Color(0xFF2563EB);
    case AccentColorOption.emerald:
      return const Color(0xFF059669);
    case AccentColorOption.indigo:
      return const Color(0xFF4F46E5);
    case AccentColorOption.violet:
      return const Color(0xFF7C3AED);
    case AccentColorOption.amber:
      return const Color(0xFFD97706);
  }
}

class AppTheme {
  AppTheme._();

  /// Builds the live ThemeData for the given resolved appearance.
  /// `AppColors.configure(...)` must be called with the same brightness/
  /// high-contrast values before this widget tree builds, so the two stay
  /// in sync — app.dart does this immediately before calling build().
  static ThemeData build({
    required Brightness brightness,
    required AccentColorOption accent,
    required LayoutDensityOption density,
    required bool highContrast,
    required bool reducedMotion,
  }) {
    final seed = colorForAccent(accent);
    final colorScheme = ColorScheme.fromSeed(seedColor: seed, brightness: brightness);

    final pageTransitionsTheme = reducedMotion
        ? const PageTransitionsTheme(
            builders: {
              TargetPlatform.android: InstantPageTransitionsBuilder(),
              TargetPlatform.iOS: InstantPageTransitionsBuilder(),
            },
          )
        : const PageTransitionsTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      visualDensity: density == LayoutDensityOption.compact
          ? VisualDensity.compact
          : VisualDensity.standard,
      scaffoldBackgroundColor: AppColors.background,
      pageTransitionsTheme: pageTransitionsTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkSurface,
        foregroundColor: Colors.white,
        centerTitle: false,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: AppColors.border, width: highContrast ? 1.4 : 1),
        ),
      ),
      dividerTheme: DividerThemeData(color: AppColors.border, thickness: highContrast ? 1.2 : 1),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: colorScheme.primary.withValues(alpha: 0.14),
        elevation: 2,
        height: 64,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? colorScheme.primary : AppColors.textMuted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? colorScheme.primary : AppColors.textMuted);
        }),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(64, 44),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 44),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      textTheme: TextTheme(
        headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        bodyLarge: TextStyle(fontSize: 15, color: AppColors.textPrimary),
        bodyMedium: TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
        labelSmall: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 0.6,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.5),
        ),
      ),
    );
  }
}
