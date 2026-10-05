import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/common/surah_search.dart';

import 'support/fakes.dart';

const _surahs = [
  Surah(id: 1, nameAr: 'الفاتحة', nameEn: 'The Opening', nameTranslit: 'Al-Faatiha', isMeccan: true, ayahCount: 7, pageStart: 1),
  Surah(id: 2, nameAr: 'البقرة', nameEn: 'The Cow', nameTranslit: 'Al-Baqara', isMeccan: false, ayahCount: 286, pageStart: 2),
  Surah(id: 12, nameAr: 'يوسف', nameEn: 'Joseph', nameTranslit: 'Yusuf', isMeccan: true, ayahCount: 111, pageStart: 235),
  Surah(id: 18, nameAr: 'الكهف', nameEn: 'The Cave', nameTranslit: 'Al-Kahf', isMeccan: true, ayahCount: 110, pageStart: 293),
  Surah(id: 36, nameAr: 'يس', nameEn: 'Yaseen', nameTranslit: 'Yaseen', isMeccan: true, ayahCount: 83, pageStart: 440),
  Surah(id: 112, nameAr: 'الإخلاص', nameEn: 'Sincerity', nameTranslit: 'Al-Ikhlaas', isMeccan: true, ayahCount: 4, pageStart: 604),
];

List<int> _ids(String q) => [for (final s in filterSurahs(_surahs, q)) s.id];

void main() {
  test('names match without «ال», «سورة», diacritics or hamza/ta-marbuta spelling', () {
    expect(_ids('البقرة'), [2]);
    expect(_ids('بقره'), [2]);
    expect(_ids('سورة الكهف'), [18]);
    expect(_ids('الاخلاص'), [112]);
    expect(_ids('يوسُف'), [12]);
  });

  test('numbers in either digit style go to that surah first', () {
    expect(_ids('18'), [18]);
    expect(_ids('١٨'), [18]);
    expect(_ids('1').first, 1);
    expect(_ids('1'), containsAll([1, 12, 18, 112]));
  });

  test('transliteration and English work too', () {
    expect(_ids('kahf'), [18]);
    expect(_ids('Al-Baqarah'.substring(0, 9)), [2]);
    expect(_ids('cave'), [18]);
  });

  test('no match is an empty list', () => expect(_ids('zzz'), isEmpty));

  testWidgets('the index filters surahs as you type', (tester) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [...overridesForIndex()],
      child: const QuranApp(openReaderOnLaunch: false),
    ));
    await tester.pumpAndSettle();
    expect(find.text('البقرة'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'فاتحه');
    await tester.pumpAndSettle();
    expect(find.text('الفاتحة'), findsOneWidget);
    expect(find.text('البقرة'), findsNothing);
    expect(find.byTooltip('استمع إلى سورة الفاتحة'), findsOneWidget);
  });
}
