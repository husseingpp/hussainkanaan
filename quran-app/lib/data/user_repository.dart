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

/// Where Listen Mode was, so a killed or finished session can be resumed.
class SavedPlayback {
  const SavedPlayback({required this.reciterId, required this.ayah, required this.position});

  final int reciterId;
  final AyahRef ayah;
  final Duration position;
}

/// Listen Mode preferences (synced in v2 with the other preferences).
class ListenSettings {
  const ListenSettings({this.reciterSlug, this.level = 1.0, this.batteryPromptSeen = false});

  factory ListenSettings.fromJson(Map<String, Object?> j) => ListenSettings(
        reciterSlug: j['reciter'] as String?,
        level: (j['level'] as num?)?.toDouble().clamp(0.0, 1.0) ?? 1.0,
        batteryPromptSeen: j['batteryPromptSeen'] as bool? ?? false,
      );

  final String? reciterSlug;

  /// Quiet-room level, 0..1 (see gainForLevel).
  final double level;
  final bool batteryPromptSeen;

  ListenSettings copyWith({String? reciterSlug, double? level, bool? batteryPromptSeen}) => ListenSettings(
        reciterSlug: reciterSlug ?? this.reciterSlug,
        level: level ?? this.level,
        batteryPromptSeen: batteryPromptSeen ?? this.batteryPromptSeen,
      );

  String toJson() => jsonEncode({'reciter': reciterSlug, 'level': level, 'batteryPromptSeen': batteryPromptSeen});
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

  static const _listenKey = 'listen_settings';

  Future<ListenSettings> loadListenSettings() async {
    final rows = await _db.query('preferences', where: 'key = ?', whereArgs: [_listenKey]);
    if (rows.isEmpty) return const ListenSettings();
    try {
      return ListenSettings.fromJson(jsonDecode(rows.first['value']! as String) as Map<String, Object?>);
    } on FormatException {
      return const ListenSettings();
    }
  }

  Future<void> saveListenSettings(ListenSettings s) => _db.insert(
        'preferences',
        {'key': _listenKey, 'value': s.toJson(), 'updated_at': _now},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

  Future<void> savePlayback(SavedPlayback p) => _db.insert(
        'playback_state',
        {
          'mode': 'listen',
          'reciter_id': p.reciterId,
          'surah_id': p.ayah.surah,
          'ayah_no': p.ayah.ayah,
          'position_ms': p.position.inMilliseconds,
          'updated_at': _now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

  Future<SavedPlayback?> loadPlayback() async {
    final rows = await _db.query('playback_state', where: 'mode = ?', whereArgs: ['listen']);
    if (rows.isEmpty) return null;
    final r = rows.first;
    return SavedPlayback(
      reciterId: r['reciter_id']! as int,
      ayah: AyahRef(r['surah_id']! as int, r['ayah_no']! as int),
      position: Duration(milliseconds: r['position_ms']! as int),
    );
  }

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
