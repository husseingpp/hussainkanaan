import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/models.dart';
import 'package:quran_app/features/study/search_screen.dart';

import 'support/fakes.dart';

void main() {
  test('references in Western or Arabic-Indic digits, only for real ayahs', () {
    expect(parseReference('2:255', fakeSurahs), const AyahRef(2, 255));
    expect(parseReference('٢:٢٥٥', fakeSurahs), const AyahRef(2, 255));
    expect(parseReference(' 1 7 ', fakeSurahs), const AyahRef(1, 7));
    expect(parseReference('1:8', fakeSurahs), isNull, reason: 'Al-Fatiha has 7 ayahs');
    expect(parseReference('3:1', fakeSurahs), isNull, reason: 'unknown surah in the fake list');
    expect(parseReference('mercy', fakeSurahs), isNull);
  });

  test('match markers become highlighted spans', () {
    const m = TextStyle(fontWeight: FontWeight.bold);
    final spans = highlightSpans('a ${SearchHit.open}b${SearchHit.close} c ${SearchHit.open}d${SearchHit.close}', m);
    expect([for (final s in spans) (s.text, s.style == m)], [('a ', false), ('b', true), (' c ', false), ('d', true)]);
  });
}
