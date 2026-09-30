import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/content_db.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/user_repository.dart';
import '../common/about.dart';
import '../khatmah/khatmah_plan.dart';
import '../khatmah/khatmah_providers.dart';
import '../khatmah/khatmah_screen.dart';
import '../settings/settings_screen.dart';
import '../study/search_screen.dart';
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
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('المصحف'),
          actions: [
            IconButton(
              tooltip: 'بحث',
              icon: const Icon(Icons.search),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SearchScreen())),
            ),
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
            IconButton(
              tooltip: 'الإعدادات والنسخ الاحتياطي',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SettingsScreen())),
            ),
            IconButton(tooltip: 'حول التطبيق', icon: const Icon(Icons.info_outline), onPressed: () => showCredits(context)),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'السور'), Tab(text: 'الأجزاء'), Tab(text: 'العلامات')]),
        ),
        body: surahs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ContentError(error: error),
          data: (list) => Column(
            children: [
              _ContinueCard(surahs: list, onOpen: (s) => _open(context, ref, s)),
              const _KhatmahTile(),
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
                  _BookmarkList(surahs: list, onOpen: (s) => _open(context, ref, s)),
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

/// The active khatmah at a glance, or an invitation to start one.
class _KhatmahTile extends ConsumerWidget {
  const _KhatmahTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(khatmahsProvider).value;
    if (all == null) return const SizedBox.shrink();
    final k = all.where((k) => !k.isComplete).firstOrNull;
    void manage() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const KhatmahScreen()));
    if (k == null) {
      return Card(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 4),
        child: ListTile(
          leading: const Icon(Icons.track_changes),
          title: const Text('ابدأ ختمة'),
          subtitle: const Text('وِرد يومي بعدد صفحات أو بتاريخ تختم فيه'),
          trailing: const Icon(Icons.chevron_left),
          onTap: manage,
        ),
      );
    }
    final m = ref.watch(khatmahMathProvider).value;
    final today = ref.watch(khatmahTodayProvider(k.uuid)).value;
    final wird = (m == null || today == null) ? null : m.wird(k, DateTime.now(), readBeforeToday: today.startOfDay);
    final doneToday = wird != null && k.progress >= wird.toAyah;
    final days = today == null ? 0 : streak(today.days, DateTime.now());
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 4),
      child: ListTile(
        leading: ProgressRing(value: m?.fraction(k) ?? 0, size: 44),
        title: Text(k.name),
        subtitle: Text([
          if (doneToday) 'أتممت وِرد اليوم ✓'
          else if (wird != null) 'وِرد اليوم: ص ${arabicDigits(wird.fromPage)}–${arabicDigits(wird.toPage)}',
          if (days > 0) '🔥 ${arabicDigits(days)}',
        ].join(' · ')),
        trailing: IconButton(
          tooltip: 'اقرأ وِرد اليوم',
          icon: const Icon(Icons.menu_book),
          onPressed: () => openWird(context, ref, k),
        ),
        onTap: manage,
      ),
    );
  }
}

class _BookmarkList extends ConsumerWidget {
  const _BookmarkList({required this.surahs, required this.onOpen});

  final List<Surah> surahs;
  final ValueChanged<ReaderScreen> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(bookmarksProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ContentError(error: e),
          data: (marks) => marks.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('لا علامات بعد. اضغط رمز العلامة في أعلى القارئ لحفظ موضع.', textAlign: TextAlign.center),
                  ),
                )
              : ListView.builder(
                  itemCount: marks.length,
                  itemBuilder: (context, i) {
                    final b = marks[i];
                    final name = surahs.where((s) => s.id == b.ayah.surah).map((s) => s.nameAr).firstOrNull ?? '';
                    return Dismissible(
                      key: ValueKey(b.uuid),
                      onDismissed: (_) async {
                        await (await ref.read(khatmahRepositoryProvider.future)).toggleBookmark(b.ayah);
                        ref.invalidate(bookmarksProvider);
                      },
                      background: Container(color: Theme.of(context).colorScheme.errorContainer),
                      child: ListTile(
                        leading: const Icon(Icons.bookmark),
                        title: Text('سورة $name، الآية ${arabicDigits(b.ayah.ayah)}'),
                        subtitle: Text(
                            '${arabicDigits(b.createdAt.day)}/${arabicDigits(b.createdAt.month)}/${arabicDigits(b.createdAt.year)}'),
                        onTap: () => onOpen(ReaderScreen(ayah: b.ayah)),
                      ),
                    );
                  },
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
