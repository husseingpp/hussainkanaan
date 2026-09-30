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

/// Repetition for memorisation (BLUEPRINT §4): each ayah [ayahTimes] times;
/// then, if [range] is set, that ayah range [rangeTimes] times; then carry on.
/// Expressed as the queue itself, so the state is just "which item is
/// playing": no counters to drift, and repeats stay gapless.
class RepeatPlan {
  const RepeatPlan({this.ayahTimes = 1, this.range, this.rangeTimes = 1});

  static const none = RepeatPlan();

  final int ayahTimes;

  /// First and last ayah of the range, within one surah.
  final ({int surah, int from, int to})? range;
  final int rangeTimes;

  bool get isNone => ayahTimes <= 1 && range == null;

  /// Items for [surah] from [fromAyah], with the plan applied. Without a
  /// range, every ayah repeats; with one, only the range's ayahs do.
  List<PlaybackItem> apply(int surah, int ayahCount, {int fromAyah = 1}) {
    final plain = surahItems(surah, ayahCount, fromAyah: fromAyah);
    final r = range;
    if (r == null) {
      return [for (final item in plain) for (var i = 0; i < (item.isBismillah ? 1 : ayahTimes); i++) item];
    }
    if (r.surah != surah) return plain;
    List<PlaybackItem> repeated(PlaybackItem item) => [for (var i = 0; i < ayahTimes; i++) item];
    final before = plain.where((i) => i.isBismillah || i.ayah < r.from).toList();
    final block = [
      for (final item in plain)
        if (!item.isBismillah && item.ayah >= r.from && item.ayah <= r.to) ...repeated(item),
    ];
    final after = plain.where((i) => !i.isBismillah && i.ayah > r.to).toList();
    return [...before, for (var i = 0; i < rangeTimes; i++) ...block, ...after];
  }
}
