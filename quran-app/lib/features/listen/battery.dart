import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

/// Android battery optimisation: even a correct foreground service is killed
/// by aggressive OEM battery savers (BLUEPRINT §3), so the app asks once to be
/// exempted and shows the maker-specific steps.
class BatteryStatus {
  const BatteryStatus({required this.exempt, required this.manufacturer});

  final bool exempt;
  final String manufacturer;
}

/// Null off Android, where none of this applies.
final batteryStatusProvider = FutureProvider<BatteryStatus?>((ref) async {
  if (!Platform.isAndroid) return null;
  final info = await DeviceInfoPlugin().androidInfo;
  return BatteryStatus(
    exempt: await Permission.ignoreBatteryOptimizations.isGranted,
    manufacturer: info.manufacturer.toLowerCase(),
  );
});

/// The extra steps each maker's own battery saver needs, beyond Android's.
String batterySteps(String manufacturer) {
  if (['xiaomi', 'redmi', 'poco'].any(manufacturer.contains)) {
    return 'على هواتف شاومي: الإعدادات ← التطبيقات ← إدارة التطبيقات ← القرآن الكريم ← '
        'توفير البطارية ← «بلا قيود»، وفعّل «التشغيل التلقائي».';
  }
  if (manufacturer.contains('samsung')) {
    return 'على هواتف سامسونج: الإعدادات ← البطارية ← حدود استخدام الخلفية ← '
        '«التطبيقات التي لا تدخل وضع السكون أبدًا» وأضف القرآن الكريم.';
  }
  if (['huawei', 'honor'].any(manufacturer.contains)) {
    return 'على هواتف هواوي وهونر: الإعدادات ← البطارية ← تشغيل التطبيقات ← القرآن الكريم ← '
        'إدارة يدوية، وفعّل الخيارات الثلاثة.';
  }
  if (['oppo', 'realme', 'oneplus', 'vivo'].any(manufacturer.contains)) {
    return 'الإعدادات ← البطارية ← استخدام البطارية للتطبيقات ← القرآن الكريم ← '
        '«السماح بالنشاط في الخلفية».';
  }
  return 'الإعدادات ← التطبيقات ← القرآن الكريم ← البطارية ← «غير مقيّد».';
}

/// Shown until the app is exempt: the one screen that keeps a sleep session
/// alive through the night on phones that kill background audio.
class BatteryCard extends ConsumerWidget {
  const BatteryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(batteryStatusProvider).value;
    if (status == null || status.exempt) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.tertiaryContainer,
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.battery_alert, color: scheme.onTertiaryContainer),
            const SizedBox(width: 8),
            Expanded(
              child: Text('حتى لا تتوقف التلاوة أثناء النوم',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(color: scheme.onTertiaryContainer)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            'قد يوقف نظام توفير البطارية التلاوة بعد إطفاء الشاشة. اسمح للتطبيق بالعمل في الخلفية:',
            style: TextStyle(color: scheme.onTertiaryContainer),
          ),
          const SizedBox(height: 4),
          Text(batterySteps(status.manufacturer), style: TextStyle(color: scheme.onTertiaryContainer)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            FilledButton(
              onPressed: () async {
                await Permission.ignoreBatteryOptimizations.request();
                ref.invalidate(batteryStatusProvider);
              },
              child: const Text('السماح الآن'),
            ),
            TextButton(onPressed: openAppSettings, child: const Text('إعدادات التطبيق')),
          ]),
        ]),
      ),
    );
  }
}

/// Android 13+ asks before an app may post notifications. The playback
/// notification (and, on several phones, the lock-screen controls) only
/// appear once it's granted. Null off Android.
final notificationPermissionProvider = FutureProvider<bool?>((ref) async {
  if (!Platform.isAndroid) return null;
  return Permission.notification.isGranted;
});

/// Asks once, just before playback starts, when the reason is obvious.
Future<void> requestNotificationPermission() async {
  if (!Platform.isAndroid) return;
  try {
    final status = await Permission.notification.status;
    if (!status.isGranted && !status.isPermanentlyDenied) await Permission.notification.request();
  } catch (_) {
    // No plugin (tests): nothing to ask.
  }
}

/// Shown while notifications are off: without them there are no controls
/// outside the app.
class NotificationCard extends ConsumerWidget {
  const NotificationCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final granted = ref.watch(notificationPermissionProvider).value;
    if (granted == null || granted) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.secondaryContainer,
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: ListTile(
        leading: Icon(Icons.notifications_off_outlined, color: scheme.onSecondaryContainer),
        title: Text('الإشعارات متوقفة', style: TextStyle(color: scheme.onSecondaryContainer)),
        subtitle: Text(
          'اسمح بالإشعارات للتحكم في التلاوة من شاشة القفل والإشعارات وسماعات الرأس.',
          style: TextStyle(color: scheme.onSecondaryContainer),
        ),
        trailing: TextButton(
          onPressed: () async {
            final status = await Permission.notification.status;
            if (status.isPermanentlyDenied) {
              await openAppSettings();
            } else {
              await Permission.notification.request();
            }
            ref.invalidate(notificationPermissionProvider);
          },
          child: const Text('السماح'),
        ),
      ),
    );
  }
}
