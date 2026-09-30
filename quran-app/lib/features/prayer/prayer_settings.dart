import 'dart:convert';

import 'prayer_calc.dart';

Prayer? _prayer(String name) => Prayer.values.where((p) => p.name == name).firstOrNull;

/// The `calc_settings` row: a method preset plus the user's overrides.
class PrayerSettings {
  const PrayerSettings({
    this.methodId = 'jafari',
    this.fajrAngle,
    this.ishaAngle,
    this.maghribRule = 'angle:4',
    this.asrFactor = 1,
    this.highLatitude = HighLatitudeRule.angleBased,
    this.offsets = const {},
    this.hijriOffset = 0,
  });

  final String methodId;
  final double? fajrAngle;
  final double? ishaAngle;
  final String maghribRule;
  final int asrFactor;
  final HighLatitudeRule highLatitude;
  final Map<Prayer, int> offsets;

  /// Days added to the computed Hijri date (−2…+2): moon sighting differs.
  final int hijriOffset;

  CalcMethod get method => CalcMethod.byId(methodId);

  CalcParams get params => CalcParams.of(
        method,
        fajrAngle: fajrAngle,
        ishaAngle: ishaAngle,
        maghrib: MaghribRule.parse(maghribRule),
        asrFactor: asrFactor,
        highLatitude: highLatitude,
        offsets: offsets,
      );

  /// Choosing a method presets its angles and Maghrib rule.
  PrayerSettings withMethod(CalcMethod m) => PrayerSettings(
        methodId: m.id,
        maghribRule: m.maghrib.encode(),
        asrFactor: asrFactor,
        highLatitude: highLatitude,
        offsets: offsets,
        hijriOffset: hijriOffset,
      );

  PrayerSettings copyWith({
    double? fajrAngle,
    double? ishaAngle,
    String? maghribRule,
    int? asrFactor,
    HighLatitudeRule? highLatitude,
    Map<Prayer, int>? offsets,
    int? hijriOffset,
  }) =>
      PrayerSettings(
        methodId: methodId,
        fajrAngle: fajrAngle ?? this.fajrAngle,
        ishaAngle: ishaAngle ?? this.ishaAngle,
        maghribRule: maghribRule ?? this.maghribRule,
        asrFactor: asrFactor ?? this.asrFactor,
        highLatitude: highLatitude ?? this.highLatitude,
        offsets: offsets ?? this.offsets,
        hijriOffset: hijriOffset ?? this.hijriOffset,
      );

  static const _highLat = {
    HighLatitudeRule.angleBased: 'angle_based',
    HighLatitudeRule.oneSeventh: 'one_seventh',
    HighLatitudeRule.middleOfNight: 'middle_of_night',
  };

  factory PrayerSettings.fromRow(Map<String, Object?> r) {
    final rawOffsets = jsonDecode(r['per_prayer_offsets_json'] as String? ?? '{}') as Map<String, Object?>;
    return PrayerSettings(
      methodId: r['method_id'] as String? ?? 'jafari',
      fajrAngle: (r['fajr_angle'] as num?)?.toDouble(),
      ishaAngle: (r['isha_angle'] as num?)?.toDouble(),
      maghribRule: r['maghrib_rule'] as String? ?? 'angle:4',
      asrFactor: (r['asr_factor'] as int?) ?? 1,
      highLatitude: _highLat.entries
              .where((e) => e.value == r['high_latitude_rule'])
              .map((e) => e.key)
              .firstOrNull ??
          HighLatitudeRule.angleBased,
      offsets: {
        for (final e in rawOffsets.entries) ?_prayer(e.key): (e.value as num).toInt(),
      },
      hijriOffset: (r['hijri_offset'] as int?) ?? 0,
    );
  }

  Map<String, Object?> toRow(int updatedAt) => {
        'id': 1,
        'method_id': methodId,
        'fajr_angle': fajrAngle,
        'isha_angle': ishaAngle,
        'maghrib_rule': maghribRule,
        'asr_factor': asrFactor,
        'high_latitude_rule': _highLat[highLatitude],
        'per_prayer_offsets_json': jsonEncode({for (final e in offsets.entries) if (e.value != 0) e.key.name: e.value}),
        'hijri_offset': hijriOffset,
        'updated_at': updatedAt,
      };
}

/// A saved place. The selected one drives prayer times, qibla and reminders.
class SavedLocation {
  const SavedLocation({
    required this.id,
    required this.label,
    required this.lat,
    required this.lng,
    required this.timezone,
    this.selected = false,
  });

  final int id;
  final String label;
  final double lat;
  final double lng;
  final String timezone;
  final bool selected;

  factory SavedLocation.fromRow(Map<String, Object?> r) => SavedLocation(
        id: r['id']! as int,
        label: r['label']! as String,
        lat: (r['lat']! as num).toDouble(),
        lng: (r['lng']! as num).toDouble(),
        timezone: r['timezone']! as String,
        selected: r['is_current'] == 1,
      );
}

/// Per-prayer notification choices (a preference, synced with the others).
class PrayerAlerts {
  const PrayerAlerts({this.enabled = const {}, this.preAlertMinutes = 0, this.silent = false});

  factory PrayerAlerts.fromJson(Map<String, Object?> j) => PrayerAlerts(
        enabled: {
          for (final n in (j['enabled'] as List? ?? const []).cast<String>()) ?_prayer(n),
        },
        preAlertMinutes: (j['preAlertMinutes'] as num?)?.toInt() ?? 0,
        silent: j['silent'] as bool? ?? false,
      );

  final Set<Prayer> enabled;

  /// A reminder this many minutes before each enabled prayer (0 = none).
  final int preAlertMinutes;

  /// Silent notifications, or the default notification sound.
  final bool silent;

  PrayerAlerts copyWith({Set<Prayer>? enabled, int? preAlertMinutes, bool? silent}) => PrayerAlerts(
        enabled: enabled ?? this.enabled,
        preAlertMinutes: preAlertMinutes ?? this.preAlertMinutes,
        silent: silent ?? this.silent,
      );

  String toJson() => jsonEncode({
        'enabled': [for (final p in enabled) p.name],
        'preAlertMinutes': preAlertMinutes,
        'silent': silent,
      });
}
