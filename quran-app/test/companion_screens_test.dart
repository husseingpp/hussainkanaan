import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';
import 'package:quran_app/features/calendar/calendar_model.dart';
import 'package:quran_app/features/calendar/dates.dart';

import 'support/fakes.dart';

Future<void> _open(WidgetTester tester, String tab, {List overrides = const []}) async {
  tester.view.physicalSize = const Size(400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [...overrides],
    child: const QuranApp(openReaderOnLaunch: false),
  ));
  await tester.pumpAndSettle();
  await tester.tap(find.text(tab).last);
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

void main() {
  testWidgets('prayer times for a saved place, grouped the Jafari way', (tester) async {
    await _open(tester, 'الصلاة', overrides: overridesForIndex(location: beirut));
    expect(find.text('بيروت'), findsOneWidget);
    expect(find.textContaining('الصلاة القادمة'), findsOneWidget);
    expect(find.textContaining('يُجمع مع العصر'), findsOneWidget);
    expect(find.text('منتصف الليل الشرعي'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('qibla shows the bearing in numbers', (tester) async {
    await _open(tester, 'القبلة', overrides: overridesForIndex(location: beirut));
    // Beirut → Kaaba ≈ 158°.
    expect(find.textContaining('°'), findsWidgets);
    expect(find.text('من الشمال الحقيقي، باتجاه عقارب الساعة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('calendar marks an unreviewed pack and lists events', (tester) async {
    final today = toHijri(DateTime.now());
    final pack = CalendarPack(version: 'test', reviewed: false, events: [
      CalendarEvent(
        slug: 'x',
        nameAr: 'مناسبة اليوم',
        nameEn: 'Today',
        category: EventCategory.eid,
        importance: 3,
        dates: [EventDate(month: today.month, day: today.day, primary: true)],
      ),
    ]);
    await _open(tester, 'التقويم', overrides: overridesForIndex(calendar: pack));
    expect(find.textContaining('مسودة لم يراجعها'), findsOneWidget);
    expect(find.text('مناسبة اليوم'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
