import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/prayer_repository.dart';
import '../../data/providers.dart';
import '../khatmah/khatmah_providers.dart';
import 'prayer_calc.dart';
import 'prayer_settings.dart';
import 'zones.dart';

final prayerRepositoryProvider = FutureProvider<PrayerRepository>(
  (ref) async => PrayerRepository((await ref.watch(userDbProvider.future)).db),
);

class PrayerSettingsNotifier extends AsyncNotifier<PrayerSettings> {
  @override
  Future<PrayerSettings> build() async => (await ref.watch(prayerRepositoryProvider.future)).settings();

  Future<void> change(PrayerSettings Function(PrayerSettings) edit) async {
    final next = edit(state.value ?? const PrayerSettings());
    state = AsyncData(next);
    await (await ref.read(prayerRepositoryProvider.future)).saveSettings(next);
    await syncReminders(ref.read);
  }
}

final prayerSettingsProvider =
    AsyncNotifierProvider<PrayerSettingsNotifier, PrayerSettings>(PrayerSettingsNotifier.new);

final locationsProvider = FutureProvider<List<SavedLocation>>(
  (ref) async => (await ref.watch(prayerRepositoryProvider.future)).locations(),
);

final selectedLocationProvider = FutureProvider<SavedLocation?>(
  (ref) async => (await ref.watch(locationsProvider.future)).where((l) => l.selected).firstOrNull,
);

class PrayerAlertsNotifier extends AsyncNotifier<PrayerAlerts> {
  static const key = 'prayer_alerts';

  @override
  Future<PrayerAlerts> build() async {
    final raw = await (await ref.watch(userRepositoryProvider.future)).preference(key);
    if (raw == null) return const PrayerAlerts();
    try {
      return PrayerAlerts.fromJson(jsonDecode(raw) as Map<String, Object?>);
    } on FormatException {
      return const PrayerAlerts();
    }
  }

  Future<void> change(PrayerAlerts Function(PrayerAlerts) edit) async {
    final next = edit(state.value ?? const PrayerAlerts());
    state = AsyncData(next);
    await (await ref.read(userRepositoryProvider.future)).setPreference(key, next.toJson());
    await syncReminders(ref.read);
  }
}

final prayerAlertsProvider = AsyncNotifierProvider<PrayerAlertsNotifier, PrayerAlerts>(PrayerAlertsNotifier.new);

/// Ticks every 20 s so countdowns and "next prayer" stay current.
final clockProvider = StreamProvider<DateTime>((ref) async* {
  yield DateTime.now();
  yield* Stream.periodic(const Duration(seconds: 20), (_) => DateTime.now());
});

PrayerDay prayerDayFor(SavedLocation loc, PrayerSettings s, DateTime date) =>
    computePrayerDay(date: date, lat: loc.lat, lng: loc.lng, params: s.params);

/// The next obligatory prayer after [now] at [loc] (today's or tomorrow's Fajr).
({Prayer prayer, DateTime at}) nextPrayer(SavedLocation loc, PrayerSettings s, DateTime now) {
  final today = dateIn(loc.timezone, now);
  for (var d = 0; d < 2; d++) {
    final day = prayerDayFor(loc, s, DateTime(today.year, today.month, today.day + d));
    for (final p in Prayer.obligatory) {
      if (day[p].isAfter(now)) return (prayer: p, at: day[p]);
    }
  }
  final day = prayerDayFor(loc, s, DateTime(today.year, today.month, today.day + 2));
  return (prayer: Prayer.fajr, at: day[Prayer.fajr]);
}
