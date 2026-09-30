import '../../data/models.dart';

/// Where the recitation is: the ayah, and the word when timing allows.
class FollowPosition {
  const FollowPosition(this.ayah, this.word);

  final int ayah;

  /// The word being recited, or null for whole-ayah highlight (no word timing
  /// for this ayah, or before the first word starts).
  final int? word;

  @override
  bool operator ==(Object other) => other is FollowPosition && other.ayah == ayah && other.word == word;

  @override
  int get hashCode => Object.hash(ayah, word);

  @override
  String toString() => '$ayah:${word ?? '-'}';
}

/// Maps "which file, how far in" to the word being recited.
///
/// Timings are relative to each ayah's own file, so there is nothing to
/// accumulate and nothing to drift: the answer depends only on the current
/// position. Words are found by binary search (BLUEPRINT §4). Between two
/// words the one just recited stays lit, so the highlight never flickers off
/// mid-ayah. Word positions are never interpolated from ayah durations.
class FollowTracker {
  FollowTracker(Map<int, List<Segment>> timings)
      : _words = {
          for (final e in timings.entries)
            e.key: (e.value.where((s) => s.position >= 1).toList()..sort((a, b) => a.startMs - b.startMs)),
        };

  final Map<int, List<Segment>> _words;

  bool hasWordTiming(int ayah) => _words[ayah]?.isNotEmpty ?? false;

  FollowPosition locate(int ayah, Duration position) {
    final segs = _words[ayah];
    if (segs == null || segs.isEmpty) return FollowPosition(ayah, null);
    final t = position.inMilliseconds;
    // Last segment starting at or before t.
    var lo = 0, hi = segs.length - 1, found = -1;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      if (segs[mid].startMs <= t) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return FollowPosition(ayah, found < 0 ? null : segs[found].position);
  }
}
