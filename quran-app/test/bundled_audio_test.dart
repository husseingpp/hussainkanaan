import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/listen/audio_library.dart';

const _minshawi = Reciter(
  id: 1,
  slug: 'minshawi-murattal',
  name: 'Minshawi',
  nameAr: 'المنشاوي',
  style: 'murattal',
  baseUrl: 'https://example.invalid',
  syncTier: 'A',
  approxBytes: 0,
);

const _other = Reciter(
  id: 2,
  slug: 'alafasy',
  name: 'Alafasy',
  nameAr: 'العفاسي',
  style: 'murattal',
  baseUrl: 'https://example.invalid',
  syncTier: 'A',
  approxBytes: 0,
);

void main() {
  final lib = AudioLibrary(
    directory: '/nonexistent/audio',
    bundled: BundledAudio.fromJson({'slug': 'minshawi-murattal', 'bitrate': 16, 'bytes': 1}),
  );
  const fatiha = Surah(id: 1, nameAr: 'الفاتحة', nameEn: '', nameTranslit: '', isMeccan: true, ayahCount: 7, pageStart: 1);

  test('the built-in reciter plays from assets and needs nothing downloaded', () {
    expect(lib.pathFor(_minshawi, const AyahRef(2, 255)), 'asset:assets/audio/minshawi-murattal/002255.opus');
    expect(lib.hasSurah(_minshawi, fatiha), isTrue);
    expect(lib.bytesOnDisk(_minshawi), 0);
    lib.delete(_minshawi, [fatiha], [fatiha]); // a no-op, never touches the APK
  });

  test('other reciters still use downloaded files', () {
    expect(lib.pathFor(_other, const AyahRef(2, 255)), '/nonexistent/audio/alafasy/002255.mp3');
    expect(lib.hasSurah(_other, fatiha), isFalse);
  });
}
