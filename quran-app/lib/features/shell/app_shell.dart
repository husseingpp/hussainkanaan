import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/breakpoints.dart';
import '../common/phase_placeholder.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/user_repository.dart';
import '../reader/quran_index_screen.dart';
import '../reader/reader_screen.dart';

class _Destination {
  const _Destination(this.label, this.icon, this.selectedIcon, this.builder);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final WidgetBuilder builder;
}

final _destinations = <_Destination>[
  _Destination('المصحف', Icons.menu_book_outlined, Icons.menu_book,
      (_) => const QuranIndexScreen()),
  _Destination('الاستماع', Icons.headphones_outlined, Icons.headphones,
      (_) => const PhasePlaceholder(title: 'الاستماع', phase: 'Phase 2 — Listen Mode')),
  _Destination('الصلاة', Icons.schedule_outlined, Icons.schedule,
      (_) => const PhasePlaceholder(title: 'مواقيت الصلاة', phase: 'Phase 6a — Prayer times')),
  _Destination('القبلة', Icons.explore_outlined, Icons.explore,
      (_) => const PhasePlaceholder(title: 'القبلة', phase: 'Phase 6b — Qibla')),
  _Destination('التقويم', Icons.calendar_month_outlined, Icons.calendar_month,
      (_) => const PhasePlaceholder(title: 'التقويم', phase: 'Phase 6c — Calendar')),
];

/// Bottom nav below 600, a side rail above it (extended past 1000).
///
/// On launch it opens straight into the mus'haf, at the last position read
/// (or Al-Fatiha on first run); going back from there shows the index.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, this.openReaderOnLaunch = true});

  final bool openReaderOnLaunch;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  var _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.openReaderOnLaunch) WidgetsBinding.instance.addPostFrameCallback((_) => _openReader());
  }

  Future<void> _openReader() async {
    ReadingPosition? last;
    try {
      last = await ref.read(lastPositionProvider.future);
    } catch (_) {
      // No user DB yet (or unreadable): start at the beginning.
    }
    if (!mounted) return;
    await Navigator.of(context).push(PageRouteBuilder<void>(
      // No slide-in: the app should simply open on the page.
      transitionDuration: Duration.zero,
      pageBuilder: (_, _, _) => ReaderScreen(ayah: last?.ayah ?? const AyahRef(1, 1), page: last?.page ?? 1),
    ));
    ref.invalidate(lastPositionProvider);
  }

  void _select(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final size = LayoutSize.of(constraints.maxWidth);
      final body = _destinations[_index].builder(context);

      if (size == LayoutSize.compact) {
        return Scaffold(
          body: body,
          bottomNavigationBar: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: _select,
            destinations: [
              for (final d in _destinations)
                NavigationDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(d.selectedIcon),
                  label: d.label,
                ),
            ],
          ),
        );
      }

      final extended = size == LayoutSize.expanded;
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: _index,
              onDestinationSelected: _select,
              extended: extended,
              labelType: extended ? NavigationRailLabelType.none : NavigationRailLabelType.all,
              destinations: [
                for (final d in _destinations)
                  NavigationRailDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.selectedIcon),
                    label: Text(d.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ],
        ),
      );
    });
  }
}
