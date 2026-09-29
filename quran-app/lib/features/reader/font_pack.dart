import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../../data/mushaf_fonts.dart';
import '../../data/providers.dart';

/// Offers the one-time download of the printed mus'haf fonts, above Page View.
class FontPackBanner extends ConsumerStatefulWidget {
  const FontPackBanner({super.key});

  @override
  ConsumerState<FontPackBanner> createState() => _FontPackBannerState();
}

class _FontPackBannerState extends ConsumerState<FontPackBanner> {
  var _dismissed = false;

  @override
  Widget build(BuildContext context) {
    final pack = ref.watch(mushafFontPackProvider).value;
    if (_dismissed || pack == null || pack.fonts.isEmpty || pack.isComplete) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final mb = arabicDigits((pack.totalBytes / 1e6).round());
    return Material(
      color: scheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 8, 8),
        child: Row(children: [
          Expanded(
            child: Text(
              'لعرض الصفحات بخط مصحف المدينة الأصلي، نزّل خطوط المصحف مرة واحدة ($mb م.ب).',
              style: TextStyle(color: scheme.onSecondaryContainer),
            ),
          ),
          TextButton(
            onPressed: () => showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder: (_) => const FontPackDownloadDialog(),
            ),
            child: const Text('تنزيل'),
          ),
          IconButton(
            tooltip: 'إخفاء',
            icon: const Icon(Icons.close),
            onPressed: () => setState(() => _dismissed = true),
          ),
        ]),
      ),
    );
  }
}

class FontPackDownloadDialog extends ConsumerStatefulWidget {
  const FontPackDownloadDialog({super.key});

  @override
  ConsumerState<FontPackDownloadDialog> createState() => _FontPackDownloadDialogState();
}

class _FontPackDownloadDialogState extends ConsumerState<FontPackDownloadDialog> {
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
      final pack = await ref.read(mushafFontPackProvider.future);
      await pack.download(
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
    // Pages re-resolve their font; the banner re-checks what's installed.
    ref.invalidate(mushafFontProvider);
    ref.invalidate(mushafFontPackProvider);
    if (!mounted) return;
    // Finished or stopped: what's downloaded is kept, and the next run resumes.
    if (_error == null) {
      Navigator.of(context).pop();
    } else {
      setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = _total == 0 ? null : _done / _total;
    return AlertDialog(
      title: const Text('تنزيل خطوط المصحف'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LinearProgressIndicator(value: progress),
          const SizedBox(height: 12),
          Text('${arabicDigits(_done)} من ${arabicDigits(_total)} صفحة'),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error is FontDownloadError ? 'تعذّر التنزيل (${(_error as FontDownloadError).reason}). ما نُزّل محفوظ، ويمكنك المتابعة لاحقًا.' : 'تعذّر التنزيل. تحقق من الاتصال وحاول مجددًا.',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
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
