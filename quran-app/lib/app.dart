import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/providers.dart';
import 'features/calendar/calendar_providers.dart';
import 'features/shell/app_shell.dart';

class QuranApp extends ConsumerWidget {
  const QuranApp({super.key, this.home, this.openReaderOnLaunch = true});

  /// Replaces the shell as the first screen (screenshots, deep links).
  final Widget? home;

  /// Open the mus'haf at the last position on launch (tests turn it off).
  final bool openReaderOnLaunch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Night mode: the reader's theme setting drives the whole app.
    final themeMode = ref.watch(settingsProvider.select((s) => s.value?.themeMode)) ?? ThemeMode.system;
    // Opt-in: a muted palette in the mourning seasons (BLUEPRINT §9).
    final mourning = ref.watch(mourningThemeProvider);
    return MaterialApp(
      title: 'القرآن الكريم',
      debugShowCheckedModeBanner: false,
      // RTL is the default, set here at the root; LTR is the exception.
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: _theme(Brightness.light, mourning: mourning),
      darkTheme: _theme(Brightness.dark, mourning: mourning),
      themeMode: themeMode,
      home: home ?? AppShell(openReaderOnLaunch: openReaderOnLaunch),
    );
  }
}

ThemeData _theme(Brightness brightness, {bool mourning = false}) => ThemeData(
      brightness: brightness,
      colorSchemeSeed: mourning ? const Color(0xFF3C3C3C) : const Color(0xFF1B5E4A),
      useMaterial3: true,
    );
