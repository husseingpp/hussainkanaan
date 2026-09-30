import 'dart:async';

import '../../data/models.dart';
import 'audio_library.dart';
import 'listen_queue.dart';
import 'sleep_timer.dart';

/// What the session needs from an audio player. just_audio implements it on
/// devices (listen_audio.dart); tests use a fake.
abstract class AudioPort {
  Stream<int?> get indexStream;

  /// Position within the current file, frequently enough to follow words
  /// (Follow Mode throttles it to about 60 ms).
  Stream<Duration> get positionStream;

  /// Fires when the last queued file finishes.
  Stream<void> get completedStream;

  int? get index;
  bool get playing;
  Duration get position;
  Duration? get duration;

  Future<void> load(List<String> paths, {int index = 0});
  Future<void> append(List<String> paths);

  /// Drops every queued file from [length] on.
  Future<void> truncate(int length);
  Future<void> play();
  Future<void> pause();
  Future<void> stop();
  Future<void> seekToIndex(int index);
  Future<void> setVolume(double volume);
}

class SurahNotDownloaded implements Exception {
  const SurahNotDownloaded(this.surah);

  final int surah;
}

enum StopReason { user, sleepTimer, endOfQuran, notDownloaded }

/// Listen Mode (screen off, hours) or Follow Mode (screen on, words lit).
/// Same engine; each keeps its own resume point.
enum SessionMode { listen, follow }

/// Where playback is, for the lock screen, the UI and crash recovery.
class ListenSnapshot {
  const ListenSnapshot({
    required this.reciter,
    required this.item,
    required this.position,
    required this.playing,
    required this.sleep,
    this.mode = SessionMode.listen,
    this.plan = RepeatPlan.none,
    this.sleepRemaining,
    this.stopAfterSurah,
    this.stopped,
  });

  final SessionMode mode;
  final RepeatPlan plan;

  final Reciter reciter;
  final PlaybackItem item;
  final Duration position;
  final bool playing;
  final SleepTimer sleep;
  final Duration? sleepRemaining;
  final int? stopAfterSurah;

  /// Set once playback has ended, with why.
  final StopReason? stopped;
}

/// One continuous listening session: from an ayah towards the end of the
/// Quran, one tap. Queues whole surahs a little ahead of the one playing
/// (gapless across boundaries), and only ever files already downloaded.
class ListenSession {
  ListenSession({
    required this._port,
    required this._library,
    required List<Surah> surahs,
    required this._save,
    this.saveEvery = const Duration(seconds: 10),
  }) : _surahs = {for (final s in surahs) s.id: s} {
    _subs = [
      _port.indexStream.listen(_onIndex),
      _port.completedStream.listen((_) => _onCompleted()),
    ];
  }

  final AudioPort _port;
  final AudioLibrary _library;
  final Map<int, Surah> _surahs;
  final Future<void> Function(ListenSnapshot) _save;
  final Duration saveEvery;

  late final List<StreamSubscription<Object?>> _subs;
  final _sleep = SleepController();
  final _changes = StreamController<ListenSnapshot>.broadcast();
  final _items = <PlaybackItem>[];
  Reciter? _reciter;
  SessionMode _mode = SessionMode.listen;
  RepeatPlan _plan = RepeatPlan.none;
  double _gain = 1;
  Duration _sinceSave = Duration.zero;
  StopReason? _stopped;

  /// Surahs to keep queued past the one playing: enough to be gapless.
  static const _lookahead = 1;

  Stream<ListenSnapshot> get changes => _changes.stream;
  List<PlaybackItem> get queue => List.unmodifiable(_items);
  Stream<Duration> get positionStream => _port.positionStream;
  Duration get position => _port.position;
  SleepController get sleep => _sleep;

  PlaybackItem? get current {
    final i = _port.index;
    return i == null || i >= _items.length ? null : _items[i];
  }

  ListenSnapshot? get snapshot {
    final r = _reciter, item = current;
    if (r == null || item == null) return null;
    return ListenSnapshot(
      reciter: r,
      item: item,
      position: _port.position,
      playing: _port.playing,
      sleep: _sleep.mode,
      mode: _mode,
      plan: _plan,
      sleepRemaining: _sleep.remaining,
      stopAfterSurah: _sleep.stopAfterSurah,
      stopped: _stopped,
    );
  }

  String _path(PlaybackItem item) => _library.pathFor(_reciter!, item.file);

  /// Starts at [from]. Refuses (throws [SurahNotDownloaded]) rather than stream.
  Future<void> start(
    Reciter reciter,
    AyahRef from, {
    SleepTimer sleep = const SleepOff(),
    SessionMode mode = SessionMode.listen,
    RepeatPlan plan = RepeatPlan.none,
  }) async {
    final surah = _surahs[from.surah]!;
    if (!_library.hasSurah(reciter, surah)) throw SurahNotDownloaded(from.surah);
    _reciter = reciter;
    _stopped = null;
    _mode = mode;
    _plan = plan;
    _sleep.set(sleep, currentSurah: from.surah);
    _items
      ..clear()
      ..addAll(plan.apply(from.surah, surah.ayahCount, fromAyah: from.ayah));
    _items.addAll(_nextSurahs(from.surah));
    await _port.load([for (final i in _items) _path(i)]);
    await _applyVolume();
    await _port.play();
    _emit();
  }

  /// Items for the surahs after [surah] that may be queued now: downloaded,
  /// within the Quran and not past a sleep timer's last surah.
  List<PlaybackItem> _nextSurahs(int surah) {
    final out = <PlaybackItem>[];
    for (var s = surah + 1; s <= surah + _lookahead; s++) {
      if (!_mayQueue(s)) break;
      out.addAll(_plan.apply(s, _surahs[s]!.ayahCount));
    }
    return out;
  }

  bool _mayQueue(int surah) {
    if (surah > 114) return false;
    final stop = _sleep.stopAfterSurah;
    if (stop != null && surah > stop) return false;
    return _library.hasSurah(_reciter!, _surahs[surah]!);
  }

  Future<void> _onIndex(int? index) async {
    final item = current;
    if (item == null) return;
    // Entering the last queued surah: queue the next one behind it.
    final lastQueued = _items.last.surah;
    if (item.surah == lastQueued) {
      final more = _nextSurahs(lastQueued);
      if (more.isNotEmpty) {
        _items.addAll(more);
        await _port.append([for (final i in more) _path(i)]);
      }
    }
    await _saveNow();
    _emit();
  }

  Future<void> _onCompleted() async {
    final last = _items.isEmpty ? null : _items.last;
    final reason = switch (last) {
      _ when _sleep.stopAfterSurah != null && last != null && last.surah >= _sleep.stopAfterSurah! =>
        StopReason.sleepTimer,
      PlaybackItem(surah: 114) => StopReason.endOfQuran,
      _ => StopReason.notDownloaded,
    };
    await _end(reason);
  }

  /// Called about once a second by the owner while the session is alive.
  Future<void> tick(Duration elapsed) async {
    if (_reciter == null || _stopped != null || !_port.playing) return;
    _sleep.elapse(elapsed);
    if (_sleep.timeIsUp) {
      await _end(StopReason.sleepTimer);
      return;
    }
    await _applyVolume();
    _sinceSave += elapsed;
    if (_sinceSave >= saveEvery) await _saveNow();
    _emit();
  }

  Future<void> setSleep(SleepTimer mode) async {
    final item = current;
    if (item == null) return;
    _sleep.set(mode, currentSurah: item.surah);
    final stop = _sleep.stopAfterSurah;
    if (stop != null) {
      // Nothing past the last surah stays queued, so playback ends there.
      final keep = _items.lastIndexWhere((i) => i.surah <= stop) + 1;
      if (keep < _items.length) {
        _items.removeRange(keep, _items.length);
        await _port.truncate(keep);
      }
    }
    if (_items.last.surah < (stop ?? 115)) {
      final more = _nextSurahs(_items.last.surah);
      if (more.isNotEmpty) {
        _items.addAll(more);
        await _port.append([for (final i in more) _path(i)]);
      }
    }
    await _applyVolume();
    _emit();
  }

  /// The quiet-room level (0..1), applied under the system volume.
  Future<void> setLevel(double level) async {
    _gain = gainForLevel(level);
    await _applyVolume();
  }

  Future<void> _applyVolume() async {
    Duration? lastLeft;
    final item = current, stop = _sleep.stopAfterSurah;
    if (item != null && stop != null && item.surah == stop && item == _items.last) {
      final d = _port.duration;
      if (d != null) lastLeft = d - _port.position;
    }
    await _port.setVolume(_gain * _sleep.volumeFactor(lastItemRemaining: lastLeft));
  }

  Future<void> pause() async {
    await _port.pause();
    await _saveNow();
    _emit();
  }

  Future<void> resume() async {
    if (_reciter == null || _stopped != null) return;
    await _port.play();
    _emit();
  }

  /// Jumps to the first queued item of [ayah] in the current surah (e.g. a
  /// tap on it in Follow Mode). Returns false if it isn't queued.
  Future<bool> jumpToAyah(int ayah) async {
    final item = current;
    if (item == null) return false;
    final i = _items.indexWhere((x) => x.surah == item.surah && x.ayah == ayah && !x.isBismillah);
    if (i < 0) return false;
    await _port.seekToIndex(i);
    if (!_port.playing) await _port.play();
    return true;
  }

  Future<void> next() => _skip(1);
  Future<void> previous() => _skip(-1);

  Future<void> _skip(int by) async {
    final i = _port.index;
    if (i == null) return;
    final to = (i + by).clamp(0, _items.length - 1);
    if (to != i) await _port.seekToIndex(to);
  }

  Future<void> stop() => _end(StopReason.user);

  Future<void> _end(StopReason reason) async {
    if (_stopped != null) return;
    await _saveNow();
    _stopped = reason;
    await _port.pause();
    _sleep.clear();
    await _port.setVolume(_gain);
    _emit();
  }

  Future<void> _saveNow() async {
    _sinceSave = Duration.zero;
    final s = snapshot;
    if (s != null) await _save(s);
  }

  void _emit() {
    final s = snapshot;
    if (s != null) _changes.add(s);
  }

  Future<void> dispose() async {
    for (final s in _subs) {
      await s.cancel();
    }
    await _changes.close();
  }
}
