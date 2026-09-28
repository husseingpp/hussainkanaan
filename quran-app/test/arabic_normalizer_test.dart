import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/core/arabic_normalizer.dart';

void main() {
  test('matches the vectors shared with tool/ingest/normalize.py', () {
    final vectors = (jsonDecode(
      File('schema/search_normalization_vectors.json').readAsStringSync(),
    ) as Map<String, dynamic>)['vectors'] as List<dynamic>;
    expect(vectors, isNotEmpty);
    for (final v in vectors.cast<Map<String, dynamic>>()) {
      expect(normalizeArabic(v['in'] as String), v['out'], reason: v['why'] as String);
    }
  });
}
