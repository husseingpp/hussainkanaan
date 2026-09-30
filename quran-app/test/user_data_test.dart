import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/khatmah_repository.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/user_db.dart';
import 'package:quran_app/features/backup/backup.dart';
import 'package:quran_app/features/khatmah/khatmah_plan.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class _Bundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async =>
      ByteData.sublistView(Uint8List.fromList(File('schema/user.sql').readAsBytesSync()));
}

void main() {
  sqfliteFfiInit();
  late Directory tmp;
  var now = DateTime(2026, 10, 1, 21);

  setUp(() async => tmp = await Directory.systemTemp.createTemp('user'));
  tearDown(() => tmp.delete(recursive: true));

  Future<UserDb> open([String name = 'a']) =>
      UserDb.open(factory: databaseFactoryFfi, directory: '${tmp.path}/$name', bundle: _Bundle());

  test('a version 1 database (as on phones today) upgrades in place, keeping its rows', () async {
    final path = '${tmp.path}/old/user.db';
    Directory('${tmp.path}/old').createSync();
    final v1 = await databaseFactoryFfi.openDatabase(path, options: OpenDatabaseOptions(
      version: 1,
      onCreate: (db, _) async {
        await db.execute('CREATE TABLE khatmah (uuid TEXT PRIMARY KEY, name TEXT NOT NULL, plan_kind TEXT NOT NULL, '
            'daily_ayahs INTEGER, start_date TEXT NOT NULL, end_date TEXT, progress_ayah_id INTEGER NOT NULL DEFAULT 0, '
            'completed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)');
        await db.insert('khatmah', {'uuid': 'u', 'name': 'old', 'plan_kind': 'daily_amount', 'start_date': '2026-09-01',
            'progress_ayah_id': 40, 'created_at': 1, 'updated_at': 1});
      },
    ));
    await v1.close();
    final upgraded = await UserDb.open(factory: databaseFactoryFfi, directory: '${tmp.path}/old', bundle: _Bundle());
    final repo = KhatmahRepository(upgraded.db);
    final list = await repo.all();
    expect(list.single.progress, 40);
    expect(list.single.dailyPages, isNull);
    await repo.advance(list.single, 50, ayahCount: 6236);
    expect(await repo.daysRead(list.single), hasLength(1), reason: 'khatmah_days exists after the upgrade');
    await upgraded.close();
  });

  test('progress only moves forward, logs the day, and stamps completion', () async {
    final db = await open();
    final repo = KhatmahRepository(db.db, clock: () => now);
    var k = await repo.create(name: 'ختمة رمضان', kind: PlanKind.dateRange, start: now, end: DateTime(2026, 10, 30));
    k = await repo.advance(k, 100, ayahCount: 6236);
    k = await repo.advance(k, 60, ayahCount: 6236);
    expect(k.progress, 100);
    now = DateTime(2026, 10, 2, 8);
    expect(await repo.progressBefore(k, now), 100, reason: 'today\'s wird starts where yesterday ended');
    k = await repo.advance(k, 6236, ayahCount: 6236);
    expect(k.isComplete, isTrue);
    expect(await repo.daysRead(k), {'2026-10-01', '2026-10-02'});
    expect((await repo.all()).single.isComplete, isTrue);
    await db.close();
  });

  test('bookmarks toggle on and off', () async {
    final db = await open();
    final repo = KhatmahRepository(db.db);
    expect(await repo.toggleBookmark(const AyahRef(2, 255)), isTrue);
    expect((await repo.bookmarks()).map((b) => b.ayah), [const AyahRef(2, 255)]);
    expect(await repo.toggleBookmark(const AyahRef(2, 255)), isFalse);
    expect(await repo.bookmarks(), isEmpty);
    await db.close();
  });

  group('backup', () {
    test('round-trips into an empty install', () async {
      final a = await open('a');
      final repo = KhatmahRepository(a.db, clock: () => now);
      final k = await repo.create(name: 'n', kind: PlanKind.dailyPages, start: now, dailyPages: 20);
      await repo.advance(k, 300, ayahCount: 6236);
      await repo.toggleBookmark(const AyahRef(18, 10));
      final json = await BackupService(a.db).export();

      final b = await open('b');
      final counts = await BackupService(b.db).restore(json);
      expect(counts['khatmah'], 1);
      expect(counts['bookmarks'], 1);
      final restored = KhatmahRepository(b.db);
      expect((await restored.all()).single.progress, 300);
      expect((await restored.bookmarks()).single.ayah, const AyahRef(18, 10));
      await a.close();
      await b.close();
    });

    test('restoring an older backup never moves a khatmah backwards', () {
      final local = {'uuid': 'k', 'name': 'renamed', 'progress_ayah_id': 900, 'updated_at': 10, 'completed_at': null};
      final old = {'uuid': 'k', 'name': 'original', 'progress_ayah_id': 300, 'updated_at': 5, 'completed_at': null};
      expect(mergeRow('khatmah', local, old)['progress_ayah_id'], 900);
      // The other device renamed it later but had read less: newest name, furthest progress.
      final newer = {...old, 'name': 'newest', 'updated_at': 20};
      final merged = mergeRow('khatmah', local, newer);
      expect((merged['name'], merged['progress_ayah_id']), ('newest', 900));
    });

    test('everything else: the most recent edit wins, deletions included', () {
      final kept = {'uuid': 'b', 'deleted': 0, 'updated_at': 5};
      final deletedLater = {'uuid': 'b', 'deleted': 1, 'updated_at': 9};
      expect(mergeRow('bookmarks', kept, deletedLater)['deleted'], 1);
      expect(mergeRow('bookmarks', deletedLater, kept)['deleted'], 1);
    });

    test('rejects files that are not this app\'s backups', () async {
      final db = await open();
      final s = BackupService(db.db);
      expect(() => s.restore('not json'), throwsA(isA<BackupError>()));
      expect(() => s.restore(jsonEncode({'app': 'other'})), throwsA(isA<BackupError>()));
      expect(
        () => s.restore(jsonEncode({'app': BackupFormat.app, 'kind': BackupFormat.kind, 'version': 99, 'tables': {}})),
        throwsA(isA<BackupError>()),
      );
      await db.close();
    });

    test('unknown columns in a backup are ignored, not written', () async {
      final db = await open();
      final json = jsonEncode({
        'app': BackupFormat.app, 'kind': BackupFormat.kind, 'version': 1,
        'tables': {'bookmarks': [{'uuid': 'x', 'surah_id': 1, 'ayah_no': 1, 'created_at': 1, 'updated_at': 1, 'evil': 'DROP'}]},
      });
      expect((await BackupService(db.db).restore(json))['bookmarks'], 1);
      expect((await db.db.query('bookmarks')).single.containsKey('evil'), isFalse);
      await db.close();
    });
  });
}
