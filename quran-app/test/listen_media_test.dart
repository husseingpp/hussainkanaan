import 'package:audio_service/audio_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/listen/listen_media.dart';
import 'package:quran_app/features/listen/listen_queue.dart';
import 'package:quran_app/features/listen/listen_session.dart';
import 'package:quran_app/features/listen/sleep_timer.dart';

const _reciter = Reciter(
  id: 1, slug: 'alafasy', name: 'Mishary Rashid Alafasy', nameAr: 'مشاري راشد العفاسي',
  style: 'murattal', baseUrl: 'https://example.invalid', syncTier: 'A', approxBytes: 0,
);
const _surahs = {
  36: Surah(id: 36, nameAr: 'يس', nameEn: 'Ya-Sin', nameTranslit: 'Yaseen', isMeccan: true, ayahCount: 83, pageStart: 440),
};

ListenSnapshot _snap(PlaybackItem item, {StopReason? stopped}) => ListenSnapshot(
      reciter: _reciter,
      item: item,
      position: Duration.zero,
      playing: stopped == null,
      sleep: const SleepOff(),
      stopped: stopped,
    );

void main() {
  test('lock screen shows surah, ayah, reciter, cover and the ayah length for the seek bar', () {
    final art = Uri.file('/data/cover.png');
    final item = mediaItemFor(_snap(const PlaybackItem(36, 12)), _surahs,
        duration: const Duration(seconds: 41), art: art);
    expect(item.title, 'سورة يس — الآية ١٢');
    expect(item.artist, 'مشاري راشد العفاسي');
    expect(item.album, 'القرآن الكريم');
    expect(item.duration, const Duration(seconds: 41));
    expect(item.artUri, art);
    expect(item.id, 'alafasy/36:12');
  });

  test('the bismillah before a surah is labelled as such', () {
    final item = mediaItemFor(_snap(const PlaybackItem(36, 1, isBismillah: true)), _surahs);
    expect(item.title, 'سورة يس — البسملة');
    expect(item.id, 'alafasy/1:1', reason: 'it plays the reciter\'s 1:1 recording');
  });

  test('controls work like a music player: previous, play/pause, next, stop, seek', () {
    final playing = playbackStateFor(
        playing: true, processing: AudioProcessingState.ready, position: Duration.zero, ended: false, index: 3);
    expect(playing.controls, [MediaControl.skipToPrevious, MediaControl.pause, MediaControl.skipToNext, MediaControl.stop]);
    expect(playing.systemActions, containsAll([MediaAction.seek, MediaAction.skipToNext, MediaAction.skipToPrevious]));
    expect(playing.androidCompactActionIndices, [0, 1, 2]);
    expect(playing.playing, isTrue);

    final paused = playbackStateFor(
        playing: false, processing: AudioProcessingState.ready, position: Duration.zero, ended: false);
    expect(paused.controls[1], MediaControl.play);
  });

  test('an ended session clears the notification instead of lingering', () {
    final s = playbackStateFor(
        playing: false, processing: AudioProcessingState.completed, position: Duration.zero, ended: true);
    expect(s.processingState, AudioProcessingState.idle);
    expect(s.playing, isFalse);
    expect(hasEnded(_snap(const PlaybackItem(36, 83), stopped: StopReason.sleepTimer)), isTrue);
  });
}
