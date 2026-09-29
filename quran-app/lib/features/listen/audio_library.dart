import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;

import '../../data/models.dart';
import 'listen_queue.dart';

class AudioDownloadError implements Exception {
  const AudioDownloadError(this.file, this.reason);

  final AyahRef file;
  final String reason;

  @override
  String toString() => '$file: $reason';
}

/// Downloaded recitations on disk: `audio/<reciter>/<SSSAAA>.mp3`.
///
/// The filesystem is the record: a file exists only once it downloaded
/// completely and looked like MP3. Partial downloads live in .part files and
/// resume with an HTTP Range request. Audio comes straight from the
/// reciter's CDN; the app never hosts audio (offline-first rule 3), and
/// Listen Mode only plays files that are here (never streams).
class AudioLibrary {
  AudioLibrary({required this.directory, HttpClient Function()? httpClient})
      : _httpClient = httpClient ?? HttpClient.new;

  final String directory;
  final HttpClient Function() _httpClient;

  static const _parallel = 4;
  static const _attempts = 3;

  String pathFor(Reciter r, AyahRef file) => p.join(directory, r.slug, Reciter.fileName(file));

  bool has(Reciter r, AyahRef file) {
    final f = File(pathFor(r, file));
    return f.existsSync() && f.lengthSync() > 0;
  }

  bool hasSurah(Reciter r, Surah s) => filesForSurah(s.id, s.ayahCount).every((f) => has(r, f));

  Set<int> downloadedSurahs(Reciter r, List<Surah> surahs) =>
      {for (final s in surahs) if (hasSurah(r, s)) s.id};

  int bytesOnDisk(Reciter r) {
    final dir = Directory(p.join(directory, r.slug));
    if (!dir.existsSync()) return 0;
    return dir.listSync().whereType<File>().where((f) => f.path.endsWith('.mp3')).fold(0, (n, f) => n + f.lengthSync());
  }

  /// Downloads whatever [surahs] still lack. Skips complete files and resumes
  /// partial ones, so it is safe to call again after a failure or a kill.
  Future<void> download(
    Reciter r,
    List<Surah> surahs, {
    void Function(int done, int total)? onProgress,
    bool Function()? isCancelled,
  }) async {
    Directory(p.join(directory, r.slug)).createSync(recursive: true);
    final wanted = <AyahRef>{for (final s in surahs) ...filesForSurah(s.id, s.ayahCount)};
    final missing = wanted.where((f) => !has(r, f)).toList()
      ..sort((a, b) => a.surah != b.surah ? a.surah - b.surah : a.ayah - b.ayah);
    var done = wanted.length - missing.length;
    onProgress?.call(done, wanted.length);
    final client = _httpClient();
    try {
      var next = 0;
      Future<void> worker() async {
        while (next < missing.length) {
          if (isCancelled?.call() ?? false) return;
          await _fetch(client, r, missing[next++]);
          onProgress?.call(++done, wanted.length);
        }
      }

      await Future.wait([for (var i = 0; i < _parallel; i++) worker()]);
    } finally {
      client.close(force: true);
    }
  }

  Future<void> _fetch(HttpClient client, Reciter r, AyahRef file) async {
    final target = File(pathFor(r, file));
    final part = File('${target.path}.part');
    Object? last;
    for (var attempt = 0; attempt < _attempts; attempt++) {
      try {
        final have = part.existsSync() ? part.lengthSync() : 0;
        final request = await client.getUrl(Uri.parse(r.urlFor(file)));
        if (have > 0) request.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-');
        final response = await request.close();
        final resumed = response.statusCode == HttpStatus.partialContent;
        if (response.statusCode != HttpStatus.ok && !resumed) {
          await response.drain<void>();
          throw AudioDownloadError(file, 'HTTP ${response.statusCode}');
        }
        // A server that ignores Range sends the whole file: start over.
        final sink = part.openWrite(mode: resumed ? FileMode.append : FileMode.write);
        try {
          await response.pipe(sink);
        } finally {
          await sink.close();
        }
        final expected = response.contentLength < 0 ? null : (resumed ? have : 0) + response.contentLength;
        final got = part.lengthSync();
        if (expected != null && got != expected) {
          throw AudioDownloadError(file, 'expected $expected bytes, got $got');
        }
        if (!_looksLikeMp3(part)) {
          part.deleteSync();
          throw AudioDownloadError(file, 'not an MP3 file');
        }
        part.renameSync(target.path);
        return;
      } catch (e) {
        last = e;
      }
    }
    throw last is AudioDownloadError ? last : AudioDownloadError(file, '$last');
  }

  /// An ID3 tag or an MPEG audio frame sync at the start of the file.
  static bool _looksLikeMp3(File f) {
    final raf = f.openSync();
    try {
      final head = raf.readSync(3);
      if (head.length < 3) return false;
      if (head[0] == 0x49 && head[1] == 0x44 && head[2] == 0x33) return true; // "ID3"
      return head[0] == 0xFF && (head[1] & 0xE0) == 0xE0;
    } finally {
      raf.closeSync();
    }
  }

  /// Deletes [surahs]' recordings. 1:1 doubles as every surah's bismillah, so
  /// it stays while any other downloaded surah still needs it.
  void delete(Reciter r, List<Surah> surahs, List<Surah> all) {
    final removing = {for (final s in surahs) s.id};
    final keep = <AyahRef>{
      for (final s in all)
        if (!removing.contains(s.id) && hasSurah(r, s)) ...filesForSurah(s.id, s.ayahCount),
    };
    for (final s in surahs) {
      for (final f in filesForSurah(s.id, s.ayahCount)) {
        if (keep.contains(f)) continue;
        for (final path in [pathFor(r, f), '${pathFor(r, f)}.part']) {
          final file = File(path);
          if (file.existsSync()) file.deleteSync();
        }
      }
    }
  }
}
