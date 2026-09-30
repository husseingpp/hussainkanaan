import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/follow/follow_text.dart';
import 'package:quran_app/features/follow/follow_tracker.dart';
import 'package:quran_app/features/listen/listen_queue.dart';

void main() {
  group('FollowTracker', () {
    final tracker = FollowTracker({
      1: const [Segment(1, 60, 610), Segment(2, 620, 1310), Segment(3, 1320, 2450), Segment(4, 2460, 5970)],
      // Ayah 2: only a whole-ayah span (no word timing).
      2: const [Segment(0, 0, 4000)],
    });
    Duration ms(int v) => Duration(milliseconds: v);

    test('finds the word being recited', () {
      expect(tracker.locate(1, ms(700)), const FollowPosition(1, 2));
      expect(tracker.locate(1, ms(2460)), const FollowPosition(1, 4), reason: 'a word starts exactly on time');
      expect(tracker.locate(1, ms(9000)), const FollowPosition(1, 4), reason: 'after the last word it stays lit');
    });

    test('before the first word: whole ayah, no word', () {
      expect(tracker.locate(1, ms(10)), const FollowPosition(1, null));
    });

    test('in a gap between words the last recited word stays lit (no flicker)', () {
      expect(tracker.locate(1, ms(1315)), const FollowPosition(1, 2));
    });

    test('ayahs without word timing fall back to the whole ayah, never interpolated', () {
      expect(tracker.hasWordTiming(2), isFalse);
      expect(tracker.locate(2, ms(1500)), const FollowPosition(2, null));
      expect(tracker.locate(99, ms(1500)), const FollowPosition(99, null));
    });

    test('is a pure function of position: seeking back and forth gives the same answer', () {
      final forward = [for (var t = 0; t < 6000; t += 37) tracker.locate(1, ms(t))];
      final again = [for (var t = 0; t < 6000; t += 37) tracker.locate(1, ms(t))];
      expect(again, forward);
      expect(tracker.locate(1, ms(3000)), tracker.locate(1, ms(3000)));
    });
  });

  group('RepeatPlan', () {
    List<String> names(List<PlaybackItem> items) => [for (final i in items) '$i'];

    test('none leaves the queue as it was', () {
      expect(names(RepeatPlan.none.apply(112, 4)), names(surahItems(112, 4)));
    });

    test('each ayah repeats, the bismillah does not', () {
      expect(names(const RepeatPlan(ayahTimes: 2).apply(112, 2)),
          ['bismillah(112)', '112:1', '112:1', '112:2', '112:2']);
    });

    test('ayah ×2 inside a range ×3, then carry on', () {
      final plan = const RepeatPlan(ayahTimes: 2, range: (surah: 36, from: 2, to: 3), rangeTimes: 3);
      final items = names(plan.apply(36, 5));
      const block = ['36:2', '36:2', '36:3', '36:3'];
      expect(items, ['bismillah(36)', '36:1', ...block, ...block, ...block, '36:4', '36:5']);
    });

    test('a range in another surah leaves this one untouched', () {
      final plan = const RepeatPlan(ayahTimes: 3, range: (surah: 36, from: 1, to: 2), rangeTimes: 2);
      expect(names(plan.apply(37, 2)), names(surahItems(37, 2)));
    });
  });

  group('FollowAyahText', () {
    Future<ValueNotifier<FollowPosition?>> pump(WidgetTester tester) async {
      final pos = ValueNotifier<FollowPosition?>(null);
      await tester.pumpWidget(MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: FollowAyahText(
              ayah: 5,
              words: const [Word(1, 'إِيَّاكَ'), Word(2, 'نَعْبُدُ')],
              position: pos,
              fontSize: 24,
            ),
          ),
        ),
      ));
      return pos;
    }

    TextSpan span(WidgetTester tester, String text) {
      final rich = tester.widget<RichText>(find.byType(RichText).first).text as TextSpan;
      TextSpan? found;
      rich.visitChildren((s) {
        if (s is TextSpan && s.text == text) found = s;
        return found == null;
      });
      return found!;
    }

    testWidgets('lights exactly the recited word', (tester) async {
      final pos = await pump(tester);
      expect(span(tester, 'نَعْبُدُ').style?.backgroundColor, isNull);
      pos.value = const FollowPosition(5, 2);
      await tester.pump();
      expect(span(tester, 'نَعْبُدُ').style?.backgroundColor, isNotNull);
      expect(span(tester, 'إِيَّاكَ').style?.backgroundColor, isNull);
    });

    testWidgets('ignores positions in other ayahs', (tester) async {
      final pos = await pump(tester);
      pos.value = const FollowPosition(6, 1);
      await tester.pump();
      expect(span(tester, 'إِيَّاكَ').style?.backgroundColor, isNull);
    });

    testWidgets('lights the whole ayah when there is no word timing', (tester) async {
      final pos = await pump(tester);
      pos.value = const FollowPosition(5, null);
      await tester.pumpAndSettle();
      final box = tester.widget<AnimatedContainer>(find.byType(AnimatedContainer)).decoration! as BoxDecoration;
      expect(box.color, isNotNull);
    });
  });
}
