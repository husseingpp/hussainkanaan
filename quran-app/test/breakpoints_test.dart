import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/core/breakpoints.dart';

void main() {
  test('content-driven breakpoints at 600 and 1000', () {
    expect(LayoutSize.of(360), LayoutSize.compact);
    expect(LayoutSize.of(599.9), LayoutSize.compact);
    expect(LayoutSize.of(600), LayoutSize.medium);
    expect(LayoutSize.of(1000), LayoutSize.medium);
    expect(LayoutSize.of(1000.1), LayoutSize.expanded);
  });
}
