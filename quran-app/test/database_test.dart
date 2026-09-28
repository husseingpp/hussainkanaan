import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/content_db.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/user_db.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Serves assets from real files, standing in for the app bundle.
class _FileBundle extends CachingAssetBundle {
  _FileBundle(this.files);

  final Map<String, File> files;

  @override
  Future<ByteData> load(String key) async {
    final f = files[key];
    if (f == null || !f.existsSync()) throw StateError('Unable to load asset: $key');
    return ByteData.sublistView(Uint8List.fromList(f.readAsBytesSync()));
  }
}

void main() {
  sqfliteFfiInit();
  late Directory tmp;
  late File built;

  setUpAll(() async {
    // Build the fixture DB with the real ingest so this test covers the
    // contract between the Python writer and the Dart reader.
    tmp = await Directory.systemTemp.createTemp('quran_app_test');
    built = File('${tmp.path}/build/content.db');
    final r = await Process.run('python3', [
      'tool/ingest/ingest.py',
      '--sources', 'tool/ingest/tests/fixtures/sources',
      '--out', built.path,
      '--no-lock', '--partial', '--allow-unreviewed-calendar',
    ]);
    expect(r.exitCode, 0, reason: '${r.stdout}${r.stderr}');
  });

  tearDownAll(() => tmp.delete(recursive: true));

  _FileBundle bundle() => _FileBundle({
        ContentDb.assetPath: built,
        '${ContentDb.assetPath}.sha256': File('${built.path}.sha256'),
        UserDb.schemaAsset: File('schema/user.sql'),
      });

  group('ContentDb', () {
    test('opens the ingest output and lists surahs', () async {
      final dir = await tmp.createTemp('app');
      final db = await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle());
      final surahs = await db.surahs();
      expect(surahs.map((s) => s.id), [1, 112]);
      expect(surahs.last.nameAr, 'الإخلاص');
      expect(surahs.last.pageStart, 2);
      await db.close();
    });

    test('search folds the query the same way ingest folded the text', () async {
      final dir = await tmp.createTemp('app');
      final db = await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle());
      expect(await db.search('إِيَّاكَ نَعْبُدُ'), [const AyahRef(1, 5)]);
      expect(await db.search('الصمد'), [const AyahRef(112, 2)]);
      expect(await db.search('") OR ('), isEmpty, reason: 'input is never FTS syntax');
      expect(await db.search('   '), isEmpty);
      await db.close();
    });

    test('re-copies only when the bundled digest changes', () async {
      final dir = await tmp.createTemp('app');
      final installed = File('${dir.path}/content.db');
      (await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle())).close();
      final firstCopy = installed.lastModifiedSync();

      await Future<void>.delayed(const Duration(milliseconds: 20));
      (await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle())).close();
      expect(installed.lastModifiedSync(), firstCopy);

      File('${dir.path}/content.db.sha256').writeAsStringSync('stale');
      (await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle())).close();
      expect(installed.lastModifiedSync(), isNot(firstCopy));
    });

    test('missing asset is reported, not crashed on', () async {
      final dir = await tmp.createTemp('app');
      expect(
        ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: _FileBundle({})),
        throwsA(isA<ContentDbMissing>()),
      );
    });
  });

  group('UserDb', () {
    test('creates every table in schema/user.sql', () async {
      final dir = await tmp.createTemp('app');
      final db = await UserDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle());
      final tables = (await db.db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )).map((r) => r['name']).toSet();
      expect(tables, containsAll(<String>[
        'bookmarks', 'notes', 'khatmah', 'preferences', 'calc_settings',
        'audio_files', 'download_queue', 'playback_state', 'reading_position', 'locations',
      ]));
      final fk = await db.db.rawQuery('PRAGMA foreign_keys');
      expect(fk.single.values.single, 1);
      await db.close();
    });

    test('splitter drops comments and pragmas', () {
      expect(
        splitSqlStatements('-- a; comment\nPRAGMA x = 1;\nCREATE TABLE t (a); -- trailing\n'),
        ['CREATE TABLE t (a)'],
      );
    });
  });

  test('vectors file is valid JSON', () {
    expect(() => jsonDecode(File('schema/search_normalization_vectors.json').readAsStringSync()),
        returnsNormally);
  });
}
