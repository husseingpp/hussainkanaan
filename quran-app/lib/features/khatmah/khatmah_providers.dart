import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;

import '../../data/khatmah_repository.dart';
import '../../data/providers.dart';
import 'khatmah_plan.dart';
import 'reminders.dart';

final khatmahRepositoryProvider = FutureProvider<KhatmahRepository>(
  (ref) async => KhatmahRepository((await ref.watch(userDbProvider.future)).db),
);

final khatmahMathProvider = FutureProvider<KhatmahMath>(
  (ref) async => KhatmahMath(QuranPages(await (await ref.watch(contentDbProvider.future)).pageOfEveryAyah())),
);

/// Active plans first, finished ones after.
final khatmahsProvider = FutureProvider<List<Khatmah>>((ref) async {
  final all = await (await ref.watch(khatmahRepositoryProvider.future)).all();
  return [...all.where((k) => !k.isComplete), ...all.where((k) => k.isComplete)];
});

/// Where today's wird starts, and the days read (for the streak).
final khatmahTodayProvider = FutureProvider.family<({int startOfDay, Set<String> days}), String>((ref, uuid) async {
  final repo = await ref.watch(khatmahRepositoryProvider.future);
  final k = (await ref.watch(khatmahsProvider.future)).firstWhere((k) => k.uuid == uuid);
  return (startOfDay: await repo.progressBefore(k, DateTime.now()), days: await repo.daysRead(k));
});

final bookmarksProvider = FutureProvider<List<Bookmark>>(
  (ref) async => (await ref.watch(khatmahRepositoryProvider.future)).bookmarks(),
);

final reminderSchedulerProvider = Provider<ReminderScheduler>((ref) => ReminderScheduler());

class ReminderSettingsNotifier extends AsyncNotifier<ReminderSettings> {
  static const key = 'reminders';

  @override
  Future<ReminderSettings> build() async {
    final raw = await (await ref.watch(userRepositoryProvider.future)).preference(key);
    if (raw == null) return const ReminderSettings();
    try {
      return ReminderSettings.fromJson(jsonDecode(raw) as Map<String, Object?>);
    } on FormatException {
      return const ReminderSettings();
    }
  }

  Future<void> change(ReminderSettings Function(ReminderSettings) edit) async {
    final next = edit(state.value ?? const ReminderSettings());
    state = AsyncData(next);
    await (await ref.read(userRepositoryProvider.future)).setPreference(key, next.toJson());
    await syncReminders(ref.read);
  }
}

final reminderSettingsProvider =
    AsyncNotifierProvider<ReminderSettingsNotifier, ReminderSettings>(ReminderSettingsNotifier.new);

/// Reschedules every reminder from the current settings and plans. Called
/// on launch (the daily-ayah window slides forward) and after any change.
Future<void> syncReminders(T Function<T>(ProviderListenable<T>) read) async {
  try {
    final db = await read(contentDbProvider.future);
    final short = await db.shortAyahIds();
    final surahs = {for (final s in await read(surahsProvider.future)) s.id: s.nameAr};
    final specs = await planReminders(
      settings: await read(reminderSettingsProvider.future),
      khatmahs: await read(khatmahsProvider.future),
      math: await read(khatmahMathProvider.future),
      now: DateTime.now(),
      ayahFor: (day) async {
        final id = short[dailyAyahIndex(day, short.length)];
        final a = (await db.ayah((await db.refOf(id))!))!;
        return DailyAyah(surahName: surahs[a.surah] ?? '', ayahNo: a.number, text: a.text, translation: a.translation);
      },
    );
    await read(reminderSchedulerProvider).sync(specs);
  } catch (_) {
    // Reminders are best effort; never let them break the app.
  }
}

/// Runs [syncReminders] once per app start.
final remindersBootProvider = FutureProvider<void>((ref) => syncReminders(ref.read));
