import 'dart:math' as math;

/// Prayer times computed offline from latitude and longitude (BLUEPRINT §7).
///
/// The standard solar-position method: the sun's declination and the
/// equation of time for the day, then the moment the sun reaches each
/// prayer's angle. Times are refined twice from rough guesses, which is
/// enough for sub-minute accuracy. Everything is pure and testable; the
/// caller supplies the UTC offset for the date.

double _rad(double d) => d * math.pi / 180;
double _deg(double r) => r * 180 / math.pi;
double _fix(double a, double b) {
  final r = a - b * (a / b).floor();
  return r < 0 ? r + b : r;
}

double _sin(double d) => math.sin(_rad(d));
double _cos(double d) => math.cos(_rad(d));
double _tan(double d) => math.tan(_rad(d));
double _asin(double x) => _deg(math.asin(x));
double _acos(double x) => _deg(math.acos(x));
double _atan2(double y, double x) => _deg(math.atan2(y, x));
double _acot(double x) => _deg(math.atan(1 / x));

/// How Maghrib is placed: a solar depression angle (Shia practice: after the
/// redness in the east passes) or a fixed delay after sunset.
sealed class MaghribRule {
  const MaghribRule();

  factory MaghribRule.parse(String s) {
    final [kind, value] = s.split(':');
    final v = double.parse(value);
    return kind == 'minutes' ? MaghribMinutes(v.round()) : MaghribAngle(v);
  }

  String encode();
}

class MaghribAngle extends MaghribRule {
  const MaghribAngle(this.degrees);
  final double degrees;
  @override
  String encode() => 'angle:$degrees';
}

class MaghribMinutes extends MaghribRule {
  const MaghribMinutes(this.minutes);
  final int minutes;
  @override
  String encode() => 'minutes:$minutes';
}

/// Isha: an angle, or a fixed delay after Maghrib (Umm al-Qura).
sealed class IshaRule {
  const IshaRule();
}

class IshaAngle extends IshaRule {
  const IshaAngle(this.degrees);
  final double degrees;
}

class IshaMinutes extends IshaRule {
  const IshaMinutes(this.minutes);
  final int minutes;
}

/// Where Fajr and Isha go when the sun never gets low enough (summer at high
/// latitudes): a share of the night, measured from sunset to sunrise.
enum HighLatitudeRule { angleBased, oneSeventh, middleOfNight }

/// Shar'i midnight: halfway from sunset to Fajr (Jafari), or from sunset to
/// sunrise (most Sunni methods).
enum MidnightRule { jafari, standard }

class CalcMethod {
  const CalcMethod({
    required this.id,
    required this.nameAr,
    required this.fajr,
    required this.isha,
    required this.maghrib,
    required this.midnight,
    this.shia = false,
  });

  final String id;
  final String nameAr;
  final double fajr;
  final IshaRule isha;
  final MaghribRule maghrib;
  final MidnightRule midnight;

  /// Presents Dhuhr–Asr and Maghrib–Isha as combined windows.
  final bool shia;

  static const jafari = CalcMethod(
    id: 'jafari',
    nameAr: 'الجعفري (مؤسسة ليفا، قم)',
    fajr: 16,
    isha: IshaAngle(14),
    maghrib: MaghribAngle(4),
    midnight: MidnightRule.jafari,
    shia: true,
  );

  static const all = <CalcMethod>[
    jafari,
    CalcMethod(
      id: 'tehran',
      nameAr: 'معهد الجيوفيزياء، جامعة طهران',
      fajr: 17.7,
      isha: IshaAngle(14),
      maghrib: MaghribAngle(4.5),
      midnight: MidnightRule.jafari,
      shia: true,
    ),
    CalcMethod(
      id: 'mwl',
      nameAr: 'رابطة العالم الإسلامي',
      fajr: 18,
      isha: IshaAngle(17),
      maghrib: MaghribMinutes(0),
      midnight: MidnightRule.standard,
    ),
    CalcMethod(
      id: 'isna',
      nameAr: 'الجمعية الإسلامية لأمريكا الشمالية',
      fajr: 15,
      isha: IshaAngle(15),
      maghrib: MaghribMinutes(0),
      midnight: MidnightRule.standard,
    ),
    CalcMethod(
      id: 'egypt',
      nameAr: 'الهيئة المصرية العامة للمساحة',
      fajr: 19.5,
      isha: IshaAngle(17.5),
      maghrib: MaghribMinutes(0),
      midnight: MidnightRule.standard,
    ),
    CalcMethod(
      id: 'karachi',
      nameAr: 'جامعة العلوم الإسلامية، كراتشي',
      fajr: 18,
      isha: IshaAngle(18),
      maghrib: MaghribMinutes(0),
      midnight: MidnightRule.standard,
    ),
    CalcMethod(
      id: 'makkah',
      nameAr: 'أم القرى، مكة المكرمة',
      fajr: 18.5,
      isha: IshaMinutes(90),
      maghrib: MaghribMinutes(0),
      midnight: MidnightRule.standard,
    ),
  ];

  static CalcMethod byId(String id) => all.firstWhere((m) => m.id == id, orElse: () => jafari);
}

/// Everything that decides the times; the user can override any of it.
class CalcParams {
  const CalcParams({
    required this.fajrAngle,
    required this.isha,
    required this.maghrib,
    required this.midnight,
    this.asrFactor = 1,
    this.highLatitude = HighLatitudeRule.angleBased,
    this.offsets = const {},
  });

  factory CalcParams.of(
    CalcMethod m, {
    double? fajrAngle,
    double? ishaAngle,
    MaghribRule? maghrib,
    int asrFactor = 1,
    HighLatitudeRule highLatitude = HighLatitudeRule.angleBased,
    Map<Prayer, int> offsets = const {},
  }) =>
      CalcParams(
        fajrAngle: fajrAngle ?? m.fajr,
        isha: ishaAngle != null ? IshaAngle(ishaAngle) : m.isha,
        maghrib: maghrib ?? m.maghrib,
        midnight: m.midnight,
        asrFactor: asrFactor,
        highLatitude: highLatitude,
        offsets: offsets,
      );

  final double fajrAngle;
  final IshaRule isha;
  final MaghribRule maghrib;
  final MidnightRule midnight;
  final int asrFactor;
  final HighLatitudeRule highLatitude;

  /// Manual minutes per prayer: local mosques differ from every calculation.
  final Map<Prayer, int> offsets;
}

enum Prayer {
  fajr('الفجر'),
  sunrise('الشروق'),
  dhuhr('الظهر'),
  asr('العصر'),
  sunset('الغروب'),
  maghrib('المغرب'),
  isha('العشاء'),
  midnight('منتصف الليل');

  const Prayer(this.nameAr);
  final String nameAr;

  /// The five that are prayed (and can be notified).
  static const obligatory = [fajr, dhuhr, asr, maghrib, isha];
}

class PrayerDay {
  const PrayerDay(this.date, this.times, {required this.lastThird});

  /// The civil date these times are for.
  final DateTime date;

  /// Instants, in UTC.
  final Map<Prayer, DateTime> times;

  /// Start of the last third of the night (Tahajjud), from Maghrib to Fajr.
  final DateTime lastThird;

  DateTime operator [](Prayer p) => times[p]!;
}

class _Sun {
  const _Sun(this.declination, this.equation);
  final double declination;
  final double equation;
}

/// Times for one civil date at one place, as UTC instants. The computation
/// runs on the place's mean solar day, so no time zone is needed here; zones
/// only matter for display.
PrayerDay computePrayerDay({
  required DateTime date,
  required double lat,
  required double lng,
  required CalcParams params,
}) {
  final today = _computeRaw(date, lat, lng, params);
  final tomorrow = _computeRaw(date.add(const Duration(days: 1)), lat, lng, params);
  final base = DateTime.utc(date.year, date.month, date.day);
  // Raw times are hours of the local mean solar day; shift to UTC.
  DateTime at(double hours, {int dayOffset = 0}) {
    final utcHours = hours - lng / 15;
    final ms = ((utcHours + dayOffset * 24) * 3600000).round();
    return base.add(Duration(milliseconds: ms));
  }

  final t = {for (final e in today.entries) e.key: at(e.value)};
  final nextFajr = at(tomorrow[Prayer.fajr]!, dayOffset: 1);
  final sunset = t[Prayer.sunset]!;
  final nightEnd = params.midnight == MidnightRule.jafari ? nextFajr : at(tomorrow[Prayer.sunrise]!, dayOffset: 1);
  t[Prayer.midnight] = sunset.add(nightEnd.difference(sunset) ~/ 2);
  final maghrib = t[Prayer.maghrib]!;
  final lastThird = nextFajr.subtract(nextFajr.difference(maghrib) ~/ 3);

  for (final e in params.offsets.entries) {
    final v = t[e.key];
    if (v != null && e.value != 0) t[e.key] = v.add(Duration(minutes: e.value));
  }
  return PrayerDay(DateTime(date.year, date.month, date.day), t, lastThird: lastThird);
}

double _julian(int y, int m, int d) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  final a = (y / 100).floor();
  final b = 2 - a + (a / 4).floor();
  return (365.25 * (y + 4716)).floor() + (30.6001 * (m + 1)).floor() + d + b - 1524.5;
}

/// Hours of the local mean solar day (UTC + lng/15), for each time.
Map<Prayer, double> _computeRaw(DateTime date, double lat, double lng, CalcParams params) {
  final jd = _julian(date.year, date.month, date.day) - lng / (15 * 24);

  _Sun sun(double dayPortion) {
    final d = jd + dayPortion - 2451545.0;
    final g = _fix(357.529 + 0.98560028 * d, 360);
    final q = _fix(280.459 + 0.98564736 * d, 360);
    final l = _fix(q + 1.915 * _sin(g) + 0.020 * _sin(2 * g), 360);
    final e = 23.439 - 0.00000036 * d;
    final ra = _atan2(_cos(e) * _sin(l), _cos(l)) / 15;
    final eqt = q / 15 - _fix(ra, 24);
    return _Sun(_asin(_sin(e) * _sin(l)), eqt);
  }

  double midDay(double t) => _fix(12 - sun(t).equation, 24);

  double angleTime(double angle, double t, {bool beforeNoon = false}) {
    final decl = sun(t).declination;
    final noon = midDay(t);
    final c = (-_sin(angle) - _sin(decl) * _sin(lat)) / (_cos(decl) * _cos(lat));
    if (c.abs() > 1) return double.nan;
    final h = _acos(c) / 15;
    return noon + (beforeNoon ? -h : h);
  }

  double asrTime(int factor, double t) {
    final decl = sun(t).declination;
    final angle = -_acot(factor + _tan((lat - decl).abs()));
    return angleTime(angle, t);
  }

  const riseSet = 0.833;
  final maghribAngle = switch (params.maghrib) { MaghribAngle(:final degrees) => degrees, _ => null };
  final ishaAngle = switch (params.isha) { IshaAngle(:final degrees) => degrees, _ => null };

  var times = <Prayer, double>{
    Prayer.fajr: 5,
    Prayer.sunrise: 6,
    Prayer.dhuhr: 12,
    Prayer.asr: 13,
    Prayer.sunset: 18,
    Prayer.maghrib: 18,
    Prayer.isha: 18,
  };
  for (var i = 0; i < 2; i++) {
    double p(Prayer x) => (times[x]!.isNaN ? 12.0 : times[x]!) / 24;
    times = {
      Prayer.fajr: angleTime(params.fajrAngle, p(Prayer.fajr), beforeNoon: true),
      Prayer.sunrise: angleTime(riseSet, p(Prayer.sunrise), beforeNoon: true),
      Prayer.dhuhr: midDay(p(Prayer.dhuhr)),
      Prayer.asr: asrTime(params.asrFactor, p(Prayer.asr)),
      Prayer.sunset: angleTime(riseSet, p(Prayer.sunset)),
      Prayer.maghrib: maghribAngle != null ? angleTime(maghribAngle, p(Prayer.maghrib)) : double.nan,
      Prayer.isha: ishaAngle != null ? angleTime(ishaAngle, p(Prayer.isha)) : double.nan,
    };
  }

  final sunrise = times[Prayer.sunrise]!;
  final sunset = times[Prayer.sunset]!;
  if (params.maghrib case MaghribMinutes(:final minutes)) times[Prayer.maghrib] = sunset + minutes / 60;
  if (params.isha case IshaMinutes(:final minutes)) times[Prayer.isha] = times[Prayer.maghrib]! + minutes / 60;

  // High latitudes: bound Fajr/Isha/Maghrib to a share of the night.
  final night = _fix(sunrise - sunset, 24);
  double portion(double angle) => switch (params.highLatitude) {
        HighLatitudeRule.angleBased => angle / 60,
        HighLatitudeRule.oneSeventh => 1 / 7,
        HighLatitudeRule.middleOfNight => 1 / 2,
      } *
      night;

  double adjust(double time, double base, double angle, {required bool before}) {
    final limit = portion(angle);
    if (time.isNaN) return before ? base - limit : base + limit;
    final diff = before ? _fix(base - time, 24) : _fix(time - base, 24);
    return diff > limit ? (before ? base - limit : base + limit) : time;
  }

  times[Prayer.fajr] = adjust(times[Prayer.fajr]!, sunrise, params.fajrAngle, before: true);
  if (ishaAngle != null) times[Prayer.isha] = adjust(times[Prayer.isha]!, sunset, ishaAngle, before: false);
  if (maghribAngle != null) times[Prayer.maghrib] = adjust(times[Prayer.maghrib]!, sunset, maghribAngle, before: false);

  return times;
}

/// The sun's azimuth (degrees from true north) and altitude at [utc] — for
/// the qibla fallback when the compass can't be trusted.
({double azimuth, double altitude}) sunPosition(DateTime utc, double lat, double lng) {
  final u = utc.toUtc();
  final hours = u.hour + u.minute / 60 + u.second / 3600;
  final d = _julian(u.year, u.month, u.day) + hours / 24 - 2451545.0;
  final g = _fix(357.529 + 0.98560028 * d, 360);
  final q = _fix(280.459 + 0.98564736 * d, 360);
  final l = _fix(q + 1.915 * _sin(g) + 0.020 * _sin(2 * g), 360);
  final e = 23.439 - 0.00000036 * d;
  final ra = _fix(_atan2(_cos(e) * _sin(l), _cos(l)), 360);
  final decl = _asin(_sin(e) * _sin(l));
  final gmst = _fix(280.46061837 + 360.98564736629 * d, 360);
  final hourAngle = _fix(gmst + lng - ra, 360);
  final alt = _asin(_sin(lat) * _sin(decl) + _cos(lat) * _cos(decl) * _cos(hourAngle));
  final az = _fix(_atan2(-_sin(hourAngle), _tan(decl) * _cos(lat) - _sin(lat) * _cos(hourAngle)), 360);
  return (azimuth: az, altitude: alt);
}
