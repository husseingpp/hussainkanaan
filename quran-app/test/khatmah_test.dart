import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/khatmah/khatmah_plan.dart';

/// A toy mus'haf: 10 pages of 3 ayahs each (30 ayahs).
final _pages = QuranPages([0, for (var p = 1; p <= 10; p++) ...[p, p, p]]);

Khatmah _daily(int pages, {int progress = 0}) => Khatmah(
      uuid: 'k', name: 'n', kind: PlanKind.dailyPages, start: DateTime(2026, 10, 1), dailyPages: pages, progress: progress);

Khatmah _range(DateTime start, DateTime end, {int progress = 0}) =>
    Khatmah(uuid: 'k', name: 'n', kind: PlanKind.dateRange, start: start, end: end, progress: progress);

void main() {
  final m = KhatmahMath(_pages);
  final oct1 = DateTime(2026, 10, 1);

  test('page arithmetic: an ayah belongs to the page it starts on', () {
    expect(_pages.pageCount, 10);
    expect(_pages.lastAyahOf(4), 12);
    expect(_pages.pagesDone(0), 0);
    expect(_pages.pagesDone(11), 3, reason: 'page 4 is only part-read');
    expect(_pages.pagesDone(12), 4);
    expect(_pages.pagesDone(30), 10);
  });

  test('daily-pages plan: today\'s wird starts after what was read', () {
    final w = m.wird(_daily(3, progress: 6), oct1)!;
    expect((w.fromPage, w.toPage, w.toAyah), (3, 5, 15));
    expect(m.estimatedFinish(_daily(3, progress: 6), oct1), DateTime(2026, 10, 3), reason: '8 pages left at 3/day');
  });

  test('the last wird never runs past the end', () {
    final w = m.wird(_daily(4, progress: 24), oct1)!;
    expect((w.fromPage, w.toPage), (9, 10));
    expect(m.wird(_daily(4, progress: 30), oct1), isNull);
  });

  test('date-range plan spreads what is left over the days left', () {
    final k = _range(oct1, DateTime(2026, 10, 5));
    expect(m.dailyTarget(k, oct1), 2, reason: '10 pages / 5 days');
    // Two days in with nothing read: 10 pages over 3 remaining days.
    expect(m.dailyTarget(k, DateTime(2026, 10, 3)), 4);
    expect(m.expectedPages(k, DateTime(2026, 10, 3)), 6);
    // Past the end date: everything left, today.
    expect(m.dailyTarget(k, DateTime(2026, 10, 9)), 10);
  });

  test('the wird stays put while you read it', () {
    final k = _daily(2, progress: 4);
    final before = m.wird(k, oct1, readBeforeToday: 3)!;
    expect((before.fromPage, before.toPage), (2, 3));
  });

  test('streak counts back from today, or from yesterday if today is not read yet', () {
    final days = {'2026-09-28', '2026-09-29', '2026-09-30'};
    expect(streak(days, DateTime(2026, 9, 30)), 3);
    expect(streak(days, DateTime(2026, 10, 1)), 3, reason: 'still alive until the day ends');
    expect(streak(days, DateTime(2026, 10, 2)), 0);
    expect(streak({}, oct1), 0);
  });

  test('day arithmetic ignores daylight-saving shifts', () {
    expect(daysBetween(DateTime(2026, 3, 28), DateTime(2026, 3, 30)), 2);
    expect(daysBetween(DateTime(2026, 10, 24, 23), DateTime(2026, 10, 26, 1)), 2);
    expect(dayKey(DateTime(2026, 1, 5)), '2026-01-05');
  });

  test('fraction and remaining pages', () {
    expect(m.fraction(_daily(1, progress: 15)), 0.5);
    expect(m.remainingPages(_daily(1, progress: 15)), 5, reason: 'ayah 15 closes page 5');
  });
}

