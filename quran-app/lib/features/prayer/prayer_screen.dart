import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../calendar/calendar_providers.dart';
import '../calendar/dates.dart';
import '../khatmah/khatmah_providers.dart';
import '../listen/battery.dart';
import 'location_sheet.dart';
import 'prayer_calc.dart';
import 'prayer_providers.dart';
import 'prayer_settings.dart';
import 'prayer_settings_screen.dart';
import 'zones.dart';

String countdownLabel(Duration d) {
  final h = d.inHours, m = d.inMinutes % 60;
  if (h == 0) return 'بعد ${arabicDigits(m < 1 ? 1 : m)} دقيقة';
  return 'بعد ${arabicDigits(h)} س ${arabicDigits(m)} د';
}

/// Prayer times for the selected place: computed on the device, never
/// fetched (offline-first rule 1).
class PrayerScreen extends ConsumerStatefulWidget {
  const PrayerScreen({super.key});

  @override
  ConsumerState<PrayerScreen> createState() => _PrayerScreenState();
}

class _PrayerScreenState extends ConsumerState<PrayerScreen> {
  var _dayOffset = 0;

  @override
  Widget build(BuildContext context) {
    final loc = ref.watch(selectedLocationProvider);
    final settings = ref.watch(prayerSettingsProvider).value;
    return Scaffold(
      appBar: AppBar(
        title: const Text('مواقيت الصلاة'),
        actions: [
          IconButton(
            tooltip: 'الموقع',
            icon: const Icon(Icons.place_outlined),
            onPressed: () => showLocationSheet(context),
          ),
          IconButton(
            tooltip: 'طريقة الحساب',
            icon: const Icon(Icons.tune),
            onPressed: () =>
                Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PrayerSettingsScreen())),
          ),
        ],
      ),
      body: loc.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
        data: (l) => l == null || settings == null
            ? const LocationPrompt()
            : _Times(location: l, settings: settings, dayOffset: _dayOffset, onDay: (d) => setState(() => _dayOffset = d)),
      ),
    );
  }
}

class LocationPrompt extends ConsumerWidget {
  const LocationPrompt({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.place_outlined, size: 48),
          const SizedBox(height: 12),
          const Text('تُحسب المواقيت على جهازك من موقعك، دون إنترنت.', textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            icon: const Icon(Icons.my_location),
            label: const Text('استخدم موقعي الحالي'),
            onPressed: () async {
              final err = await useCurrentLocation(context, ref);
              if (!context.mounted) return;
              if (err == 'city') {
                await showLocationSheet(context);
              } else if (err != null) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
              }
            },
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.location_city),
            label: const Text('اختر مدينة أو أدخل الإحداثيات'),
            onPressed: () => showLocationSheet(context),
          ),
        ]),
      ),
    );
  }
}

class _Times extends ConsumerWidget {
  const _Times({required this.location, required this.settings, required this.dayOffset, required this.onDay});

  final SavedLocation location;
  final PrayerSettings settings;
  final int dayOffset;
  final ValueChanged<int> onDay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider).value ?? DateTime.now();
    final today = dateIn(location.timezone, now);
    final date = DateTime(today.year, today.month, today.day + dayOffset);
    final day = prayerDayFor(location, settings, date);
    final next = nextPrayer(location, settings, now);
    final alerts = ref.watch(prayerAlertsProvider).value ?? const PrayerAlerts();
    final hijriOffset = ref.watch(hijriOffsetProvider);
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    // Starts round up, ends round down (see clockLabel).
    String t(DateTime x, {bool start = true}) => clockLabel(x, location.timezone, roundUp: start);

    Widget row(String name, DateTime at, {DateTime? until, Prayer? alert, String? note, bool strong = true, bool start = true}) {
      final isNext = dayOffset == 0 && alert == next.prayer && at == next.at;
      return ListTile(
        tileColor: isNext ? scheme.primaryContainer : null,
        title: Text(name, style: strong ? text.titleMedium : text.bodyMedium),
        subtitle: until == null && note == null
            ? null
            : Text([if (until != null) 'حتى ${t(until, start: false)}', ?note].join(' · ')),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(t(at, start: start), style: (strong ? text.titleLarge : text.titleMedium)?.copyWith(fontFeatures: const [])),
          if (alert != null)
            IconButton(
              tooltip: alerts.enabled.contains(alert) ? 'إيقاف التنبيه' : 'تنبيه عند دخول الوقت',
              icon: Icon(alerts.enabled.contains(alert) ? Icons.notifications_active : Icons.notifications_none),
              onPressed: () async {
                final on = !alerts.enabled.contains(alert);
                if (on) {
                  await requestNotificationPermission();
                  final scheduler = ref.read(reminderSchedulerProvider);
                  await scheduler.requestPermission();
                  await scheduler.requestExactAlarms();
                }
                await ref.read(prayerAlertsProvider.notifier).change(
                      (a) => a.copyWith(enabled: on ? {...a.enabled, alert} : ({...a.enabled}..remove(alert))),
                    );
              },
            ),
        ]),
      );
    }

    final shia = settings.method.shia;
    return ListView(padding: const EdgeInsets.only(bottom: 24), children: [
      Card(
        margin: const EdgeInsets.all(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            InkWell(
              onTap: () => showLocationSheet(context),
              child: Row(children: [
                const Icon(Icons.place, size: 18),
                const SizedBox(width: 4),
                Expanded(child: Text(location.label, style: text.titleSmall, overflow: TextOverflow.ellipsis)),
                Text(zoneOffsetLabel(location.timezone, now), style: text.bodySmall),
              ]),
            ),
            const SizedBox(height: 12),
            Text('الصلاة القادمة: ${next.prayer.nameAr}', style: text.titleLarge),
            Text('${t(next.at)} · ${countdownLabel(next.at.difference(now))}', style: text.titleMedium),
          ]),
        ),
      ),
      Row(children: [
        IconButton(
          tooltip: 'اليوم السابق',
          icon: const Icon(Icons.chevron_right),
          onPressed: () => onDay(dayOffset - 1),
        ),
        Expanded(
          child: GestureDetector(
            onTap: () => onDay(0),
            child: Column(children: [
              Text(
                '${dayOffset == 0 ? 'اليوم · ' : ''}${weekdaysAr[date.weekday - 1]} ${gregorianLabel(date)}',
                style: text.titleSmall,
                textAlign: TextAlign.center,
              ),
              Text(hijriLabel(toHijri(date, offset: hijriOffset)), style: text.bodySmall),
            ]),
          ),
        ),
        IconButton(tooltip: 'اليوم التالي', icon: const Icon(Icons.chevron_left), onPressed: () => onDay(dayOffset + 1)),
      ]),
      const Divider(height: 1),
      row('الفجر', day[Prayer.fajr], until: day[Prayer.sunrise], alert: Prayer.fajr),
      row('الشروق', day[Prayer.sunrise], strong: false, start: false),
      if (shia) ...[
        row('الظهر', day[Prayer.dhuhr], until: day[Prayer.sunset], alert: Prayer.dhuhr, note: 'يُجمع مع العصر'),
        row('العصر', day[Prayer.asr], until: day[Prayer.sunset], alert: Prayer.asr),
        row('الغروب', day[Prayer.sunset], strong: false, start: false),
        row('المغرب', day[Prayer.maghrib], until: day[Prayer.midnight], alert: Prayer.maghrib, note: 'يُجمع مع العشاء'),
        row('العشاء', day[Prayer.isha], until: day[Prayer.midnight], alert: Prayer.isha),
      ] else ...[
        row('الظهر', day[Prayer.dhuhr], until: day[Prayer.asr], alert: Prayer.dhuhr),
        row('العصر', day[Prayer.asr], until: day[Prayer.sunset], alert: Prayer.asr),
        row('المغرب', day[Prayer.maghrib], until: day[Prayer.isha], alert: Prayer.maghrib),
        row('العشاء', day[Prayer.isha], until: day[Prayer.midnight], alert: Prayer.isha),
      ],
      const Divider(),
      row('منتصف الليل الشرعي', day[Prayer.midnight],
          strong: false, start: false, note: shia ? 'آخر وقت المغرب والعشاء' : 'آخر وقت العشاء المختار'),
      row('الثلث الأخير من الليل', day.lastThird, strong: false, note: 'صلاة الليل'),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: Text(
          'طريقة الحساب: ${settings.method.nameAr}. المواقيت محسوبة فلكيًا وقد تختلف دقيقة أو دقيقتين عن تقويم مسجدك؛ '
          'يمكنك ضبط كل صلاة من إعدادات الحساب.',
          style: text.bodySmall,
        ),
      ),
      if (alerts.enabled.isNotEmpty) const _AlertOptions(),
    ]);
  }
}

class _AlertOptions extends ConsumerWidget {
  const _AlertOptions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(prayerAlertsProvider).value ?? const PrayerAlerts();
    return Column(children: [
      const Divider(),
      SwitchListTile(
        title: const Text('تنبيه صامت'),
        subtitle: const Text('دون صوت. صوت الأذان: في إصدار لاحق'),
        value: a.silent,
        onChanged: (v) => ref.read(prayerAlertsProvider.notifier).change((x) => x.copyWith(silent: v)),
      ),
      ListTile(
        title: const Text('تذكير قبل الصلاة'),
        trailing: DropdownButton<int>(
          value: a.preAlertMinutes,
          items: [
            for (final m in const [0, 5, 10, 15, 20, 30])
              DropdownMenuItem(value: m, child: Text(m == 0 ? 'لا' : '${arabicDigits(m)} دقيقة')),
          ],
          onChanged: (m) => ref.read(prayerAlertsProvider.notifier).change((x) => x.copyWith(preAlertMinutes: m)),
        ),
      ),
    ]);
  }
}
