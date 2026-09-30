import 'dart:math' as math;

import 'package:geomag/geomag.dart';

import '../prayer/prayer_calc.dart';

/// The Kaaba (BLUEPRINT §8).
const kaabaLat = 21.4225;
const kaabaLng = 39.8262;

double _rad(double d) => d * math.pi / 180;
double _deg(double r) => r * 180 / math.pi;
double normalize(double deg) => (deg % 360 + 360) % 360;

/// Initial great-circle bearing from a place to the Kaaba, degrees clockwise
/// from true north.
double qiblaBearing(double lat, double lng) {
  final p1 = _rad(lat), p2 = _rad(kaabaLat), dl = _rad(kaabaLng - lng);
  final y = math.sin(dl) * math.cos(p2);
  final x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl);
  return normalize(_deg(math.atan2(y, x)));
}

/// Great-circle distance to the Kaaba, km.
double distanceToKaaba(double lat, double lng) {
  final p1 = _rad(lat), p2 = _rad(kaabaLat);
  final dp = p2 - p1, dl = _rad(kaabaLng - lng);
  final a = math.pow(math.sin(dp / 2), 2) + math.cos(p1) * math.cos(p2) * math.pow(math.sin(dl / 2), 2);
  return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

final _wmm = GeoMag();

/// Magnetic declination (degrees, east positive) from the World Magnetic
/// Model 2025. The compass reads magnetic north; adding this gives true.
double magneticDeclination(double lat, double lng, DateTime date) => _wmm.calculate(lat, lng, 0, date).dec;

/// Where the qibla is relative to the sun right now: the fallback when the
/// magnetometer can't be trusted. Null when the sun is below the horizon.
({double sunAzimuth, double offset})? qiblaFromSun(double lat, double lng, DateTime now) {
  final sun = sunPosition(now, lat, lng);
  if (sun.altitude < 2) return null;
  // Positive: turn clockwise (to the right) from facing the sun.
  var offset = normalize(qiblaBearing(lat, lng) - sun.azimuth);
  if (offset > 180) offset -= 360;
  return (sunAzimuth: sun.azimuth, offset: offset);
}

/// Compass heading quality, from the sensor's own estimate (degrees ±).
enum CompassQuality { good, fair, unreliable, unknown }

CompassQuality compassQuality(double? accuracy) {
  if (accuracy == null || accuracy < 0) return CompassQuality.unknown;
  if (accuracy <= 20) return CompassQuality.good;
  if (accuracy <= 30) return CompassQuality.fair;
  return CompassQuality.unreliable;
}
