import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';

import '../../data/models.dart';
import 'audio_library.dart';
import 'listen_media.dart';
import 'listen_queue.dart';
import 'listen_session.dart';
import 'sleep_timer.dart';

/// just_audio behind the session's [AudioPort].
class JustAudioPort implements AudioPort {
  JustAudioPort(this.player);

  final AudioPlayer player;

  @override
  Stream<int?> get indexStream => player.currentIndexStream.distinct();

  @override
  Stream<Duration> get positionStream => player.createPositionStream(
        minPeriod: const Duration(milliseconds: 40),
        maxPeriod: const Duration(milliseconds: 60),
      );

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
  ListenSnapshot? _last;
  Uri? _art;

  ListenSession? get session => _session;

  /// Wires the session once the content and user DBs are open.
  void configure({
    required AudioLibrary library,
    required List<Surah> surahs,
    required Future<void> Function(ListenSnapshot) save,
    Uri? art,
  }) {
    if (_session != null) return;
    _art = art;
    _surahs = {for (final s in surahs) s.id: s};
    final session = ListenSession(port: _port, library: library, surahs: surahs, save: save);
    _session = session;
    _changes = session.changes.listen(_publish);
    _player.playbackEventStream.listen((_) => _publishFromPlayer());
    // The seek bar needs each ayah's length, known once its file loads.
    _player.durationStream.listen((d) {
      final s = _last;
      if (s != null && d != null) mediaItem.add(mediaItemFor(s, _surahs, duration: d, art: _art));
    });
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => session.tick(const Duration(seconds: 1)));
  }

  Future<void> startListening(
    Reciter reciter,
    AyahRef from, {
    SleepTimer sleep = const SleepOff(),
    SessionMode mode = SessionMode.listen,
    RepeatPlan plan = RepeatPlan.none,
  }) async {
    final session = _session;
    if (session == null) throw StateError('audio not configured');
    // Calls and alarms interrupt, then playback resumes; unplugging headphones pauses.
    final audioSession = await AudioSession.instance;
    await audioSession.configure(const AudioSessionConfiguration.music());
    await session.start(reciter, from, sleep: sleep, mode: mode, plan: plan);
  }

  void _publish(ListenSnapshot s) {
    _last = s;
    mediaItem.add(mediaItemFor(s, _surahs, duration: _player.duration, art: _art));
    _publishFromPlayer();
  }

  void _publishFromPlayer() {
    final s = _last;
    playbackState.add(playbackStateFor(
      playing: _player.playing && !hasEnded(s),
      processing: switch (_player.processingState) {
        // The player passes through idle while a new queue loads. audio_service
        // treats idle as "playback over" and shuts the service (and its
        // notification) down, so only an ended session may report idle.
        ProcessingState.idle => AudioProcessingState.loading,
        ProcessingState.loading => AudioProcessingState.loading,
        ProcessingState.buffering => AudioProcessingState.buffering,
        ProcessingState.ready => AudioProcessingState.ready,
        ProcessingState.completed => AudioProcessingState.completed,
      },
      position: _player.position,
      ended: hasEnded(s),
      index: _player.currentIndex,
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
        androidNotificationIcon: 'drawable/ic_stat_quran',
      ),
    );
  } catch (_) {
    return null;
  }
}
