import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/prayer/prayer_calc.dart';

String hm(DateTime utc, double offset) {
  final l = utc.add(Duration(minutes: (offset * 60).round()));
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

void main() {
  test('Beirut, Jafari, sample day prints', () {
    final d = computePrayerDay(date: DateTime(2026, 6, 21), lat: 33.8938, lng: 35.5018, params: CalcParams.of(CalcMethod.jafari));
    for (final p in Prayer.values) {
      // ignore: avoid_print
      print('${p.name} ${hm(d[p], 3)}');
    }
    // ignore: avoid_print
    print('lastThird ${hm(d.lastThird, 3)}');
  });
}
