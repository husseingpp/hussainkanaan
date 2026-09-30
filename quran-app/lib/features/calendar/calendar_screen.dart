import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../khatmah/khatmah_providers.dart';
import '../khatmah/khatmah_screen.dart' show timeLabel;
import '../listen/battery.dart';
import '../prayer/prayer_providers.dart';
import '../prayer/prayer_settings_screen.dart';
import 'calendar_model.dart';
import 'calendar_providers.dart';
import 'dates.dart';
import 'event_screen.dart';

/// Hijri calendar with the Shia observance cycle (BLUEPRINT §9).
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  /// The Hijri month shown in the grid, relative to this month.
  var _monthShift = 0;

  @override
  Widget build(BuildContext context) {
    final pack = ref.watch(calendarPackProvider);
    final offset = ref.watch(hijriOffsetProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('التقويم'),
          actions: [
            IconButton(
              tooltip: 'إعدادات التقويم',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () =>
                  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CalendarSettingsScreen())),
            ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'الشهر'), Tab(text: 'القادم')]),
        ),
        body: pack.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
          data: (p) => TabBarView(children: [
            ListView(children: [
              _Today(pack: p, offset: offset),
              _MonthGrid(
                pack: p,
                offset: offset,
                shift: _monthShift,
                onShift: (d) => setState(() => _monthShift += d),
              ),
            ]),
            _Agenda(pack: p, offset: offset),
          ]),
        ),
      ),
    );
  }
}

class _Today extends StatelessWidget {
  const _Today({required this.pack, required this.offset});

  final CalendarPack pack;
  final int offset;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final h = toHijri(now, offset: offset);
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final today = pack.on(now, hijriOffset: offset);
    final next = pack
        .upcoming(DateTime(now.year, now.month, now.day + 1), days: 120, hijriOffset: offset)
        .where((o) => o.event.importance >= 2)
        .firstOrNull;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (!pack.reviewed && !pack.isEmpty)
        Material(
          color: scheme.errorContainer,
          child: const Padding(
            padding: EdgeInsets.all(10),
            child: Text(
              'بيانات المناسبات مسودة لم يراجعها مختص بعد؛ قد تختلف التواريخ والروايات عمّا يعتمده مرجعك.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text(weekdaysAr[now.weekday - 1], style: text.titleSmall),
          Text(hijriLabel(h), style: text.headlineSmall),
          Text('${gregorianLabel(now)} · ${solarHijriLabel(now)}', style: text.bodyMedium, textAlign: TextAlign.center),
          if (offset != 0)
            Text('مع تعديل ${offset > 0 ? '+' : '−'}${arabicDigits(offset.abs())} يوم', style: text.bodySmall),
        ]),
      ),
      for (final o in today) _OccurrenceTile(o: o, today: true),
      if (next != null)
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: Icon(categoryIcon(next.event.category), color: categoryColor(next.event.category, scheme)),
            title: Text('المناسبة القادمة: ${next.event.nameAr}'),
            subtitle: Text(
              '${_inDays(next.gregorian.difference(DateTime.utc(now.year, now.month, now.day)).inDays)} · '
              '${hijriLabel(toHijri(next.gregorian, offset: offset))}',
            ),
            onTap: () => _open(context, next.event),
          ),
        ),
    ]);
  }
}

String _inDays(int d) => switch (d) {
      0 => 'اليوم',
      1 => 'غدًا',
      2 => 'بعد غد',
      _ => 'بعد ${arabicDigits(d)} ${d <= 10 ? 'أيام' : 'يومًا'}',
    };

void _open(BuildContext context, CalendarEvent e) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => EventScreen(event: e)));

class _OccurrenceTile extends StatelessWidget {
  const _OccurrenceTile({required this.o, this.today = false});

  final Occurrence o;
  final bool today;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(categoryIcon(o.event.category), color: categoryColor(o.event.category, scheme)),
      title: Text(o.event.nameAr),
      subtitle: Text([
        if (o.isPeriod) 'اليوم ${arabicDigits(o.dayOfSpan)} من ${arabicDigits(o.date.spanDays)}',
        ?o.date.variant,
        if (o.event.sightingDependent) 'تابع لرؤية الهلال',
      ].join(' · ')),
      tileColor: today ? scheme.secondaryContainer : null,
      onTap: () => _open(context, o.event),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({required this.pack, required this.offset, required this.shift, required this.onShift});

  final CalendarPack pack;
  final int offset;
  final int shift;
  final ValueChanged<int> onShift;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = toHijri(now, offset: offset);
    var y = today.year, m = today.month + shift;
    while (m > 12) {
      m -= 12;
      y++;
    }
    while (m < 1) {
      m += 12;
      y--;
    }
    final length = hijriMonthLength(y, m);
    final first = fromHijri(HijriDate(y, m, 1), offset: offset);
    // Weeks start on Saturday (DateTime.saturday == 6).
    final lead = (first.weekday + 1) % 7;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    const heads = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
    return Column(children: [
      Row(children: [
        IconButton(icon: const Icon(Icons.chevron_right), tooltip: 'الشهر السابق', onPressed: () => onShift(-1)),
        Expanded(
          child: GestureDetector(
            onTap: () => onShift(-shift),
            child: Text('${hijriMonthsAr[m - 1]} ${arabicDigits(y)}', style: text.titleMedium, textAlign: TextAlign.center),
          ),
        ),
        IconButton(icon: const Icon(Icons.chevron_left), tooltip: 'الشهر التالي', onPressed: () => onShift(1)),
      ]),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 0.8,
          children: [
            for (final h in heads) Center(child: Text(h, style: text.labelMedium)),
            for (var i = 0; i < lead; i++) const SizedBox.shrink(),
            for (var d = 1; d <= length; d++)
              Builder(builder: (context) {
                final g = first.add(Duration(days: d - 1));
                final events = pack.on(g, hijriOffset: offset);
                final isToday = y == today.year && m == today.month && d == today.day;
                final top = events.firstOrNull;
                return InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: events.isEmpty ? null : () => _showDay(context, g, events),
                  child: Container(
                    margin: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: isToday ? scheme.primaryContainer : null,
                      borderRadius: BorderRadius.circular(8),
                      border: top != null && top.event.importance == 3
                          ? Border.all(color: categoryColor(top.event.category, scheme))
                          : null,
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(arabicDigits(d), style: text.titleSmall),
                      Text(arabicDigits(g.day), style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant)),
                      if (top != null)
                        Icon(categoryIcon(top.event.category), size: 12, color: categoryColor(top.event.category, scheme)),
                    ]),
                  ),
                );
              }),
          ],
        ),
      ),
      const SizedBox(height: 16),
    ]);
  }

  void _showDay(BuildContext context, DateTime g, List<Occurrence> events) => showModalBottomSheet<void>(
        context: context,
        builder: (_) => ListView(shrinkWrap: true, children: [
          ListTile(title: Text('${hijriLabel(toHijri(g, offset: offset))} · ${gregorianLabel(g)}')),
          for (final o in events) _OccurrenceTile(o: o),
          const SizedBox(height: 12),
        ]),
      );
}

class _Agenda extends StatelessWidget {
  const _Agenda({required this.pack, required this.offset});

  final CalendarPack pack;
  final int offset;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final list = pack.upcoming(DateTime(now.year, now.month, now.day), days: 180, hijriOffset: offset);
    if (list.isEmpty) return const Center(child: Text('لا مناسبات في بيانات التقويم.'));
    final text = Theme.of(context).textTheme;
    return ListView.builder(
      itemCount: list.length,
      itemBuilder: (context, i) {
        final o = list[i];
        final newDay = i == 0 || list[i - 1].gregorian != o.gregorian;
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (newDay)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text(
                '${hijriLabel(toHijri(o.gregorian, offset: offset))} · ${weekdaysAr[o.gregorian.weekday - 1]} ${gregorianLabel(o.gregorian)}',
                style: text.labelLarge,
              ),
            ),
          _OccurrenceTile(o: o),
        ]);
      },
    );
  }
}

class CalendarSettingsScreen extends ConsumerWidget {
  const CalendarSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(calendarSettingsProvider).value;
    final prayer = ref.watch(prayerSettingsProvider).value;
    if (s == null || prayer == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final n = ref.read(calendarSettingsProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('إعدادات التقويم')),
      body: ListView(children: [
        HijriOffsetTile(settings: prayer),
        const Divider(),
        SwitchListTile(
          title: const Text('تنبيه قبل المناسبات'),
          subtitle: const Text('للمناسبات المهمة فقط'),
          value: s.alerts,
          onChanged: (v) async {
            if (v) {
              await requestNotificationPermission();
              await ref.read(reminderSchedulerProvider).requestPermission();
            }
            await n.change((x) => x.copyWith(alerts: v));
          },
        ),
        ListTile(
          enabled: s.alerts,
          title: const Text('قبل المناسبة بـ'),
          trailing: DropdownButton<int>(
            value: s.daysAhead,
            items: [
              for (final d in const [0, 1, 2, 3, 7])
                DropdownMenuItem(value: d, child: Text(d == 0 ? 'يومها' : '${arabicDigits(d)} ${d == 1 ? 'يوم' : 'أيام'}')),
            ],
            onChanged: s.alerts ? (d) => n.change((x) => x.copyWith(daysAhead: d)) : null,
          ),
        ),
        ListTile(
          enabled: s.alerts,
          title: const Text('وقت التنبيه'),
          trailing: Text(timeLabel(s.alertMinutes)),
          onTap: !s.alerts
              ? null
              : () async {
                  final t = await showTimePicker(
                    context: context,
                    initialTime: TimeOfDay(hour: s.alertMinutes ~/ 60, minute: s.alertMinutes % 60),
                  );
                  if (t != null) await n.change((x) => x.copyWith(alertMinutes: t.hour * 60 + t.minute));
                },
        ),
        const Divider(),
        SwitchListTile(
          title: const Text('ألوان هادئة في مواسم الحزن'),
          subtitle: const Text('محرّم وصفر والأيام الفاطمية. اختياري.'),
          value: s.mourningTheme,
          onChanged: (v) => n.change((x) => x.copyWith(mourningTheme: v)),
        ),
      ]),
    );
  }
}
