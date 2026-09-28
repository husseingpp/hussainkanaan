import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/content_db.dart';
import '../../data/models.dart';
import '../../data/providers.dart';

/// Surah index. Phase 1 adds juz/page navigation and opens the reader.
class SurahListScreen extends ConsumerWidget {
  const SurahListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surahs = ref.watch(surahsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('السور')),
      body: surahs.when(
        data: (list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) => _SurahTile(surah: list[i]),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ContentError(error: error),
      ),
    );
  }
}

class _SurahTile extends StatelessWidget {
  const _SurahTile({required this.surah});

  final Surah surah;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text('${surah.id}')),
      title: Text(surah.nameAr),
      subtitle: Text('${surah.isMeccan ? 'مكية' : 'مدنية'} · آياتها ${surah.ayahCount}'),
      trailing: Text('ص ${surah.pageStart}'),
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
