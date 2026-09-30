import 'dart:math' as math;

/// Which page each ayah starts on (by global ayah id), for page arithmetic.
class QuranPages {
  QuranPages(List<int> pageOfAyah) : _page = pageOfAyah {
    for (var id = 1; id < _page.length; id++) {
      _lastAyah[_page[id]] = id;
    }
  }

  /// Index 0 unused; [_page]\[id] is the page of global ayah [id].
  final List<int> _page;
  final _lastAyah = <int, int>{};

  int get ayahCount => _page.length - 1;
  int get pageCount => _lastAyah.length;
  int pageOf(int ayahId) => _page[ayahId.clamp(1, ayahCount)];

  /// Last ayah on [page] (an ayah belongs to the page it starts on).
  int lastAyahOf(int page) => _lastAyah[page.clamp(1, pageCount)]!;

  /// Pages fully read when [progress] ayahs are done.
  int pagesDone(int progress) {
    if (progress <= 0) return 0;
    if (progress >= ayahCount) return pageCount;
    final p = pageOf(progress);
    return lastAyahOf(p) == progress ? p : p - 1;
  }
}

enum PlanKind { dailyPages, dateRange }

/// A khatmah plan and where it stands. Progress is the global id of the last
/// ayah read (0 = not started, 6236 = complete); it only ever moves forward,
/// and merges as the max across devices (BLUEPRINT §5).
class Khatmah {
  const Khatmah({
    required this.uuid,
    required this.name,
    required this.kind,
    required this.start,
    this.dailyPages,
    this.end,
    this.progress = 0,
    this.completedAt,
    this.reminderMinutes,
  });

  final String uuid;
  final String name;
  final PlanKind kind;
  final DateTime start;
  final int? dailyPages;
  final DateTime? end;
  final int progress;
  final DateTime? completedAt;

  /// Daily reminder time, minutes after midnight; null = no reminder.
  final int? reminderMinutes;

  bool get isComplete => completedAt != null;

  Khatmah copyWith({int? progress, DateTime? completedAt, int? reminderMinutes, bool clearReminder = false}) => Khatmah(
        uuid: uuid,
        name: name,
        kind: kind,
        start: start,
        dailyPages: dailyPages,
        end: end,
        progress: progress ?? this.progress,
        completedAt: completedAt ?? this.completedAt,
        reminderMinutes: clearReminder ? null : (reminderMinutes ?? this.reminderMinutes),
      );
}

/// Today's reading: pages [fromPage]..[toPage], ending at ayah [toAyah].
class Wird {
  const Wird({required this.fromPage, required this.toPage, required this.toAyah});

  final int fromPage;
  final int toPage;
  final int toAyah;

  int get pages => toPage - fromPage + 1;
}

DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);
/// Calendar days from [a] to [b], immune to daylight-saving shifts.
int daysBetween(DateTime a, DateTime b) =>
    DateTime.utc(b.year, b.month, b.day).difference(DateTime.utc(a.year, a.month, a.day)).inDays;
String dayKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class KhatmahMath {
  const KhatmahMath(this.pages);

  final QuranPages pages;

  int remainingPages(Khatmah k) => pages.pageCount - pages.pagesDone(k.progress);

  double fraction(Khatmah k) => k.progress / pages.ayahCount;

  /// Pages to read today. A date-range plan spreads what's left over the days
  /// left (today included), so falling behind raises the daily amount rather
  /// than moving the finish date.
  int dailyTarget(Khatmah k, DateTime today) {
    final left = remainingPages(k);
    if (left == 0) return 0;
    switch (k.kind) {
      case PlanKind.dailyPages:
        return math.min(k.dailyPages ?? 1, left);
      case PlanKind.dateRange:
        final days = math.max(1, daysBetween(today, k.end!) + 1);
        return (left / days).ceil();
    }
  }

  /// Today's wird, starting after [readBeforeToday] (progress at the start of
  /// the day) so it stays put while you read it.
  Wird? wird(Khatmah k, DateTime today, {int? readBeforeToday}) {
    final base = readBeforeToday ?? k.progress;
    if (base >= pages.ayahCount) return null;
    final from = pages.pagesDone(base) + 1;
    final target = dailyTarget(k.copyWith(progress: base), today);
    final to = math.min(pages.pageCount, from + target - 1);
    return Wird(fromPage: from, toPage: to, toAyah: pages.lastAyahOf(to));
  }

  /// Where a date-range plan should be by the end of [today].
  int? expectedPages(Khatmah k, DateTime today) {
    if (k.kind != PlanKind.dateRange) return null;
    final total = math.max(1, daysBetween(k.start, k.end!) + 1);
    final elapsed = (daysBetween(k.start, today) + 1).clamp(0, total);
    return (pages.pageCount * elapsed / total).round();
  }

  /// When a daily-pages plan finishes at its pace, reading from today.
  DateTime? estimatedFinish(Khatmah k, DateTime today) {
    if (k.kind != PlanKind.dailyPages) return k.end;
    final left = remainingPages(k);
    if (left == 0) return dateOnly(today);
    final days = (left / (k.dailyPages ?? 1)).ceil();
    return dateOnly(today).add(Duration(days: days - 1));
  }
}

/// Consecutive days read, ending today, or yesterday if today isn't read yet
/// (the streak is still alive until the day ends).
int streak(Set<String> daysRead, DateTime today) {
  var day = dateOnly(today);
  if (!daysRead.contains(dayKey(day))) day = day.subtract(const Duration(days: 1));
  var n = 0;
  while (daysRead.contains(dayKey(day))) {
    n++;
    day = day.subtract(const Duration(days: 1));
  }
  return n;
}
