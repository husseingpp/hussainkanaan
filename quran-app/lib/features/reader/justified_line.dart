import 'dart:math' as math;

import 'package:flutter/material.dart';

/// One printed mus'haf line: its words spread edge to edge, right to left.
///
/// Measures the words at [style]; if they don't fit, shrinks the font until
/// they do; then puts the spare width between words. Lines much shorter than
/// the page (the centred opening pages) are centred instead of stretched.
class JustifiedLine extends StatelessWidget {
  const JustifiedLine({super.key, required this.words, required this.style, this.styles});

  final List<String> words;
  final TextStyle style;

  /// Optional per-word style overrides (e.g. medallions in the accent colour).
  final List<TextStyle?>? styles;

  static const _minGapEm = 0.2;
  static const _justifyThreshold = 0.75;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      // A pixel of slack: text widths don't scale exactly linearly with size.
      final width = box.maxWidth - 1;
      final scaler = MediaQuery.textScalerOf(context);
      double measure(String w, TextStyle s) => (TextPainter(
            text: TextSpan(text: w, style: s),
            textDirection: TextDirection.rtl,
            textScaler: scaler,
          )..layout())
              .width;

      TextStyle styleAt(int i) => styles?[i] ?? style;
      final natural = [for (var i = 0; i < words.length; i++) measure(words[i], styleAt(i))];
      final total = natural.fold<double>(0, (a, b) => a + b);
      final minGap = (style.fontSize ?? 14) * _minGapEm;
      final gaps = math.max(words.length - 1, 0);
      final fit = total == 0 ? 1.0 : (width - minGap * gaps) / total;
      final scale = fit >= 1 ? 1.0 : fit * 0.99;
      final used = total * scale;
      final justify = gaps > 0 && used + minGap * gaps >= width * _justifyThreshold;
      final gap = justify ? (width - used) / gaps : minGap;

      return Row(
        textDirection: TextDirection.rtl,
        mainAxisAlignment: justify ? MainAxisAlignment.start : MainAxisAlignment.center,
        children: [
          for (var i = 0; i < words.length; i++) ...[
            if (i > 0) SizedBox(width: gap),
            Text(
              words[i],
              textDirection: TextDirection.rtl,
              maxLines: 1,
              softWrap: false,
              style: styleAt(i).copyWith(fontSize: (styleAt(i).fontSize ?? 14) * scale),
            ),
          ],
        ],
      );
    });
  }
}
