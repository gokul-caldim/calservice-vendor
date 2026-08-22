import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'features/settings/domain/appearance_preferences.dart';
import 'features/settings/presentation/providers/appearance_providers.dart';
import 'routing/app_router.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // "Follow System" needs to react when the OS flips light/dark at runtime
  // (e.g. scheduled dark mode), not just when preferences are (re)loaded.
  @override
  void didChangePlatformBrightness() {
    setState(() {});
  }

  Brightness _resolveBrightness(AppThemeMode mode) {
    switch (mode) {
      case AppThemeMode.light:
        return Brightness.light;
      case AppThemeMode.dark:
        return Brightness.dark;
      case AppThemeMode.system:
        return SchedulerBinding.instance.platformDispatcher.platformBrightness;
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final appearance = ref.watch(currentAppearanceProvider);

    final brightness = _resolveBrightness(appearance.theme);
    // Must run before this build() returns — every descendant that reads
    // AppColors.* during its own build resolves against this configuration.
    AppColors.configure(brightness: brightness, highContrast: appearance.highContrast);

    final themeData = AppTheme.build(
      brightness: brightness,
      accent: appearance.accentColor,
      density: appearance.layoutDensity,
      highContrast: appearance.highContrast,
      reducedMotion: appearance.reducedMotion,
    );

    return MaterialApp.router(
      title: 'Sevo',
      debugShowCheckedModeBanner: false,
      theme: themeData,
      routerConfig: router,
    );
  }
}
