import 'package:flutter/material.dart';

/// Stands in for a destination whose phase hasn't been built yet.
class PhasePlaceholder extends StatelessWidget {
  const PhasePlaceholder({super.key, required this.title, required this.phase});

  final String title;
  final String phase;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          phase,
          textDirection: TextDirection.ltr,
          style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.outline),
        ),
      ),
    );
  }
}
