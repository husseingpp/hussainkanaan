import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/listen/audio_library.dart';
import 'package:quran_app/features/listen/listen_queue.dart';
import 'package:quran_app/features/listen/listen_session.dart';
import 'package:quran_app/features/listen/sleep_timer.dart';

const _surahs = [
  Surah(id: 1, nameAr: 'الفاتحة', nameEn: '', nameTranslit: '', isMeccan: true, ayahCount: 7, pageStart: 1),
  Surah(id: 112, nameAr: 'الإخلاص', nameEn: '', nameTranslit: '', isMeccan: true, ayahCount: 4, pageStart: 604),
  Surah(id: 113, nameAr: 'الفلق', nameEn: '', nameTranslit: '', isMeccan: true, ayahCount: 5, pageStart: 604),
  Surah(id: 114, nameAr: 'الناس', nameEn: '', nameTranslit: '', isMeccan: true, ayahCount: 6, pageStart: 604),
];
Surah _s(int id) => _surahs.firstWhere((s) => s.id == id);

Reciter _reciter(String base) => Reciter(
      id: 1, slug: 'test', name: 'Test', nameAr: null, style: 'murattal', baseUrl: base, syncTier: 'A', approxBytes: 0);

/// Bytes that pass the MP3 check (an ID3 header).
List<int> _mp3(int n) => [0x49, 0x44, 0x33, ...List.filled(n, 7)];

void main() {
  group('queue', () {
    test('a surah opens with the bismillah (1:1), except Al-Fatiha and At-Tawbah', () {
      expect(surahItems(112, 4).map((i) => '$i'), ['bismillah(112)', '112:1', '112:2', '112:3', '112:4']);
      expect(surahItems(112, 4).first.file, const AyahRef(1, 1));
      expect(surahItems(1, 7).first.isBismillah, isFalse);
      expect(surahItems(9, 129).first.isBismillah, isFalse);
    });

    test('starting mid-surah skips the bismillah', () {
      expect(surahItems(112, 4, fromAyah: 3).map((i) => '$i'), ['112:3', '112:4']);
    });

    test('files a surah needs include 1:1 for its bismillah', () {
      expect(filesForSurah(112, 4), contains(const AyahRef(1, 1)));
      expect(filesForSurah(9, 2), {const AyahRef(9, 1), const AyahRef(9, 2)});
    });
  });

  group('sleep timer', () {
    test('minutes count down playing time and fade over the last 30 s', () {
      final c = SleepController()..set(const SleepAfter(Duration(minutes: 1)), currentSurah: 2);
      expect(c.volumeFactor(), 1);
      c.elapse(const Duration(seconds: 45));
      expect(c.volumeFactor(), closeTo(0.5, 1e-9));
      c.elapse(const Duration(seconds: 20));
      expect(c.timeIsUp, isTrue);
      expect(c.volumeFactor(), 0);
    });

    test('surah timers stop after the target surah and fade within its last ayah', () {
      final c = SleepController()..set(const SleepAfterSurahs(3), currentSurah: 112);
      expect(c.stopAfterSurah, 114);
      expect(c.volumeFactor(lastItemRemaining: const Duration(seconds: 10)), closeTo(1 / 3, 1e-9));
      c.set(const SleepAfterSurahs(5), currentSurah: 113);
      expect(c.stopAfterSurah, 114, reason: 'never past the last surah');
      c.set(const SleepEndOfSurah(), currentSurah: 36);
      expect(c.stopAfterSurah, 36);
    });

    test('quiet-room gain reaches far below normal', () {
      expect(gainForLevel(1), 1);
      expect(gainForLevel(0), closeTo(0.01, 1e-12));
      expect(gainForLevel(0.5), closeTo(0.1, 1e-12));
    });
  });

  group('AudioLibrary', () {
    late HttpServer server;
    late Directory tmp;
    final files = <String, List<int>>{};
    final ranges = <String>[];

    setUp(() async {
      tmp = await Directory.systemTemp.createTemp('audio');
      files.clear();
      ranges.clear();
      for (var a = 1; a <= 4; a++) {
        files['/112${a.toString().padLeft(3, '0')}.mp3'] = _mp3(100 + a);
      }
      files['/001001.mp3'] = _mp3(50);
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((req) {
        final body = files[req.uri.path];
        final range = req.headers.value(HttpHeaders.rangeHeader);
        if (range != null) ranges.add('${req.uri.path} $range');
        if (body == null) {
          req.response.statusCode = 404;
        } else if (range != null) {
          final from = int.parse(range.substring(6, range.length - 1));
          req.response
            ..statusCode = 206
            ..contentLength = body.length - from
            ..add(body.sublist(from));
        } else {
          req.response
            ..contentLength = body.length
            ..add(body);
        }
        req.response.close();
      });
    });

    tearDown(() async {
      await server.close(force: true);
      await tmp.delete(recursive: true);
    });

    test('downloads a surah with its bismillah file', () async {
      final lib = AudioLibrary(directory: tmp.path);
      final r = _reciter('http://127.0.0.1:${server.port}');
      expect(lib.hasSurah(r, _s(112)), isFalse);
      final progress = <int>[];
      await lib.download(r, [_s(112)], onProgress: (d, _) => progress.add(d));
      expect(lib.hasSurah(r, _s(112)), isTrue);
      expect(progress.last, 5);
      expect(File(lib.pathFor(r, const AyahRef(112, 4))).readAsBytesSync(), files['/112004.mp3']);
    });

    test('resumes a partial file with a Range request', () async {
      final lib = AudioLibrary(directory: tmp.path);
      final r = _reciter('http://127.0.0.1:${server.port}');
      final path = lib.pathFor(r, const AyahRef(112, 2));
      Directory(File(path).parent.path).createSync(recursive: true);
      File('$path.part').writeAsBytesSync(files['/112002.mp3']!.sublist(0, 40));
      await lib.download(r, [_s(112)]);
      expect(ranges, ['/112002.mp3 bytes=40-']);
      expect(File(path).readAsBytesSync(), files['/112002.mp3']);
    });

    test('an error page is never kept as audio', () async {
      files['/112003.mp3'] = '<html>not found</html>'.codeUnits;
      final lib = AudioLibrary(directory: tmp.path);
      final r = _reciter('http://127.0.0.1:${server.port}');
      await expectLater(lib.download(r, [_s(112)]),
          throwsA(isA<AudioDownloadError>().having((e) => e.reason, 'reason', 'not an MP3 file')));
      expect(lib.has(r, const AyahRef(112, 3)), isFalse);
      expect(lib.has(r, const AyahRef(112, 1)), isTrue, reason: 'good files are kept');
    });

    test('deleting a surah keeps 1:1 while others need it for their bismillah', () async {
      final lib = AudioLibrary(directory: tmp.path);
      final r = _reciter('http://127.0.0.1:${server.port}');
      for (final f in [...filesForSurah(1, 7), ...filesForSurah(112, 4)]) {
        File(lib.pathFor(r, f))
          ..createSync(recursive: true)
          ..writeAsBytesSync(_mp3(5));
      }
      lib.delete(r, [_s(1)], _surahs);
      expect(lib.has(r, const AyahRef(1, 2)), isFalse);
      expect(lib.has(r, const AyahRef(1, 1)), isTrue);
      expect(lib.hasSurah(r, _s(112)), isTrue);
    });
  });

  group('ListenSession', () {
    late Directory tmp;
    late AudioLibrary lib;
    late _FakePort port;
    late List<ListenSnapshot> saved;
    late ListenSession session;
    final r = _reciter('http://unused');

    void have(List<int> surahs) {
      for (final id in surahs) {
        for (final f in filesForSurah(id, _s(id).ayahCount)) {
          File(lib.pathFor(r, f))
            ..createSync(recursive: true)
            ..writeAsBytesSync(_mp3(5));
        }
      }
    }

    setUp(() async {
      tmp = await Directory.systemTemp.createTemp('session');
      lib = AudioLibrary(directory: tmp.path);
      port = _FakePort();
      saved = [];
      session = ListenSession(port: port, library: lib, surahs: _surahs, save: (s) async => saved.add(s));
    });

    tearDown(() async {
      await session.dispose();
      await tmp.delete(recursive: true);
    });

    test('refuses to stream: the starting surah must be downloaded', () async {
      await expectLater(session.start(r, const AyahRef(112, 1)), throwsA(isA<SurahNotDownloaded>()));
      expect(port.loaded, isEmpty);
    });

    test('queues the next surah and keeps one ahead as playback crosses into it', () async {
      have([112, 113, 114]);
      await session.start(r, const AyahRef(112, 1));
      expect(session.queue.map((i) => i.surah).toSet(), {112, 113});
      expect(port.loaded.first, endsWith('/001001.mp3'), reason: 'bismillah first');
      expect(port.isPlaying, isTrue);

      await port.jumpTo(session.queue.indexWhere((i) => i.surah == 113 && !i.isBismillah));
      expect(session.queue.last.surah, 114);
      expect(port.loaded.length, session.queue.length);
    });

    test('ends cleanly where downloads end', () async {
      have([112]);
      final done = session.changes.firstWhere((s) => s.stopped != null);
      await session.start(r, const AyahRef(112, 1));
      expect(session.queue.last, const PlaybackItem(112, 4));
      port.finish();
      expect((await done).stopped, StopReason.notDownloaded);
    });

    test('end-of-surah timer trims the queue, fades in the last ayah and stops there', () async {
      have([112, 113]);
      await session.start(r, const AyahRef(112, 3));
      await session.setSleep(const SleepEndOfSurah());
      expect(session.queue.map((i) => '$i'), ['112:3', '112:4']);
      expect(port.loaded.length, 2);

      await port.jumpTo(1);
      port
        ..duration = const Duration(seconds: 40)
        ..position = const Duration(seconds: 25);
      await session.tick(const Duration(seconds: 1));
      expect(port.volume, closeTo(0.5, 1e-9), reason: '15 s left of a 30 s fade');

      final done = session.changes.firstWhere((s) => s.stopped != null);
      port.finish();
      expect((await done).stopped, StopReason.sleepTimer);
    });

    test('minutes timer fades, stops, and restores the volume for next time', () async {
      have([112]);
      await session.start(r, const AyahRef(112, 1));
      await session.setLevel(0.5);
      await session.setSleep(const SleepAfter(Duration(seconds: 40)));
      await session.tick(const Duration(seconds: 25));
      expect(port.volume, closeTo(0.1 * 0.5, 1e-9), reason: 'gain 0.1 x fade 15/30');
      await session.tick(const Duration(seconds: 15));
      expect(session.snapshot!.stopped, StopReason.sleepTimer);
      expect(port.isPlaying, isFalse);
      expect(port.volume, closeTo(0.1, 1e-9));
    });

    test('paused time does not count toward the sleep timer', () async {
      have([112]);
      await session.start(r, const AyahRef(112, 1));
      await session.setSleep(const SleepAfter(Duration(minutes: 1)));
      await session.pause();
      await session.tick(const Duration(minutes: 5));
      expect(session.sleep.remaining, const Duration(minutes: 1));
    });

    test('saves the position every 10 s of playback, and on pause', () async {
      have([112]);
      await session.start(r, const AyahRef(112, 2));
      saved.clear();
      for (var i = 0; i < 9; i++) {
        await session.tick(const Duration(seconds: 1));
      }
      expect(saved, isEmpty);
      await session.tick(const Duration(seconds: 1));
      expect(saved.single.item, const PlaybackItem(112, 2));
      await session.pause();
      expect(saved.length, 2);
    });
  });
}

class _FakePort implements AudioPort {
  final loaded = <String>[];
  final _index = StreamController<int?>.broadcast(sync: true);
  final _completed = StreamController<void>.broadcast(sync: true);
  int? _i;
  bool isPlaying = false;
  double volume = 1;
  @override
  Duration position = Duration.zero;
  @override
  Duration? duration;

  Future<void> jumpTo(int i) async {
    _i = i;
    _index.add(i);
    await Future<void>.delayed(Duration.zero);
  }

  void finish() {
    isPlaying = false;
    _completed.add(null);
  }

  @override
  Stream<int?> get indexStream => _index.stream;
  @override
  Stream<void> get completedStream => _completed.stream;
  @override
  Stream<Duration> get positionStream => const Stream.empty();
  @override
  int? get index => _i;
  @override
  bool get playing => isPlaying;
  @override
  Future<void> load(List<String> paths, {int index = 0}) async {
    loaded
      ..clear()
      ..addAll(paths);
    _i = index;
  }

  @override
  Future<void> append(List<String> paths) async => loaded.addAll(paths);
  @override
  Future<void> truncate(int length) async => loaded.removeRange(length, loaded.length);
  @override
  Future<void> play() async => isPlaying = true;
  @override
  Future<void> pause() async => isPlaying = false;
  @override
  Future<void> stop() async => isPlaying = false;
  @override
  Future<void> seekToIndex(int index) => jumpTo(index);
  @override
  Future<void> setVolume(double v) async => volume = v;
}
