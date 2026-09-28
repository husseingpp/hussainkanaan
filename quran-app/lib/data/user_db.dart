import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// On-device user data: bookmarks, khatmah, playback state, locations.
/// Created from schema/user.sql and never replaced by a content update.
class UserDb {
  static const version = 1;
  static const schemaAsset = 'schema/user.sql';

  UserDb._(this.db);

  final Database db;

  static Future<UserDb> open({
    required DatabaseFactory factory,
    required String directory,
    AssetBundle? bundle,
  }) async {
    final schema = await (bundle ?? rootBundle).loadString(schemaAsset);
    final db = await factory.openDatabase(
      p.join(directory, 'user.db'),
      options: OpenDatabaseOptions(
        version: version,
        onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
        onCreate: (db, _) async {
          for (final statement in splitSqlStatements(schema)) {
            await db.execute(statement);
          }
        },
      ),
    );
    return UserDb._(db);
  }

  Future<void> close() => db.close();
}

/// Splits a plain DDL script (no triggers, no ';' inside literals). PRAGMAs
/// are dropped: they are per-connection and set in onConfigure instead.
List<String> splitSqlStatements(String script) => script
    .replaceAll(RegExp(r'--[^\n]*'), '')
    .split(';')
    .map((s) => s.trim())
    .where((s) => s.isNotEmpty && !s.toUpperCase().startsWith('PRAGMA'))
    .toList(growable: false);
