// Renders reader screens from the real content DB to PNGs for eyeballing.
//
//   flutter test tool/screenshots/render_pages_test.dart --dart-define=OUT=/tmp/shots
//
// Not part of the normal suite (needs assets/db/content.db from the ingest).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';
import 'package:quran_app/data/content_db.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/providers.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/features/follow/follow_text.dart';
import 'package:quran_app/features/follow/follow_tracker.dart';
import 'package:quran_app/features/reader/justified_line.dart';
import 'package:quran_app/features/study/study_sheets.dart';
import 'package:quran_app/features/reader/mushaf_page.dart';
import 'package:quran_app/features/reader/reader_screen.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

const out = String.fromEnvironment('OUT', defaultValue: 'build/screenshots');

class _Settings extends SettingsNotifier {
  _Settings(this.initial);
  final ReaderSettings initial;
  @override
  Future<ReaderSettings> build() async => initial;
}

Future<void> _loadFont(String family, String path) async {
  final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(File(path).readAsBytesSync())));
  await loader.load();
}

void main() {
  sqfliteFfiInit();
  late ContentDb db;
  late List<Surah> surahs;

  setUpAll(() async {
    await _loadFont('AmiriQuran', 'assets/fonts/AmiriQuran.ttf');
    // Latin UI text in screenshots; cosmetic, so skipped where the SDK lacks it.
    final roboto = File('${Platform.environment['FLUTTER_ROOT'] ?? '/opt/sdk/flutter'}'
        '/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf');
    if (roboto.existsSync()) await _loadFont('Roboto', roboto.path);
    final dir = await Directory.systemTemp.createTemp('shots');
    File('assets/db/content.db').copySync('${dir.path}/content.db');
    File('assets/db/content.db.sha256').copySync('${dir.path}/content.db.sha256');
    db = await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: _Bundle());
    surahs = await db.surahs();
    Directory(out).createSync(recursive: true);
  });

  Future<void> shoot(WidgetTester tester, String name, Widget screen,
      {ThemeMode theme = ThemeMode.light,
      ReaderView view = ReaderView.page,
      bool translation = false,
      bool qcf = false,
      Size size = const Size(412, 870)}) async {
    tester.view.physicalSize = size * 2.5;
    tester.view.devicePixelRatio = 2.5;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    await tester.runAsync(() async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          contentDbProvider.overrideWith((ref) async => db),
          surahsProvider.overrideWith((ref) async => surahs),
          lastPositionProvider.overrideWith((ref) async => null),
          // With qcf: the page fonts from tool/ingest/sources/qcf-v1 stand in
          // for a completed download; without, Page View's Amiri fallback.
          mushafFontProvider.overrideWith((ref, page) async {
            final f = File('tool/ingest/sources/qcf-v1/p$page.ttf');
            if (!qcf || !f.existsSync()) return null;
            final family = 'QCF_P$page';
            await _loadFont(family, f.path);
            return family;
          }),
          mushafFontPackProvider.overrideWith((ref) async => throw StateError('no pack in screenshots')),
          databaseFactoryProvider.overrideWithValue(databaseFactoryFfi),
          appDirectoryProvider.overrideWith((ref) async => (await Directory.systemTemp.createTemp('user')).path),
          settingsProvider.overrideWith(() => _Settings(ReaderSettings(themeMode: theme, view: view, showTranslation: translation))),
        ],
        child: RepaintBoundary(key: key, child: QuranApp(home: screen)),
      ));
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        await tester.pump(const Duration(milliseconds: 50));
      }
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.0);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      File('$out/$name.png').writeAsBytesSync(png!.buffer.asUint8List());
    });
  }

  // The Phase 4 gate: undiacritized queries return the right ayahs in under
  // 100 ms on a cold DB (a fresh copy, opened for this test).
  test('search gate', () async {
    final dir = await Directory.systemTemp.createTemp('cold');
    final cold = await ContentDb.open(factory: databaseFactoryFfi, directory: dir.path, bundle: _Bundle());
    final cases = {
      'الله لا اله الا هو الحي القيوم': const AyahRef(2, 255),
      'قل هو الله احد': const AyahRef(112, 1),
      'انا اعطيناك الكوثر': const AyahRef(108, 1),
      'والقران الحكيم': const AyahRef(36, 2),
      'ان مع العسر يسرا': const AyahRef(94, 6),
      'فإن مع العسر يسرا': const AyahRef(94, 5),
      'throne': null,
    };
    for (final e in cases.entries) {
      final sw = Stopwatch()..start();
      final hits = await cold.searchText(e.key);
      sw.stop();
      expect(sw.elapsedMilliseconds, lessThan(100), reason: '"${e.key}" took ${sw.elapsedMilliseconds} ms');
      if (e.value != null) expect(hits.map((h) => h.ref), contains(e.value), reason: e.key);
      expect(hits, isNotEmpty, reason: e.key);
    }
    await cold.close();
  });

  // The Phase 1 gate, rendering half: every page lays out at phone and tablet
  // widths with no overflow or error. (Line breaks are proven by the ingest.)
  testWidgets('all 604 pages render cleanly', (tester) async {
    final fontsDir = Directory('tool/ingest/sources/qcf-v1');
    final modes = [
      (const Size(360, 740), false),
      (const Size(800, 1200), false),
      if (fontsDir.existsSync()) (const Size(360, 740), true),
      if (fontsDir.existsSync()) (const Size(800, 1200), true),
    ];
    for (final (size, qcf) in modes) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      for (var page = 1; page <= ContentDb.pageCount; page++) {
        final data = await tester.runAsync(() => db.page(page));
        String? family;
        if (qcf) {
          family = 'QCF_P$page';
          await tester.runAsync(() => _loadFont(family!, '${fontsDir.path}/p$page.ttf'));
        }
        await tester.pumpWidget(ProviderScope(
          key: ValueKey('$size-$qcf-$page'),
          overrides: [
            mushafPageProvider(page).overrideWith((ref) async => data!),
            mushafFontProvider(page).overrideWith((ref) async => family),
            surahsProvider.overrideWith((ref) async => surahs),
          ],
          child: MaterialApp(home: Directionality(textDirection: TextDirection.rtl, child: Scaffold(body: MushafPageView(page: page)))),
        ));
        await tester.pump();
        await tester.pump();
        final error = tester.takeException();
        expect(error, isNull, reason: 'page $page at $size (qcf: $qcf): $error');
        expect(find.byType(JustifiedLine), findsWidgets, reason: 'page $page drew no ayat');
      }
    }
    tester.view.reset();
  }, timeout: const Timeout(Duration(minutes: 20)));

  for (final (page, ayah) in [(1, const AyahRef(1, 1)), (2, const AyahRef(2, 1)), (50, const AyahRef(2, 283)), (77, const AyahRef(4, 12)), (187, const AyahRef(9, 1)), (604, const AyahRef(112, 1))]) {
    testWidgets('page $page', (t) => shoot(t, 'page-$page', ReaderScreen(ayah: ayah, page: page, view: ReaderView.page)));
  }
  for (final page in [1, 50, 604]) {
    testWidgets('page $page qcf', (t) => shoot(t, 'page-$page-qcf', ReaderScreen(ayah: const AyahRef(1, 1), page: page, view: ReaderView.page), qcf: true));
  }
  testWidgets('follow highlight on real timing', (tester) async {
    tester.view.physicalSize = const Size(412, 700) * 2.5;
    tester.view.devicePixelRatio = 2.5;
    addTearDown(tester.view.reset);
    final reciters = await tester.runAsync(() => db.reciters());
    final alafasy = reciters!.firstWhere((r) => r.slug == 'alafasy');
    final words = await tester.runAsync(() => db.wordsOfSurah(1));
    final timings = await tester.runAsync(() => db.timingsForSurah(alafasy.id, 1));
    final tracker = FollowTracker(timings!);
    final pos = ValueNotifier<FollowPosition?>(tracker.locate(2, const Duration(milliseconds: 1900)));
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(
      key: key,
      child: MaterialApp(
        theme: ThemeData(colorSchemeSeed: const Color(0xFF1B5E4A)),
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: ListView(padding: const EdgeInsets.all(12), children: [
              for (var a = 1; a <= 7; a++)
                FollowAyahText(ayah: a, words: words![a]!, position: a == 5 ? ValueNotifier(const FollowPosition(5, null)) : pos, fontSize: 26),
            ]),
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage();
      File('$out/follow-1.png').writeAsBytesSync((await image.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List());
    });
    // 1:2 at 1.9 s is the third word in Alafasy's timing.
    expect(pos.value, const FollowPosition(2, 3));
  });

  testWidgets('word study', (t) => shoot(t, 'study-word',
      const Scaffold(body: WordStudySheet(ayah: AyahRef(1, 2), position: 1))));
  testWidgets('ayah study', (t) => shoot(t, 'study-ayah', const Scaffold(body: AyahStudySheet(ayah: AyahRef(2, 255)))));

  testWidgets('page 604 night', (t) => shoot(t, 'page-604-night', const ReaderScreen(ayah: AyahRef(112, 1), page: 604, view: ReaderView.page), theme: ThemeMode.dark));
  testWidgets('reading 2:255', (t) => shoot(t, 'reading-2-255', const ReaderScreen(ayah: AyahRef(2, 255), view: ReaderView.reading), view: ReaderView.reading));
  testWidgets('reading 32 translation', (t) => shoot(t, 'reading-32',
      const ReaderScreen(ayah: AyahRef(32, 14), view: ReaderView.reading), view: ReaderView.reading, translation: true));
}

class _Bundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async => ByteData.sublistView(File('${Directory.current.path}/assets/db/${key.split('/').last}').readAsBytesSync());
}
