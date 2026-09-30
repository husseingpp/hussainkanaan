// Renders the Listen Mode cover art (lock screen / media controls) to
// assets/images/listen_cover.png with the app's own Arabic text shaping:
//
//   flutter test tool/screenshots/render_cover_test.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('cover', (tester) async {
    await tester.runAsync(() async {
      final loader = FontLoader('AmiriQuran')
        ..addFont(Future.value(ByteData.sublistView(File('assets/fonts/AmiriQuran.ttf').readAsBytesSync())));
      await loader.load();
    });
    tester.view.physicalSize = const Size(512, 512);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(
      key: key,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF12382D), Color(0xFF0A1F19)],
            ),
          ),
          child: Center(
            child: Container(
              width: 420,
              height: 420,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFC9A95B), width: 3),
                borderRadius: BorderRadius.circular(28),
              ),
              alignment: Alignment.center,
              child: const Text(
                'القرآن\nالكريم',
                textAlign: TextAlign.center,
                style: TextStyle(fontFamily: 'AmiriQuran', fontSize: 96, height: 1.35, color: Color(0xFFF2E6C4)),
              ),
            ),
          ),
        ),
      ),
    ));
    await tester.pump();
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage();
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      File('assets/images/listen_cover.png').writeAsBytesSync(png!.buffer.asUint8List());
    });
  });
}
