import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/content_db.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/user_repository.dart';
import 'reader_screen.dart';

/// Navigation into the reader: resume, surah, juz, or page number.
class QuranIndexScreen extends ConsumerWidget {
  const QuranIndexScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, ReaderScreen screen) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    ref.invalidate(lastPositionProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surahs = ref.watch(surahsProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('المصحف'),
          actions: [
            IconButton(
              tooltip: 'الانتقال إلى صفحة',
              icon: const Icon(Icons.pin_outlined),
              onPressed: () async {
                final page = await showDialog<int>(context: context, builder: (_) => const _PageJumpDialog());
                if (page == null || !context.mounted) return;
                final first = (await ref.read(mushafPageProvider(page).future)).firstAyah ?? const AyahRef(1, 1);
                if (context.mounted) await _open(context, ref, ReaderScreen(ayah: first, page: page));
              },
            ),
            const ThemeToggleButton(),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'السور'), Tab(text: 'الأجزاء')]),
        ),
        body: surahs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ContentError(error: error),
          data: (list) => Column(
            children: [
              _ContinueCard(surahs: list, onOpen: (s) => _open(context, ref, s)),
              Expanded(
                child: TabBarView(children: [
                  ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (context, i) => _SurahTile(
                      surah: list[i],
                      onTap: () => _open(context, ref, ReaderScreen(ayah: AyahRef(list[i].id, 1), page: list[i].pageStart)),
                    ),
                  ),
                  _JuzList(surahs: list, onOpen: (s) => _open(context, ref, s)),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContinueCard extends ConsumerWidget {
  const _ContinueCard({required this.surahs, required this.onOpen});

  final List<Surah> surahs;
  final ValueChanged<ReaderScreen> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ReadingPosition? pos = ref.watch(lastPositionProvider).value;
    if (pos == null) return const SizedBox.shrink();
    final name = surahs.where((s) => s.id == pos.ayah.surah).map((s) => s.nameAr).firstOrNull ?? '';
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: ListTile(
        leading: const Icon(Icons.bookmark_outline),
        title: const Text('متابعة القراءة'),
        subtitle: Text('سورة $name · الآية ${arabicDigits(pos.ayah.ayah)} · ${pageLabel(pos.page)}'),
        trailing: const Icon(Icons.chevron_left),
        onTap: () => onOpen(ReaderScreen(ayah: pos.ayah, page: pos.page, view: pos.view)),
      ),
    );
  }
}

class _SurahTile extends StatelessWidget {
  const _SurahTile({required this.surah, required this.onTap});

  final Surah surah;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text(arabicDigits(surah.id))),
      title: Text(surah.nameAr),
      subtitle: Text('${surah.isMeccan ? 'مكية' : 'مدنية'} · آياتها ${arabicDigits(surah.ayahCount)}'),
      trailing: Text(pageLabel(surah.pageStart)),
      onTap: onTap,
    );
  }
}

class _JuzList extends ConsumerWidget {
  const _JuzList({required this.surahs, required this.onOpen});

  final List<Surah> surahs;
  final ValueChanged<ReaderScreen> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(juzStartsProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ContentError(error: e),
          data: (juzs) => ListView.builder(
            itemCount: juzs.length,
            itemBuilder: (context, i) {
              final j = juzs[i];
              final name = surahs.where((s) => s.id == j.start.surah).map((s) => s.nameAr).firstOrNull ?? '';
              return ListTile(
                leading: CircleAvatar(child: Text(arabicDigits(j.juz))),
                title: Text('الجزء ${arabicDigits(j.juz)}'),
                subtitle: Text('يبدأ من سورة $name، الآية ${arabicDigits(j.start.ayah)}'),
                trailing: Text(pageLabel(j.page)),
                onTap: () => onOpen(ReaderScreen(ayah: j.start, page: j.page)),
              );
            },
          ),
        );
  }
}

class _PageJumpDialog extends StatefulWidget {
  const _PageJumpDialog();

  @override
  State<_PageJumpDialog> createState() => _PageJumpDialogState();
}

class _PageJumpDialogState extends State<_PageJumpDialog> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    // Accept both 123 and ١٢٣.
    final raw = String.fromCharCodes(_controller.text.trim().codeUnits.map(
          (c) => c >= 0x0660 && c <= 0x0669 ? c - 0x0660 + 0x30 : c,
        ));
    final page = int.tryParse(raw);
    if (page == null || page < 1 || page > ContentDb.pageCount) {
      setState(() => _error = 'أدخل رقمًا من ١ إلى ٦٠٤');
      return;
    }
    Navigator.of(context).pop(page);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('الانتقال إلى صفحة'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[0-9٠-٩]'))],
        decoration: InputDecoration(hintText: '١ – ٦٠٤', errorText: _error),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('إلغاء')),
        FilledButton(onPressed: _submit, child: const Text('انتقال')),
      ],
    );
  }
}

class _ContentError extends StatelessWidget {
  const _ContentError({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final missing = error is ContentDbMissing;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(missing ? Icons.storage : Icons.error_outline, size: 48),
            const SizedBox(height: 16),
            Text(missing ? 'لم يتم تضمين قاعدة بيانات المصحف' : 'تعذّر فتح قاعدة بيانات المصحف'),
            const SizedBox(height: 8),
            Text('$error', textDirection: TextDirection.ltr, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
