import 'dart:async';
import 'dart:convert';

/// How Dart runs JavaScript in the page. The app uses a WebView; tests use a fake that plays the page.
abstract class JsTransport {
  Future<void> run(String js);
}

/// Flutter <-> WebView bridge.
///
/// Dart -> page: [rpc] calls `Molde.rpc(id, method, args)`; the page answers with a `reply` event.
/// page -> Dart: every message the `MoldeHost` channel receives goes to [onRaw]; events are
///   ready, reply, snapshot (after every change), progress (while generating), native (a model call),
///   ask, log.
/// A model call from the page (`native`) is answered with `Molde.nativeReply(id, json)`.
class WebBridge {
  WebBridge(this.transport);
  final JsTransport transport;

  final Map<int, Completer<dynamic>> _pending = {};
  int _seq = 0;
  Completer<void> _ready = Completer<void>();

  /// Called with the payload of every `snapshot` event: {id, source, snapshot, undo}.
  void Function(Map<String, dynamic> payload)? onSnapshot;
  void Function(Map<String, dynamic> progress)? onProgress;
  void Function(String message)? onLog;
  void Function(String answer)? onAsk;

  /// Runs a model call for the page. method is complete | cancel; the result must be JSON-encodable.
  Future<Object?> Function(String method, Map<String, dynamic> args)? nativeHandler;

  final List<String> logLines = [];

  Future<void> get ready => _ready.future;
  bool get isReady => _ready.isCompleted;

  /// The page was (re)loaded: calls waiting for the old page can never be answered.
  void pageReloading() {
    for (final c in _pending.values) {
      if (!c.isCompleted) c.completeError(StateError('the page was reloaded'));
    }
    _pending.clear();
    if (_ready.isCompleted) _ready = Completer<void>();
  }

  Future<T> rpc<T>(String method, [Map<String, dynamic> args = const {}]) async {
    await ready;
    final id = ++_seq;
    final c = Completer<dynamic>();
    _pending[id] = c;
    try {
      await transport.run('Molde.rpc($id, ${jsonEncode(method)}, ${jsonEncode(args)})');
    } catch (e) {
      _pending.remove(id);
      rethrow;
    }
    return (await c.future) as T;
  }

  /// One message from the page (a JSON text).
  void onRaw(String raw) {
    Map<String, dynamic> m;
    try {
      final j = jsonDecode(raw);
      if (j is! Map) return;
      m = Map<String, dynamic>.from(j);
    } catch (_) {
      return;
    }
    switch (m['t']) {
      case 'ready':
        if (!_ready.isCompleted) _ready.complete();
      case 'reply':
        final c = _pending.remove(m['id']);
        if (c == null || c.isCompleted) return;
        if (m['ok'] == true) {
          c.complete(m['value']);
        } else {
          c.completeError(StateError('${m['error']}'));
        }
      case 'snapshot':
        final p = m['payload'];
        if (p is Map) onSnapshot?.call(Map<String, dynamic>.from(p));
      case 'progress':
        onProgress?.call(m);
      case 'ask':
        onAsk?.call('${m['answer']}');
      case 'log':
        logLines.add('${m['msg']}');
        if (logLines.length > 200) logLines.removeAt(0);
        onLog?.call('${m['msg']}');
      case 'native':
        unawaited(_native(m));
    }
  }

  Future<void> _native(Map<String, dynamic> m) async {
    final id = m['id'];
    Object? result;
    try {
      final h = nativeHandler;
      if (h == null) {
        result = {'stop': 'error', 'text': '', 'error': 'no model is available'};
      } else {
        result = await h('${m['method']}', Map<String, dynamic>.from((m['args'] as Map?) ?? {}));
      }
    } catch (e) {
      result = {'stop': 'error', 'text': '', 'error': '$e'};
    }
    // the reply is passed as a JSON text inside a JS string
    await transport.run('Molde.nativeReply($id, ${jsonEncode(jsonEncode(result))})');
  }
}
