import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import 'audio_library.dart';
import 'listen_providers.dart';

/// One reciter's recitation files: download all or by surah, delete by surah.
class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key, required this.reciter});

  final Reciter reciter;

  Future<void> _download(BuildContext context, WidgetRef ref, List<Surah> surahs) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _DownloadDialog(reciter: reciter, surahs: surahs),
    );
    ref.invalidate(downloadedSurahsProvider(reciter.slug));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surahs = ref.watch(surahsProvider).value ?? const <Surah>[];
    final sizes = ref.watch(surahSizesProvider(reciter.id)).value ?? const <int, int>{};
    final done = ref.watch(downloadedSurahsProvider(reciter.slug)).value ?? const <int>{};
    final missing = [for (final s in surahs) if (!done.contains(s.id)) s];
    final missingBytes = missing.fold<int>(0, (n, s) => n + (sizes[s.id] ?? 0));
    final bundled = ref.watch(bundledAudioProvider).value?.slug == reciter.slug;

    return Scaffold(
      appBar: AppBar(title: Text(reciter.nameAr ?? reciter.name)),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('المُنزَّل: ${arabicDigits(done.length)} من ${arabicDigits(surahs.length)} سورة'),
              const SizedBox(height: 4),
              Text(
                  bundled
                      ? 'هذه التلاوة مضمّنة في التطبيق كاملة، فلا تحتاج إلى تنزيل.'
                      : 'حجم التلاوة كاملة: ≈ ${formatBytes(reciter.approxBytes)}',
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
              if (missing.isNotEmpty)
                FilledButton.icon(
                  icon: const Icon(Icons.download),
                  label: Text('تنزيل الباقي (≈ ${formatBytes(missingBytes)})'),
                  onPressed: () => _download(context, ref, missing),
                ),
              const SizedBox(height: 4),
              Text(
                'يُستحسن التنزيل عبر Wi-Fi. التلاوة لا تُبث من الإنترنت أثناء الاستماع.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ]),
          ),
          const Divider(height: 1),
          for (final s in surahs)
            ListTile(
              leading: CircleAvatar(child: Text(arabicDigits(s.id))),
              title: Text(s.nameAr),
              subtitle: Text('≈ ${formatBytes(sizes[s.id] ?? 0)}'),
              trailing: bundled
                  ? const Icon(Icons.check_circle_outline)
                  : done.contains(s.id)
                  ? IconButton(
                      tooltip: 'حذف',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        final lib = await ref.read(audioLibraryProvider.future);
                        lib.delete(reciter, [s], surahs);
                        ref.invalidate(downloadedSurahsProvider(reciter.slug));
                      },
                    )
                  : IconButton(
                      tooltip: 'تنزيل',
                      icon: const Icon(Icons.download_outlined),
                      onPressed: () => _download(context, ref, [s]),
                    ),
            ),
        ],
      ),
    );
  }
}

class _DownloadDialog extends ConsumerStatefulWidget {
  const _DownloadDialog({required this.reciter, required this.surahs});

  final Reciter reciter;
  final List<Surah> surahs;

  @override
  ConsumerState<_DownloadDialog> createState() => _DownloadDialogState();
}

class _DownloadDialogState extends ConsumerState<_DownloadDialog> {
  var _done = 0;
  var _total = 0;
  var _cancelled = false;
  var _running = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    setState(() {
      _running = true;
      _error = null;
    });
    try {
      final lib = await ref.read(audioLibraryProvider.future);
      await lib.download(
        widget.reciter,
        widget.surahs,
        isCancelled: () => _cancelled || !mounted,
        onProgress: (done, total) {
          if (mounted) {
            setState(() {
              _done = done;
              _total = total;
            });
          }
        },
      );
    } catch (e) {
      _error = e;
    }
    if (!mounted) return;
    if (_error == null) {
      Navigator.of(context).pop();
    } else {
      setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تنزيل التلاوة'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        LinearProgressIndicator(value: _total == 0 ? null : _done / _total),
        const SizedBox(height: 12),
        Text('${arabicDigits(_done)} من ${arabicDigits(_total)} ملفًا'),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(
            _error is AudioDownloadError
                ? 'تعذّر التنزيل (${(_error as AudioDownloadError).reason}). ما نُزّل محفوظ، ويمكنك المتابعة لاحقًا.'
                : 'تعذّر التنزيل. تحقق من الاتصال وحاول مجددًا.',
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
      ]),
      actions: [
        if (!_running && _error != null) TextButton(onPressed: _run, child: const Text('إعادة المحاولة')),
        TextButton(
          onPressed: () {
            if (_running) {
              setState(() => _cancelled = true);
            } else {
              Navigator.of(context).pop();
            }
          },
          child: Text(_running ? (_cancelled ? 'جارٍ الإيقاف…' : 'إيقاف') : 'إغلاق'),
        ),
      ],
    );
  }
}
