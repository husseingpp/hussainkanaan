import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/content_db.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/reader_settings.dart';
import '../../data/user_repository.dart';
import 'font_pack.dart';
import 'mushaf_page.dart';
import 'reading_view.dart';

/// The reader: Page View (the printed mus'haf) or Reading View (flowing text).
///
/// Opens at [ayah], and in Page View at [page] if given (else the ayah's page).
/// The position is saved as you read, so the index can offer to resume it.
class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key, required this.ayah, this.page, this.view});

  final AyahRef ayah;
  final int? page;

  /// Overrides the saved view preference (e.g. resuming in the view you left).
  final ReaderView? view;

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  late AyahRef _ayah = widget.ayah;
  late int _page = widget.page ?? 0;
  ReaderView? _view;
  PageController? _pages;
  Timer? _saveTimer;
  UserRepository? _repo;

  @override
  void initState() {
    super.initState();
    _view = widget.view;
    ref.read(userRepositoryProvider.future).then((r) => _repo = r);
    if (_page == 0) {
      ref.read(contentDbProvider.future).then((db) => db.pageOf(_ayah)).then((p) {
        if (mounted) setState(() => _page = p);
      });
    }
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _save();
    _pages?.dispose();
    super.dispose();
  }

  ReaderView get _currentView => _view ?? ref.read(settingsProvider).value?.view ?? ReaderView.page;

  void _save() {
    final repo = _repo;
    if (repo == null || _page == 0) return;
    repo.savePosition(ReadingPosition(view: _currentView, ayah: _ayah, page: _page));
  }

  /// Positions change constantly while scrolling; write at most once a second.
  void _scheduleSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(seconds: 1), _save);
  }

  Future<void> _switchView() async {
    final next = _currentView == ReaderView.page ? ReaderView.reading : ReaderView.page;
    if (next == ReaderView.page) {
      final db = await ref.read(contentDbProvider.future);
      _page = await db.pageOf(_ayah);
      _pages?.dispose();
      _pages = null;
    }
    setState(() => _view = next);
    await ref.read(settingsProvider.notifier).change((s) => s.copyWith(view: next));
    _scheduleSave();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider).value ?? const ReaderSettings();
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final view = _view ?? settings.view;
    final surah = surahs.where((s) => s.id == _ayah.surah).firstOrNull;
    final title = surah == null ? '' : 'سورة ${surah.nameAr}';

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (view == ReaderView.reading) ...[
            IconButton(
              tooltip: 'الترجمة',
              isSelected: settings.showTranslation,
              icon: const Icon(Icons.translate),
              onPressed: () => ref
                  .read(settingsProvider.notifier)
                  .change((s) => s.copyWith(showTranslation: !s.showTranslation)),
            ),
            IconButton(
              tooltip: 'تصغير الخط',
              icon: const Icon(Icons.text_decrease),
              onPressed: settings.fontScale <= ReaderSettings.minScale
                  ? null
                  : () => ref.read(settingsProvider.notifier).change((s) => s.copyWith(fontScale: s.fontScale - 0.1)),
            ),
            IconButton(
              tooltip: 'تكبير الخط',
              icon: const Icon(Icons.text_increase),
              onPressed: settings.fontScale >= ReaderSettings.maxScale
                  ? null
                  : () => ref.read(settingsProvider.notifier).change((s) => s.copyWith(fontScale: s.fontScale + 0.1)),
            ),
          ],
          IconButton(
            tooltip: view == ReaderView.page ? 'عرض القراءة' : 'عرض الصفحة',
            icon: Icon(view == ReaderView.page ? Icons.view_agenda_outlined : Icons.auto_stories_outlined),
            onPressed: _switchView,
          ),
          const ThemeToggleButton(),
        ],
      ),
      body: SafeArea(
        child: switch (view) {
          ReaderView.page => _page == 0
              ? const Center(child: CircularProgressIndicator())
              : Column(children: [const FontPackBanner(), Expanded(child: _pageView())]),
          ReaderView.reading => surah == null
              ? const Center(child: CircularProgressIndicator())
              : ReadingView(
                  key: ValueKey('surah-${surah.id}'),
                  surah: surah,
                  initialAyah: _ayah.ayah,
                  settings: settings,
                  onVisibleAyah: (a) {
                    _ayah = a.ref;
                    _page = a.page;
                    _scheduleSave();
                  },
                  onChangeSurah: (s) => setState(() {
                    _ayah = AyahRef(s, 1);
                    _scheduleSave();
                  }),
                ),
        },
      ),
    );
  }

  Widget _pageView() {
    final controller = _pages ??= PageController(initialPage: _page - 1);
    // In the RTL app root, PageView advances leftwards, like a printed mus'haf.
    return PageView.builder(
      controller: controller,
      itemCount: ContentDb.pageCount,
      onPageChanged: (i) async {
        _page = i + 1;
        final p = await ref.read(mushafPageProvider(i + 1).future);
        if (!mounted || _page != i + 1) return;
        final first = p.firstAyah;
        if (first != null) setState(() => _ayah = first);
        _scheduleSave();
      },
      itemBuilder: (context, i) => MushafPageView(page: i + 1),
    );
  }
}

/// Cycles system → light → dark (night mode), saved with the reader settings.
class ThemeToggleButton extends ConsumerWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(settingsProvider).value?.themeMode ?? ThemeMode.system;
    final (icon, label, next) = switch (mode) {
      ThemeMode.system => (Icons.brightness_auto, 'حسب النظام', ThemeMode.light),
      ThemeMode.light => (Icons.light_mode, 'الوضع النهاري', ThemeMode.dark),
      ThemeMode.dark => (Icons.dark_mode, 'الوضع الليلي', ThemeMode.system),
    };
    return IconButton(
      tooltip: label,
      icon: Icon(icon),
      onPressed: () => ref.read(settingsProvider.notifier).change((s) => s.copyWith(themeMode: next)),
    );
  }
}

String pageLabel(int page) => 'صفحة ${arabicDigits(page)}';
