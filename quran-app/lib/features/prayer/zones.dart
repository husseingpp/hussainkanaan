import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../core/arabic_digits.dart';

var _loaded = false;

/// An IANA zone, for showing a saved place's times in its own clock (with
/// its daylight saving), whatever the phone's zone is. Unknown names fall
/// back to UTC rather than failing.
tz.Location zone(String name) {
  if (!_loaded) {
    tzdata.initializeTimeZones();
    _loaded = true;
  }
  try {
    return tz.getLocation(name);
  } catch (_) {
    return tz.UTC;
  }
}

/// [instant] on the wall clock of [zoneName].
tz.TZDateTime inZone(DateTime instant, String zoneName) => tz.TZDateTime.from(instant, zone(zoneName));

/// The civil date it is at [zoneName] at [instant].
DateTime dateIn(String zoneName, DateTime instant) {
  final t = inZone(instant, zoneName);
  return DateTime(t.year, t.month, t.day);
}

String two(int n) => n.toString().padLeft(2, '0');

/// "٠٤:٣٠" on the place's clock.
String clockLabel(DateTime instant, String zoneName) {
  final t = inZone(instant, zoneName);
  return arabicNumerals('${two(t.hour)}:${two(t.minute)}');
}
