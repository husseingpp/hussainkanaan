import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/arabic_digits.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/reader_settings.dart';
import '../listen/battery.dart';
import '../listen/downloads_screen.dart';
import '../listen/listen_providers.dart';
import '../listen/listen_queue.dart';
import '../listen/listen_screen.dart';
import '../listen/listen_session.dart';
import '../reader/quran_text.dart';
import 'follow_text.dart';
import 'follow_tracker.dart';

/// Follow Mode: audio and text together, the recited word lit, the view
/// scrolling along (BLUEPRINT §4). The screen stays on while this is open and
/// only then; leaving it stops the recitation.
class FollowScreen extends ConsumerStatefulWidget {
  const FollowScreen({super.key, required this.start});

  final AyahRef start;

  @override
  ConsumerState<FollowScreen> createState() => _FollowScreenState();
}

class _FollowScreenState extends ConsumerState<FollowScreen> {
  late int _surah = widget.start.surah;
  final _position = ValueNotifier<FollowPosition?>(null);
  final _scroll = ItemScrollController();
  var _autoScroll = true;
  var _started = false;
  var _plan = RepeatPlan.none;
  FollowTracker? _tracker;
  ListenSession? _session;
  StreamSubscription<Duration>? _positions;
  StreamSubscription<ListenSnapshot>? _changes;
  String? _error;

  @override
  void initState() {
    super.initState();
    _setWakelock(true);
  }

  @override
  void dispose() {
    _positions?.cancel();
    _changes?.cancel();
    _session?.stop();
    _setWakelock(false);
    _position.dispose();
    super.dispose();
  }

  /// Screen on while Follow Mode is open, released the moment it closes;
  /// leaking it would be a battery bug (BLUEPRINT §4).
  static Future<void> _setWakelock(bool on) async {
    try {
      await WakelockPlus.toggle(enable: on);
    } catch (_) {
      // No wakelock plugin (tests, some desktops): nothing to hold or release.
    }
  }

  Reciter? _reciter() {
    final reciters = ref.read(recitersProvider).value ?? const <Reciter>[];
    final slug = ref.read(listenSettingsProvider).value?.reciterSlug;
    return reciters.where((r) => r.slug == slug).firstOrNull ??
        reciters.where((r) => r.slug == 'alafasy').firstOrNull ??
        reciters.firstOrNull;
  }

  Future<void> _start(AyahRef from) async {
    final handler = await ref.read(listenReadyProvider.future);
    final reciter = _reciter();
    if (handler == null || reciter == null) return;
    final session = handler.session!;
    _session = session;
    await _positions?.cancel();
    await _changes?.cancel();
    _changes = session.changes.listen(_onSnapshot);
    _positions = session.positionStream.listen((_) => _update());
    await requestNotificationPermission();
    try {
      final level = ref.read(listenSettingsProvider).value?.level ?? 1.0;
      await session.setLevel(level);
      await handler.startListening(reciter, from, mode: SessionMode.follow, plan: _plan);
      setState(() {
        _started = true;
        _error = null;
      });
    } on SurahNotDownloaded {
      setState(() => _error = 'notDownloaded');
    }
  }

  Future<void> _onSnapshot(ListenSnapshot s) async {
    if (s.item.surah != _surah) {
      // Recitation moved into the next surah: follow it there.
      setState(() {
        _surah = s.item.surah;
        _tracker = null;
        _autoScroll = true;
      });
    }
    _update();
  }

  void _update() {
    final item = _session?.current;
    final tracker = _tracker;
    if (item == null || tracker == null || item.surah != _surah) return;
    final next = item.isBismillah ? const FollowPosition(0, null) : tracker.locate(item.ayah, _session!.position);
    if (next.ayah != _position.value?.ayah && _autoScroll && _scroll.isAttached) {
      // Current ayah in the upper part of the screen; item 0 is the header.
      _scroll.scrollTo(
        index: next.ayah,
        alignment: 0.15,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOut,
      );
    }
    _position.value = next;
  }

  void _returnToPlayback() {
    setState(() => _autoScroll = true);
    final ayah = _position.value?.ayah;
    if (ayah != null && _scroll.isAttached) _scroll.jumpTo(index: ayah, alignment: 0.15);
  }

  Future<void> _editRepeat(int surahAyahs) async {
    final here = _position.value?.ayah ?? widget.start.ayah;
    final plan = await showModalBottomSheet<RepeatPlan>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RepeatSheet(current: _plan, surah: _surah, fromAyah: here < 1 ? 1 : here, ayahCount: surahAyahs),
    );
    if (plan == null) return;
    _plan = plan;
    final from = plan.range != null ? AyahRef(_surah, plan.range!.from) : AyahRef(_surah, here < 1 ? 1 : here);
    await _start(from);
  }

  @override
  Widget build(BuildContext context) {
    final handler = ref.watch(listenReadyProvider);
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final settings = ref.watch(settingsProvider).value ?? const ReaderSettings();
    ref.watch(recitersProvider);
    ref.watch(listenSettingsProvider);
    final reciter = _reciter();
    final surah = surahs.where((s) => s.id == _surah).firstOrNull;
    final words = ref.watch(surahWordsProvider(_surah)).value;
    final timings = reciter == null ? null : ref.watch(surahTimingsProvider((reciter: reciter.id, surah: _surah))).value;
    if (timings != null && _tracker == null) _tracker = FollowTracker(timings);
    final snapshot = ref.watch(listenSnapshotProvider).value;
    final playing = snapshot != null && snapshot.stopped == null && snapshot.playing && snapshot.mode == SessionMode.follow;

    if (!_started && _error == null && handler.value != null && reciter != null && surah != null && words != null && timings != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_started && _error == null) _start(widget.start);
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(surah == null ? '' : 'سورة ${surah.nameAr}'),
        actions: [
          IconButton(
            tooltip: 'القارئ',
            icon: const Icon(Icons.record_voice_over_outlined),
            onPressed: () async {
              final reciters = ref.read(recitersProvider).value ?? const <Reciter>[];
              final picked = await showModalBottomSheet<Reciter>(
                context: context,
                builder: (_) => ReciterSheet(reciters: reciters, selected: reciter?.slug ?? ''),
              );
              if (picked == null) return;
              await ref.read(listenSettingsProvider.notifier).change((s) => s.copyWith(reciterSlug: picked.slug));
              setState(() => _tracker = null);
              await _start(AyahRef(_surah, _position.value?.ayah ?? widget.start.ayah));
            },
          ),
          IconButton(
            tooltip: 'التكرار',
            icon: Badge(
              isLabelVisible: !_plan.isNone,
              label: Text(arabicDigits(_plan.ayahTimes)),
              child: const Icon(Icons.repeat),
            ),
            onPressed: surah == null ? null : () => _editRepeat(surah.ayahCount),
          ),
        ],
      ),
      body: SafeArea(
        child: handler.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
          data: (h) {
            if (h == null) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('متابعة التلاوة متاحة حاليًا على أندرويد وiOS.', textAlign: TextAlign.center),
                ),
              );
            }
            if (_error == 'notDownloaded' && reciter != null && surah != null) {
              return _NotDownloaded(reciter: reciter, surah: surah, onReady: () => _start(widget.start));
            }
            if (words == null || surah == null) return const Center(child: CircularProgressIndicator());
            final size = 26 * settings.fontScale;
            return Stack(children: [
              Column(children: [
                if (reciter != null && reciter.syncTier != 'A')
                  MaterialBanner(
                    content: Text('${reciter.nameAr ?? reciter.name}: ${tierLabel(reciter.syncTier)} فقط. '
                        'لتمييز كل كلمة اختر قارئًا آخر.'),
                    actions: const [SizedBox.shrink()],
                  ),
                Expanded(
                  child: NotificationListener<ScrollStartNotification>(
                    // A finger on the list suspends auto-scroll until asked back.
                    onNotification: (n) {
                      if (n.dragDetails != null && _autoScroll) setState(() => _autoScroll = false);
                      return false;
                    },
                    child: ScrollablePositionedList.builder(
                      key: ValueKey('follow-$_surah'),
                      itemScrollController: _scroll,
                      initialScrollIndex: _surah == widget.start.surah && widget.start.ayah > 1 ? widget.start.ayah : 0,
                      itemCount: surah.ayahCount + 1,
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 120),
                      itemBuilder: (context, i) => i == 0
                          ? _Header(surah: surah, size: size, position: _position)
                          : FollowAyahText(
                              ayah: i,
                              words: words[i] ?? const [],
                              position: _position,
                              fontSize: size,
                              onTap: () => _session?.jumpToAyah(i),
                            ),
                    ),
                  ),
                ),
                _Controls(playing: playing, session: _session),
              ]),
              if (!_autoScroll)
                Positioned(
                  bottom: 96,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: FilledButton.icon(
                      icon: const Icon(Icons.my_location),
                      label: const Text('العودة إلى موضع التلاوة'),
                      onPressed: _returnToPlayback,
                    ),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.surah, required this.size, required this.position});

  final Surah surah;
  final double size;
  final ValueListenable<FollowPosition?> position;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final style = quranStyle(context, size);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: scheme.primaryContainer.withValues(alpha: 0.5),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.6)),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Text('سُورَةُ ${surah.nameAr}', style: style.copyWith(height: 1.6, color: scheme.onPrimaryContainer)),
        ),
        if (opensWithBismillah(surah.id))
          ValueListenableBuilder(
            valueListenable: position,
            builder: (context, p, _) => Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: p?.ayah == 0 ? scheme.primaryContainer.withValues(alpha: 0.45) : null,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(bismillah, style: style.copyWith(height: 1.8)),
            ),
          ),
      ]),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({required this.playing, required this.session});

  final bool playing;
  final ListenSession? session;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        // RTL row: previous ayah on the right, next on the left.
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          IconButton(tooltip: 'الآية السابقة', icon: const Icon(Icons.skip_next), onPressed: session?.previous),
          IconButton.filled(
            iconSize: 36,
            tooltip: playing ? 'إيقاف مؤقت' : 'تشغيل',
            icon: Icon(playing ? Icons.pause : Icons.play_arrow),
            onPressed: playing ? session?.pause : session?.resume,
          ),
          IconButton(tooltip: 'الآية التالية', icon: const Icon(Icons.skip_previous), onPressed: session?.next),
        ]),
      ),
    );
  }
}

class _NotDownloaded extends ConsumerWidget {
  const _NotDownloaded({required this.reciter, required this.surah, required this.onReady});

  final Reciter reciter;
  final Surah surah;
  final VoidCallback onReady;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = ref.watch(surahSizesProvider(reciter.id)).value?[surah.id];
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.download_outlined, size: 48),
          const SizedBox(height: 12),
          Text('سورة ${surah.nameAr} غير مُنزّلة بصوت ${reciter.nameAr ?? reciter.name}.', textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => DownloadsScreen(reciter: reciter)),
              );
              ref.invalidate(downloadedSurahsProvider(reciter.slug));
              onReady();
            },
            child: Text(size == null ? 'إلى التنزيلات' : 'إلى التنزيلات (السورة ≈ ${formatBytes(size)})'),
          ),
        ]),
      ),
    );
  }
}

class _RepeatSheet extends StatefulWidget {
  const _RepeatSheet({required this.current, required this.surah, required this.fromAyah, required this.ayahCount});

  final RepeatPlan current;
  final int surah;
  final int fromAyah;
  final int ayahCount;

  @override
  State<_RepeatSheet> createState() => _RepeatSheetState();
}

class _RepeatSheetState extends State<_RepeatSheet> {
  static const _counts = [1, 2, 3, 5, 10];
  late int _ayahTimes = widget.current.ayahTimes;
  late bool _useRange = widget.current.range != null;
  late int _from = widget.current.range?.from ?? widget.fromAyah;
  late int _to = widget.current.range?.to ?? widget.fromAyah;
  late int _rangeTimes = widget.current.rangeTimes;

  Widget _choice(String title, int value, ValueChanged<int> onChanged) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title),
          const SizedBox(height: 6),
          Wrap(spacing: 8, children: [
            for (final c in _counts)
              ChoiceChip(label: Text('×${arabicDigits(c)}'), selected: value == c, onSelected: (_) => onChanged(c)),
          ]),
        ],
      );

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('التكرار للحفظ', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _choice('تكرار كل آية', _ayahTimes, (v) => setState(() => _ayahTimes = v)),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('تكرار مقطع'),
            value: _useRange,
            onChanged: (v) => setState(() => _useRange = v),
          ),
          if (_useRange) ...[
            Row(children: [
              const Text('من الآية '),
              DropdownButton<int>(
                value: _from,
                items: [for (var a = 1; a <= widget.ayahCount; a++) DropdownMenuItem(value: a, child: Text(arabicDigits(a)))],
                onChanged: (v) => setState(() {
                  _from = v!;
                  if (_to < _from) _to = _from;
                }),
              ),
              const Text('  إلى '),
              DropdownButton<int>(
                value: _to,
                items: [for (var a = _from; a <= widget.ayahCount; a++) DropdownMenuItem(value: a, child: Text(arabicDigits(a)))],
                onChanged: (v) => setState(() => _to = v!),
              ),
            ]),
            _choice('عدد مرات المقطع', _rangeTimes, (v) => setState(() => _rangeTimes = v)),
          ],
          const SizedBox(height: 16),
          Row(children: [
            TextButton(
              onPressed: () => Navigator.pop(context, RepeatPlan.none),
              child: const Text('بلا تكرار'),
            ),
            const Spacer(),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                RepeatPlan(
                  ayahTimes: _ayahTimes,
                  range: _useRange ? (surah: widget.surah, from: _from, to: _to) : null,
                  rangeTimes: _useRange ? _rangeTimes : 1,
                ),
              ),
              child: const Text('تطبيق'),
            ),
          ]),
        ]),
      ),
    );
  }
}
