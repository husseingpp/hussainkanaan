/// The SQLite backend per platform: the phone's own (sqflite), FFI on
/// desktop, and SQLite compiled to WebAssembly in a browser (stored in
/// IndexedDB).
library;

export 'db_factory_io.dart' if (dart.library.js_interop) 'db_factory_web.dart';
