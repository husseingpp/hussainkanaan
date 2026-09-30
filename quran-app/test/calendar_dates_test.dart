import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/features/calendar/dates.dart';

void main() {
  test('probe', () {
    for (final d in [DateTime(2026, 2, 18), DateTime(2026, 6, 16), DateTime(2026, 3, 20), DateTime(2026, 3, 21), DateTime(2025, 3, 21), DateTime(2026, 9, 30)]) {
      // ignore: avoid_print
      print('$d ${toHijri(d)} ${toSolarHijri(d)}');
    }
    // ignore: avoid_print
    print(fromHijri(const HijriDate(1448, 1, 10)));
  });
}
