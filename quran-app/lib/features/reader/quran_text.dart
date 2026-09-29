import 'package:flutter/material.dart';

import '../../core/arabic_digits.dart';

/// Bundled OFL font with full coverage of the Tanzil Uthmani text.
const quranFontFamily = 'AmiriQuran';

const bismillah = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/// The end-of-ayah medallion with its number inside (the font joins them).
String ayahEndMark(int number) => '۝${arabicDigits(number)}';

TextStyle quranStyle(BuildContext context, double fontSize) => TextStyle(
      fontFamily: quranFontFamily,
      fontSize: fontSize,
      height: 1.0,
      color: Theme.of(context).colorScheme.onSurface,
    );
