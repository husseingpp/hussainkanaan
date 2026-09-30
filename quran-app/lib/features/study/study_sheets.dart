import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../reader/quran_text.dart';
import '../reader/reader_screen.dart';

final ayahStudyProvider = FutureProvider.family<(Ayah?, List<WordInfo>), AyahRef>((ref, a) async {
  final db = await ref.watch(contentDbProvider.future);
  return (await db.ayah(a), await db.wordsOf(a));
});

final rootOccurrencesProvider = FutureProvider.family<List<WordInfo>, String>(
  (ref, root) async => (await ref.watch(contentDbProvider.future)).rootOccurrences(root),
);

String _surahName(WidgetRef ref, int id) =>
    ref.read(surahsProvider).value?.where((s) => s.id == id).firstOrNull?.nameAr ?? '';

void showAyahStudy(BuildContext context, AyahRef ref) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.95,
        builder: (context, scroll) => AyahStudySheet(ayah: ref, scroll: scroll),
      ),
    );

void showWordStudy(BuildContext context, AyahRef ref, int position) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        maxChildSize: 0.95,
        builder: (context, scroll) => WordStudySheet(ayah: ref, position: position, scroll: scroll),
      ),
    );

/// An ayah with its translation and word-by-word meanings; tap a word to
/// study it (BLUEPRINT §10, Phase 4).
class AyahStudySheet extends ConsumerWidget {
  const AyahStudySheet({super.key, required this.ayah, this.scroll});

  final AyahRef ayah;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(ayahStudyProvider(ayah));
    final scheme = Theme.of(context).colorScheme;
    return data.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
      data: (d) {
        final (a, words) = d;
        return ListView(controller: scroll, padding: const EdgeInsets.all(16), children: [
          Text('سورة ${_surahName(ref, ayah.surah)} · الآية ${arabicDigits(ayah.ayah)}',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (a != null)
            Text('${a.text} ${ayahEndMark(ayah.ayah)}',
                style: quranStyle(context, 26).copyWith(height: 2.0), textAlign: TextAlign.justify),
          if (a?.translation != null) ...[
            const SizedBox(height: 8),
            Text(a!.translation!, textDirection: TextDirection.ltr, textAlign: TextAlign.left,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
            Text('— Ali Quli Qara\'i', textDirection: TextDirection.ltr, textAlign: TextAlign.left,
                style: Theme.of(context).textTheme.labelSmall),
          ],
          const SizedBox(height: 16),
          Text('معاني الكلمات', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final w in words)
              ActionChip(
                onPressed: () => showWordStudy(context, ayah, w.position),
                label: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(w.text, style: quranStyle(context, 22).copyWith(height: 1.6)),
                  if (w.translation != null)
                    Text(w.translation!, textDirection: TextDirection.ltr,
                        style: Theme.of(context).textTheme.labelSmall),
                ]),
              ),
          ]),
        ]);
      },
    );
  }
}

/// A word: its meaning, its root, and everywhere else that root appears.
class WordStudySheet extends ConsumerWidget {
  const WordStudySheet({super.key, required this.ayah, required this.position, this.scroll});

  final AyahRef ayah;
  final int position;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(ayahStudyProvider(ayah));
    final text = Theme.of(context).textTheme;
    return data.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
      data: (d) {
        final word = d.$2.where((w) => w.position == position).firstOrNull;
        if (word == null) return const SizedBox.shrink();
        final root = word.root;
        final occurrences = root == null ? null : ref.watch(rootOccurrencesProvider(root));
        return ListView(controller: scroll, padding: const EdgeInsets.all(16), children: [
          Center(child: Text(word.text, style: quranStyle(context, 40).copyWith(height: 1.8))),
          if (word.translation != null)
            Center(child: Text(word.translation!, textDirection: TextDirection.ltr, style: text.titleMedium)),
          const SizedBox(height: 8),
          Center(
            child: Text('سورة ${_surahName(ref, ayah.surah)} · الآية ${arabicDigits(ayah.ayah)} · الكلمة ${arabicDigits(position)}',
                style: text.bodySmall),
          ),
          const Divider(height: 32),
          if (root == null)
            Text('لا جذر لهذه الكلمة (حرف أو ضمير).', style: text.bodyMedium)
          else ...[
            Row(children: [
              Text('الجذر', style: text.titleSmall),
              const SizedBox(width: 12),
              Text(root, style: quranStyle(context, 26)),
            ]),
            const SizedBox(height: 8),
            occurrences!.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('$e'),
              data: (list) {
                final ayahs = {for (final w in list) w.ref}.length;
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('ورد هذا الجذر ${arabicDigits(list.length)} مرة في ${arabicDigits(ayahs)} آية.', style: text.bodyMedium),
                  const SizedBox(height: 8),
                  for (final w in list.take(200))
                    ListTile(
                      dense: true,
                      selected: w.ref == ayah && w.position == position,
                      title: Text(w.text, style: quranStyle(context, 22)),
                      subtitle: Text('${_surahName(ref, w.ref.surah)} ${arabicDigits(w.ref.surah)}:${arabicDigits(w.ref.ayah)}'
                          '${w.translation == null ? '' : ' · ${w.translation}'}'),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => ReaderScreen(ayah: w.ref)),
                      ),
                    ),
                  if (list.length > 200)
                    Text('و${arabicDigits(list.length - 200)} غيرها.', style: text.bodySmall),
                ]);
              },
            ),
          ],
        ]);
      },
    );
  }
}
