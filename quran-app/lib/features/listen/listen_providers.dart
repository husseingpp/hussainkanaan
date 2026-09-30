import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;

import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/user_repository.dart';
import 'audio_library.dart';
import 'listen_audio.dart';
import 'listen_session.dart';

/// The running audio service; overridden in main(). Null where Listen Mode
/// isn't available yet (desktop).
final audioHandlerProvider = Provider<QuranAudioHandler?>((ref) => null);

final recitersProvider = FutureProvider<List<Reciter>>(
  (ref) async => (await ref.watch(contentDbProvider.future)).reciters(),
);

final surahSizesProvider = FutureProvider.family<Map<int, int>, int>(
  (ref, reciterId) async => (await ref.watch(contentDbProvider.future)).surahSizes(reciterId),
);

final audioLibraryProvider = FutureProvider<AudioLibrary>(
  (ref) async => AudioLibrary(directory: p.join(await ref.watch(appDirectoryProvider.future), 'audio')),
);

/// Which surahs a reciter has fully downloaded. Invalidate after downloads.
final downloadedSurahsProvider = FutureProvider.family<Set<int>, String>((ref, slug) async {
  final lib = await ref.watch(audioLibraryProvider.future);
  final reciters = await ref.watch(recitersProvider.future);
  final surahs = await ref.watch(surahsProvider.future);
  final r = reciters.where((r) => r.slug == slug).firstOrNull;
  return r == null ? const {} : lib.downloadedSurahs(r, surahs);
});

class ListenSettingsNotifier extends AsyncNotifier<ListenSettings> {
  @override
  Future<ListenSettings> build() async =>
      (await ref.watch(userRepositoryProvider.future)).loadListenSettings();

  Future<void> change(ListenSettings Function(ListenSettings) edit) async {
    final next = edit(state.value ?? const ListenSettings());
    state = AsyncData(next);
    await (await ref.read(userRepositoryProvider.future)).saveListenSettings(next);
  }
}

final listenSettingsProvider =
    AsyncNotifierProvider<ListenSettingsNotifier, ListenSettings>(ListenSettingsNotifier.new);

final savedPlaybackProvider = FutureProvider<SavedPlayback?>(
  (ref) async => (await ref.watch(userRepositoryProvider.future)).loadPlayback(),
);

/// The audio handler, configured with the library, surahs and position saving.
final listenReadyProvider = FutureProvider<QuranAudioHandler?>((ref) async {
  final handler = ref.watch(audioHandlerProvider);
  if (handler == null) return null;
  final repo = await ref.watch(userRepositoryProvider.future);
  final dir = await ref.watch(appDirectoryProvider.future);
  handler.configure(
    art: await _coverArt(dir),
    library: await ref.watch(audioLibraryProvider.future),
    surahs: await ref.watch(surahsProvider.future),
    save: (s) => repo.savePlayback(SavedPlayback(
      reciterId: s.reciter.id,
      // A bismillah belongs to the surah it opens.
      ayah: s.item.ref,
      position: s.position,
    )),
  );
  return handler;
});

/// The cover shown by the system media controls. They take a file URI, not
/// an asset, so the bundled image is copied out once.
Future<Uri?> _coverArt(String dir) async {
  try {
    final file = File(p.join(dir, 'listen_cover.png'));
    if (!file.existsSync()) {
      final data = await rootBundle.load('assets/images/listen_cover.png');
      await file.writeAsBytes(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    }
    return file.uri;
  } catch (_) {
    return null;
  }
}

final listenSnapshotProvider = StreamProvider<ListenSnapshot?>((ref) async* {
  final handler = await ref.watch(listenReadyProvider.future);
  final session = handler?.session;
  if (session == null) {
    yield null;
    return;
  }
  yield session.snapshot;
  yield* session.changes;
});
