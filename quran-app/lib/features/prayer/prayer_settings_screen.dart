import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import 'prayer_calc.dart';
import 'prayer_providers.dart';
import 'prayer_settings.dart';

String _deg(double d) => '${arabicNumerals(d.toStringAsFixed(d == d.roundToDouble() ? 0 : 1))}°';

String _signed(int n) => n == 0 ? '٠' : '${n > 0 ? '+' : '−'}${arabicDigits(n.abs())}';

/// Method, Maghrib rule, Asr, high latitudes, per-prayer offsets and the
/// Hijri offset: everything the times depend on is here and visible.
class PrayerSettingsScreen extends ConsumerWidget {
  const PrayerSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(prayerSettingsProvider).value;
    final text = Theme.of(context).textTheme;
    if (s == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final notifier = ref.read(prayerSettingsProvider.notifier);
    final params = s.params;
    final maghrib = MaghribRule.parse(s.maghribRule);

    Widget section(String title) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
          child: Text(title, style: text.titleSmall?.copyWith(color: Theme.of(context).colorScheme.primary)),
        );

    Widget angle(String label, double value, double min, double max, ValueChanged<double> onChanged) => ListTile(
          title: Text('$label: ${_deg(value)}'),
          subtitle: Slider(
            value: value.clamp(min, max),
            min: min,
            max: max,
            divisions: ((max - min) * 2).round(),
            label: _deg(value),
            onChanged: onChanged,
          ),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('طريقة الحساب')),
      body: ListView(children: [
        section('الطريقة'),
        RadioGroup<String>(
          groupValue: s.methodId,
          onChanged: (id) => notifier.change((x) => x.withMethod(CalcMethod.byId(id!))),
          child: Column(children: [
            for (final m in CalcMethod.all)
              RadioListTile<String>(
                value: m.id,
                title: Text(m.nameAr),
                subtitle: Text(
                  'الفجر ${_deg(m.fajr)} · العشاء ${switch (m.isha) {
                    IshaAngle(:final degrees) => _deg(degrees),
                    IshaMinutes(:final minutes) => '${arabicDigits(minutes)} دقيقة بعد المغرب',
                  }} · المغرب ${switch (m.maghrib) {
                    MaghribAngle(:final degrees) => '${_deg(degrees)} تحت الأفق',
                    MaghribMinutes(minutes: 0) => 'عند الغروب',
                    MaghribMinutes(:final minutes) => '${arabicDigits(minutes)} دقيقة بعد الغروب',
                  }}',
                ),
              ),
          ]),
        ),
        section('الزوايا'),
        angle('الفجر', params.fajrAngle, 10, 22, (v) => notifier.change((x) => x.copyWith(fajrAngle: v))),
        if (params.isha case IshaAngle(:final degrees))
          angle('العشاء', degrees, 10, 22, (v) => notifier.change((x) => x.copyWith(ishaAngle: v))),
        section('المغرب'),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('في الفقه الجعفري يدخل المغرب بذهاب الحمرة المشرقية، لا بمجرد الغروب. '
              'اختر زاوية انخفاض الشمس، أو عددًا من الدقائق بعد الغروب.'),
        ),
        RadioGroup<bool>(
          groupValue: maghrib is MaghribAngle,
          onChanged: (isAngle) => notifier.change((x) => x.copyWith(maghribRule: isAngle! ? 'angle:4.0' : 'minutes:17')),
          child: const Column(children: [
            RadioListTile<bool>(value: true, title: Text('زاوية تحت الأفق')),
            RadioListTile<bool>(value: false, title: Text('دقائق بعد الغروب')),
          ]),
        ),
        switch (maghrib) {
          MaghribAngle(:final degrees) =>
            angle('زاوية المغرب', degrees, 0, 8, (v) => notifier.change((x) => x.copyWith(maghribRule: 'angle:$v'))),
          MaghribMinutes(:final minutes) => ListTile(
              title: Text('المغرب بعد الغروب بـ ${arabicDigits(minutes)} دقيقة'),
              subtitle: Slider(
                value: minutes.toDouble().clamp(0, 30),
                min: 0,
                max: 30,
                divisions: 30,
                onChanged: (v) => notifier.change((x) => x.copyWith(maghribRule: 'minutes:${v.round()}')),
              ),
            ),
        },
        section('العصر'),
        RadioGroup<int>(
          groupValue: s.asrFactor,
          onChanged: (f) => notifier.change((x) => x.copyWith(asrFactor: f)),
          child: const Column(children: [
            RadioListTile<int>(value: 1, title: Text('ظل الشيء مثله (الجعفري والجمهور)')),
            RadioListTile<int>(value: 2, title: Text('ظل الشيء مثلاه (الحنفي)')),
          ]),
        ),
        section('خطوط العرض العالية'),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('حيث لا تنخفض الشمس بما يكفي صيفًا (أوروبا الشمالية وكندا) يُقدّر الفجر والعشاء بجزء من الليل.'),
        ),
        RadioGroup<HighLatitudeRule>(
          groupValue: s.highLatitude,
          onChanged: (r) => notifier.change((x) => x.copyWith(highLatitude: r)),
          child: const Column(children: [
            RadioListTile(value: HighLatitudeRule.angleBased, title: Text('بحسب الزاوية')),
            RadioListTile(value: HighLatitudeRule.oneSeventh, title: Text('سُبع الليل')),
            RadioListTile(value: HighLatitudeRule.middleOfNight, title: Text('منتصف الليل')),
          ]),
        ),
        section('تعديل يدوي بالدقائق'),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('لمطابقة تقويم مسجدك المحلي.'),
        ),
        for (final p in [Prayer.fajr, Prayer.sunrise, Prayer.dhuhr, Prayer.asr, Prayer.maghrib, Prayer.isha])
          ListTile(
            title: Text(p.nameAr),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                icon: const Icon(Icons.remove),
                onPressed: () => notifier.change((x) => x.copyWith(offsets: {...x.offsets, p: (x.offsets[p] ?? 0) - 1})),
              ),
              SizedBox(width: 40, child: Text(_signed(s.offsets[p] ?? 0), textAlign: TextAlign.center)),
              IconButton(
                icon: const Icon(Icons.add),
                onPressed: () => notifier.change((x) => x.copyWith(offsets: {...x.offsets, p: (x.offsets[p] ?? 0) + 1})),
              ),
            ]),
          ),
        section('التاريخ الهجري'),
        HijriOffsetTile(settings: s),
        const SizedBox(height: 24),
      ]),
    );
  }
}

/// −2…+2 days on the computed Hijri date (shared with the calendar).
class HijriOffsetTile extends ConsumerWidget {
  const HijriOffsetTile({super.key, required this.settings});

  final PrayerSettings settings;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ListTile(
        title: const Text('تعديل التاريخ الهجري'),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('بحسب رؤية الهلال في بلدك أو رأي مرجعك'),
          const SizedBox(height: 8),
          SegmentedButton<int>(
            showSelectedIcon: false,
            segments: [for (final d in const [-2, -1, 0, 1, 2]) ButtonSegment(value: d, label: Text(_signed(d)))],
            selected: {settings.hijriOffset},
            onSelectionChanged: (v) =>
                ref.read(prayerSettingsProvider.notifier).change((x) => x.copyWith(hijriOffset: v.first)),
          ),
        ]),
      );
}
