import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/content_db.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/data/user_db.dart';
import 'package:quran_app/data/user_repository.dart';
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
      '--reciters', 'tool/ingest/tests/fixtures/reciters.json',
      '--overrides', 'tool/ingest/tests/fixtures/overrides.json',
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

  group('ContentDb reader queries', () {
    late ContentDb db;
    setUpAll(() async {
      db = await ContentDb.open(factory: databaseFactoryFfi, directory: (await tmp.createTemp('app')).path, bundle: bundle());
    });
    tearDownAll(() => db.close());

    test('a page lists titles, bismillah and ayat lines with words then medallions', () async {
      final page = await db.page(2);
      expect(page.lines.map((l) => l.kind),
          [PageLineKind.surahName, PageLineKind.bismillah, PageLineKind.ayat, PageLineKind.ayat]);
      expect(page.lines.first.surah, 112);
      final line3 = page.lines[2].glyphs;
      expect(line3.map((g) => g.position), [1, 2, 3, 4, 1000]);
      expect(line3.last.isAyahEnd, isTrue);
      expect(line3.last.text, '1');
      expect(line3.first.qcf, isNotNull);
      expect(page.firstAyah, const AyahRef(112, 1));
    });

    test('search: Arabic folded and undiacritized, English as a prefix while typing', () async {
      final ar = await db.searchText('إِيَّاكَ نَعْبُدُ');
      expect(ar.map((h) => h.ref), [const AyahRef(1, 5)]);
      expect(ar.single.text, contains(SearchHit.open));
      expect(ar.single.isTranslation, isFalse);
      final en = await db.searchText('fixt');
      expect(en, hasLength(11));
      expect(en.first.isTranslation, isTrue);
      expect(await db.searchText('") OR ('), isEmpty);
    });

    test('word study: meanings, roots, and every occurrence of a root', () async {
      final words = await db.wordsOf(const AyahRef(1, 1));
      expect(words.map((w) => w.position), [1, 2, 3, 4]);
      expect(words[1].root, 'أ ل ه');
      expect(words[0].translation, 'In (the) name');
      final occ = await db.rootOccurrences('أ ل ه');
      expect(occ.map((w) => (w.ref, w.position)), [(const AyahRef(1, 1), 2), (const AyahRef(112, 1), 3)]);
      expect((await db.ayah(const AyahRef(112, 2)))!.translation, '[fixture translation 112:2]');
    });

    test('juz starts and page lookup', () async {
      final juzs = await db.juzStarts();
      expect(juzs.map((j) => (j.juz, j.start, j.page)), [(1, const AyahRef(1, 1), 1), (2, const AyahRef(112, 1), 2)]);
      expect(await db.pageOf(const AyahRef(112, 3)), 3);
    });

    test('ayahs of a surah, with and without the translation', () async {
      final plain = await db.ayahsOfSurah(112);
      expect(plain.map((a) => a.number), [1, 2, 3, 4]);
      expect(plain.first.translation, isNull);
      expect(plain[1].sajda, 'recommended');
      final withT = await db.ayahsOfSurah(112, withTranslation: true);
      expect(withT.first.translation, '[fixture translation 112:1]');
    });
  });

  group('UserRepository', () {
    test('settings and the latest reading position persist', () async {
      final dir = await tmp.createTemp('app');
      var now = DateTime(2026, 1, 1);
      final repo = UserRepository(
        await UserDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: bundle()),
        clock: () => now,
      );
      expect((await repo.loadSettings()).view, ReaderView.page);
      await repo.saveSettings(const ReaderSettings(view: ReaderView.reading, fontScale: 1.3));
      expect((await repo.loadSettings()).fontScale, closeTo(1.3, 1e-9));

      expect(await repo.lastPosition(), isNull);
      await repo.savePosition(const ReadingPosition(view: ReaderView.page, ayah: AyahRef(2, 255), page: 42));
      now = now.add(const Duration(minutes: 1));
      await repo.savePosition(const ReadingPosition(view: ReaderView.reading, ayah: AyahRef(36, 1), page: 440));
      final last = await repo.lastPosition();
      expect((last!.view, last.ayah, last.page), (ReaderView.reading, const AyahRef(36, 1), 440));
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
