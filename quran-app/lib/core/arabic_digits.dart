/// 123 -> ١٢٣ (Arabic-Indic digits, as printed in the mus'haf).
String arabicDigits(int n) =>
    String.fromCharCodes(n.toString().codeUnits.map((c) => c - 0x30 + 0x0660));

/// Every Western digit in [s] as Arabic-Indic: "04:30" -> "٠٤:٣٠".
String arabicNumerals(String s) =>
    String.fromCharCodes(s.codeUnits.map((c) => c >= 0x30 && c <= 0x39 ? c - 0x30 + 0x0660 : c));
