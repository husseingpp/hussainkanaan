import '../../core/arabic_digits.dart';
import '../khatmah/reminders.dart';
import 'prayer_calc.dart';
import 'prayer_settings.dart';
import 'zones.dart';

const prayerAlertBase = 3000;

/// Days of prayer notifications kept scheduled. Each day's times differ, so
/// they are scheduled one by one and the window slides forward whenever the
/// app opens (iOS keeps at most 64 pending notifications in total).
const prayerAlertDays = 4;

/// The prayer notifications for the selected place from [now] on.
List<ReminderSpec> planPrayerAlerts({
  required PrayerAlerts alerts,
  required SavedLocation? location,
  required PrayerSettings settings,
  required DateTime now,
}) {
  final loc = location;
  if (loc == null || alerts.enabled.isEmpty) return const [];
  final specs = <ReminderSpec>[];
  final first = dateIn(loc.timezone, now);
  for (var d = 0; d < prayerAlertDays; d++) {
    final date = DateTime(first.year, first.month, first.day + d);
    final day = computePrayerDay(date: date, lat: loc.lat, lng: loc.lng, params: settings.params);
    for (final (i, p) in Prayer.obligatory.indexed) {
      if (!alerts.enabled.contains(p)) continue;
      final at = day[p];
      final id = prayerAlertBase + d * 20 + i * 2;
      if (at.isAfter(now)) {
        specs.add(ReminderSpec(
          id: id,
          at: at,
          title: 'حان وقت صلاة ${p.nameAr}',
          body: '${loc.label} · ${clockLabel(at, loc.timezone, roundUp: true)}',
          kind: alerts.silent ? ReminderKind.prayerSilent : ReminderKind.prayer,
        ));
      }
      final pre = at.subtract(Duration(minutes: alerts.preAlertMinutes));
      if (alerts.preAlertMinutes > 0 && pre.isAfter(now)) {
        specs.add(ReminderSpec(
          id: id + 1,
          at: pre,
          title: 'صلاة ${p.nameAr} بعد ${arabicDigits(alerts.preAlertMinutes)} دقيقة',
          body: '${loc.label} · ${clockLabel(at, loc.timezone, roundUp: true)}',
          kind: ReminderKind.prayerSilent,
        ));
      }
    }
  }
  return specs;
}
