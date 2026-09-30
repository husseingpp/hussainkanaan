import 'package:sqflite/sqflite.dart';

import '../core/ids.dart';
import '../features/khatmah/khatmah_plan.dart';
import 'models.dart';

class Bookmark {
  const Bookmark({required this.uuid, required this.ayah, required this.createdAt});

  final String uuid;
  final AyahRef ayah;
  final DateTime createdAt;
}

/// Khatmah plans, their daily log, and bookmarks, in the user DB. Deletes are
/// tombstones (deleted = 1) so a future sync can propagate them.
class KhatmahRepository {
  KhatmahRepository(this._db, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final Database _db;
  final DateTime Function() _clock;

  int get _now => _clock().millisecondsSinceEpoch;

  static DateTime _date(String s) => DateTime.parse(s);

  static Khatmah _fromRow(Map<String, Object?> r) => Khatmah(
        uuid: r['uuid']! as String,
        name: r['name']! as String,
        kind: r['plan_kind'] == 'date_range' ? PlanKind.dateRange : PlanKind.dailyPages,
        start: _date(r['start_date']! as String),
        end: r['end_date'] == null ? null : _date(r['end_date']! as String),
        dailyPages: r['daily_pages'] as int?,
        progress: r['progress_ayah_id']! as int,
        completedAt: r['completed_at'] == null ? null : DateTime.fromMillisecondsSinceEpoch(r['completed_at']! as int),
        reminderMinutes: r['reminder_minutes'] as int?,
      );

  Future<List<Khatmah>> all() async {
    final rows = await _db.query('khatmah', where: 'deleted = 0', orderBy: 'created_at DESC');
    return rows.map(_fromRow).toList();
  }

  Future<Khatmah> create({
    required String name,
    required PlanKind kind,
    required DateTime start,
    int? dailyPages,
    DateTime? end,
  }) async {
    final k = Khatmah(uuid: newUuid(), name: name, kind: kind, start: dateOnly(start), dailyPages: dailyPages, end: end);
    await _db.insert('khatmah', {
      'uuid': k.uuid,
      'name': name,
      'plan_kind': kind == PlanKind.dateRange ? 'date_range' : 'daily_amount',
      'daily_pages': dailyPages,
      'start_date': dayKey(k.start),
      'end_date': end == null ? null : dayKey(end),
      'progress_ayah_id': 0,
      'created_at': _now,
      'updated_at': _now,
    });
    return k;
  }

  /// Moves progress forward to [ayahId] (never back) and logs today.
  /// Completing the last ayah stamps completion. Returns the updated plan.
  Future<Khatmah> advance(Khatmah k, int ayahId, {required int ayahCount}) async {
    if (ayahId <= k.progress) return k;
    final done = ayahId >= ayahCount && k.completedAt == null;
    final next = k.copyWith(progress: ayahId, completedAt: done ? _clock() : null);
    await _db.transaction((txn) async {
      await txn.update(
        'khatmah',
        {
          'progress_ayah_id': ayahId,
          if (done) 'completed_at': _now,
          'updated_at': _now,
        },
        where: 'uuid = ?',
        whereArgs: [k.uuid],
      );
      final today = dayKey(_clock());
      final rows = await txn.query('khatmah_days',
          where: 'khatmah_uuid = ? AND day = ?', whereArgs: [k.uuid, today]);
      if (rows.isEmpty || (rows.first['progress_ayah_id']! as int) < ayahId) {
        await txn.insert('khatmah_days', {'khatmah_uuid': k.uuid, 'day': today, 'progress_ayah_id': ayahId},
            conflictAlgorithm: ConflictAlgorithm.replace);
      }
    });
    return next;
  }

  /// Progress at the start of [day]: where today's wird begins.
  Future<int> progressBefore(Khatmah k, DateTime day) async {
    final rows = await _db.rawQuery(
      'SELECT max(progress_ayah_id) AS p FROM khatmah_days WHERE khatmah_uuid = ? AND day < ?',
      [k.uuid, dayKey(day)],
    );
    return (rows.first['p'] as int?) ?? 0;
  }

  Future<Set<String>> daysRead(Khatmah k) async {
    final rows = await _db.query('khatmah_days', columns: ['day'], where: 'khatmah_uuid = ?', whereArgs: [k.uuid]);
    return {for (final r in rows) r['day']! as String};
  }

  Future<void> setReminder(Khatmah k, int? minutes) => _db.update(
        'khatmah',
        {'reminder_minutes': minutes, 'updated_at': _now},
        where: 'uuid = ?',
        whereArgs: [k.uuid],
      );

  Future<void> delete(Khatmah k) => _db.update(
        'khatmah',
        {'deleted': 1, 'updated_at': _now},
        where: 'uuid = ?',
        whereArgs: [k.uuid],
      );

  // ---- bookmarks

  Future<List<Bookmark>> bookmarks() async {
    final rows = await _db.query('bookmarks', where: 'deleted = 0', orderBy: 'created_at DESC');
    return [
      for (final r in rows)
        Bookmark(
          uuid: r['uuid']! as String,
          ayah: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
          createdAt: DateTime.fromMillisecondsSinceEpoch(r['created_at']! as int),
        ),
    ];
  }

  /// Adds a bookmark on [ayah], or removes it if there is one. Returns
  /// whether the ayah is bookmarked afterwards.
  Future<bool> toggleBookmark(AyahRef ayah) async {
    final existing = await _db.query('bookmarks',
        where: 'surah_id = ? AND ayah_no = ? AND deleted = 0', whereArgs: [ayah.surah, ayah.ayah]);
    if (existing.isNotEmpty) {
      await _db.update('bookmarks', {'deleted': 1, 'updated_at': _now},
          where: 'uuid = ?', whereArgs: [existing.first['uuid']]);
      return false;
    }
    await _db.insert('bookmarks', {
      'uuid': newUuid(),
      'surah_id': ayah.surah,
      'ayah_no': ayah.ayah,
      'created_at': _now,
      'updated_at': _now,
    });
    return true;
  }
}
