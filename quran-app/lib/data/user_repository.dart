import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'models.dart';
import 'reader_settings.dart';
import 'user_db.dart';

/// Where the reader last was, in whichever view.
class ReadingPosition {
  const ReadingPosition({required this.view, required this.ayah, required this.page});

  final ReaderView view;
  final AyahRef ayah;
  final int page;
}

class UserRepository {
  UserRepository(this._userDb, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final UserDb _userDb;
  final DateTime Function() _clock;

  Database get _db => _userDb.db;
  int get _now => _clock().millisecondsSinceEpoch;

  static const _settingsKey = 'reader_settings';

  Future<ReaderSettings> loadSettings() async {
    final rows = await _db.query('preferences', where: 'key = ?', whereArgs: [_settingsKey]);
    if (rows.isEmpty) return const ReaderSettings();
    try {
      return ReaderSettings.fromJson(jsonDecode(rows.first['value']! as String) as Map<String, Object?>);
    } on FormatException {
      return const ReaderSettings();
    }
  }

  Future<void> saveSettings(ReaderSettings s) => _db.insert(
        'preferences',
        {'key': _settingsKey, 'value': s.toJson(), 'updated_at': _now},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

  /// The most recently saved position across both views.
  Future<ReadingPosition?> lastPosition() async {
    final rows = await _db.query('reading_position', orderBy: 'updated_at DESC', limit: 1);
    if (rows.isEmpty) return null;
    final r = rows.first;
    return ReadingPosition(
      view: r['view'] == 'reading' ? ReaderView.reading : ReaderView.page,
      ayah: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
      page: r['page']! as int,
    );
  }

  Future<void> savePosition(ReadingPosition p) => _db.insert(
        'reading_position',
        {
          'view': p.view.name,
          'page': p.page,
          'surah_id': p.ayah.surah,
          'ayah_no': p.ayah.ayah,
          'updated_at': _now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
}
