import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/core/format.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/data/providers.dart';
import 'package:quran_app/features/listen/battery.dart';
import 'package:quran_app/features/listen/downloads_screen.dart';
import 'package:quran_app/features/listen/listen_providers.dart';
import 'package:quran_app/features/listen/listen_screen.dart';

import 'support/fakes.dart';

const _reciter = Reciter(
  id: 7, slug: 'alafasy', name: 'Mishary Rashid Alafasy', nameAr: 'مشاري راشد العفاسي',
  style: 'murattal', baseUrl: 'https://example.invalid', syncTier: 'A', approxBytes: 1670000000,
);

Widget _app(Widget home, List overrides) => ProviderScope(
      overrides: [...overrides],
      child: MaterialApp(
        home: Directionality(textDirection: TextDirection.rtl, child: home),
      ),
    );

void main() {
  test('sizes and durations read in Arabic', () {
    expect(formatBytes(1670000000), '١٫٧ غ.ب');
    expect(formatBytes(45200000), '٤٦ م.ب');
    expect(formatDuration(const Duration(minutes: 90)), '١ س ٣٠ د');
    expect(formatDuration(const Duration(minutes: 15)), '١٥ د');
  });

  test('battery steps name the right maker\'s settings', () {
    expect(batterySteps('xiaomi'), contains('شاومي'));
    expect(batterySteps('samsung'), contains('سامسونج'));
    expect(batterySteps('huawei'), contains('هواوي'));
    expect(batterySteps('google'), contains('غير مقيّد'));
  });

  testWidgets('says plainly where Listen Mode is not available yet', (tester) async {
    await tester.pumpWidget(_app(const ListenScreen(), [
      listenReadyProvider.overrideWith((ref) async => null),
      listenSnapshotProvider.overrideWith((ref) => Stream.value(null)),
      batteryStatusProvider.overrideWith((ref) async => null),
    ]));
    await tester.pumpAndSettle();
    expect(find.textContaining('متاح حاليًا على أندرويد'), findsOneWidget);
  });

  testWidgets('downloads screen shows sizes and what is left to fetch', (tester) async {
    await tester.pumpWidget(_app(const DownloadsScreen(reciter: _reciter), [
      surahsProvider.overrideWith((ref) async => fakeSurahs),
      surahSizesProvider(7).overrideWith((ref) async => {1: 1200000, 2: 150000000}),
      downloadedSurahsProvider('alafasy').overrideWith((ref) async => {1}),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('المُنزَّل: ١ من ٢ سورة'), findsOneWidget);
    expect(find.text('تنزيل الباقي (≈ ١٥٠ م.ب)'), findsOneWidget);
    expect(find.byTooltip('حذف'), findsOneWidget, reason: 'Al-Fatiha is downloaded');
    expect(find.byTooltip('تنزيل'), findsOneWidget, reason: 'Al-Baqarah is not');
  });
}
