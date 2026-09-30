import 'dart:math' as math;

import 'package:flutter/material.dart';

/// One printed mus'haf line: its words spread edge to edge, right to left.
///
/// Measures the words at [style]; if they don't fit, shrinks the font until
/// they do; then puts the spare width between words. Lines much shorter than
/// the page (the centred opening pages) are centred instead of stretched.
class JustifiedLine extends StatelessWidget {
  const JustifiedLine({super.key, required this.words, required this.style, this.styles, this.onTaps});

  final List<String> words;
  final TextStyle style;

  /// Optional per-word style overrides (e.g. medallions in the accent colour).
  final List<TextStyle?>? styles;

  /// Optional per-word tap handlers (word study).
  final List<VoidCallback?>? onTaps;

  static const _minGapEm = 0.2;
  static const _justifyThreshold = 0.75;

  /// The font scale (≤ 1) at which [words] fit [width]. A page takes the
  /// smallest over its lines so every line shares one letter size, as printed.
  static double fitScale(List<String> words, List<TextStyle> styles, double width, TextScaler scaler) {
    var total = 0.0;
    for (var i = 0; i < words.length; i++) {
      total += (TextPainter(
        text: TextSpan(text: words[i], style: styles[i]),
        textDirection: TextDirection.rtl,
        textScaler: scaler,
      )..layout())
          .width;
    }
    if (total == 0) return 1;
    final minGap = (styles.first.fontSize ?? 14) * _minGapEm * math.max(words.length - 1, 0);
    final fit = (width - 1 - minGap) / total;
    return fit >= 1 ? 1 : fit * 0.99;
  }

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
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTaps?[i],
              child: Text(
                words[i],
                textDirection: TextDirection.rtl,
                maxLines: 1,
                softWrap: false,
                style: styleAt(i).copyWith(fontSize: (styleAt(i).fontSize ?? 14) * scale),
              ),
            ),
          ],
        ],
      );
    });
  }
}
