import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;

import '../../core/arabic_digits.dart';
import '../../data/providers.dart';
import '../khatmah/khatmah_providers.dart';
import '../khatmah/reminders.dart';
import '../prayer/prayer_providers.dart';
import 'calendar_model.dart';
import 'dates.dart';

final calendarPackProvider = FutureProvider<CalendarPack>(
  (ref) async => (await ref.watch(contentDbProvider.future)).calendar(),
);

/// The user's Hijri offset lives with the calculation settings (it's what
/// the local sighting decided), so prayer and calendar agree.
final hijriOffsetProvider = Provider<int>((ref) => ref.watch(prayerSettingsProvider).value?.hijriOffset ?? 0);

class CalendarSettings {
  const CalendarSettings({this.alerts = false, this.daysAhead = 1, this.alertMinutes = 20 * 60, this.mourningTheme = false});

  factory CalendarSettings.fromJson(Map<String, Object?> j) => CalendarSettings(
        alerts: j['alerts'] as bool? ?? false,
        daysAhead: (j['daysAhead'] as num?)?.toInt() ?? 1,
        alertMinutes: (j['alertMinutes'] as num?)?.toInt() ?? 20 * 60,
        mourningTheme: j['mourningTheme'] as bool? ?? false,
      );

  /// Advance notice before significant events.
  final bool alerts;

  /// How many days before (0 = on the day).
  final int daysAhead;

  /// Time of day for the notice, minutes after midnight.
  final int alertMinutes;

  /// Opt-in muted palette in Muharram, Safar and the Fatimiyya days.
  final bool mourningTheme;

  CalendarSettings copyWith({bool? alerts, int? daysAhead, int? alertMinutes, bool? mourningTheme}) => CalendarSettings(
        alerts: alerts ?? this.alerts,
        daysAhead: daysAhead ?? this.daysAhead,
        alertMinutes: alertMinutes ?? this.alertMinutes,
        mourningTheme: mourningTheme ?? this.mourningTheme,
      );

  String toJson() => jsonEncode({
        'alerts': alerts,
        'daysAhead': daysAhead,
        'alertMinutes': alertMinutes,
        'mourningTheme': mourningTheme,
      });
}

class CalendarSettingsNotifier extends AsyncNotifier<CalendarSettings> {
  static const key = 'calendar';

  @override
  Future<CalendarSettings> build() async {
    final raw = await (await ref.watch(userRepositoryProvider.future)).preference(key);
    if (raw == null) return const CalendarSettings();
    try {
      return CalendarSettings.fromJson(jsonDecode(raw) as Map<String, Object?>);
    } on FormatException {
      return const CalendarSettings();
    }
  }

  Future<void> change(CalendarSettings Function(CalendarSettings) edit) async {
    final next = edit(state.value ?? const CalendarSettings());
    state = AsyncData(next);
    await (await ref.read(userRepositoryProvider.future)).setPreference(key, next.toJson());
    await syncReminders(ref.read);
  }
}

final calendarSettingsProvider =
    AsyncNotifierProvider<CalendarSettingsNotifier, CalendarSettings>(CalendarSettingsNotifier.new);

/// Muharram, Safar, and the Fatimiyya days (13 Jumada al-Ula – 3 Jumada al-Akhira).
bool isMourningSeason(HijriDate h) =>
    h.month == 1 || h.month == 2 || (h.month == 5 && h.day >= 13) || (h.month == 6 && h.day <= 3);

/// Whether the muted palette applies today.
final mourningThemeProvider = Provider<bool>((ref) {
  if (!(ref.watch(calendarSettingsProvider).value?.mourningTheme ?? false)) return false;
  return isMourningSeason(toHijri(DateTime.now(), offset: ref.watch(hijriOffsetProvider)));
});

const eventAlertBase = 4000;
const eventAlertMax = 40;

/// Advance notices for significant events (importance 2+) in the next 60 days.
List<ReminderSpec> planEventAlertsFrom({
  required CalendarPack pack,
  required CalendarSettings settings,
  required int hijriOffset,
  required DateTime now,
}) {
  if (!settings.alerts || pack.isEmpty) return const [];
  final specs = <ReminderSpec>[];
  final from = DateTime(now.year, now.month, now.day);
  for (final o in pack.upcoming(from, days: 60 + settings.daysAhead, hijriOffset: hijriOffset)) {
    if (o.event.importance < 2 || o.dayOfSpan != 1) continue;
    final day = DateTime(o.gregorian.year, o.gregorian.month, o.gregorian.day - settings.daysAhead);
    final at = DateTime(day.year, day.month, day.day, settings.alertMinutes ~/ 60, settings.alertMinutes % 60);
    if (!at.isAfter(now)) continue;
    final when = switch (settings.daysAhead) {
      0 => 'اليوم',
      1 => 'غدًا',
      2 => 'بعد غد',
      final n => 'بعد ${arabicDigits(n)} أيام',
    };
    final h = toHijri(o.gregorian, offset: hijriOffset);
    specs.add(ReminderSpec(
      id: eventAlertBase + specs.length,
      at: at,
      title: '$when: ${o.event.nameAr}',
      body: [
        hijriLabel(h),
        if (o.event.sightingDependent) 'التاريخ تابع لرؤية الهلال ورأي مرجع التقليد.',
      ].join('\n'),
      kind: ReminderKind.event,
    ));
    if (specs.length >= eventAlertMax) break;
  }
  return specs;
}

Future<List<ReminderSpec>> planEventAlerts(T Function<T>(ProviderListenable<T>) read) async => planEventAlertsFrom(
      pack: await read(calendarPackProvider.future),
      settings: await read(calendarSettingsProvider.future),
      hijriOffset: (await read(prayerSettingsProvider.future)).hijriOffset,
      now: DateTime.now(),
    );
