import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/khatmah/khatmah_plan.dart';
import 'package:quran_app/features/khatmah/reminders.dart';

final _math = KhatmahMath(QuranPages([0, for (var p = 1; p <= 10; p++) ...[p, p, p]]));

Future<DailyAyah> _ayah(DateTime day) async =>
    DailyAyah(surahName: 'الإخلاص', ayahNo: day.day % 4 + 1, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Say, He is Allah');

void main() {
  test('daily ayah: 14 days ahead, starting tomorrow once today\'s time has passed', () async {
    final specs = await planReminders(
      settings: const ReminderSettings(dailyAyah: true, dailyAyahMinutes: 7 * 60),
      khatmahs: const [],
      math: _math,
      now: DateTime(2026, 10, 1, 9),
      ayahFor: _ayah,
    );
    expect(specs, hasLength(dailyAyahWindow));
    expect(specs.first.at, DateTime(2026, 10, 2, 7));
    expect(specs.last.at, DateTime(2026, 10, 15, 7));
    expect(specs.map((s) => s.id).toSet(), hasLength(dailyAyahWindow), reason: 'distinct ids');
    expect(specs.first.title, 'آية اليوم · سورة الإخلاص ٣', reason: 'Oct 2: 2 % 4 + 1');
    expect(specs.first.body, contains('Say, He is Allah'));
    expect(specs.every((s) => !s.daily), isTrue, reason: 'each day has its own text');
  });

  test('before today\'s time, today is included', () async {
    final specs = await planReminders(
      settings: const ReminderSettings(dailyAyah: true, dailyAyahMinutes: 20 * 60),
      khatmahs: const [],
      math: _math,
      now: DateTime(2026, 10, 1, 9),
      ayahFor: _ayah,
    );
    expect(specs.first.at, DateTime(2026, 10, 1, 20));
  });

  test('khatmah reminders: daily, with today\'s amount; none for finished plans or when off', () async {
    final active = Khatmah(uuid: 'a', name: 'رمضان', kind: PlanKind.dailyPages, start: DateTime(2026, 10, 1),
        dailyPages: 2, reminderMinutes: 21 * 60 + 30);
    final done = Khatmah(uuid: 'b', name: 'b', kind: PlanKind.dailyPages, start: DateTime(2026, 9, 1), dailyPages: 2,
        reminderMinutes: 600, completedAt: DateTime(2026, 9, 20));
    final silent = Khatmah(uuid: 'c', name: 'c', kind: PlanKind.dailyPages, start: DateTime(2026, 10, 1), dailyPages: 2);
    final specs = await planReminders(
      settings: const ReminderSettings(),
      khatmahs: [active, done, silent],
      math: _math,
      now: DateTime(2026, 10, 1, 9),
      ayahFor: _ayah,
    );
    expect(specs, hasLength(1));
    expect(specs.single.daily, isTrue);
    expect(specs.single.at, DateTime(2026, 10, 1, 21, 30));
    expect(specs.single.title, 'وِرد الختمة · رمضان');
    expect(specs.single.body, startsWith('وِردك اليوم ٢ صفحات'));
  });

  test('the day\'s ayah is the same everywhere and changes daily', () {
    expect(dailyAyahIndex(DateTime(2026, 10, 1), 500), dailyAyahIndex(DateTime(2026, 10, 1, 23), 500));
    expect(dailyAyahIndex(DateTime(2026, 10, 2), 500), isNot(dailyAyahIndex(DateTime(2026, 10, 1), 500)));
  });
}
