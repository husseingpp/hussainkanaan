import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import 'justified_line.dart';
import 'quran_text.dart';

/// One page of the v1 Madani mus'haf, line for line.
///
/// Drawn with the page's own QCF v1 font (the exact printed shapes) once the
/// font pack is downloaded; until then with the bundled Uthmani font, which
/// keeps the printed line breaks but not the printed letterforms.
class MushafPageView extends ConsumerWidget {
  const MushafPageView({super.key, required this.page});

  final int page;

  static const lines = 15;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(mushafPageProvider(page));
    final qcfFamily = ref.watch(mushafFontProvider(page)).value;
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final theme = Theme.of(context);
    return data.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
      data: (p) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Column(
          children: [
            Expanded(
              child: LayoutBuilder(builder: (context, box) {
                final lineHeight = box.maxHeight / lines;
                final scaler = MediaQuery.textScalerOf(context);
                // Titles and the bismillah stand alone, so they keep full size.
                final titles = quranStyle(context, lineHeight * 0.52);
                var base = titles;
                var glyphs = qcfFamily == null ? null : base.copyWith(fontFamily: qcfFamily, fontSize: lineHeight * 0.72);
                // One letter size for the whole page: shrink everything by
                // what the tightest line needs, so short lines don't balloon.
                final ayatLines = p.lines.where((l) => l.kind == PageLineKind.ayat && l.glyphs.isNotEmpty);
                var scale = 1.0;
                for (final line in ayatLines) {
                  final useQcf = glyphs != null && line.glyphs.every((g) => g.qcf != null);
                  final words = [for (final g in line.glyphs) useQcf ? g.qcf! : (g.isAyahEnd ? ayahEndMark(g.ayah.ayah) : g.text)];
                  final style = useQcf ? glyphs : base;
                  scale = math.min(scale, JustifiedLine.fitScale(words, List.filled(words.length, style), box.maxWidth, scaler));
                }
                base = base.copyWith(fontSize: base.fontSize! * scale);
                glyphs = glyphs?.copyWith(fontSize: glyphs.fontSize! * scale);
                final accent = base.copyWith(color: theme.colorScheme.primary);
                final rows = [
                  for (final line in p.lines)
                    SizedBox(
                      height: lineHeight,
                      child: Center(child: _line(context, line, surahs, titles, base, accent, glyphs)),
                    ),
                ];
                // The two opening pages are short and centred on the page.
                return page <= 2
                    ? Column(mainAxisAlignment: MainAxisAlignment.center, children: rows)
                    : Column(children: rows);
              }),
            ),
            Text(arabicDigits(page), style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Widget _line(
    BuildContext context,
    PageLine line,
    List<Surah> surahs,
    TextStyle titles,
    TextStyle base,
    TextStyle accent,
    TextStyle? glyphs,
  ) {
    switch (line.kind) {
      case PageLineKind.surahName:
        final name = surahs.where((s) => s.id == line.surah).map((s) => s.nameAr).firstOrNull ?? '';
        return _SurahTitle(name: name, style: titles);
      case PageLineKind.bismillah:
        return Text(bismillah, style: titles, textDirection: TextDirection.rtl);
      case PageLineKind.ayat:
        if (glyphs != null && line.glyphs.every((g) => g.qcf != null)) {
          return JustifiedLine(
            words: [for (final g in line.glyphs) g.qcf!],
            style: glyphs,
            styles: [for (final g in line.glyphs) g.isAyahEnd ? glyphs.copyWith(color: accent.color) : null],
          );
        }
        return JustifiedLine(
          words: [for (final g in line.glyphs) g.isAyahEnd ? ayahEndMark(g.ayah.ayah) : g.text],
          style: base,
          styles: [for (final g in line.glyphs) g.isAyahEnd ? accent : null],
        );
    }
  }
}

class _SurahTitle extends StatelessWidget {
  const _SurahTitle({required this.name, required this.style});

  final String name;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 2),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.5),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(6),
      ),
      alignment: Alignment.center,
      child: FittedBox(
        child: Text('سُورَةُ $name', style: style.copyWith(color: scheme.onPrimaryContainer)),
      ),
    );
  }
}
