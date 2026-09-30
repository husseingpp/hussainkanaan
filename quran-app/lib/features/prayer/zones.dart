import 'package:timezone/data/latest_all.dart' as tzdata;
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

/// "٠٤:٣٠" on the place's clock. Times carry seconds; [roundUp] shows the
/// next minute (for when a prayer's time begins), otherwise the minute is
/// truncated (for when a window ends), so the screen never shows a start
/// earlier, or an end later, than the computed instant.
String clockLabel(DateTime instant, String zoneName, {bool roundUp = false}) {
  final exact = instant.second == 0 && instant.millisecond == 0 && instant.microsecond == 0;
  final shown = roundUp && !exact ? instant.add(const Duration(minutes: 1)) : instant;
  final t = inZone(shown, zoneName);
  return arabicNumerals('${two(t.hour)}:${two(t.minute)}');
}
