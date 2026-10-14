import 'dart:io' show Platform;

const bool isWeb = false;
bool get isAndroid => Platform.isAndroid;
bool get isIOS => Platform.isIOS;
bool get isMobile => Platform.isAndroid || Platform.isIOS;
bool get isDesktop => Platform.isLinux || Platform.isMacOS || Platform.isWindows;
