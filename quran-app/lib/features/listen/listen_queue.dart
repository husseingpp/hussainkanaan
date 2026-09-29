import '../../data/models.dart';

/// One file in the playback queue: an ayah, or the bismillah said before a
/// surah (the reciter's recording of 1:1, as is customary for per-ayah audio).
class PlaybackItem {
  const PlaybackItem(this.surah, this.ayah, {this.isBismillah = false});

  final int surah;
  final int ayah;
  final bool isBismillah;

  /// The recording this item plays.
  AyahRef get file => isBismillah ? const AyahRef(1, 1) : AyahRef(surah, ayah);
  AyahRef get ref => AyahRef(surah, ayah);

  @override
  bool operator ==(Object other) =>
      other is PlaybackItem && other.surah == surah && other.ayah == ayah && other.isBismillah == isBismillah;

  @override
  int get hashCode => Object.hash(surah, ayah, isBismillah);

  @override
  String toString() => isBismillah ? 'bismillah($surah)' : '$surah:$ayah';
}

/// Surahs that open without a recited bismillah: Al-Fatiha (it *is* its first
/// ayah) and At-Tawbah.
bool opensWithBismillah(int surah) => surah != 1 && surah != 9;

/// The items for one surah, starting at [fromAyah]. Starting mid-surah skips
/// the bismillah.
List<PlaybackItem> surahItems(int surah, int ayahCount, {int fromAyah = 1}) => [
      if (fromAyah == 1 && opensWithBismillah(surah)) PlaybackItem(surah, 1, isBismillah: true),
      for (var a = fromAyah; a <= ayahCount; a++) PlaybackItem(surah, a),
    ];

/// Every recording a surah needs downloaded (including the bismillah's 1:1).
Set<AyahRef> filesForSurah(int surah, int ayahCount) =>
    {for (final item in surahItems(surah, ayahCount)) item.file};
