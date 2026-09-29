import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/mushaf_fonts.dart';
import 'package:quran_app/data/providers.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/data/user_repository.dart';
import 'package:quran_app/features/reader/mushaf_page.dart';
import 'package:quran_app/features/reader/reader_screen.dart';

import 'support/fakes.dart';

MushafPage _page(int n) => MushafPage(number: n, lines: [
      PageLine(number: 1, kind: PageLineKind.ayat, glyphs: [
        PageGlyph(ayah: const AyahRef(2, 255), position: 1, text: 'ٱللَّهُ'),
      ]),
    ]);

Future<void> _launch(WidgetTester tester, ReadingPosition? position) async {
  tester.view.physicalSize = const Size(400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...overridesForIndex(position: position),
      mushafPageProvider.overrideWith((ref, n) async => _page(n)),
      mushafFontProvider.overrideWith((ref, n) async => null),
      mushafFontPackProvider.overrideWith((ref) => Completer<MushafFontPack>().future),
      userRepositoryProvider.overrideWith((ref) => Completer<UserRepository>().future),
    ],
    child: const QuranApp(),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('opens straight into the mus\'haf at the last position', (tester) async {
    await _launch(tester, const ReadingPosition(view: ReaderView.page, ayah: AyahRef(2, 255), page: 42));
    final reader = tester.widget<ReaderScreen>(find.byType(ReaderScreen));
    expect((reader.ayah, reader.page), (const AyahRef(2, 255), 42));
    expect(find.byType(MushafPageView), findsOneWidget);

    // Back from the mus'haf lands on the index.
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(ReaderScreen), findsNothing);
    expect(find.text('المصحف'), findsWidgets);
  });

  testWidgets('first launch opens Al-Fatiha on page 1', (tester) async {
    await _launch(tester, null);
    final reader = tester.widget<ReaderScreen>(find.byType(ReaderScreen));
    expect((reader.ayah, reader.page), (const AyahRef(1, 1), 1));
  });
}
