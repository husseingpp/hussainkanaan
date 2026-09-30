import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../listen/battery.dart';
import '../reader/reader_screen.dart';
import 'khatmah_plan.dart';
import 'khatmah_providers.dart';

String _date(DateTime d) => '${arabicDigits(d.day)}/${arabicDigits(d.month)}/${arabicDigits(d.year)}';
String _pages(int n) => '${arabicDigits(n)} ${n == 1 ? 'صفحة' : (n == 2 ? 'صفحتان' : 'صفحات')}';

/// A ring that fills with the khatmah's progress.
class ProgressRing extends StatelessWidget {
  const ProgressRing({super.key, required this.value, this.size = 72, this.label});

  final double value;
  final double size;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox.square(
      dimension: size,
      child: Stack(fit: StackFit.expand, children: [
        CircularProgressIndicator(
          value: value.clamp(0, 1),
          strokeWidth: size / 10,
          backgroundColor: scheme.surfaceContainerHighest,
          strokeCap: StrokeCap.round,
        ),
        Center(
          child: Text(label ?? '${arabicDigits((value * 100).floor())}٪',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold)),
        ),
      ]),
    );
  }
}

Future<void> openWird(BuildContext context, WidgetRef ref, Khatmah k) async {
  final math = await ref.read(khatmahMathProvider.future);
  final today = await ref.read(khatmahTodayProvider(k.uuid).future);
  final w = math.wird(k, DateTime.now(), readBeforeToday: today.startOfDay);
  if (w == null || !context.mounted) return;
  // Resume where reading stopped, if that's already inside today's wird.
  final page = math.pages.pagesDone(k.progress) + 1;
  final start = page.clamp(w.fromPage, w.toPage);
  final db = await ref.read(contentDbProvider.future);
  final first = (await db.page(start)).firstAyah ?? const AyahRef(1, 1);
  if (!context.mounted) return;
  await Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => ReaderScreen(ayah: first, page: start, khatmah: k),
  ));
  ref.invalidate(khatmahsProvider);
}

class KhatmahScreen extends ConsumerWidget {
  const KhatmahScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(khatmahsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('الختمة')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('ختمة جديدة'),
        onPressed: () async {
          await showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            useSafeArea: true,
            builder: (_) => const NewKhatmahSheet(),
          );
          ref.invalidate(khatmahsProvider);
        },
      ),
      body: list.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
        data: (all) => all.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('لا ختمة بعد. ابدأ ختمة بعدد صفحات يومي أو بتاريخ تختم فيه، وسيحسب التطبيق وِردك كل يوم.',
                      textAlign: TextAlign.center),
                ),
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
                children: [for (final k in all) KhatmahCard(khatmah: k, detailed: true)],
              ),
      ),
    );
  }
}

/// One plan: ring, today's wird, streak, pace; used on the index and here.
class KhatmahCard extends ConsumerWidget {
  const KhatmahCard({super.key, required this.khatmah, this.detailed = false});

  final Khatmah khatmah;
  final bool detailed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final m = ref.watch(khatmahMathProvider).value;
    final today = ref.watch(khatmahTodayProvider(khatmah.uuid)).value;
    final text = Theme.of(context).textTheme;
    if (m == null || today == null) return const Card(child: SizedBox(height: 96));
    final k = khatmah;
    final now = DateTime.now();
    final wird = m.wird(k, now, readBeforeToday: today.startOfDay);
    final doneToday = wird != null && k.progress >= wird.toAyah;
    final days = streak(today.days, now);
    final expected = m.expectedPages(k, now);
    final done = m.pages.pagesDone(k.progress);
    final finish = m.estimatedFinish(k, now);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            ProgressRing(value: m.fraction(k)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(k.name, style: text.titleMedium),
                const SizedBox(height: 4),
                if (k.isComplete)
                  Text('خُتمت في ${_date(k.completedAt!)}', style: text.bodyMedium)
                else if (wird != null)
                  Text(doneToday
                      ? 'أتممت وِرد اليوم ✓'
                      : 'وِرد اليوم: الصفحات ${arabicDigits(wird.fromPage)}–${arabicDigits(wird.toPage)} (${_pages(wird.pages)})'),
                const SizedBox(height: 2),
                Text(
                  [
                    '${arabicDigits(done)} من ${arabicDigits(m.pages.pageCount)} صفحة',
                    if (days > 0) '🔥 ${arabicDigits(days)} ${days == 1 ? 'يوم' : 'أيام'}',
                  ].join(' · '),
                  style: text.bodySmall,
                ),
              ]),
            ),
          ]),
          if (detailed && !k.isComplete) ...[
            const SizedBox(height: 12),
            if (expected != null)
              Text(
                done >= expected
                    ? 'على الموعد لتختم في ${_date(k.end!)}.'
                    : 'متأخر ${_pages(expected - done)} عن الخطة؛ زِيد وِردك اليومي لتختم في ${_date(k.end!)}.',
                style: text.bodySmall,
              )
            else if (finish != null)
              Text('بهذا الوِرد تختم في ${_date(finish)} تقريبًا.', style: text.bodySmall),
          ],
          const SizedBox(height: 12),
          Row(children: [
            if (!k.isComplete)
              FilledButton.icon(
                icon: const Icon(Icons.menu_book),
                label: Text(doneToday ? 'اقرأ المزيد' : 'اقرأ وِرد اليوم'),
                onPressed: () => openWird(context, ref, k),
              ),
            const Spacer(),
            if (detailed && !k.isComplete)
              IconButton(
                tooltip: k.reminderMinutes == null ? 'تذكير يومي' : 'التذكير الساعة ${timeLabel(k.reminderMinutes!)}',
                icon: Icon(k.reminderMinutes == null ? Icons.notifications_none : Icons.notifications_active),
                onPressed: () => _editReminder(context, ref, k),
              ),
            if (detailed)
              IconButton(
                tooltip: 'حذف',
                icon: const Icon(Icons.delete_outline),
                onPressed: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (_) => AlertDialog(
                      title: Text('حذف «${k.name}»؟'),
                      content: const Text('يُحذف التقدّم وسجلّ الأيام أيضًا.'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
                        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
                      ],
                    ),
                  );
                  if (ok != true) return;
                  await (await ref.read(khatmahRepositoryProvider.future)).delete(k);
                  ref.invalidate(khatmahsProvider);
                  await syncReminders(ref.read);
                },
              ),
          ]),
        ]),
      ),
    );
  }
}

String timeLabel(int minutes) =>
    '${arabicDigits(minutes ~/ 60)}:${arabicDigits(minutes % 60).padLeft(2, arabicDigits(0))}';

Future<void> _editReminder(BuildContext context, WidgetRef ref, Khatmah k) async {
  final current = k.reminderMinutes;
  final picked = await showTimePicker(
    context: context,
    helpText: 'وقت تذكير الوِرد',
    cancelText: current == null ? 'إلغاء' : 'إيقاف التذكير',
    initialTime: TimeOfDay(hour: (current ?? 21 * 60) ~/ 60, minute: (current ?? 0) % 60),
  );
  final repo = await ref.read(khatmahRepositoryProvider.future);
  if (picked == null) {
    if (current != null) await repo.setReminder(k, null);
  } else {
    await requestNotificationPermission();
    await ref.read(reminderSchedulerProvider).requestPermission();
    await repo.setReminder(k, picked.hour * 60 + picked.minute);
  }
  ref.invalidate(khatmahsProvider);
  await syncReminders(ref.read);
}

/// New plan: a daily amount, or a finish date.
class NewKhatmahSheet extends ConsumerStatefulWidget {
  const NewKhatmahSheet({super.key});

  @override
  ConsumerState<NewKhatmahSheet> createState() => _NewKhatmahSheetState();
}

class _NewKhatmahSheetState extends ConsumerState<NewKhatmahSheet> {
  final _name = TextEditingController(text: 'ختمة');
  var _kind = PlanKind.dateRange;
  var _pages = 20;
  var _end = dateOnly(DateTime.now()).add(const Duration(days: 29));

  static const _pagePresets = [1, 2, 4, 5, 10, 20, 40];

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final today = dateOnly(DateTime.now());
    final days = daysBetween(today, _end) + 1;
    final summary = _kind == PlanKind.dailyPages
        ? 'تختم في ${arabicDigits((604 / _pages).ceil())} يومًا تقريبًا.'
        : 'نحو ${_pagesText((604 / math.max(1, days)).ceil())} يوميًا لمدة ${arabicDigits(days)} يومًا.';
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('ختمة جديدة', style: text.titleLarge),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'الاسم', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        SegmentedButton<PlanKind>(
          segments: const [
            ButtonSegment(value: PlanKind.dateRange, label: Text('أختم بتاريخ'), icon: Icon(Icons.event)),
            ButtonSegment(value: PlanKind.dailyPages, label: Text('وِرد يومي ثابت'), icon: Icon(Icons.repeat)),
          ],
          selected: {_kind},
          onSelectionChanged: (s) => setState(() => _kind = s.first),
        ),
        const SizedBox(height: 12),
        if (_kind == PlanKind.dailyPages)
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final p in _pagePresets)
              ChoiceChip(
                label: Text(p == 20 ? 'جزء (٢٠ صفحة)' : _pagesText(p)),
                selected: _pages == p,
                onSelected: (_) => setState(() => _pages = p),
              ),
          ])
        else
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final (label, d) in [('أسبوع', 7), ('شهر (٣٠ يومًا)', 30), ('شهران', 60)])
              ChoiceChip(
                label: Text(label),
                selected: days == d,
                onSelected: (_) => setState(() => _end = today.add(Duration(days: d - 1))),
              ),
            ActionChip(
              avatar: const Icon(Icons.calendar_month, size: 18),
              label: Text('حتى ${_date(_end)}'),
              onPressed: () async {
                final picked = await showDatePicker(
                  context: context,
                  firstDate: today,
                  lastDate: today.add(const Duration(days: 3650)),
                  initialDate: _end,
                );
                if (picked != null) setState(() => _end = dateOnly(picked));
              },
            ),
          ]),
        const SizedBox(height: 12),
        Text(summary, style: text.bodyMedium),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () async {
            final repo = await ref.read(khatmahRepositoryProvider.future);
            await repo.create(
              name: _name.text.trim().isEmpty ? 'ختمة' : _name.text.trim(),
              kind: _kind,
              start: today,
              dailyPages: _kind == PlanKind.dailyPages ? _pages : null,
              end: _kind == PlanKind.dateRange ? _end : null,
            );
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('ابدأ'),
        ),
      ]),
    );
  }
}

String _pagesText(int n) => _pages(n);
