import '../../data/models.dart';
import 'dates.dart';

enum EventCategory {
  mourning('حزن'),
  birth('ولادة'),
  martyrdom('شهادة'),
  eid('عيد'),
  blessedNight('ليلة مباركة'),
  fast('صيام'),
  other('مناسبة');

  const EventCategory(this.labelAr);
  final String labelAr;

  static EventCategory parse(String s) => switch (s) {
        'blessed_night' => blessedNight,
        _ => values.firstWhere((c) => c.name == s, orElse: () => other),
      };
}

/// One of an event's dates. Several narrations can give different days; a
/// period (Muharram 1–10) spans several days.
class EventDate {
  const EventDate({required this.month, required this.day, this.spanDays = 1, this.variant, this.primary = false});

  final int month;
  final int day;
  final int spanDays;
  final String? variant;
  final bool primary;
}

/// A range of ayat an a'maal recommends: opens the reader or builds a
/// Listen Mode queue.
class AmaalAyahs {
  const AmaalAyahs({required this.surah, required this.from, required this.to});

  final int surah;
  final int from;
  final int to;

  AyahRef get start => AyahRef(surah, from);
}

class Amaal {
  const Amaal({required this.kind, required this.titleAr, this.bodyAr, required this.sourceNote, this.ayahs = const []});

  final String kind;
  final String titleAr;
  final String? bodyAr;
  final String sourceNote;
  final List<AmaalAyahs> ayahs;
}

class CalendarEvent {
  const CalendarEvent({
    required this.slug,
    required this.nameAr,
    required this.nameEn,
    required this.category,
    required this.importance,
    this.significance,
    this.sightingDependent = false,
    required this.dates,
    this.amaal = const [],
  });

  final String slug;
  final String nameAr;
  final String nameEn;
  final EventCategory category;

  /// 1..3; 3 is the most significant.
  final int importance;
  final String? significance;

  /// Ramadan, the Eids: shown "subject to local sighting".
  final bool sightingDependent;
  final List<EventDate> dates;
  final List<Amaal> amaal;
}

/// An event on a particular day (which of its dates, and which day of a
/// period).
class Occurrence {
  const Occurrence({required this.event, required this.date, required this.gregorian, required this.dayOfSpan});

  final CalendarEvent event;
  final EventDate date;
  final DateTime gregorian;

  /// 1-based day within a period; 1 for single days.
  final int dayOfSpan;

  bool get isPeriod => date.spanDays > 1;
}

/// The calendar pack's own metadata.
class CalendarPack {
  const CalendarPack({required this.version, required this.reviewed, required this.events});

  final String? version;

  /// False until a qualified reviewer signs the dataset off (BLUEPRINT §9).
  final bool reviewed;
  final List<CalendarEvent> events;

  bool get isEmpty => events.isEmpty;

  /// Every event falling on [day] (a Gregorian date), given the Hijri offset.
  List<Occurrence> on(DateTime day, {int hijriOffset = 0}) {
    final out = <Occurrence>[];
    final g = DateTime.utc(day.year, day.month, day.day);
    for (final e in events) {
      for (final d in e.dates) {
        // Periods may have started up to spanDays-1 days earlier.
        for (var back = 0; back < d.spanDays; back++) {
          final h = toHijri(g.subtract(Duration(days: back)), offset: hijriOffset);
          if (h.month == d.month && h.day == d.day) {
            out.add(Occurrence(event: e, date: d, gregorian: g, dayOfSpan: back + 1));
            break;
          }
        }
      }
    }
    out.sort((a, b) => b.event.importance.compareTo(a.event.importance));
    return out;
  }

  /// The occurrences from [from] for [days] days, first days of periods only
  /// (so Muharram 1–10 is listed once, on its first day, plus today if
  /// inside it).
  List<Occurrence> upcoming(DateTime from, {int days = 60, int hijriOffset = 0}) {
    final out = <Occurrence>[];
    for (var i = 0; i < days; i++) {
      final day = DateTime.utc(from.year, from.month, from.day + i);
      for (final o in on(day, hijriOffset: hijriOffset)) {
        if (o.dayOfSpan == 1 || i == 0) out.add(o);
      }
    }
    return out;
  }
}
