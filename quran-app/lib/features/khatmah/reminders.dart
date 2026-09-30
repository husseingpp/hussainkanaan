import 'dart:convert';
import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../core/arabic_digits.dart';
import 'khatmah_plan.dart';

/// Reminder preferences (synced in v2 with the other preferences).
class ReminderSettings {
  const ReminderSettings({this.dailyAyah = false, this.dailyAyahMinutes = 7 * 60});

  factory ReminderSettings.fromJson(Map<String, Object?> j) => ReminderSettings(
        dailyAyah: j['dailyAyah'] as bool? ?? false,
        dailyAyahMinutes: (j['dailyAyahMinutes'] as num?)?.toInt() ?? 7 * 60,
      );

  final bool dailyAyah;

  /// Time of day, minutes after midnight.
  final int dailyAyahMinutes;

  ReminderSettings copyWith({bool? dailyAyah, int? dailyAyahMinutes}) => ReminderSettings(
        dailyAyah: dailyAyah ?? this.dailyAyah,
        dailyAyahMinutes: dailyAyahMinutes ?? this.dailyAyahMinutes,
      );

  String toJson() => jsonEncode({'dailyAyah': dailyAyah, 'dailyAyahMinutes': dailyAyahMinutes});
}

/// One notification to schedule.
class ReminderSpec {
  const ReminderSpec({required this.id, required this.at, required this.title, required this.body, this.daily = false});

  final int id;

  /// Local wall-clock time; for [daily] reminders only the time of day matters.
  final DateTime at;
  final String title;
  final String body;
  final bool daily;
}

/// What the daily-ayah notification shows for one day.
class DailyAyah {
  const DailyAyah({required this.surahName, required this.ayahNo, required this.text, this.translation});

  final String surahName;
  final int ayahNo;
  final String text;
  final String? translation;
}

/// Picks the day's ayah the same way on every device: the date indexes into
/// the list of short ayahs, so no state has to be kept or synced.
int dailyAyahIndex(DateTime day, int count) => daysBetween(DateTime(2000), day) % count;

const _dailyAyahBase = 1000;
const _khatmahBase = 2000;

/// How many days of daily ayahs to schedule ahead. Each day has its own
/// text, so they are scheduled individually (iOS allows 64 pending); the
/// window is refreshed whenever the app opens.
const dailyAyahWindow = 14;

DateTime _atTime(DateTime day, int minutes) => DateTime(day.year, day.month, day.day, minutes ~/ 60, minutes % 60);

/// Everything to schedule, from the settings and plans as they stand [now].
Future<List<ReminderSpec>> planReminders({
  required ReminderSettings settings,
  required List<Khatmah> khatmahs,
  required KhatmahMath math,
  required DateTime now,
  required Future<DailyAyah> Function(DateTime day) ayahFor,
}) async {
  final specs = <ReminderSpec>[];
  if (settings.dailyAyah) {
    var day = dateOnly(now);
    // Today's is still ahead only if its time hasn't passed.
    if (!_atTime(day, settings.dailyAyahMinutes).isAfter(now)) day = day.add(const Duration(days: 1));
    for (var i = 0; i < dailyAyahWindow; i++, day = day.add(const Duration(days: 1))) {
      final a = await ayahFor(day);
      specs.add(ReminderSpec(
        id: _dailyAyahBase + i,
        at: _atTime(day, settings.dailyAyahMinutes),
        title: 'آية اليوم · سورة ${a.surahName} ${arabicDigits(a.ayahNo)}',
        body: a.translation == null ? a.text : '${a.text}\n\n${a.translation}',
      ));
    }
  }
  var i = 0;
  for (final k in khatmahs) {
    final minutes = k.reminderMinutes;
    if (minutes == null || k.isComplete) continue;
    final target = math.dailyTarget(k, now);
    specs.add(ReminderSpec(
      id: _khatmahBase + i++,
      at: _atTime(dateOnly(now), minutes),
      title: 'وِرد الختمة · ${k.name}',
      body: 'وِردك اليوم ${arabicDigits(target)} ${target == 1 ? 'صفحة' : 'صفحات'}. افتح التطبيق لتبدأ من حيث توقفت.',
      daily: true,
    ));
  }
  return specs;
}

/// Schedules [ReminderSpec]s with the system. Local notifications only: no
/// server, no network (offline-first rule 1).
class ReminderScheduler {
  final _plugin = FlutterLocalNotificationsPlugin();
  var _ready = false;

  static const _channel = AndroidNotificationDetails(
    'net.hussainkanaan.quran_app.reminders',
    'التذكيرات',
    channelDescription: 'آية اليوم ووِرد الختمة',
    importance: Importance.defaultImportance,
    styleInformation: BigTextStyleInformation(''),
    icon: 'ic_stat_quran',
  );

  Future<bool> _init() async {
    if (_ready) return true;
    if (!(Platform.isAndroid || Platform.isIOS)) return false;
    tzdata.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation((await FlutterTimezone.getLocalTimezone()).identifier));
    } catch (_) {
      // Unknown zone name: fall back to UTC offsets of the device clock.
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_stat_quran'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    _ready = true;
    return true;
  }

  /// Asks for notification permission (Android 13+, iOS). Returns whether granted.
  Future<bool> requestPermission() async {
    if (!await _init()) return false;
    if (Platform.isAndroid) {
      return await _plugin
              .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
              ?.requestNotificationsPermission() ??
          false;
    }
    return await _plugin
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
            ?.requestPermissions(alert: true, sound: true) ??
        false;
  }

  /// Replaces every scheduled reminder with [specs].
  Future<void> sync(List<ReminderSpec> specs) async {
    if (!await _init()) return;
    await _plugin.cancelAll();
    for (final s in specs) {
      var when = tz.TZDateTime.from(s.at, tz.local);
      if (s.daily && !when.isAfter(tz.TZDateTime.now(tz.local))) when = when.add(const Duration(days: 1));
      await _plugin.zonedSchedule(
        id: s.id,
        scheduledDate: when,
        title: s.title,
        body: s.body,
        notificationDetails: const NotificationDetails(android: _channel, iOS: DarwinNotificationDetails()),
        // Inexact is fine for a reminder, and needs no exact-alarm permission.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: s.daily ? DateTimeComponents.time : null,
      );
    }
  }
}
