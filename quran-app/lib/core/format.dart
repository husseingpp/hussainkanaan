import 'arabic_digits.dart';

/// "٤٥ م.ب", "١٫٧ غ.ب": sizes shown to the reader.
String formatBytes(int bytes) {
  if (bytes >= 1e9) {
    final gb = (bytes / 1e9 * 10).round();
    return '${arabicDigits(gb ~/ 10)}٫${arabicDigits(gb % 10)} غ.ب';
  }
  return '${arabicDigits((bytes / 1e6).ceil())} م.ب';
}

/// "١ س ٥ د" / "١٢ د" / "٤٥ ث".
String formatDuration(Duration d) {
  if (d.inHours > 0) return '${arabicDigits(d.inHours)} س ${arabicDigits(d.inMinutes % 60)} د';
  if (d.inMinutes > 0) return '${arabicDigits(d.inMinutes)} د';
  return '${arabicDigits(d.inSeconds)} ث';
}
