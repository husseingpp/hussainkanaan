import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/app.dart';

import 'support/fakes.dart';

Future<void> _pumpAt(WidgetTester tester, double width) async {
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [...overridesForIndex()],
    child: const QuranApp(openReaderOnLaunch: false),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('app root is right-to-left', (tester) async {
    await _pumpAt(tester, 400);
    final context = tester.element(find.text('الفاتحة'));
    expect(Directionality.of(context), TextDirection.rtl);
  });

  testWidgets('phone width: bottom navigation', (tester) async {
    await _pumpAt(tester, 400);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('tablet width: collapsed side rail', (tester) async {
    await _pumpAt(tester, 800);
    expect(find.byType(NavigationBar), findsNothing);
    expect(tester.widget<NavigationRail>(find.byType(NavigationRail)).extended, isFalse);
  });

  testWidgets('desktop width: extended side rail', (tester) async {
    await _pumpAt(tester, 1280);
    expect(tester.widget<NavigationRail>(find.byType(NavigationRail)).extended, isTrue);
  });

  testWidgets('switching destinations', (tester) async {
    await _pumpAt(tester, 400);
    await tester.tap(find.text('القبلة'));
    await tester.pumpAndSettle();
    // No place saved yet: it asks, rather than guessing.
    expect(find.text('استخدم موقعي الحالي'), findsOneWidget);
  });
}
