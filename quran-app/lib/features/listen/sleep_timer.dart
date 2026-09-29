import 'dart:math' as math;

/// When a sleep session should stop (BLUEPRINT §3): four conditions, not just minutes.
sealed class SleepTimer {
  const SleepTimer();
}

class SleepOff extends SleepTimer {
  const SleepOff();
}

/// After this much *playing* time (pauses don't count).
class SleepAfter extends SleepTimer {
  const SleepAfter(this.duration);

  final Duration duration;
}

/// At the end of the surah playing when the timer was set.
class SleepEndOfSurah extends SleepTimer {
  const SleepEndOfSurah();
}

/// After [count] surahs, counting the one playing now.
class SleepAfterSurahs extends SleepTimer {
  const SleepAfterSurahs(this.count);

  final int count;
}

/// Tracks a sleep timer against playback and says how loud to be and when to
/// stop. The last [fade] fades out rather than cutting: the listener is
/// asleep, and a hard stop wakes them.
class SleepController {
  SleepController({this.fade = const Duration(seconds: 30)});

  final Duration fade;

  SleepTimer _mode = const SleepOff();
  Duration? _remaining;
  int? _stopAfterSurah;

  SleepTimer get mode => _mode;

  /// Playing time left under [SleepAfter].
  Duration? get remaining => _remaining;

  /// The last surah to play under the surah-based timers.
  int? get stopAfterSurah => _stopAfterSurah;

  void set(SleepTimer mode, {required int currentSurah}) {
    _mode = mode;
    _remaining = null;
    _stopAfterSurah = null;
    switch (mode) {
      case SleepOff():
        break;
      case SleepAfter(:final duration):
        _remaining = duration;
      case SleepEndOfSurah():
        _stopAfterSurah = currentSurah;
      case SleepAfterSurahs(:final count):
        _stopAfterSurah = (currentSurah + count - 1).clamp(currentSurah, 114);
    }
  }

  void clear() => set(const SleepOff(), currentSurah: 1);

  /// Counts down [SleepAfter]; call with the time that played since last call.
  void elapse(Duration played) {
    final r = _remaining;
    if (r != null) _remaining = r - played < Duration.zero ? Duration.zero : r - played;
  }

  bool get timeIsUp => _remaining == Duration.zero;

  /// 1.0 normally, easing to 0 over the last [fade] before the stop.
  ///
  /// For the surah timers the stop is the end of the target surah's last ayah,
  /// so pass that item's time left while it plays ([lastItemRemaining]).
  double volumeFactor({Duration? lastItemRemaining}) {
    final left = switch (_mode) {
      SleepAfter() => _remaining,
      SleepEndOfSurah() || SleepAfterSurahs() => lastItemRemaining,
      SleepOff() => null,
    };
    if (left == null) return 1;
    final f = left.inMilliseconds / fade.inMilliseconds;
    return f >= 1 ? 1 : (f <= 0 ? 0 : f);
  }
}

/// Maps the "quiet room" slider (0..1) to a gain applied on top of the system
/// volume: 1 is normal, 0 is -40 dB, far below the phone's lowest step.
double gainForLevel(double level) => math.pow(10, (level.clamp(0.0, 1.0) - 1) * 2).toDouble();
