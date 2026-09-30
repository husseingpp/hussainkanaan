// Runs on an Android emulator in CI (.github/workflows/quran-app-android-media.yml):
// plays generated audio through the real Listen Mode engine and prints
// MEDIA_PHASE markers; tool/ci/media_check.sh dumps what Android shows for
// the media session and its notification at each marker.
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/listen/audio_library.dart';
import 'package:quran_app/features/listen/listen_audio.dart';

/// A mono 16-bit WAV tone. ExoPlayer sniffs the container, so the .mp3 name
/// the library expects doesn't matter.
Uint8List _tone(Duration length) {
  const rate = 16000;
  final samples = rate * length.inMilliseconds ~/ 1000;
  final data = ByteData(44 + samples * 2);
  void ascii(int at, String s) {
    for (var i = 0; i < s.length; i++) {
      data.setUint8(at + i, s.codeUnitAt(i));
    }
  }

  ascii(0, 'RIFF');
  data.setUint32(4, 36 + samples * 2, Endian.little);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little);
  data.setUint16(22, 1, Endian.little);
  data.setUint32(24, rate, Endian.little);
  data.setUint32(28, rate * 2, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  ascii(36, 'data');
  data.setUint32(40, samples * 2, Endian.little);
  for (var i = 0; i < samples; i++) {
    data.setInt16(44 + i * 2, (3000 * math.sin(2 * math.pi * 440 * i / rate)).round(), Endian.little);
  }
  return data.buffer.asUint8List();
}

const _reciter = Reciter(
  id: 1,
  slug: 'test',
  name: 'Test',
  nameAr: 'اختبار',
  style: 'murattal',
  baseUrl: 'https://example.invalid',
  syncTier: 'C',
  approxBytes: 0,
);

const _surahs = [
  Surah(id: 1, nameAr: 'الفاتحة', nameEn: 'The Opening', nameTranslit: 'Al-Faatiha', isMeccan: true, ayahCount: 7, pageStart: 1),
];

Future<void> _phase(String name) async {
  // ignore: avoid_print
  print('MEDIA_PHASE_$name');
  await Future<void>.delayed(const Duration(seconds: 25));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Listen Mode publishes a media notification', (tester) async {
    final handler = await initAudio();
    expect(handler, isNotNull, reason: 'AudioService.init failed');

    final dir = p.join((await getApplicationSupportDirectory()).path, 'audio');
    final tone = _tone(const Duration(seconds: 20));
    Directory(p.join(dir, _reciter.slug)).createSync(recursive: true);
    for (var a = 1; a <= 7; a++) {
      File(p.join(dir, _reciter.slug, Reciter.fileName(AyahRef(1, a)))).writeAsBytesSync(tone);
    }
    handler!.configure(library: AudioLibrary(directory: dir), surahs: _surahs, save: (_) async {});

    await handler.startListening(_reciter, const AyahRef(1, 1));
    await _phase('1_first_play');

    await handler.pause();
    await _phase('2_paused');

    await handler.play();
    await _phase('3_resumed');

    // What Follow Mode does on leaving, then Listen Mode starting again.
    await handler.session!.stop();
    await _phase('4_stopped');
    await handler.startListening(_reciter, const AyahRef(1, 2));
    await _phase('5_second_play');

    await handler.stop();
  }, timeout: const Timeout(Duration(minutes: 5)));
}
