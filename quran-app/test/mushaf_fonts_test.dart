import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quran_app/data/mushaf_fonts.dart';

void main() {
  late HttpServer server;
  late Directory tmp;
  final served = <String, List<int>>{};
  var requests = 0;

  final fontA = Uint8List.fromList(List.generate(300, (i) => i % 256));
  final fontB = Uint8List.fromList(List.generate(200, (i) => (i * 7) % 256));

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('fonts');
    requests = 0;
    served
      ..clear()
      ..['/p1.ttf'] = fontA
      ..['/p2.ttf'] = fontB;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((req) {
      requests++;
      final body = served[req.uri.path];
      if (body == null) {
        req.response.statusCode = 404;
      } else {
        req.response.add(body);
      }
      req.response.close();
    });
  });

  tearDown(() async {
    await server.close(force: true);
    await tmp.delete(recursive: true);
  });

  QcfFontInfo info(int page, Uint8List bytes) => QcfFontInfo(
        page: page,
        url: 'http://127.0.0.1:${server.port}/p$page.ttf',
        bytes: bytes.length,
        sha256: sha256.convert(bytes).toString(),
      );

  MushafFontPack pack(List<String> registered) => MushafFontPack(
        directory: '${tmp.path}/qcf',
        fonts: [info(1, fontA), info(2, fontB)],
        register: (family, _) async => registered.add(family),
      );

  test('downloads, verifies, reports progress and then serves families', () async {
    final registered = <String>[];
    final p = pack(registered);
    expect(p.isComplete, isFalse);
    expect(await p.family(1), isNull, reason: 'nothing installed: fall back');

    final progress = <int>[];
    await p.download(onProgress: (done, _) => progress.add(done));
    expect(progress.first, 0);
    expect(progress.last, 2);
    expect(p.isComplete, isTrue);
    expect(await p.family(1), 'QCF_P001');
    expect(await p.family(1), 'QCF_P001');
    expect(registered, ['QCF_P001'], reason: 'each font registers once');
  });

  test('resumes: installed pages are not fetched again', () async {
    final p = pack([]);
    await p.download();
    expect(requests, 2);
    File('${tmp.path}/qcf/p2.ttf').deleteSync();
    await p.download();
    expect(requests, 3);
    expect(p.isComplete, isTrue);
  });

  test('a tampered file is rejected and never installed', () async {
    served['/p2.ttf'] = Uint8List.fromList(List<int>.from(fontB)..[0] ^= 0xFF);
    final p = pack([]);
    await expectLater(
      p.download(),
      throwsA(isA<FontDownloadError>().having((e) => e.reason, 'reason', 'checksum mismatch')),
    );
    expect(p.isInstalled(1), isTrue, reason: 'good pages are kept');
    expect(p.isInstalled(2), isFalse);
    expect(File('${tmp.path}/qcf/p2.ttf').existsSync(), isFalse);
  });

  test('HTTP errors surface with the page number', () async {
    served.remove('/p1.ttf');
    await expectLater(
      pack([]).download(),
      throwsA(isA<FontDownloadError>().having((e) => (e.page, e.reason), 'error', (1, 'HTTP 404'))),
    );
  });

  test('cancelling stops before fetching more', () async {
    final p = pack([]);
    await p.download(isCancelled: () => true);
    expect(requests, 0);
    expect(p.installedCount, 0);
  });
}
