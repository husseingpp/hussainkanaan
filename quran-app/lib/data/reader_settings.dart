import 'dart:convert';

import 'package:flutter/material.dart';

enum ReaderView { page, reading }

class ReaderSettings {
  const ReaderSettings({
    this.themeMode = ThemeMode.system,
    this.view = ReaderView.page,
    this.fontScale = 1.0,
    this.showTranslation = false,
  });

  factory ReaderSettings.fromJson(Map<String, Object?> j) => ReaderSettings(
        themeMode: ThemeMode.values.asNameMap()[j['themeMode']] ?? ThemeMode.system,
        view: ReaderView.values.asNameMap()[j['view']] ?? ReaderView.page,
        fontScale: (j['fontScale'] as num?)?.toDouble().clamp(minScale, maxScale) ?? 1.0,
        showTranslation: j['showTranslation'] as bool? ?? false,
      );

  static const minScale = 0.8;
  static const maxScale = 2.0;

  final ThemeMode themeMode;
  final ReaderView view;

  /// Reading View text size; Page View is fixed-layout by design.
  final double fontScale;
  final bool showTranslation;

  ReaderSettings copyWith({ThemeMode? themeMode, ReaderView? view, double? fontScale, bool? showTranslation}) =>
      ReaderSettings(
        themeMode: themeMode ?? this.themeMode,
        view: view ?? this.view,
        fontScale: (fontScale ?? this.fontScale).clamp(minScale, maxScale),
        showTranslation: showTranslation ?? this.showTranslation,
      );

  String toJson() => jsonEncode({
        'themeMode': themeMode.name,
        'view': view.name,
        'fontScale': fontScale,
        'showTranslation': showTranslation,
      });
}
