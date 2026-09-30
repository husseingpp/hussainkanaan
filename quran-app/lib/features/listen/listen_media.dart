import 'package:audio_service/audio_service.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import 'listen_session.dart';

/// What the system media controls show for a snapshot: the notification, the
/// lock screen, Android's quick-settings player, Bluetooth car displays and
/// the iOS Now Playing panel.
MediaItem mediaItemFor(ListenSnapshot s, Map<int, Surah> surahs, {Duration? duration, Uri? art}) {
  final surah = surahs[s.item.surah];
  final name = surah == null ? '' : 'سورة ${surah.nameAr}';
  return MediaItem(
    id: '${s.reciter.slug}/${s.item.file.surah}:${s.item.file.ayah}',
    title: s.item.isBismillah ? '$name — البسملة' : '$name — الآية ${arabicDigits(s.item.ayah)}',
    artist: s.reciter.nameAr ?? s.reciter.name,
    album: 'القرآن الكريم',
    // Each ayah is its own file, so the seek bar spans the ayah playing.
    duration: duration,
    artUri: art,
  );
}

/// The transport state the system controls act on. Once a session has ended
/// (sleep timer, end of downloads, stop) the state goes idle, which ends the
/// foreground service and clears the notification instead of leaving a
/// stale player on the lock screen.
PlaybackState playbackStateFor({
  required bool playing,
  required AudioProcessingState processing,
  required Duration position,
  required bool ended,
  int? index,
}) {
  if (ended) return PlaybackState(processingState: AudioProcessingState.idle);
  return PlaybackState(
    controls: [
      MediaControl.skipToPrevious,
      if (playing) MediaControl.pause else MediaControl.play,
      MediaControl.skipToNext,
      MediaControl.stop,
    ],
    androidCompactActionIndices: const [0, 1, 2],
    systemActions: const {MediaAction.seek, MediaAction.skipToNext, MediaAction.skipToPrevious},
    processingState: processing,
    playing: playing,
    updatePosition: position,
    queueIndex: index,
  );
}

/// Stops are reported with why, so the in-app screen can explain them.
bool hasEnded(ListenSnapshot? s) => s?.stopped != null;
