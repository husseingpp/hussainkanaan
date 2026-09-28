import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'content_db.dart';
import 'models.dart';
import 'user_db.dart';

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
