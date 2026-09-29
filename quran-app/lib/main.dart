import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite_common_ffi/sqflite_ffi.dart' show databaseFactoryFfi, sqfliteFfiInit;

import 'app.dart';
import 'data/providers.dart';
import 'features/listen/listen_audio.dart';
import 'features/listen/listen_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Listen Mode's background service: phones only for now (desktop is Phase 7).
  final audio = Platform.isAndroid || Platform.isIOS ? await initAudio() : null;
  runApp(
    ProviderScope(
      overrides: [
        databaseFactoryProvider.overrideWithValue(_databaseFactory()),
        audioHandlerProvider.overrideWithValue(audio),
      ],
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
