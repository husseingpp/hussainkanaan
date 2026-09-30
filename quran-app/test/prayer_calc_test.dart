import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/calendar/calendar_model.dart';
import 'package:quran_app/features/calendar/calendar_providers.dart';
import 'package:quran_app/features/calendar/dates.dart';
import 'package:quran_app/features/prayer/cities.dart';
import 'package:quran_app/features/prayer/prayer_alerts.dart';
import 'package:quran_app/features/prayer/prayer_calc.dart';
import 'package:quran_app/features/prayer/prayer_settings.dart';
import 'package:quran_app/features/prayer/zones.dart';
import 'package:quran_app/features/qibla/qibla_math.dart';

PrayerDay _day(DateTime date, double lat, double lng, [CalcParams? p]) =>
    computePrayerDay(date: date, lat: lat, lng: lng, params: p ?? CalcParams.of(CalcMethod.jafari));

String _hm(DateTime utc, String zoneName) {
  final t = inZone(utc, zoneName);
  return '${two(t.hour)}:${two(t.minute)}';
}

void main() {
  group('prayer times', () {
    test('Beirut at the June solstice: the order and Jafari rules hold', () {
      final d = _day(DateTime(2026, 6, 21), 33.8938, 35.5018);
      final order = [Prayer.fajr, Prayer.sunrise, Prayer.dhuhr, Prayer.asr, Prayer.sunset, Prayer.maghrib, Prayer.isha];
      for (var i = 1; i < order.length; i++) {
        expect(d[order[i]].isAfter(d[order[i - 1]]), isTrue, reason: '${order[i]} after ${order[i - 1]}');
      }
      // Sunrise and sunset in Beirut that day are about 05:27 and 19:52 (UTC+3).
      expect(_hm(d[Prayer.sunrise], 'Asia/Beirut'), '05:27');
      expect(_hm(d[Prayer.sunset], 'Asia/Beirut'), '19:52');
      // Maghrib is after the redness passes, not at sunset.
      expect(d[Prayer.maghrib].difference(d[Prayer.sunset]).inMinutes, inInclusiveRange(12, 25));
      // Shar'i midnight is halfway from sunset to Fajr, the last third before Fajr.
      expect(d[Prayer.midnight].isAfter(d[Prayer.isha]), isTrue);
      expect(d.lastThird.isAfter(d[Prayer.midnight]), isTrue);
    });

    test('Asr is when the shadow equals its noon length plus the object (brute force)', () {
      for (final (lat, lng, date) in [(59.9139, 10.7522, DateTime(2026, 9, 23)), (33.8938, 35.5018, DateTime(2026, 9, 23))]) {
        final d = _day(date, lat, lng);
        double cot(double deg) => 1 / math.tan(deg * math.pi / 180);
        final target = 1 + cot(sunPosition(d[Prayer.dhuhr], lat, lng).altitude);
        var t = d[Prayer.dhuhr];
        while (cot(sunPosition(t, lat, lng).altitude) < target) {
          t = t.add(const Duration(seconds: 5));
        }
        expect(t.difference(d[Prayer.asr]).inSeconds.abs(), lessThan(40));
      }
    });

    test('a Sunni method puts Maghrib at sunset; Hanafi Asr is later', () {
      final mwl = _day(DateTime(2026, 3, 20), 30.0444, 31.2357, CalcParams.of(CalcMethod.byId('mwl')));
      expect(mwl[Prayer.maghrib], mwl[Prayer.sunset]);
      final hanafi =
          _day(DateTime(2026, 3, 20), 30.0444, 31.2357, CalcParams.of(CalcMethod.byId('mwl'), asrFactor: 2));
      expect(hanafi[Prayer.asr].isAfter(mwl[Prayer.asr]), isTrue);
    });

    test('Umm al-Qura: Isha is 90 minutes after Maghrib', () {
      final d = _day(DateTime(2026, 3, 20), 21.4225, 39.8262, CalcParams.of(CalcMethod.byId('makkah')));
      expect(d[Prayer.isha].difference(d[Prayer.maghrib]).inMinutes, 90);
    });

    test('high latitude summer: Fajr and Isha still resolve inside the night', () {
      for (final rule in HighLatitudeRule.values) {
        final d = _day(DateTime(2026, 6, 21), 59.9139, 10.7522, CalcParams.of(CalcMethod.jafari, highLatitude: rule));
        expect(d[Prayer.fajr].isBefore(d[Prayer.sunrise]), isTrue, reason: '$rule');
        // Oslo is UTC+2 in summer: a real zone, not a UTC fallback.
        expect(_hm(d[Prayer.dhuhr], 'Europe/Oslo').startsWith('13:'), isTrue, reason: '$rule');
        expect(d[Prayer.isha].isBefore(d[Prayer.maghrib]), isFalse, reason: '$rule');
      }
    });

    test('every listed city has a real time zone (links included)', () {
      for (final c in cities) {
        expect(zone(c.timezone).name, c.timezone, reason: c.nameEn);
      }
    });

    test('manual offsets move one prayer only', () {
      final base = _day(DateTime(2026, 9, 30), 32.0, 44.335);
      final moved = _day(DateTime(2026, 9, 30), 32.0, 44.335, CalcParams.of(CalcMethod.jafari, offsets: {Prayer.dhuhr: 3}));
      expect(moved[Prayer.dhuhr].difference(base[Prayer.dhuhr]).inMinutes, 3);
      expect(moved[Prayer.asr], base[Prayer.asr]);
    });

    test('a place east of UTC gets its own civil day (Sydney)', () {
      final d = _day(DateTime(2026, 12, 21), -33.8688, 151.2093);
      expect(inZone(d[Prayer.dhuhr], 'Australia/Sydney').day, 21);
      expect(_hm(d[Prayer.dhuhr], 'Australia/Sydney').startsWith('12:'), isTrue);
    });

    test('settings round-trip through the calc_settings row', () {
      const s = PrayerSettings(
        methodId: 'tehran',
        maghribRule: 'minutes:15',
        asrFactor: 2,
        highLatitude: HighLatitudeRule.oneSeventh,
        offsets: {Prayer.fajr: -2},
        hijriOffset: 1,
      );
      final back = PrayerSettings.fromRow(s.toRow(0));
      expect(back.methodId, 'tehran');
      expect(back.maghribRule, 'minutes:15');
      expect(back.asrFactor, 2);
      expect(back.highLatitude, HighLatitudeRule.oneSeventh);
      expect(back.offsets, {Prayer.fajr: -2});
      expect(back.hijriOffset, 1);
      expect(const PrayerSettings().withMethod(CalcMethod.byId('mwl')).maghribRule, 'minutes:0');
    });

    test('alerts: only future, enabled prayers, with pre-alerts', () {
      final now = DateTime.utc(2026, 9, 30, 12);
      final specs = planPrayerAlerts(
        alerts: const PrayerAlerts(enabled: {Prayer.fajr, Prayer.maghrib}, preAlertMinutes: 10),
        location: const SavedLocation(id: 1, label: 'بيروت', lat: 33.89, lng: 35.5, timezone: 'Asia/Beirut'),
        settings: const PrayerSettings(),
        now: now,
      );
      expect(specs.every((s) => s.at.isAfter(now)), isTrue);
      expect(specs.where((s) => s.title.contains('حان')).length, 2 * prayerAlertDays - 1, reason: "today's Fajr is past");
      expect(specs.map((s) => s.id).toSet().length, specs.length);
    });
  });

  group('qibla', () {
    test('bearings match published values', () {
      expect(qiblaBearing(51.5074, -0.1278), closeTo(118.99, 0.5)); // London
      expect(qiblaBearing(40.7128, -74.0060), closeTo(58.48, 0.5)); // New York
      expect(qiblaBearing(-6.2088, 106.8456), closeTo(295.15, 0.5)); // Jakarta
      expect(qiblaBearing(35.6892, 51.3890), closeTo(218.0, 1.5)); // Tehran
    });

    test('declination from WMM-2025 is the right sign and size', () {
      expect(magneticDeclination(40.7128, -74.0060, DateTime(2026)), closeTo(-12.8, 1.5)); // New York: west
      expect(magneticDeclination(33.8938, 35.5018, DateTime(2026)), closeTo(5.2, 1.5)); // Beirut: east
    });

    test('compass accuracy gates the needle', () {
      expect(compassQuality(15), CompassQuality.good);
      expect(compassQuality(45), CompassQuality.unreliable);
      expect(compassQuality(null), CompassQuality.unknown);
    });
  });

  group('calendar', () {
    test('Hijri (Umm al-Qura) and Solar Hijri against known dates', () {
      expect(toHijri(DateTime(2026, 2, 18)), const HijriDate(1447, 9, 1)); // 1 Ramadan
      expect(toHijri(DateTime(2026, 3, 20)), const HijriDate(1447, 10, 1)); // Eid al-Fitr
      expect(toHijri(DateTime(2026, 6, 16)), const HijriDate(1448, 1, 1)); // 1 Muharram
      expect(toHijri(DateTime(2026, 6, 16), offset: -1), const HijriDate(1447, 12, 29));
      expect(fromHijri(const HijriDate(1448, 1, 10)), DateTime.utc(2026, 6, 25)); // Ashura
      expect(toSolarHijri(DateTime(2026, 3, 21)), (1405, 1, 1)); // Nowruz
      expect(toSolarHijri(DateTime(2026, 3, 20)), (1404, 12, 29));
    });

    CalendarPack pack() => const CalendarPack(version: 't', reviewed: false, events: [
          CalendarEvent(
            slug: 'muharram',
            nameAr: 'أيام عاشوراء',
            nameEn: '',
            category: EventCategory.mourning,
            importance: 3,
            dates: [EventDate(month: 1, day: 1, spanDays: 10, primary: true)],
          ),
          CalendarEvent(
            slug: 'fatima',
            nameAr: 'شهادة الزهراء',
            nameEn: '',
            category: EventCategory.martyrdom,
            importance: 3,
            dates: [
              EventDate(month: 6, day: 3, variant: 'أ', primary: true),
              EventDate(month: 5, day: 13, variant: 'ب'),
            ],
          ),
        ]);

    test('periods know which day they are on; every date variant shows', () {
      final ashura = pack().on(DateTime(2026, 6, 25));
      expect(ashura.single.dayOfSpan, 10);
      final variants = [
        for (final g in [fromHijri(const HijriDate(1447, 6, 3)), fromHijri(const HijriDate(1447, 5, 13))])
          ...pack().on(g).map((o) => o.date.variant),
      ];
      expect(variants, ['أ', 'ب']);
    });

    test('event alerts: ahead of time, first day of periods only', () {
      final specs = planEventAlertsFrom(
        pack: pack(),
        settings: const CalendarSettings(alerts: true, daysAhead: 1),
        hijriOffset: 0,
        now: DateTime(2026, 6, 1),
      );
      expect(specs.length, 1);
      expect(specs.single.at, DateTime(2026, 6, 15, 20));
      expect(specs.single.title, contains('غدًا'));
    });
  });
}
