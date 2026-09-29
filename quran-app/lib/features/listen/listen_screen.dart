import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/user_repository.dart';
import 'battery.dart';
import 'downloads_screen.dart';
import 'listen_providers.dart';
import 'listen_session.dart';
import 'sleep_timer.dart';

/// Listen Mode: long, untouched, screen-off recitation (BLUEPRINT §3).
/// A dark, low-information screen with big thumb-reachable controls.
class ListenScreen extends ConsumerWidget {
  const ListenScreen({super.key, this.startAt});

  /// Pre-selects where to start (e.g. from the reader).
  final AyahRef? startAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ThemeData(
      brightness: Brightness.dark,
      colorSchemeSeed: const Color(0xFF1B5E4A),
      useMaterial3: true,
    );
    final ready = ref.watch(listenReadyProvider);
    final snapshot = ref.watch(listenSnapshotProvider).value;
    final active = snapshot != null && snapshot.stopped == null;
    return Theme(
      data: dark,
      child: Scaffold(
        appBar: AppBar(title: const Text('الاستماع')),
        body: ready.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
          data: (handler) => handler == null
              ? const _Unavailable()
              : ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    const BatteryCard(),
                    if (active) _NowPlaying(snapshot: snapshot) else _StartPanel(startAt: startAt, last: snapshot),
                  ],
                ),
        ),
      ),
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('الاستماع متاح حاليًا على أندرويد وiOS، ويأتي إلى سطح المكتب في مرحلة لاحقة.',
              textAlign: TextAlign.center),
        ),
      );
}

String _tierLabel(String tier) => switch (tier) {
      'A' => 'تمييز كلمة بكلمة',
      'B' => 'تمييز الآية',
      _ => 'صوت فقط',
    };

class _StartPanel extends ConsumerStatefulWidget {
  const _StartPanel({this.startAt, this.last});

  final AyahRef? startAt;
  final ListenSnapshot? last;

  @override
  ConsumerState<_StartPanel> createState() => _StartPanelState();
}

class _StartPanelState extends ConsumerState<_StartPanel> {
  late AyahRef _from = widget.startAt ?? const AyahRef(1, 1);
  String? _error;

  Reciter? _selected(List<Reciter> reciters, ListenSettings settings) =>
      reciters.where((r) => r.slug == settings.reciterSlug).firstOrNull ??
      reciters.where((r) => r.slug == 'alafasy').firstOrNull ??
      reciters.firstOrNull;

  Future<void> _start(Reciter r, AyahRef from) async {
    setState(() => _error = null);
    final handler = await ref.read(listenReadyProvider.future);
    final settings = ref.read(listenSettingsProvider).value ?? const ListenSettings();
    try {
      await handler!.session!.setLevel(settings.level);
      await handler.startListening(r, from);
    } on SurahNotDownloaded catch (e) {
      final name = ref.read(surahsProvider).value?.where((s) => s.id == e.surah).firstOrNull?.nameAr ?? '';
      setState(() => _error = 'سورة $name غير مُنزّلة بصوت هذا القارئ. نزّلها أولًا، فالتلاوة لا تُبث من الإنترنت.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final reciters = ref.watch(recitersProvider).value ?? const <Reciter>[];
    final settings = ref.watch(listenSettingsProvider).value ?? const ListenSettings();
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final saved = ref.watch(savedPlaybackProvider).value;
    final reciter = _selected(reciters, settings);
    final text = Theme.of(context).textTheme;
    if (reciter == null) return const Center(child: CircularProgressIndicator());
    final downloaded = ref.watch(downloadedSurahsProvider(reciter.slug)).value ?? const <int>{};
    final surahName = surahs.where((s) => s.id == _from.surah).firstOrNull?.nameAr ?? '';
    final ready = downloaded.contains(_from.surah);
    final savedReciter = reciters.where((r) => r.id == saved?.reciterId).firstOrNull;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (widget.last?.stopped case final reason?)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(switch (reason) {
              StopReason.sleepTimer => 'توقفت التلاوة بانتهاء مؤقت النوم.',
              StopReason.endOfQuran => 'خُتمت التلاوة.',
              StopReason.notDownloaded => 'توقفت التلاوة عند آخر سورة مُنزّلة.',
              StopReason.user => 'أُوقفت التلاوة.',
            }, style: text.bodyMedium),
          ),
        if (saved != null && savedReciter != null && downloaded.contains(saved.ayah.surah))
          Card(
            margin: const EdgeInsets.only(top: 12),
            child: ListTile(
              leading: const Icon(Icons.history),
              title: const Text('متابعة الاستماع'),
              subtitle: Text('سورة ${surahs.where((s) => s.id == saved.ayah.surah).firstOrNull?.nameAr ?? ''}'
                  ' · الآية ${arabicDigits(saved.ayah.ayah)} · ${savedReciter.nameAr ?? savedReciter.name}'),
              onTap: () => _start(savedReciter, saved.ayah),
            ),
          ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.record_voice_over_outlined),
            title: Text(reciter.nameAr ?? reciter.name),
            subtitle: Text('${_tierLabel(reciter.syncTier)} · كاملة ≈ ${formatBytes(reciter.approxBytes)}'),
            trailing: const Icon(Icons.expand_more),
            onTap: () async {
              final picked = await showModalBottomSheet<Reciter>(
                context: context,
                builder: (_) => _ReciterSheet(reciters: reciters, selected: reciter.slug),
              );
              if (picked != null) {
                await ref.read(listenSettingsProvider.notifier).change((s) => s.copyWith(reciterSlug: picked.slug));
              }
            },
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.download_outlined),
            title: const Text('التنزيلات'),
            subtitle: Text('${arabicDigits(downloaded.length)} من ${arabicDigits(surahs.length)} سورة مُنزّلة'),
            trailing: const Icon(Icons.chevron_left),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => DownloadsScreen(reciter: reciter)),
            ),
          ),
        ),
        const SizedBox(height: 16),
        DropdownMenu<int>(
          label: const Text('ابدأ من سورة'),
          expandedInsets: EdgeInsets.zero,
          initialSelection: _from.surah,
          menuHeight: 360,
          dropdownMenuEntries: [
            for (final s in surahs)
              DropdownMenuEntry(
                value: s.id,
                label: '${arabicDigits(s.id)}. ${s.nameAr}',
                trailingIcon: downloaded.contains(s.id) ? const Icon(Icons.check, size: 18) : null,
              ),
          ],
          onSelected: (id) => setState(() => _from = AyahRef(id ?? 1, 1)),
        ),
        if (_from.ayah > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('من الآية ${arabicDigits(_from.ayah)}', style: text.bodySmall),
          ),
        const SizedBox(height: 16),
        SizedBox(
          height: 64,
          child: FilledButton.icon(
            icon: Icon(ready ? Icons.play_arrow : Icons.download),
            label: Text(ready ? 'استمع من سورة $surahName حتى نهاية القرآن' : 'نزّل سورة $surahName أولًا'),
            onPressed: ready
                ? () => _start(reciter, _from)
                : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => DownloadsScreen(reciter: reciter)),
                    ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
      ]),
    );
  }
}

class _ReciterSheet extends ConsumerWidget {
  const _ReciterSheet({required this.reciters, required this.selected});

  final List<Reciter> reciters;
  final String selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: ListView(shrinkWrap: true, children: [
        for (final r in reciters)
          ListTile(
            selected: r.slug == selected,
            title: Text(r.nameAr ?? r.name),
            subtitle: Text('${_tierLabel(r.syncTier)} · ≈ ${formatBytes(r.approxBytes)}'),
            trailing: r.slug == selected ? const Icon(Icons.check) : null,
            onTap: () => Navigator.of(context).pop(r),
          ),
      ]),
    );
  }
}

class _NowPlaying extends ConsumerWidget {
  const _NowPlaying({required this.snapshot});

  final ListenSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final level = ref.watch(listenSettingsProvider).value?.level ?? 1.0;
    final session = ref.watch(listenReadyProvider).value?.session;
    final text = Theme.of(context).textTheme;
    final surah = surahs.where((s) => s.id == snapshot.item.surah).firstOrNull;
    final ayah = snapshot.item.isBismillah ? 'البسملة' : 'الآية ${arabicDigits(snapshot.item.ayah)}';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 32),
        Text('سورة ${surah?.nameAr ?? ''}', textAlign: TextAlign.center, style: text.displaySmall),
        const SizedBox(height: 8),
        Text(ayah, textAlign: TextAlign.center, style: text.titleLarge),
        const SizedBox(height: 4),
        Text(snapshot.reciter.nameAr ?? snapshot.reciter.name, textAlign: TextAlign.center, style: text.bodyMedium),
        const SizedBox(height: 32),
        Center(child: _SleepChip(snapshot: snapshot)),
        const SizedBox(height: 24),
        Row(children: [
          const Icon(Icons.volume_down),
          Expanded(
            child: Slider(
              value: level,
              label: 'مستوى الصوت داخل التطبيق',
              onChanged: (v) {
                ref.read(listenSettingsProvider.notifier).change((s) => s.copyWith(level: v));
                session?.setLevel(v);
              },
            ),
          ),
          const Icon(Icons.volume_up),
        ]),
        Text('لخفض الصوت دون أدنى مستوى في الهاتف، في الغرف الهادئة.',
            textAlign: TextAlign.center, style: text.bodySmall),
        const SizedBox(height: 32),
        // RTL row: the previous ayah sits on the right, the next on the left.
        Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          IconButton.filledTonal(
            iconSize: 36,
            tooltip: 'الآية السابقة',
            icon: const Icon(Icons.skip_next),
            onPressed: session?.previous,
          ),
          IconButton.filled(
            iconSize: 56,
            tooltip: snapshot.playing ? 'إيقاف مؤقت' : 'تشغيل',
            icon: Icon(snapshot.playing ? Icons.pause : Icons.play_arrow),
            onPressed: snapshot.playing ? session?.pause : session?.resume,
          ),
          IconButton.filledTonal(
            iconSize: 36,
            tooltip: 'الآية التالية',
            icon: const Icon(Icons.skip_previous),
            onPressed: session?.next,
          ),
        ]),
        const SizedBox(height: 24),
        TextButton.icon(
          icon: const Icon(Icons.stop),
          label: const Text('إنهاء التلاوة'),
          onPressed: session?.stop,
        ),
      ]),
    );
  }
}

class _SleepChip extends ConsumerWidget {
  const _SleepChip({required this.snapshot});

  final ListenSnapshot snapshot;

  static const _minutes = [15, 30, 45, 60, 90, 120];

  String _label(Map<int, String> names) => switch (snapshot.sleep) {
        SleepOff() => 'مؤقت النوم: متوقف',
        SleepAfter() => 'يتوقف بعد ${formatDuration(snapshot.sleepRemaining ?? Duration.zero)}',
        SleepEndOfSurah() || SleepAfterSurahs() => 'يتوقف بعد سورة ${names[snapshot.stopAfterSurah] ?? ''}',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final session = ref.watch(listenReadyProvider).value?.session;
    final names = {for (final s in surahs) s.id: s.nameAr};
    return ActionChip(
      avatar: const Icon(Icons.bedtime_outlined),
      label: Text(_label(names)),
      onPressed: () async {
        final choice = await showModalBottomSheet<SleepTimer>(
          context: context,
          builder: (_) => SafeArea(
            child: ListView(shrinkWrap: true, children: [
              for (final m in _minutes)
                ListTile(
                  title: Text('بعد ${formatDuration(Duration(minutes: m))}'),
                  onTap: () => Navigator.pop(context, SleepAfter(Duration(minutes: m))),
                ),
              ListTile(
                title: const Text('عند نهاية السورة الحالية'),
                onTap: () => Navigator.pop(context, const SleepEndOfSurah()),
              ),
              for (final n in [2, 3, 5])
                ListTile(
                  title: Text('بعد ${arabicDigits(n)} سور (مع الحالية)'),
                  onTap: () => Navigator.pop(context, SleepAfterSurahs(n)),
                ),
              ListTile(
                title: const Text('بلا مؤقت'),
                onTap: () => Navigator.pop(context, const SleepOff()),
              ),
            ]),
          ),
        );
        if (choice != null) await session?.setSleep(choice);
      },
    );
  }
}
