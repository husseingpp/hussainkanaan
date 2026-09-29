import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';
import 'package:quran_app/core/arabic_digits.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/reader_settings.dart';
import 'package:quran_app/data/user_repository.dart';
import 'package:quran_app/features/reader/justified_line.dart';

import 'support/fakes.dart';

Future<void> _pumpIndex(WidgetTester tester, {ReadingPosition? position}) async {
  tester.view.physicalSize = const Size(400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [...overridesForIndex(position: position)],
    child: const QuranApp(),
  ));
  await tester.pumpAndSettle();
}

void main() {
  test('arabic digits', () {
    expect(arabicDigits(0), '٠');
    expect(arabicDigits(604), '٦٠٤');
  });

  group('ReaderSettings', () {
    test('round-trips through JSON', () {
      const s = ReaderSettings(themeMode: ThemeMode.dark, view: ReaderView.reading, fontScale: 1.4, showTranslation: true);
      final back = ReaderSettings.fromJson(Map<String, Object?>.from(jsonDecode(s.toJson()) as Map));
      expect(back.themeMode, ThemeMode.dark);
      expect(back.view, ReaderView.reading);
      expect(back.fontScale, closeTo(1.4, 1e-9));
      expect(back.showTranslation, isTrue);
    });

    test('clamps font scale and tolerates unknown values', () {
      expect(const ReaderSettings().copyWith(fontScale: 9).fontScale, ReaderSettings.maxScale);
      final s = ReaderSettings.fromJson({'themeMode': 'purple', 'view': 'scroll', 'fontScale': 0.1});
      expect(s.themeMode, ThemeMode.system);
      expect(s.view, ReaderView.page);
      expect(s.fontScale, ReaderSettings.minScale);
    });
  });

  group('JustifiedLine', () {
    Future<void> pumpLine(WidgetTester tester, double width, List<String> words) async {
      await tester.pumpWidget(MaterialApp(
        home: Center(
          child: SizedBox(
            width: width,
            child: JustifiedLine(words: words, style: const TextStyle(fontSize: 30)),
          ),
        ),
      ));
    }

    testWidgets('shrinks a line that is too long instead of overflowing', (tester) async {
      await pumpLine(tester, 120, List.filled(12, 'ٱلْمُسْتَقِيمَ'));
      expect(tester.takeException(), isNull);
      final sizes = tester.widgetList<Text>(find.byType(Text)).map((t) => t.style!.fontSize!);
      expect(sizes.every((s) => s < 30), isTrue);
    });

    testWidgets('spreads a full line edge to edge', (tester) async {
      await pumpLine(tester, 400, List.filled(8, 'كلمة'));
      final first = tester.getRect(find.byType(Text).first);
      final last = tester.getRect(find.byType(Text).last);
      final line = tester.getRect(find.byType(JustifiedLine));
      // RTL: the first word hugs the right edge, the last the left.
      expect(line.right - first.right, lessThan(2));
      expect(last.left - line.left, lessThan(2));
    });

    testWidgets('centres a short line', (tester) async {
      await pumpLine(tester, 400, ['قل']);
      final word = tester.getRect(find.byType(Text));
      final line = tester.getRect(find.byType(JustifiedLine));
      expect((word.center.dx - line.center.dx).abs(), lessThan(1));
    });
  });

  group('index', () {
    testWidgets('offers to continue where you left off', (tester) async {
      await _pumpIndex(tester,
          position: const ReadingPosition(view: ReaderView.page, ayah: AyahRef(2, 255), page: 42));
      expect(find.text('متابعة القراءة'), findsOneWidget);
      expect(find.text('سورة البقرة · الآية ٢٥٥ · صفحة ٤٢'), findsOneWidget);
    });

    testWidgets('no resume card on first launch', (tester) async {
      await _pumpIndex(tester);
      expect(find.text('متابعة القراءة'), findsNothing);
    });

    testWidgets('lists juz starts', (tester) async {
      await _pumpIndex(tester);
      await tester.tap(find.text('الأجزاء'));
      await tester.pumpAndSettle();
      expect(find.text('الجزء ٢'), findsOneWidget);
      expect(find.text('يبدأ من سورة البقرة، الآية ١٤٢'), findsOneWidget);
    });

    testWidgets('page jump accepts Arabic-Indic digits and rejects out of range', (tester) async {
      await _pumpIndex(tester);
      await tester.tap(find.byTooltip('الانتقال إلى صفحة'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '٦٠٥');
      await tester.tap(find.text('انتقال'));
      await tester.pumpAndSettle();
      expect(find.text('أدخل رقمًا من ١ إلى ٦٠٤'), findsOneWidget);
    });

    testWidgets('night mode toggle cycles the app theme', (tester) async {
      await _pumpIndex(tester);
      final app = find.byType(MaterialApp);
      expect(tester.widget<MaterialApp>(app).themeMode, ThemeMode.system);
      await tester.tap(find.byTooltip('حسب النظام'));
      await tester.pumpAndSettle();
      expect(tester.widget<MaterialApp>(app).themeMode, ThemeMode.light);
      await tester.tap(find.byTooltip('الوضع النهاري'));
      await tester.pumpAndSettle();
      expect(tester.widget<MaterialApp>(app).themeMode, ThemeMode.dark);
    });
  });
}

