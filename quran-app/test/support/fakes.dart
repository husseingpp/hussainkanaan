import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quran_app/data/khatmah_repository.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/providers.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/data/user_repository.dart';
import 'package:quran_app/features/khatmah/khatmah_plan.dart';
import 'package:quran_app/features/khatmah/khatmah_providers.dart';

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

/// Everything the index and shell need, without any database.
List overridesForIndex({ReadingPosition? position, List<Khatmah> khatmahs = const [], List<Bookmark> bookmarks = const []}) => [
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
