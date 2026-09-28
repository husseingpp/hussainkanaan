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
