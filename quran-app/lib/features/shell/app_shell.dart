import 'package:flutter/material.dart';

import '../../core/breakpoints.dart';
import '../common/phase_placeholder.dart';
import '../reader/surah_list_screen.dart';

class _Destination {
  const _Destination(this.label, this.icon, this.selectedIcon, this.builder);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final WidgetBuilder builder;
}

final _destinations = <_Destination>[
  _Destination('المصحف', Icons.menu_book_outlined, Icons.menu_book,
      (_) => const SurahListScreen()),
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
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  var _index = 0;

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
