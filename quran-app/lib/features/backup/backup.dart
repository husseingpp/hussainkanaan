import 'dart:convert';

import 'package:sqflite/sqflite.dart';

/// JSON backup of the user's own data (BLUEPRINT §5 rule 2: backup without a
/// backend). Device-local tables (downloads, playback position) are left out.
///
/// Restoring merges rather than overwrites, with the same rules v2 sync will
/// use: most recent edit wins per row, except khatmah progress, which takes
/// the furthest point reached, so restoring an older backup never moves a
/// khatmah backwards.
class BackupFormat {
  static const app = 'net.hussainkanaan.quran_app';
  static const kind = 'user-data-backup';
  static const version = 1;

  /// Table -> primary key columns.
  static const tables = <String, List<String>>{
    'bookmarks': ['uuid'],
    'favourites': ['uuid'],
    'notes': ['uuid'],
    'khatmah': ['uuid'],
    'khatmah_days': ['khatmah_uuid', 'day'],
    'preferences': ['key'],
    'calc_settings': ['id'],
  };
}

class BackupError implements Exception {
  const BackupError(this.message);

  final String message;

  @override
  String toString() => message;
}

typedef Row = Map<String, Object?>;

String _key(Row r, List<String> cols) => cols.map((c) => '${r[c]}').join('\u0000');

int _int(Object? v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);

/// The row to keep when [local] and [incoming] describe the same record.
Row mergeRow(String table, Row? local, Row incoming) {
  if (local == null) return incoming;
  switch (table) {
    case 'khatmah':
      final newer = _int(incoming['updated_at']) > _int(local['updated_at']) ? incoming : local;
      final progress = [_int(local['progress_ayah_id']), _int(incoming['progress_ayah_id'])].reduce((a, b) => a > b ? a : b);
      final done = [local['completed_at'], incoming['completed_at']].whereType<int>().toList()..sort();
      return {...newer, 'progress_ayah_id': progress, 'completed_at': done.isEmpty ? null : done.first};
    case 'khatmah_days':
      return _int(incoming['progress_ayah_id']) > _int(local['progress_ayah_id']) ? incoming : local;
    default:
      return _int(incoming['updated_at']) > _int(local['updated_at']) ? incoming : local;
  }
}

class BackupService {
  BackupService(this._db, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final Database _db;
  final DateTime Function() _clock;

  Future<String> export() async {
    final data = <String, Object?>{};
    for (final t in BackupFormat.tables.keys) {
      data[t] = await _db.query(t);
    }
    return const JsonEncoder.withIndent(' ').convert({
      'app': BackupFormat.app,
      'kind': BackupFormat.kind,
      'version': BackupFormat.version,
      'exported_at': _clock().toUtc().toIso8601String(),
      'tables': data,
    });
  }

  /// Merges a backup in. Returns how many rows each table took.
  Future<Map<String, int>> restore(String json) async {
    final Object? doc;
    try {
      doc = jsonDecode(json);
    } on FormatException {
      throw const BackupError('الملف ليس نسخة احتياطية صالحة.');
    }
    if (doc is! Map || doc['app'] != BackupFormat.app || doc['kind'] != BackupFormat.kind) {
      throw const BackupError('هذا الملف ليس نسخة احتياطية من هذا التطبيق.');
    }
    if ((doc['version'] as num? ?? 0) > BackupFormat.version) {
      throw const BackupError('النسخة الاحتياطية من إصدار أحدث من التطبيق. حدّث التطبيق أولًا.');
    }
    final tables = doc['tables'];
    if (tables is! Map) throw const BackupError('النسخة الاحتياطية فارغة أو تالفة.');

    final counts = <String, int>{};
    await _db.transaction((txn) async {
      for (final entry in BackupFormat.tables.entries) {
        final rows = tables[entry.key];
        if (rows is! List) continue;
        // Only columns this database has: a backup can't smuggle in others.
        final cols = {for (final c in await txn.rawQuery('PRAGMA table_info(${entry.key})')) c['name']! as String};
        final local = {for (final r in await txn.query(entry.key)) _key(r, entry.value): r};
        var n = 0;
        for (final raw in rows.whereType<Map>()) {
          final incoming = {for (final e in raw.entries) if (cols.contains(e.key)) e.key as String: e.value};
          if (!entry.value.every(incoming.containsKey)) continue;
          final merged = mergeRow(entry.key, local[_key(incoming, entry.value)], incoming);
          await txn.insert(entry.key, merged, conflictAlgorithm: ConflictAlgorithm.replace);
          n++;
        }
        counts[entry.key] = n;
      }
    });
    return counts;
  }
}
