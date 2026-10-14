import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/platform.dart' as platform;
import 'data/db_factory.dart';
import 'data/providers.dart';
import 'features/listen/listen_audio.dart';
import 'features/listen/listen_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // The audio service: background playback with lock-screen controls on
  // phones, the browser's media session on the web. Desktop is Phase 7.
  final audio = platform.isMobile || platform.isWeb ? await initAudio() : null;
  runApp(
    ProviderScope(
      overrides: [
        databaseFactoryProvider.overrideWithValue(platformDatabaseFactory()),
        audioHandlerProvider.overrideWithValue(audio),
      ],
      child: const QuranApp(),
    ),
  );
}
