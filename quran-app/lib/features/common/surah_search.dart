import 'package:flutter/material.dart';

import '../../core/arabic_digits.dart';
import '../../core/arabic_normalizer.dart';
import '../../data/models.dart';

/// Western and Arabic-Indic digits to an int, or null.
int? parseNumber(String s) {
  final western = String.fromCharCodes(s.trim().codeUnits.map((c) => c >= 0x0660 && c <= 0x0669 ? c - 0x0660 + 0x30 : c));
  return RegExp(r'^\d+$').hasMatch(western) ? int.parse(western) : null;
}

String _arabicKey(String s) {
  var n = normalizeArabic(s).replaceAll(RegExp(r'^سوره\s*'), '');
  if (n.startsWith('ال')) n = n.substring(2);
  return n.replaceAll(' ', '');
}

String _latinKey(String s) => s.toLowerCase().replaceAll(RegExp(r"[^a-z0-9]"), '').replaceFirst(RegExp(r'^(al|an|ar|as|at|ad|adh|az|ash)'), '');

/// Surahs matching [query], best first: a number goes straight to that surah
/// (and those starting with it); names match without diacritics, «ال», «سورة»,
/// hamza/alef/ta-marbuta differences, or in transliteration/English.
List<Surah> filterSurahs(List<Surah> surahs, String query) {
  final q = query.trim();
  if (q.isEmpty) return surahs;
  final n = parseNumber(q);
  if (n != null) {
    return [
      ...surahs.where((s) => s.id == n),
      ...surahs.where((s) => s.id != n && s.id.toString().startsWith(n.toString())),
    ];
  }
  final ar = _arabicKey(q);
  final la = _latinKey(q);
  int? rank(Surah s) {
    final name = _arabicKey(s.nameAr);
    if (ar.isNotEmpty && name == ar) return 0;
    if (ar.isNotEmpty && name.startsWith(ar)) return 1;
    if (ar.isNotEmpty && name.contains(ar)) return 2;
    if (la.isNotEmpty) {
      final t = _latinKey(s.nameTranslit), e = s.nameEn.toLowerCase();
      if (t.startsWith(la)) return 1;
      if (t.contains(la) || e.contains(q.toLowerCase())) return 3;
    }
    return null;
  }

  final hits = [for (final s in surahs) if (rank(s) case final r?) (r, s)]..sort((a, b) => a.$1 != b.$1 ? a.$1 - b.$1 : a.$2.id - b.$2.id);
  return [for (final h in hits) h.$2];
}

/// A large, clear search box for surahs.
class SurahSearchField extends StatelessWidget {
  const SurahSearchField({super.key, required this.controller, this.autofocus = false, this.onChanged});

  final TextEditingController controller;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: autofocus,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: Theme.of(context).textTheme.titleMedium,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search),
        hintText: 'ابحث باسم السورة أو رقمها',
        filled: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(28), borderSide: BorderSide.none),
        suffixIcon: ListenableBuilder(
          listenable: controller,
          builder: (context, _) => controller.text.isEmpty
              ? const SizedBox.shrink()
              : IconButton(
                  tooltip: 'مسح البحث',
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    controller.clear();
                    onChanged?.call('');
                  },
                ),
        ),
      ),
    );
  }
}

/// One surah row: number, name, place of revelation and length, with room
/// for actions. Big enough to hit easily, and read as one sentence by
/// screen readers.
class SurahRow extends StatelessWidget {
  const SurahRow({super.key, required this.surah, this.onTap, this.trailing, this.subtitleExtra, this.selected = false});

  final Surah surah;
  final VoidCallback? onTap;
  final Widget? trailing;
  final String? subtitleExtra;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final s = surah;
    final subtitle = [
      s.isMeccan ? 'مكية' : 'مدنية',
      'آياتها ${arabicDigits(s.ayahCount)}',
      ?subtitleExtra,
    ].join(' · ');
    return MergeSemantics(
      child: ListTile(
        minTileHeight: 64,
        selected: selected,
        leading: CircleAvatar(child: Text(arabicDigits(s.id))),
        title: Text(s.nameAr, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(subtitle),
        trailing: trailing,
        onTap: onTap,
      ),
    );
  }
}

/// A full-height, searchable surah list in a bottom sheet. Returns the
/// chosen surah. [mark] adds a note per surah (e.g. "مُنزّلة").
Future<Surah?> showSurahPicker(
  BuildContext context, {
  required List<Surah> surahs,
  String title = 'اختر السورة',
  int? selected,
  String? Function(Surah)? mark,
}) =>
    showModalBottomSheet<Surah>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.92,
        child: _SurahPicker(surahs: surahs, title: title, selected: selected, mark: mark),
      ),
    );

class _SurahPicker extends StatefulWidget {
  const _SurahPicker({required this.surahs, required this.title, this.selected, this.mark});

  final List<Surah> surahs;
  final String title;
  final int? selected;
  final String? Function(Surah)? mark;

  @override
  State<_SurahPicker> createState() => _SurahPickerState();
}

class _SurahPickerState extends State<_SurahPicker> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = filterSurahs(widget.surahs, _query.text);
    return Column(children: [
      Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: SurahSearchField(
          controller: _query,
          onChanged: (_) => setState(() {}),
        ),
      ),
      Expanded(
        child: list.isEmpty
            ? const Center(child: Text('لا سورة بهذا الاسم أو الرقم'))
            : ListView.builder(
                itemCount: list.length,
                itemBuilder: (context, i) => SurahRow(
                  surah: list[i],
                  selected: list[i].id == widget.selected,
                  subtitleExtra: widget.mark?.call(list[i]),
                  trailing: list[i].id == widget.selected ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.of(context).pop(list[i]),
                ),
              ),
      ),
    ]);
  }
}
