import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../reader/reader_screen.dart';

/// "2:255", "٢:٢٥٥", "2 255" → a reference, if it names a real ayah.
AyahRef? parseReference(String input, List<Surah> surahs) {
  final ascii = String.fromCharCodes(input.trim().codeUnits.map(
        (c) => c >= 0x0660 && c <= 0x0669 ? c - 0x0660 + 0x30 : c,
      ));
  final m = RegExp(r'^(\d{1,3})\s*[:：.\s]\s*(\d{1,3})$').firstMatch(ascii);
  if (m == null) return null;
  final s = int.parse(m[1]!), a = int.parse(m[2]!);
  final surah = surahs.where((x) => x.id == s).firstOrNull;
  if (surah == null || a < 1 || a > surah.ayahCount) return null;
  return AyahRef(s, a);
}

/// Splits search text on the match markers into highlighted spans.
List<TextSpan> highlightSpans(String text, TextStyle match) {
  final spans = <TextSpan>[];
  var rest = text;
  while (rest.isNotEmpty) {
    final start = rest.indexOf(SearchHit.open);
    if (start < 0) {
      spans.add(TextSpan(text: rest));
      break;
    }
    if (start > 0) spans.add(TextSpan(text: rest.substring(0, start)));
    final end = rest.indexOf(SearchHit.close, start);
    final stop = end < 0 ? rest.length : end;
    spans.add(TextSpan(text: rest.substring(start + 1, stop), style: match));
    rest = end < 0 ? '' : rest.substring(end + 1);
  }
  return spans;
}

final _searchProvider = FutureProvider.autoDispose.family<List<SearchHit>, String>((ref, q) async {
  if (q.trim().length < 2) return const [];
  return (await ref.watch(contentDbProvider.future)).searchText(q);
});

/// Search the Quran (Arabic, without diacritics, any alef/hamza/ya form) or
/// the translation (anything else), or jump to a reference.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  var _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () => setState(() => _query = v));
  }

  void _open(AyahRef ref) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ReaderScreen(ayah: ref)));

  @override
  Widget build(BuildContext context) {
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final names = {for (final s in surahs) s.id: s.nameAr};
    final reference = parseReference(_query, surahs);
    final hits = ref.watch(_searchProvider(_query));
    final scheme = Theme.of(context).colorScheme;
    final match = TextStyle(backgroundColor: scheme.primaryContainer, color: scheme.onPrimaryContainer);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'ابحث في القرآن، أو بالإنجليزية، أو ٢:٢٥٥', border: InputBorder.none),
          onChanged: _changed,
          onSubmitted: (v) {
            final r = parseReference(v, surahs);
            if (r != null) _open(r);
          },
        ),
      ),
      body: ListView(children: [
        if (reference != null)
          ListTile(
            leading: const Icon(Icons.arrow_back),
            title: Text('انتقل إلى سورة ${names[reference.surah]} · الآية ${arabicDigits(reference.ayah)}'),
            onTap: () => _open(reference),
          ),
        ...hits.when(
          loading: () => const [LinearProgressIndicator()],
          error: (e, _) => [ListTile(title: Text('$e', textDirection: TextDirection.ltr))],
          data: (list) => [
            if (_query.trim().length >= 2 && reference == null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(list.isEmpty ? 'لا نتائج.' : '${arabicDigits(list.length)}${list.length >= 100 ? '+' : ''} نتيجة',
                    style: Theme.of(context).textTheme.labelMedium),
              ),
            for (final h in list)
              ListTile(
                title: Text.rich(
                  TextSpan(children: highlightSpans(h.text, match)),
                  textDirection: h.isTranslation ? TextDirection.ltr : TextDirection.rtl,
                  textAlign: h.isTranslation ? TextAlign.left : TextAlign.right,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text('سورة ${names[h.ref.surah] ?? ''} · الآية ${arabicDigits(h.ref.ayah)}'),
                onTap: () => _open(h.ref),
              ),
          ],
        ),
      ]),
    );
  }
}
