import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/arabic_digits.dart';
import '../prayer/location_sheet.dart';
import '../prayer/prayer_providers.dart';
import '../prayer/prayer_screen.dart';
import '../prayer/prayer_settings.dart';
import '../prayer/zones.dart';
import 'qibla_math.dart';

String degLabel(double d) => '${arabicNumerals(d.toStringAsFixed(1))}°';

/// Qibla: the numeric bearing always, a needle only when the compass can be
/// trusted, and the sun as a fallback (BLUEPRINT §8).
class QiblaScreen extends ConsumerWidget {
  const QiblaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loc = ref.watch(selectedLocationProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('القبلة'),
        actions: [
          IconButton(tooltip: 'الموقع', icon: const Icon(Icons.place_outlined), onPressed: () => showLocationSheet(context)),
        ],
      ),
      body: loc.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', textDirection: TextDirection.ltr)),
        data: (l) => l == null ? const LocationPrompt() : _Qibla(location: l),
      ),
    );
  }
}

class _Qibla extends ConsumerWidget {
  const _Qibla({required this.location});

  final SavedLocation location;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider).value ?? DateTime.now();
    final bearing = qiblaBearing(location.lat, location.lng);
    final declination = magneticDeclination(location.lat, location.lng, now);
    final text = Theme.of(context).textTheme;
    final hasCompass = (Platform.isAndroid || Platform.isIOS) && FlutterCompass.events != null;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text(location.label, style: text.titleSmall, textAlign: TextAlign.center),
      const SizedBox(height: 8),
      Text(degLabel(bearing), style: text.displaySmall, textAlign: TextAlign.center),
      Text('من الشمال الحقيقي، باتجاه عقارب الساعة', style: text.bodyMedium, textAlign: TextAlign.center),
      Text(
        'المسافة إلى الكعبة ≈ ${arabicDigits(distanceToKaaba(location.lat, location.lng).round())} كم',
        style: text.bodySmall,
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      if (hasCompass)
        _LiveCompass(bearing: bearing, declination: declination)
      else ...[
        SizedBox(height: 260, child: CustomPaint(painter: DialPainter(heading: 0, bearing: bearing, scheme: Theme.of(context).colorScheme))),
        const Text(
          'لا بوصلة في هذا الجهاز: الرسم أعلاه ثابت، الشمال فيه إلى الأعلى. وجّه أعلى الرسم إلى الشمال ثم اتبع خط القبلة.',
          textAlign: TextAlign.center,
        ),
      ],
      const SizedBox(height: 16),
      _SunCard(location: location, now: now),
      const SizedBox(height: 8),
      Text(
        'الانحراف المغناطيسي هنا ${degLabel(declination.abs())} ${declination >= 0 ? 'شرقًا' : 'غربًا'} '
        '(نموذج WMM-2025)، وقد صُحّحت البوصلة به.',
        style: text.bodySmall,
        textAlign: TextAlign.center,
      ),
    ]);
  }
}

class _LiveCompass extends StatefulWidget {
  const _LiveCompass({required this.bearing, required this.declination});

  final double bearing;
  final double declination;

  @override
  State<_LiveCompass> createState() => _LiveCompassState();
}

class _LiveCompassState extends State<_LiveCompass> {
  // Smoothed on the unit circle, so 359° and 1° average to 0°, not 180°.
  double? _sin, _cos;

  double _smooth(double deg) {
    const k = 0.25;
    final r = deg * math.pi / 180;
    _sin = _sin == null ? math.sin(r) : _sin! + k * (math.sin(r) - _sin!);
    _cos = _cos == null ? math.cos(r) : _cos! + k * (math.cos(r) - _cos!);
    return normalize(math.atan2(_sin!, _cos!) * 180 / math.pi);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return StreamBuilder<CompassEvent>(
      stream: FlutterCompass.events,
      builder: (context, snap) {
        final e = snap.data;
        final magnetic = e?.heading;
        if (magnetic == null) {
          return const SizedBox(height: 280, child: Center(child: Text('في انتظار البوصلة…')));
        }
        final quality = compassQuality(e?.accuracy);
        if (quality == CompassQuality.unreliable) return const _Calibrate();
        // The sensor reads magnetic north; the qibla bearing is from true north.
        final heading = _smooth(normalize(magnetic + widget.declination));
        var off = normalize(widget.bearing - heading);
        if (off > 180) off -= 360;
        final aligned = off.abs() <= 3;
        return Column(children: [
          SizedBox(height: 280, child: CustomPaint(painter: DialPainter(heading: heading, bearing: widget.bearing, scheme: scheme))),
          const SizedBox(height: 8),
          Text(
            aligned ? 'أنت باتجاه القبلة' : 'استدر ${degLabel(off.abs())} ${off > 0 ? 'إلى اليمين' : 'إلى اليسار'}',
            style: text.titleMedium?.copyWith(color: aligned ? scheme.primary : null),
          ),
          const SizedBox(height: 4),
          Text(
            'أعلى الهاتف يتجه إلى ${degLabel(heading)} من الشمال الحقيقي '
            '(${degLabel(normalize(magnetic))} مغناطيسيًا). ضع الهاتف مسطّحًا بعيدًا عن المعادن والمغناطيس (أغطية الهاتف المغناطيسية أيضًا).',
            style: text.bodySmall,
            textAlign: TextAlign.center,
          ),
          if (quality == CompassQuality.fair || quality == CompassQuality.unknown)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                quality == CompassQuality.fair
                    ? 'دقة البوصلة متوسطة: حرّك الهاتف على شكل ٨ لتحسينها.'
                    : 'تعذّر معرفة دقة البوصلة؛ حرّك الهاتف على شكل ٨ ثم قارن بالرقم أعلاه.',
                style: text.bodySmall,
                textAlign: TextAlign.center,
              ),
            ),
        ]);
      },
    );
  }
}

/// Shown instead of a needle when the magnetometer reports low accuracy.
class _Calibrate extends StatelessWidget {
  const _Calibrate();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          const Icon(Icons.all_inclusive, size: 64),
          const SizedBox(height: 8),
          Text('البوصلة تحتاج إلى معايرة', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          const Text(
            'حرّك الهاتف في الهواء على شكل الرقم ٨ عدة مرات، بعيدًا عن المعادن والأجهزة الكهربائية. '
            'لن يظهر المؤشر حتى تصبح القراءة موثوقة؛ استعن بالرقم أعلاه وباتجاه الشمس.',
            textAlign: TextAlign.center,
          ),
        ]),
      ),
    );
  }
}

class _SunCard extends StatelessWidget {
  const _SunCard({required this.location, required this.now});

  final SavedLocation location;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final s = qiblaFromSun(location.lat, location.lng, now);
    final time = clockLabel(now, location.timezone);
    return Card(
      child: ListTile(
        leading: const Icon(Icons.wb_sunny_outlined),
        title: const Text('بالاستعانة بالشمس'),
        subtitle: Text(s == null
            ? 'الشمس تحت الأفق الآن.'
            : 'الساعة $time: قف مواجهًا للشمس، ثم استدر ${degLabel(s.offset.abs())} '
                '${s.offset >= 0 ? 'إلى اليمين' : 'إلى اليسار'}.'),
      ),
    );
  }
}

/// A dial with north and the qibla, rotated so the phone's top is up.
class DialPainter extends CustomPainter {
  DialPainter({required this.heading, required this.bearing, required this.scheme});

  /// Where the top of the phone points (true north = 0).
  final double heading;
  final double bearing;
  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2 - 8;
    final ring = Paint()
      ..color = scheme.outline
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(c, r, ring);
    Offset at(double deg, double radius) {
      final a = (deg - heading - 90) * math.pi / 180;
      return c + Offset(math.cos(a), math.sin(a)) * radius;
    }

    for (var d = 0; d < 360; d += 30) {
      canvas.drawLine(at(d.toDouble(), r), at(d.toDouble(), r - (d % 90 == 0 ? 14 : 7)), ring);
    }
    final north = TextPainter(
      text: TextSpan(text: 'N', style: TextStyle(color: scheme.error, fontWeight: FontWeight.bold, fontSize: 18)),
      textDirection: TextDirection.ltr,
    )..layout();
    north.paint(canvas, at(0, r - 28) - Offset(north.width / 2, north.height / 2));
    final needle = Paint()
      ..color = scheme.primary
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(c, at(bearing, r - 20), needle);
    canvas.drawCircle(at(bearing, r - 20), 12, Paint()..color = scheme.primary);
    canvas.drawCircle(c, 6, Paint()..color = scheme.onSurface);
  }

  @override
  bool shouldRepaint(DialPainter old) => old.heading != heading || old.bearing != bearing || old.scheme != scheme;
}
