import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/arabic_digits.dart';
import '../khatmah/khatmah_providers.dart';
import 'cities.dart';
import 'prayer_providers.dart';
import 'zones.dart';

const currentLocationLabel = 'موقعي الحالي';

City? nearestCity(double lat, double lng, {double withinKm = 60}) {
  City? best;
  var bestKm = double.infinity;
  for (final c in cities) {
    final dLat = (c.lat - lat) * 111;
    final dLng = (c.lng - lng) * 111 * math.cos(lat * math.pi / 180);
    final km = math.sqrt(dLat * dLat + dLng * dLng);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return bestKm <= withinKm ? best : null;
}

Future<String> _deviceZone() async {
  try {
    return (await FlutterTimezone.getLocalTimezone()).identifier;
  } catch (_) {
    return 'UTC';
  }
}

Future<void> _saved(WidgetRef ref) async {
  ref.invalidate(locationsProvider);
  await syncReminders(ref.read);
}

/// GPS once, with a plain explanation first (never at launch: CLAUDE.md).
/// Works offline: the position comes from the satellites, not a server.
Future<String?> useCurrentLocation(BuildContext context, WidgetRef ref) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('استخدام موقعك'),
      content: const Text(
        'يُحسب وقت الصلاة واتجاه القبلة من موقعك على جهازك فقط، ولا يُرسل الموقع إلى أي مكان. '
        'يكفي موقع تقريبي. ويمكنك بدلًا من ذلك اختيار مدينتك من القائمة.',
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('اختيار مدينة')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('متابعة')),
      ],
    ),
  );
  if (ok != true) return 'city';
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return 'خدمة الموقع متوقفة في إعدادات الهاتف.';
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      return 'لم يُسمح بالوصول إلى الموقع. اختر مدينتك من القائمة أو أدخل الإحداثيات.';
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 30)),
    );
    final zoneName = await _deviceZone();
    final near = nearestCity(pos.latitude, pos.longitude);
    final repo = await ref.read(prayerRepositoryProvider.future);
    await repo.add(
      label: near == null ? currentLocationLabel : '$currentLocationLabel (${near.nameAr})',
      lat: pos.latitude,
      lng: pos.longitude,
      timezone: zoneName,
    );
    await _saved(ref);
    return null;
  } catch (e) {
    return 'تعذّر تحديد الموقع: $e';
  }
}

/// Saved places, current location, a city, or coordinates.
class LocationSheet extends ConsumerStatefulWidget {
  const LocationSheet({super.key});

  @override
  ConsumerState<LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends ConsumerState<LocationSheet> {
  String _query = '';
  bool _cities = false;
  String? _error;
  bool _busy = false;

  Future<void> _addCity(City c) async {
    final repo = await ref.read(prayerRepositoryProvider.future);
    await repo.add(label: c.nameAr, lat: c.lat, lng: c.lng, timezone: c.timezone);
    await _saved(ref);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _current() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await useCurrentLocation(context, ref);
    if (!mounted) return;
    setState(() => _busy = false);
    if (err == null) {
      Navigator.pop(context);
    } else if (err == 'city') {
      setState(() => _cities = true);
    } else {
      setState(() => _error = err);
    }
  }

  Future<void> _coordinates() async {
    final lat = TextEditingController(), lng = TextEditingController(), name = TextEditingController();
    final zoneName = await _deviceZone();
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إدخال الإحداثيات'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
          TextField(
            controller: lat,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'خط العرض (مثال 33.89)'),
          ),
          TextField(
            controller: lng,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'خط الطول (مثال 35.50)'),
          ),
          const SizedBox(height: 8),
          Text('المنطقة الزمنية: $zoneName', textDirection: TextDirection.ltr),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حفظ')),
        ],
      ),
    );
    final la = double.tryParse(lat.text.trim()), lo = double.tryParse(lng.text.trim());
    if (ok != true) return;
    if (la == null || lo == null || la.abs() > 90 || lo.abs() > 180) {
      setState(() => _error = 'إحداثيات غير صالحة.');
      return;
    }
    final repo = await ref.read(prayerRepositoryProvider.future);
    await repo.add(
      label: name.text.trim().isEmpty ? '${la.toStringAsFixed(2)}، ${lo.toStringAsFixed(2)}' : name.text.trim(),
      lat: la,
      lng: lo,
      timezone: zoneName,
    );
    await _saved(ref);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final saved = ref.watch(locationsProvider).value ?? const [];
    if (_cities) {
      final q = _query.trim().toLowerCase();
      final list = cities
          .where((c) => q.isEmpty || c.nameAr.contains(q) || c.nameEn.toLowerCase().contains(q) || c.country.contains(q))
          .toList();
      return Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            autofocus: true,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'ابحث عن مدينة'),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Expanded(
          child: ListView(children: [
            for (final c in list)
              ListTile(title: Text(c.nameAr), subtitle: Text('${c.country} · ${c.nameEn}'), onTap: () => _addCity(c)),
            ListTile(
              leading: const Icon(Icons.edit_location_alt_outlined),
              title: const Text('مدينة أخرى: أدخل الإحداثيات'),
              onTap: _coordinates,
            ),
          ]),
        ),
      ]);
    }
    return ListView(shrinkWrap: true, children: [
      const ListTile(title: Text('الموقع', style: TextStyle(fontWeight: FontWeight.bold))),
      for (final l in saved)
        ListTile(
          leading: Icon(l.selected ? Icons.radio_button_checked : Icons.radio_button_off),
          title: Text(l.label),
          subtitle: Text(
            '${arabicNumerals(l.lat.toStringAsFixed(2))}، ${arabicNumerals(l.lng.toStringAsFixed(2))} · ${l.timezone}',
          ),
          trailing: IconButton(
            tooltip: 'حذف',
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              await (await ref.read(prayerRepositoryProvider.future)).delete(l.id);
              await _saved(ref);
            },
          ),
          onTap: () async {
            await (await ref.read(prayerRepositoryProvider.future)).select(l.id);
            await _saved(ref);
            if (context.mounted) Navigator.pop(context);
          },
        ),
      if (saved.isNotEmpty) const Divider(),
      ListTile(
        leading: _busy ? const SizedBox.square(dimension: 24, child: CircularProgressIndicator()) : const Icon(Icons.my_location),
        title: const Text('استخدم موقعي الحالي'),
        onTap: _busy ? null : _current,
      ),
      ListTile(
        leading: const Icon(Icons.location_city),
        title: const Text('اختر مدينة'),
        onTap: () => setState(() => _cities = true),
      ),
      ListTile(leading: const Icon(Icons.edit_location_alt_outlined), title: const Text('أدخل الإحداثيات'), onTap: _coordinates),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ),
      const SizedBox(height: 12),
    ]);
  }
}

Future<void> showLocationSheet(BuildContext context) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const FractionallySizedBox(heightFactor: 0.8, child: LocationSheet()),
    );

/// For the zone label on screens.
String zoneOffsetLabel(String zoneName, DateTime at) {
  final o = inZone(at, zoneName).timeZoneOffset;
  final sign = o.isNegative ? '−' : '+';
  final m = o.inMinutes.abs();
  return 'UTC$sign${arabicDigits(m ~/ 60)}${m % 60 == 0 ? '' : ':${arabicNumerals(two(m % 60))}'}';
}
