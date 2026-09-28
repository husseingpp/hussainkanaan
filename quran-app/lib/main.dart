import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite_common_ffi/sqflite_ffi.dart' show databaseFactoryFfi, sqfliteFfiInit;

import 'app.dart';
import 'data/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ProviderScope(
      overrides: [databaseFactoryProvider.overrideWithValue(_databaseFactory())],
      child: const QuranApp(),
    ),
  );
}

sqflite.DatabaseFactory _databaseFactory() {
  if (Platform.isLinux || Platform.isWindows || Platform.isMacOS) {
    sqfliteFfiInit();
    return databaseFactoryFfi;
  }
  return sqflite.databaseFactory;
}
