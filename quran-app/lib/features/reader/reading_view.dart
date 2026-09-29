import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/reader_settings.dart';
import 'quran_text.dart';

/// One surah as flowing, resizable Uthmani text (the view Follow Mode builds on).
class ReadingView extends ConsumerStatefulWidget {
  const ReadingView({
    super.key,
    required this.surah,
    required this.initialAyah,
    required this.settings,
    required this.onVisibleAyah,
    required this.onChangeSurah,
  });

  final Surah surah;
  final int initialAyah;
  final ReaderSettings settings;
  final ValueChanged<Ayah> onVisibleAyah;
  final ValueChanged<int> onChangeSurah;

  @override
  ConsumerState<ReadingView> createState() => _ReadingViewState();
}

class _ReadingViewState extends ConsumerState<ReadingView> {
  final _positions = ItemPositionsListener.create();
  List<Ayah> _ayahs = const [];
  int? _lastReported;

  @override
  void initState() {
    super.initState();
    _positions.itemPositions.addListener(_report);
  }

  @override
  void dispose() {
    _positions.itemPositions.removeListener(_report);
    super.dispose();
  }

  /// Reports the first ayah whose top is on screen (index 0 is the header).
  void _report() {
    final visible = _positions.itemPositions.value.where((p) => p.itemTrailingEdge > 0.05);
    if (visible.isEmpty || _ayahs.isEmpty) return;
    final top = visible.map((p) => p.index).reduce((a, b) => a < b ? a : b);
    final ayahIndex = (top - 1).clamp(0, _ayahs.length - 1);
    if (ayahIndex == _lastReported) return;
    _lastReported = ayahIndex;
    widget.onVisibleAyah(_ayahs[ayahIndex]);
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(surahAyahsProvider((surah: widget.surah.id, translation: widget.settings.showTranslation)));
    return data.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
      data: (ayahs) {
        _ayahs = ayahs;
        final size = 26 * widget.settings.fontScale;
        return ScrollablePositionedList.builder(
          key: PageStorageKey('reading-${widget.surah.id}'),
          itemCount: ayahs.length + 2,
          // Item 0 is the surah header; ayah n is item n.
          initialScrollIndex: widget.initialAyah <= 1 ? 0 : widget.initialAyah.clamp(1, ayahs.length),
          itemPositionsListener: _positions,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          itemBuilder: (context, i) {
            if (i == 0) return _Header(surah: widget.surah, size: size);
            if (i == ayahs.length + 1) {
              return _SurahNav(surah: widget.surah.id, onChange: widget.onChangeSurah);
            }
            return _AyahTile(ayah: ayahs[i - 1], size: size, showTranslation: widget.settings.showTranslation);
          },
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.surah, required this.size});

  final Surah surah;
  final double size;

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
          child: Text('سُورَةُ ${surah.nameAr}', style: style.copyWith(color: scheme.onPrimaryContainer, height: 1.6)),
        ),
        // Al-Fatiha's bismillah is its first ayah; At-Tawbah has none.
        if (surah.id != 1 && surah.id != 9)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(bismillah, style: style.copyWith(height: 1.8)),
          ),
      ]),
    );
  }
}

class _AyahTile extends StatelessWidget {
  const _AyahTile({required this.ayah, required this.size, required this.showTranslation});

  final Ayah ayah;
  final double size;
  final bool showTranslation;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final style = quranStyle(context, size).copyWith(height: 2.1);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.4)))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text.rich(
            TextSpan(children: [
              TextSpan(text: ayah.text),
              if (ayah.sajda != null)
                TextSpan(
                  text: ' ۩',
                  style: TextStyle(color: ayah.sajda == 'obligatory' ? scheme.error : scheme.tertiary),
                ),
              TextSpan(text: ' ${ayahEndMark(ayah.number)}', style: TextStyle(color: scheme.primary)),
            ]),
            style: style,
            textAlign: TextAlign.justify,
            textDirection: TextDirection.rtl,
          ),
          if (ayah.sajda != null)
            Text(
              ayah.sajda == 'obligatory' ? 'سجدة واجبة' : 'سجدة مستحبة',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: ayah.sajda == 'obligatory' ? scheme.error : scheme.tertiary,
                  ),
            ),
          if (showTranslation && ayah.translation != null)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 4),
              child: Text(
                '${ayah.number}. ${ayah.translation}',
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.left,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class _SurahNav extends StatelessWidget {
  const _SurahNav({required this.surah, required this.onChange});

  final int surah;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (surah > 1)
            TextButton.icon(
              onPressed: () => onChange(surah - 1),
              icon: const Icon(Icons.arrow_forward),
              label: const Text('السورة السابقة'),
            )
          else
            const SizedBox.shrink(),
          if (surah < 114)
            FilledButton.tonalIcon(
              onPressed: () => onChange(surah + 1),
              icon: const Icon(Icons.arrow_back),
              label: const Text('السورة التالية'),
            ),
        ],
      ),
    );
  }
}
