class Surah {
  const Surah({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.nameTranslit,
    required this.isMeccan,
    required this.ayahCount,
    required this.pageStart,
  });

  factory Surah.fromRow(Map<String, Object?> r) => Surah(
        id: r['id']! as int,
        nameAr: r['name_ar']! as String,
        nameEn: r['name_en']! as String,
        nameTranslit: r['name_translit']! as String,
        isMeccan: r['revelation_type'] == 'meccan',
        ayahCount: r['ayah_count']! as int,
        pageStart: r['page_start']! as int,
      );

  final int id;
  final String nameAr;
  final String nameEn;
  final String nameTranslit;
  final bool isMeccan;
  final int ayahCount;
  final int pageStart;
}

/// A stable pointer into the Quran. User data stores these, never content-DB
/// row ids, so replacing the content DB can't orphan a bookmark.
class AyahRef {
  const AyahRef(this.surah, this.ayah);

  final int surah;
  final int ayah;

  @override
  bool operator ==(Object other) =>
      other is AyahRef && other.surah == surah && other.ayah == ayah;

  @override
  int get hashCode => Object.hash(surah, ayah);

  @override
  String toString() => '$surah:$ayah';
}

class Ayah {
  const Ayah({
    required this.surah,
    required this.number,
    required this.text,
    required this.page,
    required this.juz,
    this.sajda,
    this.translation,
  });

  factory Ayah.fromRow(Map<String, Object?> r) => Ayah(
        surah: r['surah_id']! as int,
        number: r['ayah_no']! as int,
        text: r['text_uthmani']! as String,
        page: r['page']! as int,
        juz: r['juz']! as int,
        sajda: r['sajda'] as String?,
        translation: r['translation'] as String?,
      );

  final int surah;
  final int number;
  final String text;
  final int page;
  final int juz;

  /// 'obligatory' | 'recommended' | null.
  final String? sajda;
  final String? translation;

  AyahRef get ref => AyahRef(surah, number);
}

class JuzStart {
  const JuzStart({required this.juz, required this.start, required this.page});

  final int juz;
  final AyahRef start;
  final int page;
}

enum PageLineKind { ayat, surahName, bismillah }

/// One word, or an end-of-ayah medallion, placed on a mus'haf line.
class PageGlyph {
  const PageGlyph({
    required this.ayah,
    required this.position,
    required this.text,
    this.qcf,
    this.isAyahEnd = false,
  });

  final AyahRef ayah;
  final int position;

  /// Uthmani word text, or the ayah number for a medallion.
  final String text;

  /// QCF v1 glyph code, drawn with that page's font when it's installed.
  final String? qcf;
  final bool isAyahEnd;
}

class PageLine {
  const PageLine({required this.number, required this.kind, this.surah, this.glyphs = const []});

  final int number;
  final PageLineKind kind;

  /// The surah a title or bismillah line belongs to.
  final int? surah;
  final List<PageGlyph> glyphs;
}

class MushafPage {
  const MushafPage({required this.number, required this.lines});

  final int number;
  final List<PageLine> lines;

  /// The first ayah that starts on this page (resume and headers use it).
  AyahRef? get firstAyah {
    for (final line in lines) {
      for (final g in line.glyphs) {
        if (g.position == 1 && !g.isAyahEnd) return g.ayah;
      }
    }
    for (final line in lines) {
      if (line.glyphs.isNotEmpty) return line.glyphs.first.ayah;
    }
    return null;
  }
}

class Reciter {
  const Reciter({
    required this.id,
    required this.slug,
    required this.name,
    required this.nameAr,
    required this.style,
    required this.baseUrl,
    required this.syncTier,
    required this.approxBytes,
    this.bitrate,
  });

  final int id;
  final String slug;
  final String name;
  final String? nameAr;
  final String style;
  final String baseUrl;

  /// 'A' word highlight, 'B' ayah highlight, 'C' none (derived by the ingest).
  final String syncTier;
  final int approxBytes;
  final int? bitrate;

  /// Per-ayah file: {baseUrl}/{SSS}{AAA}.mp3.
  String urlFor(AyahRef ref) => '$baseUrl/${fileName(ref)}';

  static String fileName(AyahRef ref) =>
      '${ref.surah.toString().padLeft(3, '0')}${ref.ayah.toString().padLeft(3, '0')}.mp3';
}

/// One word of an ayah as Follow Mode renders it (from the `words` table).
class Word {
  const Word(this.position, this.text);

  final int position;
  final String text;
}

/// When a word (position ≥ 1), or the whole ayah (position 0), is recited,
/// relative to the start of that ayah's own audio file.
class Segment {
  const Segment(this.position, this.startMs, this.endMs);

  final int position;
  final int startMs;
  final int endMs;
}
