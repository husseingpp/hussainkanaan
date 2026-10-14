import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite_common_ffi/sqflite_ffi.dart' show databaseFactoryFfi, sqfliteFfiInit;

import '../core/platform.dart' as platform;

sqflite.DatabaseFactory platformDatabaseFactory() {
  if (platform.isDesktop) {
    sqfliteFfiInit();
    return databaseFactoryFfi;
  }
  return sqflite.databaseFactory;
}
