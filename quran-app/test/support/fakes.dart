import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quran_app/data/khatmah_repository.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/providers.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/data/user_repository.dart';
import 'package:quran_app/features/khatmah/khatmah_plan.dart';
import 'package:quran_app/features/calendar/calendar_model.dart';
import 'package:quran_app/features/calendar/calendar_providers.dart';
import 'package:quran_app/features/khatmah/khatmah_providers.dart';
import 'package:quran_app/features/prayer/prayer_providers.dart';
import 'package:quran_app/features/prayer/prayer_settings.dart';

const fakeSurahs = [
  Surah(id: 1, nameAr: 'الفاتحة', nameEn: 'The Opening', nameTranslit: 'Al-Faatiha', isMeccan: true, ayahCount: 7, pageStart: 1),
  Surah(id: 2, nameAr: 'البقرة', nameEn: 'The Cow', nameTranslit: 'Al-Baqara', isMeccan: false, ayahCount: 286, pageStart: 2),
];

class FakeSettings extends SettingsNotifier {
  FakeSettings([this.initial = const ReaderSettings()]);

  final ReaderSettings initial;

  @override
  Future<ReaderSettings> build() async => initial;

  @override
  Future<void> change(ReaderSettings Function(ReaderSettings) edit) async {
    state = AsyncData(edit(state.value ?? initial));
  }
}

class FakePrayerSettings extends PrayerSettingsNotifier {
  @override
  Future<PrayerSettings> build() async => const PrayerSettings();

  @override
  Future<void> change(PrayerSettings Function(PrayerSettings) edit) async {
    state = AsyncData(edit(state.value ?? const PrayerSettings()));
  }
}

class FakePrayerAlerts extends PrayerAlertsNotifier {
  @override
  Future<PrayerAlerts> build() async => const PrayerAlerts();
}

class FakeCalendarSettings extends CalendarSettingsNotifier {
  @override
  Future<CalendarSettings> build() async => const CalendarSettings();
}

const beirut = SavedLocation(id: 1, label: 'بيروت', lat: 33.8938, lng: 35.5018, timezone: 'Asia/Beirut', selected: true);

/// Everything the index and shell need, without any database.
List overridesForIndex({
  ReadingPosition? position,
  List<Khatmah> khatmahs = const [],
  List<Bookmark> bookmarks = const [],
  SavedLocation? location,
  CalendarPack calendar = const CalendarPack(version: null, reviewed: false, events: []),
}) =>
    [
      locationsProvider.overrideWith((ref) async => [?location]),
      prayerSettingsProvider.overrideWith(FakePrayerSettings.new),
      prayerAlertsProvider.overrideWith(FakePrayerAlerts.new),
      calendarSettingsProvider.overrideWith(FakeCalendarSettings.new),
      calendarPackProvider.overrideWith((ref) async => calendar),
      khatmahsProvider.overrideWith((ref) async => khatmahs),
      bookmarksProvider.overrideWith((ref) async => bookmarks),
      // A toy mus'haf: 10 pages of 3 ayahs.
      khatmahMathProvider.overrideWith((ref) async => KhatmahMath(QuranPages([0, for (var p = 1; p <= 10; p++) ...[p, p, p]]))),
      khatmahTodayProvider.overrideWith((ref, uuid) async => (startOfDay: 6, days: {dayKey(DateTime.now())})),
      surahsProvider.overrideWith((ref) async => fakeSurahs),
      lastPositionProvider.overrideWith((ref) async => position),
      settingsProvider.overrideWith(FakeSettings.new),
      juzStartsProvider.overrideWith((ref) async => const [
            JuzStart(juz: 1, start: AyahRef(1, 1), page: 1),
            JuzStart(juz: 2, start: AyahRef(2, 142), page: 22),
          ]),
    ];
