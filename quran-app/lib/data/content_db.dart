import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../core/arabic_normalizer.dart';
import 'models.dart';

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
