import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/catalogue.dart';
import 'package:molde/src/downloader.dart';

/// A small HTTP server: serves [data] at /file (Range supported), /redirect -> /file, and can cut the first
/// responses short to simulate a network loss.
class TestServer {
  TestServer(this.data);
  final List<int> data;
  late HttpServer server;
  int cutFirst = 0; // number of requests that are cut after cutAt bytes
  int cutAt = 0;
  bool ignoreRange = false;
  final List<String?> ranges = [];
  int requests = 0;
  Future<void> start() async {
    server = await HttpServer.bind('127.0.0.1', 0);
    server.listen((req) async {
      requests++;
      if (req.uri.path == '/redirect') { req.response.statusCode = 302; req.response.headers.set('location', '/file'); await req.response.close(); return; }
      final r = req.headers.value('range');
      ranges.add(r);
      var start = 0;
      if (r != null && !ignoreRange) { start = int.parse(RegExp(r'bytes=(\d+)-').firstMatch(r)!.group(1)!); }
      final status = start > 0 ? 206 : 200;
      final cr = start > 0 ? 'content-range: bytes $start-${data.length - 1}/${data.length}\r\n' : '';
      if (cutFirst > 0) {
        cutFirst--;
        final end = min(data.length, start + cutAt);
        final sock = await req.response.detachSocket(writeHeaders: false);
        sock.add(utf8.encode('HTTP/1.1 $status X\r\ncontent-length: ${data.length - start}\r\n$cr\r\n'));
        sock.add(data.sublist(start, end));
        await sock.flush();
        sock.destroy();
        return;
      }
      final res = req.response;
      res.statusCode = status;
      res.contentLength = data.length - start;
      if (start > 0) res.headers.set('content-range', 'bytes $start-${data.length - 1}/${data.length}');
      res.add(data.sublist(start));
      await res.close();
    });
  }
  String get url => 'http://127.0.0.1:${server.port}/file';
  String get redirect => 'http://127.0.0.1:${server.port}/redirect';
  Future<void> stop() => server.close(force: true);
}

CatalogueModel model(List<int> data, String url, {String? sha, String name = 'm.gguf'}) =>
    CatalogueModel(id: 'm', name: 'M', file: 'dir/$name', url: url, bytes: data.length, sha256: sha ?? sha256.convert(data).toString());

void main() {
  late Directory tmp;
  late List<int> data;
  late TestServer srv;
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_dl_');
    final r = Random(7);
    data = List.generate(600000, (_) => r.nextInt(256));
    srv = TestServer(data);
    await srv.start();
  });
  tearDown(() async { await srv.stop(); tmp.deleteSync(recursive: true); });

  ModelDownloader dl({int free = 1 << 40}) => ModelDownloader(dir: Directory('${tmp.path}/models'), freeSpace: (_) async => free, backoff: const [0], maxRetries: 5);

  test('downloads, verifies the hash and renames to the final name (no .part left)', () async {
    final m = model(data, srv.url);
    final f = await dl().download(m);
    expect(f.path.endsWith('/models/m.gguf'), isTrue);
    expect(await f.length(), data.length);
    expect(File('${f.path}.part').existsSync(), isFalse);
  });

  test('follows a redirect', () async {
    final f = await dl().download(model(data, srv.redirect));
    expect(await f.length(), data.length);
  });

  test('resume: a connection cut in the middle continues with a Range request from the bytes already on disk', () async {
    srv.cutFirst = 1; srv.cutAt = 200000;
    final m = model(data, srv.url);
    final f = await dl().download(m);
    expect(sha256.convert(await f.readAsBytes()).toString(), m.sha256);
    expect(srv.ranges.first, isNull);
    expect(srv.ranges.length, greaterThanOrEqualTo(2));
    expect(srv.ranges[1], startsWith('bytes='));
    final from = int.parse(RegExp(r'bytes=(\d+)-').firstMatch(srv.ranges[1]!)!.group(1)!);
    expect(from, greaterThan(0));
    expect(from, lessThanOrEqualTo(200000));
  });

  test('resume from a .part file left by an earlier run (app killed)', () async {
    final m = model(data, srv.url);
    final d = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${d.path}/m.gguf.part').writeAsBytesSync(data.sublist(0, 123456));
    final f = await dl().download(m);
    expect(srv.ranges.single, 'bytes=123456-');
    expect(sha256.convert(await f.readAsBytes()).toString(), m.sha256);
  });

  test('a server that ignores Range (sends 200) restarts the file cleanly and still ends verified', () async {
    srv.ignoreRange = true;
    final m = model(data, srv.url);
    final d = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${d.path}/m.gguf.part').writeAsBytesSync(data.sublist(0, 1000));
    final f = await dl().download(m);
    expect(sha256.convert(await f.readAsBytes()).toString(), m.sha256);
  });

  test('retries several cuts and then succeeds', () async {
    srv.cutFirst = 3; srv.cutAt = 50000;
    final f = await dl().download(model(data, srv.url));
    expect(await f.length(), data.length);
  });

  test('hash mismatch: the file is deleted, an error is shown, nothing is left to load', () async {
    final m = model(data, srv.url, sha: 'a' * 64);
    final d = dl();
    await expectLater(d.download(m), throwsA(isA<DlError>().having((e) => e.message, 'message', contains('did not pass the safety check'))));
    final dir = Directory('${tmp.path}/models');
    expect(dir.listSync(), isEmpty);
    expect(d.current.state, DlState.failed);
  });

  test('not enough free space is refused before any byte is fetched, with the amount in plain words', () async {
    final m = model(data, srv.url);
    await expectLater(dl(free: 500000).download(m), throwsA(isA<DlError>().having((e) => e.message, 'message', contains('Not enough free space'))));
    expect(srv.requests, 0);
  });

  test('free space rule: size plus 10%, minus what the .part already holds', () {
    expect(neededBytes(1000, 0), 1100);
    expect(neededBytes(1000, 400), 700);
    expect(neededBytes(1000, 5000), 0);
  });

  test('pause stops with a .part kept, resume finishes it', () async {
    srv.cutFirst = 0;
    final m = model(data, srv.url);
    final d = dl();
    // pause as soon as some bytes are on disk
    final sub = d.status.listen((s) { if (s.state == DlState.downloading && s.received > 0) d.pause(); });
    Object? err;
    try { await d.download(m); } catch (e) { err = e; }
    await sub.cancel();
    if (err is DlError) {
      expect(err.message, 'paused');
      expect(File('${tmp.path}/models/m.gguf.part').existsSync(), isTrue);
      final f = await dl().download(m);
      expect(sha256.convert(await f.readAsBytes()).toString(), m.sha256);
    } else {
      // the whole file arrived before the first progress tick: still a verified file
      expect(File('${tmp.path}/models/m.gguf').existsSync(), isTrue);
    }
  });

  test('cancel removes the .part', () async {
    srv.cutFirst = 100; srv.cutAt = 1000; // keeps failing so we can cancel during the wait
    final d = dl();
    final sub = d.status.listen((s) { if (s.message.startsWith('Network lost')) d.cancel(); });
    await expectLater(d.download(model(data, srv.url)), throwsA(isA<DlError>().having((e) => e.message, 'm', 'cancelled')));
    await sub.cancel();
    expect(Directory('${tmp.path}/models').listSync().where((e) => e.path.endsWith('.part')), isEmpty);
  });

  test('gives up after the retry limit with the part kept and a plain message', () async {
    srv.cutFirst = 1000; srv.cutAt = 1000;
    final d = dl();
    await expectLater(d.download(model(data, srv.url)), throwsA(isA<DlError>().having((e) => e.message, 'm', contains('no network'))));
    expect(File('${tmp.path}/models/m.gguf.part').existsSync(), isTrue);
  });

  group('catalogue', () {
    final good = jsonEncode({
      'version': 1, 'licence': 'Gemma Terms of Use: https://ai.google.dev/gemma/terms',
      'models': [
        {'id': 'a', 'name': 'A', 'file': 'x/a.gguf', 'url': 'https://h/a', 'bytes': 10, 'sha256': 'b' * 64, 'recommended': true, 'note': 'n'},
        {'id': 'bad', 'name': 'B', 'file': 'b.gguf', 'url': 'http://insecure/b', 'bytes': 10, 'sha256': 'c' * 64},
        {'id': 'bad2', 'name': 'B', 'file': 'b.gguf', 'url': 'https://h/b', 'bytes': 10, 'sha256': 'short'},
      ],
    });
    test('parses, keeps only valid https entries with a real sha256, finds the recommended one and the licence link', () {
      final c = Catalogue.parse(good);
      expect(c.models.map((m) => m.id), ['a']);
      expect(c.recommended!.localName, 'a.gguf');
      expect(c.licenceUrl, 'https://ai.google.dev/gemma/terms');
    });
    test('garbage and empty catalogues are errors', () {
      expect(() => Catalogue.parse('nope'), throwsFormatException);
      expect(() => Catalogue.parse('{"models": []}'), throwsFormatException);
      expect(() => Catalogue.parse('{"models": [{"id": 1}]}'), throwsFormatException);
    });
    test('the bundled copy is a valid catalogue with the recommended r1 Q4_K_M', () {
      final c = Catalogue.parse(File('assets/models.json').readAsStringSync());
      expect(c.recommended!.bytes, 253155040);
      expect(c.recommended!.sha256, startsWith('156e9d17'));
      expect(c.models.length, greaterThanOrEqualTo(2));
    });
    test('load: network copy when it works, bundled copy when the fetch fails, times out or is garbage', () async {
      final bundled = () async => good;
      final live = jsonEncode({'models': [{'id': 'z', 'name': 'Z', 'file': 'z.gguf', 'url': 'https://h/z', 'bytes': 5, 'sha256': 'd' * 64}]});
      expect((await Catalogue.load(bundled: bundled, fetch: () async => live)).models.single.id, 'z');
      expect((await Catalogue.load(bundled: bundled, fetch: () async => throw const SocketException('offline'))).models.single.id, 'a');
      expect((await Catalogue.load(bundled: bundled, fetch: () async => '<html>captive portal</html>')).models.single.id, 'a');
      final slow = await Catalogue.load(bundled: bundled, fetch: () => Future.delayed(const Duration(seconds: 2), () => live), timeout: const Duration(milliseconds: 100));
      expect(slow.fromNetwork, isFalse);
    });
  });
}
