/// One design, three widths (BLUEPRINT §11). Decided by available width, never
/// by platform: a portrait tablet and a narrow desktop window are the same case.
enum LayoutSize {
  /// Single page, bottom nav, sheet-based tafsir.
  compact,

  /// Single page + persistent side rail.
  medium,

  /// Two-page spread + docked tafsir/translation panel.
  expanded;

  static LayoutSize of(double width) {
    if (width < 600) return compact;
    if (width <= 1000) return medium;
    return expanded;
  }
}
