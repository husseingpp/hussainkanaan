import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../data/models.dart';
import '../reader/quran_text.dart';
import 'follow_tracker.dart';

/// One ayah drawn word by word, with the recited word lit.
///
/// Each word is its own span so it can be highlighted in place (BLUEPRINT
/// §4). Rebuilds only when the highlight enters, moves within or leaves
/// this ayah.
class FollowAyahText extends StatelessWidget {
  const FollowAyahText({
    super.key,
    required this.ayah,
    required this.words,
    required this.position,
    required this.fontSize,
    this.onTap,
  });

  final int ayah;
  final List<Word> words;
  final ValueListenable<FollowPosition?> position;
  final double fontSize;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _Selective(
      listenable: position,
      select: (p) => p?.ayah == ayah ? p : null,
      builder: (context, here) {
        final scheme = Theme.of(context).colorScheme;
        final style = quranStyle(context, fontSize).copyWith(height: 2.1);
        final wordLit = style.copyWith(
          backgroundColor: scheme.primaryContainer,
          color: scheme.onPrimaryContainer,
        );
        // No word timing for this ayah (or between ayah start and first word):
        // light the whole ayah instead.
        final wholeAyah = here != null && here.word == null;
        return InkWell(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
            decoration: BoxDecoration(
              color: wholeAyah ? scheme.primaryContainer.withValues(alpha: 0.45) : null,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text.rich(
              TextSpan(children: [
                for (final w in words) ...[
                  TextSpan(text: w.text, style: here?.word == w.position ? wordLit : null),
                  const TextSpan(text: ' '),
                ],
                TextSpan(text: ayahEndMark(ayah), style: TextStyle(color: scheme.primary)),
              ]),
              style: style,
              textAlign: TextAlign.justify,
              textDirection: TextDirection.rtl,
            ),
          ),
        );
      },
    );
  }
}

/// A ValueListenableBuilder that rebuilds only when a selected slice changes.
class _Selective<T, S> extends StatefulWidget {
  const _Selective({required this.listenable, required this.select, required this.builder});

  final ValueListenable<T> listenable;
  final S Function(T) select;
  final Widget Function(BuildContext, S) builder;

  @override
  State<_Selective<T, S>> createState() => _SelectiveState<T, S>();
}

class _SelectiveState<T, S> extends State<_Selective<T, S>> {
  late S _value = widget.select(widget.listenable.value);

  @override
  void initState() {
    super.initState();
    widget.listenable.addListener(_changed);
  }

  @override
  void didUpdateWidget(covariant _Selective<T, S> old) {
    super.didUpdateWidget(old);
    if (old.listenable != widget.listenable) {
      old.listenable.removeListener(_changed);
      widget.listenable.addListener(_changed);
    }
    _value = widget.select(widget.listenable.value);
  }

  @override
  void dispose() {
    widget.listenable.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final next = widget.select(widget.listenable.value);
    if (next != _value) setState(() => _value = next);
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _value);
}
