/// Folds Arabic text to the skeleton stored in `ayahs.search_text`.
///
/// Must stay identical to tool/ingest/normalize.py: the DB side is folded at
/// ingest, the query side here, and a mismatch silently loses results. Both
/// are pinned by schema/search_normalization_vectors.json.
library;

const _fold = <int, int>{
  0x0671: 0x0627, // ٱ alef wasla -> ا
  0x0623: 0x0627, // أ
  0x0625: 0x0627, // إ
  0x0622: 0x0627, // آ
  0x0649: 0x064A, // ى alef maqsura -> ي
  0x06CC: 0x064A, // ی Persian yeh
  0x0626: 0x064A, // ئ
  0x0624: 0x0648, // ؤ -> و
  0x0629: 0x0647, // ة ta marbuta -> ه
  0x06A9: 0x0643, // ک Persian keheh -> ك
};

bool _strip(int c) =>
    c == 0x0640 || // tatweel
    (c >= 0x064B && c <= 0x065F) || // harakat
    c == 0x0670 || // dagger alef
    (c >= 0x06D6 && c <= 0x06ED); // Quranic annotation marks

final _space = RegExp(r'\s+');

String normalizeArabic(String text) {
  final out = StringBuffer();
  for (final rune in text.runes) {
    if (_strip(rune)) continue;
    out.writeCharCode(_fold[rune] ?? rune);
  }
  return out.toString().replaceAll(_space, ' ').trim();
}
