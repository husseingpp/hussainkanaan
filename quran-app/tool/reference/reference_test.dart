// Phase 6 gates against an independent reference (fetched in CI by
// fetch_reference.py): prayer times within one minute, Hijri dates exact.
//
//   python3 tool/reference/fetch_reference.py build/reference.json
//   flutter test tool/reference/reference_test.dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/calendar/dates.dart';
import 'package:quran_app/features/prayer/prayer_calc.dart';
import 'package:quran_app/features/prayer/zones.dart';

const _names = {
  'Fajr': Prayer.fajr,
  'Sunrise': Prayer.sunrise,
  'Dhuhr': Prayer.dhuhr,
  'Asr': Prayer.asr,
  'Sunset': Prayer.sunset,
  'Maghrib': Prayer.maghrib,
  'Isha': Prayer.isha,
  'Midnight': Prayer.midnight,
};

int _minutes(String hhmm) {
  final m = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(hhmm)!;
  return int.parse(m[1]!) * 60 + int.parse(m[2]!);
}

void main() {
  final file = File('build/reference.json');
  final skip = file.existsSync() ? null : 'run tool/reference/fetch_reference.py first';
  final ref = file.existsSync() ? jsonDecode(file.readAsStringSync()) as Map<String, dynamic> : const <String, dynamic>{};

  test('prayer times match the reference within one minute', () {
    final misses = <String>[];
    var checked = 0;
    for (final row in (ref['prayers'] as List? ?? const []).cast<Map<String, dynamic>>()) {
      final date = DateTime.parse(row['date'] as String);
      final day = computePrayerDay(
        date: date,
        lat: (row['lat'] as num).toDouble(),
        lng: (row['lng'] as num).toDouble(),
        params: CalcParams.of(CalcMethod.byId(row['method'] as String)),
      );
      final timings = (row['timings'] as Map).cast<String, String>();
      for (final e in _names.entries) {
        final theirs = timings[e.key];
        if (theirs == null) continue;
        final t = inZone(day[e.value], row['tz'] as String);
        var diff = (t.hour * 60 + t.minute - _minutes(theirs)).abs();
        if (diff > 720) diff = 1440 - diff;
        checked++;
        if (diff > 1) misses.add('${row['city']} ${row['date']} ${row['method']} ${e.key}: ours ${two(t.hour)}:${two(t.minute)}, ref $theirs');
      }
    }
    // ignore: avoid_print
    print('checked $checked prayer times; ${misses.length} off by more than a minute');
    for (final m in misses) {
      // ignore: avoid_print
      print('  $m');
    }
    expect(misses, isEmpty);
  }, skip: skip);

  test('Hijri dates match Umm al-Qura for this year and the next two', () {
    final misses = <String>[];
    for (final row in (ref['hijri'] as List? ?? const []).cast<Map<String, dynamic>>()) {
      final g = DateTime.parse(row['gregorian'] as String);
      final want = (row['hijri'] as List).cast<int>();
      final got = toHijri(g);
      if (got != HijriDate(want[0], want[1], want[2])) misses.add('${row['gregorian']}: ours $got, ref ${want.join('-')}');
    }
    // ignore: avoid_print
    print('checked ${(ref['hijri'] as List? ?? const []).length} Hijri dates; ${misses.length} differ');
    for (final m in misses) {
      // ignore: avoid_print
      print('  $m');
    }
    expect(misses, isEmpty);
  }, skip: skip);
}
