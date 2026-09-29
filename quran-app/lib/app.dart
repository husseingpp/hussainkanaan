import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/providers.dart';
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
    return MaterialApp(
      title: 'القرآن الكريم',
      debugShowCheckedModeBanner: false,
      // RTL is the default, set here at the root; LTR is the exception.
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      themeMode: themeMode,
      home: home ?? AppShell(openReaderOnLaunch: openReaderOnLaunch),
    );
  }
}

ThemeData _theme(Brightness brightness) => ThemeData(
      brightness: brightness,
      colorSchemeSeed: const Color(0xFF1B5E4A),
      useMaterial3: true,
    );
