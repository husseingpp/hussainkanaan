/// 123 -> ١٢٣ (Arabic-Indic digits, as printed in the mus'haf).
String arabicDigits(int n) =>
    String.fromCharCodes(n.toString().codeUnits.map((c) => c - 0x30 + 0x0660));
