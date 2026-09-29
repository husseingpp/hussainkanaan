import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import 'audio_library.dart';
import 'listen_session.dart';
import 'sleep_timer.dart';

/// just_audio behind the session's [AudioPort].
class JustAudioPort implements AudioPort {
  JustAudioPort(this.player);

  final AudioPlayer player;

  @override
  Stream<int?> get indexStream => player.currentIndexStream.distinct();

  @override
  Stream<void> get completedStream =>
      player.processingStateStream.where((s) => s == ProcessingState.completed).map((_) {});

  @override
  int? get index => player.currentIndex;
  @override
  bool get playing => player.playing;
  @override
  Duration get position => player.position;
  @override
  Duration? get duration => player.duration;

  @override
  Future<void> load(List<String> paths, {int index = 0}) async {
    // Gapless: the whole window is one playlist, pre-buffering the next file.
    await player.setAudioSources([for (final p in paths) AudioSource.file(p)], initialIndex: index);
  }

  @override
  Future<void> append(List<String> paths) => player.addAudioSources([for (final p in paths) AudioSource.file(p)]);

  @override
  Future<void> truncate(int length) async {
    final n = player.sequence.length;
    if (length < n) await player.removeAudioSourceRange(length, n);
  }

  @override
  Future<void> play() async => unawaited(player.play());
  @override
  Future<void> pause() => player.pause();
  @override
  Future<void> stop() => player.stop();
  @override
  Future<void> seekToIndex(int index) => player.seek(Duration.zero, index: index);
  @override
  Future<void> setVolume(double volume) => player.setVolume(volume);
}

/// Runs Listen Mode as an Android foreground service / iOS background audio,
/// with lock-screen, notification and headset controls. Without the
/// foreground service Android kills background playback (BLUEPRINT §3).
class QuranAudioHandler extends BaseAudioHandler with SeekHandler {
  QuranAudioHandler() : _player = AudioPlayer() {
    _port = JustAudioPort(_player);
  }

  final AudioPlayer _player;
  late final JustAudioPort _port;
  ListenSession? _session;
  Timer? _ticker;
  Map<int, Surah> _surahs = const {};
  StreamSubscription<ListenSnapshot>? _changes;

  ListenSession? get session => _session;

  /// Wires the session once the content and user DBs are open.
  void configure({
    required AudioLibrary library,
    required List<Surah> surahs,
    required Future<void> Function(ListenSnapshot) save,
  }) {
    if (_session != null) return;
    _surahs = {for (final s in surahs) s.id: s};
    final session = ListenSession(port: _port, library: library, surahs: surahs, save: save);
    _session = session;
    _changes = session.changes.listen(_publish);
    _player.playbackEventStream.listen((_) => _publishFromPlayer());
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => session.tick(const Duration(seconds: 1)));
  }

  Future<void> startListening(Reciter reciter, AyahRef from, {SleepTimer sleep = const SleepOff()}) async {
    final session = _session;
    if (session == null) throw StateError('audio not configured');
    // Calls and alarms interrupt, then playback resumes; unplugging headphones pauses.
    final audioSession = await AudioSession.instance;
    await audioSession.configure(const AudioSessionConfiguration.music());
    await session.start(reciter, from, sleep: sleep);
  }

  void _publish(ListenSnapshot s) {
    final surah = _surahs[s.item.surah];
    mediaItem.add(MediaItem(
      id: '${s.reciter.slug}/${s.item.file.surah}:${s.item.file.ayah}',
      title: surah == null
          ? ''
          : s.item.isBismillah
              ? 'سورة ${surah.nameAr} — البسملة'
              : 'سورة ${surah.nameAr} — الآية ${arabicDigits(s.item.ayah)}',
      album: 'القرآن الكريم',
      artist: s.reciter.nameAr ?? s.reciter.name,
    ));
    _publishFromPlayer(stopped: s.stopped != null);
  }

  void _publishFromPlayer({bool stopped = false}) {
    final playing = _player.playing && !stopped;
    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        if (playing) MediaControl.pause else MediaControl.play,
        MediaControl.skipToNext,
        MediaControl.stop,
      ],
      androidCompactActionIndices: const [0, 1, 2],
      systemActions: const {MediaAction.seek},
      processingState: stopped
          ? AudioProcessingState.completed
          : switch (_player.processingState) {
              ProcessingState.idle => AudioProcessingState.idle,
              ProcessingState.loading => AudioProcessingState.loading,
              ProcessingState.buffering => AudioProcessingState.buffering,
              ProcessingState.ready => AudioProcessingState.ready,
              ProcessingState.completed => AudioProcessingState.completed,
            },
      playing: playing,
      updatePosition: _player.position,
      queueIndex: _player.currentIndex,
    ));
  }

  @override
  Future<void> play() async => _session?.resume();
  @override
  Future<void> pause() async => _session?.pause();
  @override
  Future<void> skipToNext() async => _session?.next();
  @override
  Future<void> skipToPrevious() async => _session?.previous();
  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> stop() async {
    await _session?.stop();
    await super.stop();
  }

  Future<void> dispose() async {
    _ticker?.cancel();
    await _changes?.cancel();
    await _session?.dispose();
    await _player.dispose();
  }
}

/// Starts the audio service; null where it isn't available (desktop, for now).
Future<QuranAudioHandler?> initAudio() async {
  try {
    return await AudioService.init(
      builder: QuranAudioHandler.new,
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'net.hussainkanaan.quran_app.recitation',
        androidNotificationChannelName: 'التلاوة',
        androidNotificationOngoing: true,
        androidStopForegroundOnPause: true,
      ),
    );
  } catch (_) {
    return null;
  }
}
