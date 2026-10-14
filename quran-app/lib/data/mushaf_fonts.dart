import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;

import '../core/platform.dart' as platform;

/// One page's QCF v1 font, as recorded (size + sha256) by the ingest.
class QcfFontInfo {
  const QcfFontInfo({required this.page, required this.url, required this.bytes, required this.sha256});

  final int page;
  final String url;
  final int bytes;
  final String sha256;
}

class FontDownloadError implements Exception {
  const FontDownloadError(this.page, this.reason);

  final int page;
  final String reason;

  @override
  String toString() => 'page $page: $reason';
}

/// The King Fahd Complex per-page fonts that draw each page exactly as
/// printed. Too large to bundle (~95 MB), so they are a one-time download
/// the reader asks for; Page View uses the bundled Uthmani font until then.
///
/// Never called from the reading path: [download] only runs when the user
/// taps it, and [family] reads local files only (offline-first rule 1).
class MushafFontPack {
  MushafFontPack({
    required this.directory,
    required List<QcfFontInfo> fonts,
    HttpClient Function()? httpClient,
    Future<void> Function(String family, Uint8List bytes)? register,
  })  : fonts = {for (final f in fonts) f.page: f},
        _httpClient = httpClient ?? HttpClient.new,
        _register = register ?? _registerWithEngine;

  final String directory;
  final Map<int, QcfFontInfo> fonts;
  final HttpClient Function() _httpClient;
  final Future<void> Function(String family, Uint8List bytes) _register;
  final _loaded = <int, Future<String?>>{};

  static const _parallel = 6;
  static const _attempts = 3;

  int get totalBytes => fonts.values.fold(0, (sum, f) => sum + f.bytes);

  File _file(int page) => File(p.join(directory, 'p$page.ttf'));

  /// Size is checked here; the sha256 was checked when the file was written.
  bool isInstalled(int page) {
    final info = fonts[page];
    // In a browser each page's font is fetched when the page is shown (the
    // browser caches it), so there is nothing to install.
    if (platform.isWeb) return info != null;
    final file = _file(page);
    return info != null && file.existsSync() && file.lengthSync() == info.bytes;
  }

  int get installedCount => fonts.keys.where(isInstalled).length;
  bool get isComplete => fonts.isNotEmpty && installedCount == fonts.length;

  /// Downloads every missing page font, verifying each before it's kept.
  /// Resumable: already-installed pages are skipped.
  Future<void> download({void Function(int done, int total)? onProgress, bool Function()? isCancelled}) async {
    Directory(directory).createSync(recursive: true);
    final missing = fonts.keys.where((page) => !isInstalled(page)).toList()..sort();
    final total = fonts.length;
    var done = total - missing.length;
    onProgress?.call(done, total);
    final client = _httpClient();
    try {
      var next = 0;
      Future<void> worker() async {
        while (next < missing.length) {
          if (isCancelled?.call() ?? false) return;
          final page = missing[next++];
          await _fetchOne(client, fonts[page]!);
          onProgress?.call(++done, total);
        }
      }

      await Future.wait([for (var i = 0; i < _parallel; i++) worker()]);
    } finally {
      client.close(force: true);
    }
  }

  Future<void> _fetchOne(HttpClient client, QcfFontInfo info) async {
    Object? lastError;
    for (var attempt = 0; attempt < _attempts; attempt++) {
      try {
        final request = await client.getUrl(Uri.parse(info.url));
        final response = await request.close();
        if (response.statusCode != HttpStatus.ok) {
          await response.drain<void>();
          throw FontDownloadError(info.page, 'HTTP ${response.statusCode}');
        }
        final builder = BytesBuilder(copy: false);
        await response.forEach(builder.add);
        final bytes = builder.takeBytes();
        if (bytes.length != info.bytes) {
          throw FontDownloadError(info.page, 'expected ${info.bytes} bytes, got ${bytes.length}');
        }
        if (sha256.convert(bytes).toString() != info.sha256) {
          throw FontDownloadError(info.page, 'checksum mismatch');
        }
        final tmp = File('${_file(info.page).path}.tmp');
        await tmp.writeAsBytes(bytes, flush: true);
        await tmp.rename(_file(info.page).path);
        return;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError is FontDownloadError ? lastError : FontDownloadError(info.page, '$lastError');
  }

  /// The font family to draw [page] with, or null if its font isn't installed.
  Future<String?> family(int page) {
    if (!isInstalled(page)) return Future.value(null);
    return _loaded.putIfAbsent(page, () async {
      final family = 'QCF_P${page.toString().padLeft(3, '0')}';
      try {
        await _register(family, platform.isWeb ? await _fetchVerified(fonts[page]!) : await _file(page).readAsBytes());
        return family;
      } catch (_) {
        // Offline or a bad response: draw this page with the Uthmani font
        // for now and try again next time it's shown.
        unawaited(Future(() => _loaded.remove(page)));
        return null;
      }
    });
  }

  /// A page font over HTTP, kept only if it matches the size and sha256 the
  /// ingest recorded.
  static Future<Uint8List> _fetchVerified(QcfFontInfo info) async {
    final r = await http.get(Uri.parse(info.url));
    final bytes = r.bodyBytes;
    if (r.statusCode != 200 || bytes.length != info.bytes || sha256.convert(bytes).toString() != info.sha256) {
      throw FontDownloadError(info.page, 'font failed verification');
    }
    return bytes;
  }

  static Future<void> _registerWithEngine(String family, Uint8List bytes) =>
      (FontLoader(family)..addFont(Future.value(ByteData.sublistView(bytes)))).load();
}
