import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../listen/listen_queue.dart';
import '../listen/listen_screen.dart';
import '../reader/reader_screen.dart';
import 'calendar_model.dart';
import 'calendar_providers.dart';
import 'dates.dart';

IconData categoryIcon(EventCategory c) => switch (c) {
      EventCategory.mourning => Icons.water_drop_outlined,
      EventCategory.martyrdom => Icons.brightness_3_outlined,
      EventCategory.birth => Icons.local_florist_outlined,
      EventCategory.eid => Icons.celebration_outlined,
      EventCategory.blessedNight => Icons.nights_stay_outlined,
      EventCategory.fast => Icons.no_food_outlined,
      EventCategory.other => Icons.event_note_outlined,
    };

Color categoryColor(EventCategory c, ColorScheme s) => switch (c) {
      EventCategory.mourning || EventCategory.martyrdom => s.onSurfaceVariant,
      EventCategory.eid || EventCategory.birth => s.primary,
      EventCategory.blessedNight => s.tertiary,
      EventCategory.fast || EventCategory.other => s.secondary,
    };

/// The next Gregorian day on which a Hijri month/day falls, from [from].
DateTime? nextGregorian(EventDate d, DateTime from, int offset) {
  final h = toHijri(from, offset: offset);
  for (var y = h.year; y <= h.year + 1; y++) {
    if (d.day > hijriMonthLength(y, d.month)) continue;
    final g = fromHijri(HijriDate(y, d.month, d.day), offset: offset);
    if (!g.isBefore(DateTime.utc(from.year, from.month, from.day))) return g;
  }
  return null;
}

class EventScreen extends ConsumerWidget {
  const EventScreen({super.key, required this.event});

  final CalendarEvent event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offset = ref.watch(hijriOffsetProvider);
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final surahs = {for (final s in ref.watch(surahsProvider).value ?? const <Surah>[]) s.id: s};
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: Text(event.category.labelAr)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          Icon(categoryIcon(event.category), color: categoryColor(event.category, scheme), size: 32),
          const SizedBox(width: 12),
          Expanded(child: Text(event.nameAr, style: text.titleLarge)),
        ]),
        if (event.significance != null) ...[const SizedBox(height: 12), Text(event.significance!)],
        if (event.sightingDependent)
          Card(
            margin: const EdgeInsets.only(top: 12),
            color: scheme.tertiaryContainer,
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Text('التاريخ محسوب، وثبوته تابع لرؤية الهلال في بلدك ورأي مرجع التقليد.'),
            ),
          ),
        const SizedBox(height: 16),
        Text('التاريخ', style: text.titleSmall),
        for (final d in event.dates)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(d.primary ? Icons.star : Icons.star_border),
            title: Text([
              '${arabicDigits(d.day)} ${hijriMonthsAr[d.month - 1]}',
              if (d.spanDays > 1) 'لمدة ${arabicDigits(d.spanDays)} أيام',
            ].join(' · ')),
            subtitle: Text([
              ?d.variant,
              if (nextGregorian(d, now, offset) case final g?) 'القادم: ${weekdaysAr[g.weekday - 1]} ${gregorianLabel(g)}',
            ].join('\n')),
          ),
        if (event.amaal.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('الأعمال', style: text.titleSmall),
          for (final a in event.amaal)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(a.titleAr, style: text.titleMedium),
                  if (a.bodyAr != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(a.bodyAr!)),
                  for (final r in a.ayahs) ...[
                    const SizedBox(height: 8),
                    Text(
                      'سورة ${surahs[r.surah]?.nameAr ?? arabicDigits(r.surah)}'
                      '${r.from == 1 && r.to == (surahs[r.surah]?.ayahCount ?? -1) ? '' : '، الآيات ${arabicDigits(r.from)}–${arabicDigits(r.to)}'}',
                    ),
                    Wrap(spacing: 8, children: [
                      OutlinedButton.icon(
                        icon: const Icon(Icons.menu_book_outlined),
                        label: const Text('اقرأ'),
                        onPressed: () => Navigator.of(context)
                            .push(MaterialPageRoute<void>(builder: (_) => ReaderScreen(ayah: r.start))),
                      ),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.headphones_outlined),
                        label: const Text('استمع'),
                        onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                          builder: (_) => ListenScreen(startAt: r.start, plan: RepeatPlan.only(r.surah, r.from, r.to)),
                        )),
                      ),
                    ]),
                  ],
                  const SizedBox(height: 6),
                  Text('المصدر: ${a.sourceNote}', style: text.bodySmall),
                ]),
              ),
            ),
        ],
      ]),
    );
  }
}
