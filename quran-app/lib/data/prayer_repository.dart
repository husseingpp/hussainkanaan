import 'package:sqflite/sqflite.dart';

import '../features/prayer/prayer_settings.dart';

/// Calculation settings (synced in v2) and saved locations (device-local).
class PrayerRepository {
  PrayerRepository(this._db, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final Database _db;
  final DateTime Function() _clock;

  Future<PrayerSettings> settings() async {
    final rows = await _db.query('calc_settings', where: 'id = 1');
    return rows.isEmpty ? const PrayerSettings() : PrayerSettings.fromRow(rows.first);
  }

  Future<void> saveSettings(PrayerSettings s) =>
      _db.insert('calc_settings', s.toRow(_clock().millisecondsSinceEpoch), conflictAlgorithm: ConflictAlgorithm.replace);

  Future<List<SavedLocation>> locations() async =>
      [for (final r in await _db.query('locations', orderBy: 'id')) SavedLocation.fromRow(r)];

  Future<SavedLocation?> selected() async {
    final rows = await _db.query('locations', where: 'is_current = 1', limit: 1);
    return rows.isEmpty ? null : SavedLocation.fromRow(rows.first);
  }

  /// Saves a place and makes it the selected one. A place with the same
  /// label is updated rather than duplicated (e.g. «موقعي الحالي» refreshed).
  Future<SavedLocation> add({required String label, required double lat, required double lng, required String timezone}) =>
      _db.transaction((txn) async {
        await txn.update('locations', {'is_current': 0});
        final existing = await txn.query('locations', where: 'label = ?', whereArgs: [label], limit: 1);
        final values = {'label': label, 'lat': lat, 'lng': lng, 'timezone': timezone, 'is_current': 1};
        final id = existing.isEmpty
            ? await txn.insert('locations', values)
            : (await txn.update('locations', values, where: 'id = ?', whereArgs: [existing.first['id']]), existing.first['id']! as int).$2;
        return SavedLocation(id: id, label: label, lat: lat, lng: lng, timezone: timezone, selected: true);
      });

  Future<void> select(int id) => _db.transaction((txn) async {
        await txn.update('locations', {'is_current': 0});
        await txn.update('locations', {'is_current': 1}, where: 'id = ?', whereArgs: [id]);
      });

  Future<void> delete(int id) => _db.transaction((txn) async {
        final wasSelected = (await txn.query('locations', where: 'id = ? AND is_current = 1', whereArgs: [id])).isNotEmpty;
        await txn.delete('locations', where: 'id = ?', whereArgs: [id]);
        if (wasSelected) {
          await txn.rawUpdate('UPDATE locations SET is_current = 1 WHERE id = (SELECT MIN(id) FROM locations)');
        }
      });
}
