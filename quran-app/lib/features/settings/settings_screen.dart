import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/arabic_digits.dart';
import '../../data/providers.dart';
import '../backup/backup.dart';
import '../khatmah/khatmah_providers.dart';
import '../khatmah/khatmah_screen.dart';
import '../listen/battery.dart';

/// Daily ayah reminder, and backup of the user's data (bookmarks, notes,
/// khatmah plans, preferences) as one JSON file. There is no account and no
/// server: the file is the backup.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reminders = ref.watch(reminderSettingsProvider).value;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text('التذكير', style: text.titleSmall),
        ),
        SwitchListTile(
          secondary: const Icon(Icons.wb_sunny_outlined),
          title: const Text('آية اليوم'),
          subtitle: const Text('إشعار كل يوم بآية قصيرة وترجمتها'),
          value: reminders?.dailyAyah ?? false,
          onChanged: reminders == null
              ? null
              : (on) async {
                  if (on) {
                    await requestNotificationPermission();
                    await ref.read(reminderSchedulerProvider).requestPermission();
                  }
                  await ref.read(reminderSettingsProvider.notifier).change((s) => s.copyWith(dailyAyah: on));
                },
        ),
        ListTile(
          enabled: reminders?.dailyAyah ?? false,
          leading: const Icon(Icons.schedule),
          title: const Text('وقت آية اليوم'),
          trailing: Text(timeLabel(reminders?.dailyAyahMinutes ?? 7 * 60)),
          onTap: () async {
            final m = reminders!.dailyAyahMinutes;
            final picked = await showTimePicker(
              context: context,
              helpText: 'وقت آية اليوم',
              initialTime: TimeOfDay(hour: m ~/ 60, minute: m % 60),
            );
            if (picked == null) return;
            await ref
                .read(reminderSettingsProvider.notifier)
                .change((s) => s.copyWith(dailyAyahMinutes: picked.hour * 60 + picked.minute));
          },
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Text('النسخ الاحتياطي', style: text.titleSmall),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'ملف واحد فيه العلامات والملاحظات والختمات والتفضيلات. لا حساب ولا خادم: احفظ الملف حيث تشاء. '
            'الاستعادة تدمج مع ما على الجهاز ولا تحذف شيئًا.',
          ),
        ),
        ListTile(
          leading: const Icon(Icons.upload_file),
          title: const Text('تصدير نسخة احتياطية'),
          onTap: () => _export(context, ref),
        ),
        ListTile(
          leading: const Icon(Icons.restore),
          title: const Text('استعادة من ملف'),
          onTap: () => _import(context, ref),
        ),
      ]),
    );
  }

  Future<BackupService> _service(WidgetRef ref) async => BackupService((await ref.read(userDbProvider.future)).db);

  Future<void> _export(BuildContext context, WidgetRef ref) async {
    final json = await (await _service(ref)).export();
    final now = DateTime.now();
    final stamp = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final name = 'quran-backup-$stamp.json';
    if (Platform.isAndroid || Platform.isIOS) {
      final file = File('${(await getTemporaryDirectory()).path}/$name');
      await file.writeAsString(json);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'application/json')], subject: name));
      return;
    }
    final location = await getSaveLocation(
      suggestedName: name,
      acceptedTypeGroups: const [XTypeGroup(label: 'JSON', extensions: ['json'])],
    );
    if (location == null) return;
    await File(location.path).writeAsString(json);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('حُفظت النسخة الاحتياطية')));
    }
  }

  Future<void> _import(BuildContext context, WidgetRef ref) async {
    final file = await openFile(acceptedTypeGroups: const [
      XTypeGroup(label: 'JSON', extensions: ['json'], mimeTypes: ['application/json'], uniformTypeIdentifiers: ['public.json']),
    ]);
    if (file == null) return;
    String message;
    try {
      final counts = await (await _service(ref)).restore(await file.readAsString());
      final n = counts.values.fold(0, (a, b) => a + b);
      message = 'تمّت الاستعادة: ${arabicDigits(n)} سجلًّا';
      ref
        ..invalidate(khatmahsProvider)
        ..invalidate(bookmarksProvider)
        ..invalidate(reminderSettingsProvider)
        ..invalidate(settingsProvider)
        ..invalidate(lastPositionProvider);
      await syncReminders(ref.read);
    } on BackupError catch (e) {
      message = e.message;
    } on FormatException {
      message = 'الملف ليس نسخة احتياطية صالحة.';
    }
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
