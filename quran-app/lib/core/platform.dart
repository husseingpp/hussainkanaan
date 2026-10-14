/// Which platform the app runs on, safe to call in a browser (where
/// dart:io's Platform throws). Native builds use dart:io; the web build
/// answers false for every native platform.
library;

export 'platform_io.dart' if (dart.library.js_interop) 'platform_web.dart';
