import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'features/shell/app_shell.dart';

class QuranApp extends StatelessWidget {
  const QuranApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'القرآن الكريم',
      debugShowCheckedModeBanner: false,
      // RTL is the default, set here at the root; LTR is the exception.
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: const AppShell(),
    );
  }
}

ThemeData _theme(Brightness brightness) => ThemeData(
      brightness: brightness,
      colorSchemeSeed: const Color(0xFF1B5E4A),
      useMaterial3: true,
    );
