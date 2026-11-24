import 'dart:async';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'catalogue.dart';

enum DlState { idle, downloading, paused, verifying, done, failed, cancelled }

class DlStatus {
  DlStatus(this.state, {this.received = 0, this.total = 0, this.message = '', this.bytesPerSec = 0, this.model});
  final DlState state;
  final int received, total;
  final String message;
  final double bytesPerSec;
  final CatalogueModel? model;
  double get fraction => total <= 0 ? 0 : (received / total).clamp(0.0, 1.0);
}

/// Thrown for problems the user should read; the message is plain language.
class DlError implements Exception {
  DlError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Free space needed: size plus a 10% margin (counting what the .part file already holds).
int neededBytes(int total, int alreadyHave) => ((total * 1.10).ceil() - alreadyHave).clamp(0, 1 << 62);

/// Resumable model download.
///  - redirects are followed by hand so the Range header is kept on every hop;
///  - bytes go to `<file>.part`; a restart asks for `Range: bytes=<size>-` and appends;
///  - a network error retries with backoff (1, 2, 4 ... 30 s), pause and cancel stop it;
///  - the sha256 is checked on the finished file: on a mismatch the file is deleted and nothing is used;
///  - the file is renamed (atomic) to its final name only after the hash matches.
class ModelDownloader {
  ModelDownloader({required this.dir, required this.freeSpace, this.backoff = const [1, 2, 4, 8, 15, 30], this.maxRetries = 40, HttpClient Function()? client})
      : _client = client ?? HttpClient.new;
  final Directory dir;
  final Future<int> Function(String path) freeSpace;
  final List<int> backoff;
  final int maxRetries;
  final HttpClient Function() _client;

  final _ctl = StreamController<DlStatus>.broadcast();
  Stream<DlStatus> get status => _ctl.stream;
  DlStatus current = DlStatus(DlState.idle);
  bool _pause = false, _cancel = false, _running = false;
  HttpClient? _http;

  bool get running => _running;

  void _emit(DlStatus s) { current = s; if (!_ctl.isClosed) _ctl.add(s); }

  File partFile(CatalogueModel m) => File('${dir.path}/${m.localName}.part');
  File finalFile(CatalogueModel m) => File('${dir.path}/${m.localName}');

  void pause() { _pause = true; _http?.close(force: true); }
  void cancel() { _cancel = true; _http?.close(force: true); }

  /// Downloads [m] (or continues its .part). Returns the verified file, or throws DlError. A pause throws DlError('paused').
  Future<File> download(CatalogueModel m) async {
    if (_running) throw DlError('A download is already running.');
    _running = true; _pause = false; _cancel = false;
    try {
      await dir.create(recursive: true);
      final fin = finalFile(m), part = partFile(m);
      if (await fin.exists() && await fin.length() == m.bytes && await _hash(fin) == m.sha256) {
        _emit(DlStatus(DlState.done, received: m.bytes, total: m.bytes, model: m));
        return fin;
      }
      var have = await part.exists() ? await part.length() : 0;
      if (have > m.bytes) { await part.delete(); have = 0; }
      final need = neededBytes(m.bytes, have);
      final free = await freeSpace(dir.path);
      if (free < need) {
        final mb = ((need - free) / 1048576).ceil();
        final e = DlError('Not enough free space. The model needs ${(m.bytes * 1.10 / 1048576).ceil()} MB (its size plus a safety margin) and the phone has ${(free / 1048576).floor()} MB free. Free up about $mb MB and try again.');
        _emit(DlStatus(DlState.failed, message: e.message, model: m));
        throw e;
      }
      var attempt = 0;
      final sw = Stopwatch()..start();
      var lastBytes = have;
      while (true) {
        if (_cancel) return _cancelled(m, part);
        if (_pause) {
          final got = await part.exists() ? await part.length() : 0;
          _emit(DlStatus(DlState.paused, received: got, total: m.bytes, model: m));
          throw DlError('paused');
        }
        have = await part.exists() ? await part.length() : 0;
        if (have >= m.bytes) break;
        try {
          _emit(DlStatus(DlState.downloading, received: have, total: m.bytes, model: m, message: attempt > 0 ? 'Reconnecting…' : ''));
          await _fetchOnce(m, part, have, (n) {
            final secs = sw.elapsedMilliseconds / 1000;
            final rate = secs > 0.5 ? (n - lastBytes) / secs : 0.0;
            _emit(DlStatus(DlState.downloading, received: n, total: m.bytes, model: m, bytesPerSec: rate < 0 ? 0 : rate));
          });
          if (await part.length() == have && have < m.bytes) throw const HttpException('no progress');
          attempt = 0;
        } on _RangeIgnored {
          if (await part.exists()) await part.delete(); // the server sent the whole file: start over cleanly
        } on DlError {
          rethrow;
        } catch (e) {
          if (_cancel) return _cancelled(m, part);
          if (_pause) continue;
          attempt++;
          if (attempt > maxRetries) {
            final err = DlError('The download could not continue: no network. What is already here is kept; tap Resume when you are online.');
            _emit(DlStatus(DlState.failed, received: have, total: m.bytes, message: err.message, model: m));
            throw err;
          }
          final wait = backoff[(attempt - 1).clamp(0, backoff.length - 1)];
          _emit(DlStatus(DlState.downloading, received: have, total: m.bytes, model: m, message: 'Network lost. Trying again in $wait s…'));
          for (var i = 0; i < wait * 10 && !_pause && !_cancel; i++) { await Future<void>.delayed(const Duration(milliseconds: 100)); }
        }
      }
      // verify
      _emit(DlStatus(DlState.verifying, received: m.bytes, total: m.bytes, model: m, message: 'Checking the file…'));
      final len = await part.length();
      final digest = len == m.bytes ? await _hash(part) : '';
      if (len != m.bytes || digest != m.sha256) {
        await part.delete();
        final err = DlError('The downloaded file did not pass the safety check, so it was deleted and will not be used. Please download it again.');
        _emit(DlStatus(DlState.failed, message: err.message, model: m));
        throw err;
      }
      await part.rename(fin.path);
      _emit(DlStatus(DlState.done, received: m.bytes, total: m.bytes, model: m));
      return fin;
    } finally {
      _running = false;
      _http = null;
    }
  }

  File _cancelled(CatalogueModel m, File part) {
    if (part.existsSync()) part.deleteSync();
    _emit(DlStatus(DlState.cancelled, model: m, message: 'Download cancelled.'));
    throw DlError('cancelled');
  }

  Future<void> _fetchOnce(CatalogueModel m, File part, int have, void Function(int) onBytes) async {
    final c = _client()..connectionTimeout = const Duration(seconds: 15);
    c.idleTimeout = const Duration(seconds: 20);
    _http = c;
    try {
      var uri = Uri.parse(m.url);
      HttpClientResponse? res;
      for (var hop = 0; hop < 6; hop++) {
        final req = await c.getUrl(uri);
        req.followRedirects = false;
        if (have > 0) req.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-');
        res = await req.close();
        if (res.isRedirect) {
          final loc = res.headers.value('location');
          await res.drain<void>();
          if (loc == null) throw const HttpException('redirect without a location');
          uri = uri.resolve(loc);
          if (uri.scheme != 'https' && !(uri.host == 'localhost' || uri.host == '127.0.0.1')) throw DlError('The server redirected to an insecure address, so the download was stopped.');
          res = null;
          continue;
        }
        break;
      }
      if (res == null) throw const HttpException('too many redirects');
      if (res.statusCode == 416 && have > 0) { await res.drain<void>(); return; } // already complete on the server's view
      if (res.statusCode == 200 && have > 0) { await res.drain<void>(); throw _RangeIgnored(); }
      if (res.statusCode != 200 && res.statusCode != 206) { await res.drain<void>(); throw HttpException('server answered ${res.statusCode}'); }
      final raf = await part.open(mode: FileMode.append);
      var n = have;
      var tick = DateTime.now();
      try {
        await for (final chunk in res) {
          await raf.writeFrom(chunk);
          n += chunk.length;
          if (n > m.bytes) throw DlError('The server sent more data than expected, so the download was stopped.');
          if (DateTime.now().difference(tick).inMilliseconds > 250) { tick = DateTime.now(); onBytes(n); }
        }
        onBytes(n);
        await raf.flush();
      } finally {
        await raf.close();
      }
    } finally {
      c.close(force: true);
    }
  }

  static Future<String> _hash(File f) async => (await sha256.bind(f.openRead()).first).toString();
  static Future<String> hashOf(File f) => _hash(f);

  void dispose() { _ctl.close(); }
}

class _RangeIgnored implements Exception {}
