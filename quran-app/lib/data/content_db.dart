import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../core/arabic_normalizer.dart';
import 'models.dart';
import 'mushaf_fonts.dart';

/// The bundled, read-only content DB built by tool/ingest.
///
/// SQLite can't open a file inside the asset bundle, so the asset is copied
/// to app storage once and re-copied only when the build's sha256 sidecar
/// changes (i.e. the app shipped new content).
class ContentDb {
  /// Bump together with SCHEMA_VERSION in tool/ingest/ingest.py.
  static const schemaVersion = 1;
  static const assetPath = 'assets/db/content.db';

  ContentDb._(this._db);

  final Database _db;

  static Future<ContentDb> open({
    required DatabaseFactory factory,
    required String directory,
    AssetBundle? bundle,
  }) async {
    bundle ??= rootBundle;
    final String digest;
    try {
      digest = (await bundle.loadString('$assetPath.sha256', cache: false)).trim();
    } catch (_) {
      throw const ContentDbMissing();
    }

    final path = p.join(directory, 'content.db');
    final stamp = File('$path.sha256');
    final current = stamp.existsSync() ? stamp.readAsStringSync().trim() : null;
    if (current != digest || !File(path).existsSync()) {
      final data = await bundle.load(assetPath);
      final tmp = File('$path.tmp');
      await tmp.writeAsBytes(
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
        flush: true,
      );
      await tmp.rename(path);
      await stamp.writeAsString(digest, flush: true);
    }

    final db = await factory.openDatabase(
      path,
      options: OpenDatabaseOptions(readOnly: true, singleInstance: false),
    );
    final version = Sqflite.firstIntValue(await db.rawQuery('PRAGMA user_version'));
    if (version != schemaVersion) {
      await db.close();
      throw ContentDbSchemaMismatch(found: version ?? 0);
    }
    return ContentDb._(db);
  }

  Future<void> close() => _db.close();

  Future<List<Surah>> surahs() async {
    final rows = await _db.query('surahs', orderBy: 'id');
    return rows.map(Surah.fromRow).toList(growable: false);
  }

  static const pageCount = 604;

  Future<List<Ayah>> ayahsOfSurah(int surah, {bool withTranslation = false}) async {
    final rows = await _db.rawQuery(
      'SELECT a.surah_id, a.ayah_no, a.text_uthmani, a.page, a.juz, a.sajda, '
      '${withTranslation ? 't.text' : 'NULL'} AS translation FROM ayahs a '
      '${withTranslation ? 'LEFT JOIN translation_ayahs t ON t.ayah_id = a.id AND t.translation_id = 1 ' : ''}'
      'WHERE a.surah_id = ? ORDER BY a.ayah_no',
      [surah],
    );
    return rows.map(Ayah.fromRow).toList(growable: false);
  }

  Future<List<JuzStart>> juzStarts() async {
    final rows = await _db.rawQuery(
      'SELECT a.juz, a.surah_id, a.ayah_no, a.page FROM ayahs a '
      'JOIN (SELECT juz, min(id) AS id FROM ayahs GROUP BY juz) f ON f.id = a.id ORDER BY a.juz',
    );
    return [
      for (final r in rows)
        JuzStart(
          juz: r['juz']! as int,
          start: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
          page: r['page']! as int,
        ),
    ];
  }

  Future<int> pageOf(AyahRef ref) async {
    final rows = await _db.rawQuery(
      'SELECT page FROM ayahs WHERE surah_id = ? AND ayah_no = ?',
      [ref.surah, ref.ayah],
    );
    return rows.isEmpty ? 1 : rows.first['page']! as int;
  }

  /// Every line of a printed page, with its words and medallions in reading order.
  Future<MushafPage> page(int number) async {
    final lineRows = await _db.rawQuery(
      'SELECT line, kind, surah_id FROM page_lines WHERE page = ? ORDER BY line',
      [number],
    );
    final glyphRows = await _db.rawQuery(
      'SELECT w.line, a.surah_id, a.ayah_no, w.position, w.text_uthmani AS text, w.text_qcf AS qcf, '
      '0 AS is_end FROM words w JOIN ayahs a ON a.id = w.ayah_id WHERE w.page = ? '
      'UNION ALL '
      'SELECT a.end_line, a.surah_id, a.ayah_no, 1000, a.ayah_no, substr(a.text_qcf, -1), 1 '
      'FROM ayahs a WHERE a.end_page = ? '
      'ORDER BY 1, 2, 3, 4',
      [number, number],
    );
    final byLine = <int, List<PageGlyph>>{};
    for (final r in glyphRows) {
      final isEnd = r['is_end'] == 1;
      byLine.putIfAbsent(r['line']! as int, () => []).add(PageGlyph(
            ayah: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
            position: r['position']! as int,
            text: '${r['text']}',
            qcf: r['qcf'] as String?,
            isAyahEnd: isEnd,
          ));
    }
    return MushafPage(
      number: number,
      lines: [
        for (final r in lineRows)
          PageLine(
            number: r['line']! as int,
            kind: switch (r['kind']) {
              'surah_name' => PageLineKind.surahName,
              'bismillah' => PageLineKind.bismillah,
              _ => PageLineKind.ayat,
            },
            surah: r['surah_id'] as int?,
            glyphs: byLine[r['line']! as int] ?? const [],
          ),
      ],
    );
  }

  Future<List<Reciter>> reciters() async {
    final rows = await _db.rawQuery(
      'SELECT r.*, (SELECT sum(approx_bytes) FROM reciter_surahs s WHERE s.reciter_id = r.id) AS total '
      'FROM reciters r ORDER BY r.sync_tier, r.name',
    );
    return [
      for (final r in rows)
        Reciter(
          id: r['id']! as int,
          slug: r['slug']! as String,
          name: r['name']! as String,
          nameAr: r['name_ar'] as String?,
          style: r['style']! as String,
          baseUrl: r['base_url']! as String,
          syncTier: r['sync_tier']! as String,
          approxBytes: (r['total'] as int?) ?? 0,
          bitrate: r['bitrate'] as int?,
        ),
    ];
  }

  /// Estimated download size of each surah for one reciter.
  Future<Map<int, int>> surahSizes(int reciterId) async {
    final rows = await _db.query('reciter_surahs', where: 'reciter_id = ?', whereArgs: [reciterId]);
    return {for (final r in rows) r['surah_id']! as int: r['approx_bytes']! as int};
  }

  /// A surah's words by ayah, in reading order (Follow Mode draws these).
  Future<Map<int, List<Word>>> wordsOfSurah(int surah) async {
    final rows = await _db.rawQuery(
      'SELECT a.ayah_no, w.position, w.text_uthmani FROM words w JOIN ayahs a ON a.id = w.ayah_id '
      'WHERE a.surah_id = ? ORDER BY a.ayah_no, w.position',
      [surah],
    );
    final out = <int, List<Word>>{};
    for (final r in rows) {
      out.putIfAbsent(r['ayah_no']! as int, () => []).add(Word(r['position']! as int, r['text_uthmani']! as String));
    }
    return out;
  }

  /// One reciter's timing for one surah, loaded per surah (BLUEPRINT §4).
  /// Ayahs without word timing are simply absent.
  Future<Map<int, List<Segment>>> timingsForSurah(int reciterId, int surah) async {
    final rows = await _db.rawQuery(
      'SELECT a.ayah_no, t.word_position, t.start_ms, t.end_ms FROM ayah_timings t '
      'JOIN ayahs a ON a.id = t.ayah_id WHERE t.reciter_id = ? AND a.surah_id = ? '
      'ORDER BY a.ayah_no, t.start_ms',
      [reciterId, surah],
    );
    final out = <int, List<Segment>>{};
    for (final r in rows) {
      out.putIfAbsent(r['ayah_no']! as int, () => []).add(
            Segment(r['word_position']! as int, r['start_ms']! as int, r['end_ms']! as int),
          );
    }
    return out;
  }

  /// The page of every ayah by global id (index 0 unused), for khatmah math.
  Future<List<int>> pageOfEveryAyah() async {
    final rows = await _db.rawQuery('SELECT id, page FROM ayahs ORDER BY id');
    return [0, for (final r in rows) r['page']! as int];
  }

  /// Global ayah id of a reference.
  Future<int?> ayahId(AyahRef ref) async {
    final rows = await _db.query('ayahs', columns: ['id'], where: 'surah_id = ? AND ayah_no = ?', whereArgs: [ref.surah, ref.ayah]);
    return rows.isEmpty ? null : rows.first['id']! as int;
  }

  /// The reference of a global ayah id.
  Future<AyahRef?> refOf(int ayahId) async {
    final rows = await _db.query('ayahs', columns: ['surah_id', 'ayah_no'], where: 'id = ?', whereArgs: [ayahId]);
    return rows.isEmpty ? null : AyahRef(rows.first['surah_id']! as int, rows.first['ayah_no']! as int);
  }

  /// Ayahs short enough for a notification, in Quran order (for the daily ayah).
  Future<List<int>> shortAyahIds({int maxLength = 110}) async {
    final rows = await _db.rawQuery('SELECT id FROM ayahs WHERE length(text_uthmani) <= ? ORDER BY id', [maxLength]);
    return [for (final r in rows) r['id']! as int];
  }

  Future<List<QcfFontInfo>> qcfFonts() async {
    final rows = await _db.query('qcf_fonts', orderBy: 'page');
    return [
      for (final r in rows)
        QcfFontInfo(
          page: r['page']! as int,
          url: r['url']! as String,
          bytes: r['bytes']! as int,
          sha256: r['sha256']! as String,
        ),
    ];
  }

  /// Search for the study screen: Arabic (folded, undiacritized) against the
  /// Quran text, anything else against the bundled translation. Matches come
  /// back marked with [SearchHit.open] / [SearchHit.close].
  Future<List<SearchHit>> searchText(String query, {int limit = 100}) async {
    final arabic = RegExp('[\u0600-\u06FF]').hasMatch(query);
    final folded = arabic ? normalizeArabic(query) : query.trim();
    final tokens = folded.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
    if (tokens.isEmpty) return const [];
    // Quoted tokens: user input is never FTS syntax. A trailing * lets the
    // last word match as a prefix while typing.
    final match = [
      for (var i = 0; i < tokens.length; i++)
        '"${tokens[i].replaceAll('"', '""')}"${i == tokens.length - 1 ? '*' : ''}',
    ].join(' ');
    final o = SearchHit.open, c = SearchHit.close;
    final rows = arabic
        ? await _db.rawQuery(
            "SELECT a.surah_id, a.ayah_no, highlight(ayahs_fts, 0, '$o', '$c') AS hit "
            'FROM ayahs_fts JOIN ayahs a ON a.id = ayahs_fts.rowid WHERE ayahs_fts MATCH ? ORDER BY a.id LIMIT ?',
            [match, limit],
          )
        : await _db.rawQuery(
            "SELECT a.surah_id, a.ayah_no, highlight(translation_fts, 0, '$o', '$c') AS hit "
            'FROM translation_fts JOIN ayahs a ON a.id = translation_fts.rowid '
            'WHERE translation_fts MATCH ? ORDER BY rank LIMIT ?',
            [match, limit],
          );
    return [
      for (final r in rows)
        SearchHit(
          ref: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
          text: r['hit']! as String,
          isTranslation: !arabic,
        ),
    ];
  }

  Future<Ayah?> ayah(AyahRef ref) async {
    final rows = await _db.rawQuery(
      'SELECT a.surah_id, a.ayah_no, a.text_uthmani, a.page, a.juz, a.sajda, t.text AS translation FROM ayahs a '
      'LEFT JOIN translation_ayahs t ON t.ayah_id = a.id AND t.translation_id = 1 '
      'WHERE a.surah_id = ? AND a.ayah_no = ?',
      [ref.surah, ref.ayah],
    );
    return rows.isEmpty ? null : Ayah.fromRow(rows.first);
  }

  /// The ayah's words with their word-by-word meaning and root.
  Future<List<WordInfo>> wordsOf(AyahRef ref) async {
    final rows = await _db.rawQuery(
      'SELECT w.position, w.text_uthmani, w.translation_en, w.root FROM words w JOIN ayahs a ON a.id = w.ayah_id '
      'WHERE a.surah_id = ? AND a.ayah_no = ? ORDER BY w.position',
      [ref.surah, ref.ayah],
    );
    return [
      for (final r in rows)
        WordInfo(
          ref: ref,
          position: r['position']! as int,
          text: r['text_uthmani']! as String,
          translation: r['translation_en'] as String?,
          root: r['root'] as String?,
        ),
    ];
  }

  /// Every word from [root], in Quran order.
  Future<List<WordInfo>> rootOccurrences(String root) async {
    final rows = await _db.rawQuery(
      'SELECT a.surah_id, a.ayah_no, w.position, w.text_uthmani, w.translation_en FROM words w '
      'JOIN ayahs a ON a.id = w.ayah_id WHERE w.root = ? ORDER BY w.id',
      [root],
    );
    return [
      for (final r in rows)
        WordInfo(
          ref: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
          position: r['position']! as int,
          text: r['text_uthmani']! as String,
          translation: r['translation_en'] as String?,
          root: root,
        ),
    ];
  }

  /// Full-text search over the undiacritized text. Every token is quoted so
  /// user input can never be parsed as FTS5 query syntax.
  Future<List<AyahRef>> search(String query, {int limit = 50}) async {
    final tokens = normalizeArabic(query).split(' ').where((t) => t.isNotEmpty);
    if (tokens.isEmpty) return const [];
    final match = tokens.map((t) => '"${t.replaceAll('"', '""')}"').join(' ');
    final rows = await _db.rawQuery(
      'SELECT a.surah_id, a.ayah_no FROM ayahs_fts f JOIN ayahs a ON a.id = f.rowid '
      'WHERE ayahs_fts MATCH ? ORDER BY a.id LIMIT ?',
      [match, limit],
    );
    return rows
        .map((r) => AyahRef(r['surah_id']! as int, r['ayah_no']! as int))
        .toList(growable: false);
  }
}

class ContentDbMissing implements Exception {
  const ContentDbMissing();

  @override
  String toString() =>
      'Content DB not bundled. Build it with: python3 tool/ingest/ingest.py';
}

class ContentDbSchemaMismatch implements Exception {
  const ContentDbSchemaMismatch({required this.found});

  final int found;

  @override
  String toString() =>
      'Content DB schema v$found, app expects v${ContentDb.schemaVersion}. '
      'Rebuild with tool/ingest/ingest.py.';
}
