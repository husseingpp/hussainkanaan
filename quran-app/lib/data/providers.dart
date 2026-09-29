import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'content_db.dart';
import 'models.dart';
import 'mushaf_fonts.dart';
import 'reader_settings.dart';
import 'user_db.dart';
import 'user_repository.dart';

/// sqflite on mobile, sqflite_common_ffi on desktop; chosen in main().
final databaseFactoryProvider = Provider<DatabaseFactory>(
  (ref) => throw UnimplementedError('override in main()'),
);

final appDirectoryProvider = FutureProvider<String>(
  (ref) async => (await getApplicationSupportDirectory()).path,
);

final contentDbProvider = FutureProvider<ContentDb>((ref) async {
  final db = await ContentDb.open(
    factory: ref.watch(databaseFactoryProvider),
    directory: await ref.watch(appDirectoryProvider.future),
  );
  ref.onDispose(db.close);
  return db;
});

final userDbProvider = FutureProvider<UserDb>((ref) async {
  final db = await UserDb.open(
    factory: ref.watch(databaseFactoryProvider),
    directory: await ref.watch(appDirectoryProvider.future),
  );
  ref.onDispose(db.close);
  return db;
});

final surahsProvider = FutureProvider<List<Surah>>(
  (ref) async => (await ref.watch(contentDbProvider.future)).surahs(),
);

final userRepositoryProvider = FutureProvider<UserRepository>(
  (ref) async => UserRepository(await ref.watch(userDbProvider.future)),
);

final juzStartsProvider = FutureProvider<List<JuzStart>>(
  (ref) async => (await ref.watch(contentDbProvider.future)).juzStarts(),
);

final surahAyahsProvider = FutureProvider.family<List<Ayah>, ({int surah, bool translation})>(
  (ref, q) async =>
      (await ref.watch(contentDbProvider.future)).ayahsOfSurah(q.surah, withTranslation: q.translation),
);

final mushafPageProvider = FutureProvider.family<MushafPage, int>(
  (ref, page) async => (await ref.watch(contentDbProvider.future)).page(page),
);

final lastPositionProvider = FutureProvider<ReadingPosition?>(
  (ref) async => (await ref.watch(userRepositoryProvider.future)).lastPosition(),
);

/// Reader settings, loaded from the user DB and written back on every change.
class SettingsNotifier extends AsyncNotifier<ReaderSettings> {
  @override
  Future<ReaderSettings> build() async => (await ref.watch(userRepositoryProvider.future)).loadSettings();

  Future<void> change(ReaderSettings Function(ReaderSettings) edit) async {
    final next = edit(state.value ?? const ReaderSettings());
    state = AsyncData(next);
    await (await ref.read(userRepositoryProvider.future)).saveSettings(next);
  }
}

final settingsProvider = AsyncNotifierProvider<SettingsNotifier, ReaderSettings>(SettingsNotifier.new);

final mushafFontPackProvider = FutureProvider<MushafFontPack>((ref) async {
  final db = await ref.watch(contentDbProvider.future);
  return MushafFontPack(
    directory: p.join(await ref.watch(appDirectoryProvider.future), 'qcf_v1'),
    fonts: await db.qcfFonts(),
  );
});

/// The QCF font family for a page, or null to fall back to the Uthmani font.
/// Invalidate after a download so pages pick the new fonts up.
final mushafFontProvider = FutureProvider.family<String?, int>((ref, page) async {
  final pack = await ref.watch(mushafFontPackProvider.future);
  return pack.family(page);
});
