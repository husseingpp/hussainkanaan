import 'package:hijri/hijri_calendar.dart';

import '../../core/arabic_digits.dart';

/// A Hijri (lunar) date.
class HijriDate {
  const HijriDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  @override
  bool operator ==(Object other) => other is HijriDate && other.year == year && other.month == month && other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() => '$year-$month-$day';
}

const hijriMonthsAr = [
  'محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', //
  'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة',
];

const gregorianMonthsAr = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', //
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

const solarMonthsAr = [
  'فروردين', 'أرديبهشت', 'خرداد', 'تير', 'مرداد', 'شهريور', //
  'مهر', 'آبان', 'آذر', 'دي', 'بهمن', 'إسفند',
];

const weekdaysAr = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

DateTime _date(DateTime d) => DateTime.utc(d.year, d.month, d.day);

/// Computed Hijri date (Umm al-Qura tables), shifted by the user's offset.
///
/// A computed date can differ from the sighted one by a day either way, and
/// Shia practice follows sighting, so [offset] (−2…+2) is a first-class
/// setting and obligatory dates always carry a sighting note (BLUEPRINT §9).
HijriDate toHijri(DateTime gregorian, {int offset = 0}) {
  final d = _date(gregorian).add(Duration(days: offset));
  final h = HijriCalendar.fromDate(d);
  return HijriDate(h.hYear, h.hMonth, h.hDay);
}

/// The Gregorian day that is [h] (with the same [offset] as [toHijri]).
DateTime fromHijri(HijriDate h, {int offset = 0}) {
  final g = HijriCalendar().hijriToGregorian(h.year, h.month, h.day);
  return _date(g).subtract(Duration(days: offset));
}

/// Days in a Hijri month (29 or 30).
int hijriMonthLength(int year, int month) => HijriCalendar().getDaysInMonth(year, month);

String hijriLabel(HijriDate h) => '${arabicDigits(h.day)} ${hijriMonthsAr[h.month - 1]} ${arabicDigits(h.year)} هـ';

String gregorianLabel(DateTime d) => '${arabicDigits(d.day)} ${gregorianMonthsAr[d.month - 1]} ${arabicDigits(d.year)}';

// ------------------------------------------------------------ Solar Hijri
// The Borkowski / jalaali algorithm: exact for 1 to 3177 SH.

const _breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

int _mod(int a, int b) => a - (a ~/ b) * b;

({int leap, int gy, int march}) _jalCal(int jy) {
  final gy = jy + 621;
  var leapJ = -14;
  var jp = _breaks[0];
  var jump = 0;
  for (var i = 1; i < _breaks.length; i++) {
    final jm = _breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += (jump ~/ 33) * 8 + _mod(jump, 33) ~/ 4;
    jp = jm;
  }
  var n = jy - jp;
  leapJ += (n ~/ 33) * 8 + (_mod(n, 33) + 3) ~/ 4;
  if (_mod(jump, 33) == 4 && jump - n == 4) leapJ += 1;
  final leapG = gy ~/ 4 - ((gy ~/ 100 + 1) * 3) ~/ 4 - 150;
  final march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + ((jump + 4) ~/ 33) * 33;
  var leap = _mod(_mod(n + 1, 33) - 1, 4);
  if (leap == -1) leap = 4;
  return (leap: leap, gy: gy, march: march);
}

int _g2d(int gy, int gm, int gd) {
  var d = ((gy + (gm - 8) ~/ 6 + 100100) * 1461) ~/ 4 + (153 * _mod(gm + 9, 12) + 2) ~/ 5 + gd - 34840408;
  d = d - (((gy + 100100 + (gm - 8) ~/ 6) ~/ 100) * 3) ~/ 4 + 752;
  return d;
}

({int gy, int gm, int gd}) _d2g(int jdn) {
  var j = 4 * jdn + 139361631;
  j = j + (((4 * jdn + 183187720) ~/ 146097) * 3) ~/ 4 * 4 - 3908;
  final i = (_mod(j, 1461) ~/ 4) * 5 + 308;
  final gd = _mod(i, 153) ~/ 5 + 1;
  final gm = _mod(i ~/ 153, 12) + 1;
  final gy = j ~/ 1461 - 100100 + (8 - gm) ~/ 6;
  return (gy: gy, gm: gm, gd: gd);
}

/// Solar Hijri (Iranian) date: (year, month, day).
(int, int, int) toSolarHijri(DateTime g) {
  final jdn = _g2d(g.year, g.month, g.day);
  final gy = _d2g(jdn).gy;
  var jy = gy - 621;
  final r = _jalCal(jy);
  final jdn1f = _g2d(gy, 3, r.march);
  var k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return (jy, 1 + k ~/ 31, _mod(k, 31) + 1);
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap == 1) k += 1;
  }
  return (jy, 7 + k ~/ 30, _mod(k, 30) + 1);
}

String solarHijriLabel(DateTime g) {
  final (y, m, d) = toSolarHijri(g);
  return '${arabicDigits(d)} ${solarMonthsAr[m - 1]} ${arabicDigits(y)} هـ.ش';
}
