import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';

/// Plays the page: reads `Molde.rpc(...)` / `Molde.nativeReply(...)` calls and answers like the real page would.
class FakePage implements JsTransport {
  FakePage(this.onMessage);
  final void Function(String raw) onMessage; // page -> Dart
  final List<String> ran = [];
  Map<String, dynamic> Function(String method, Map<String, dynamic> args)? handler;
  @override
  Future<void> run(String js) async {
    ran.add(js);
    final m = RegExp(r'^Molde\.rpc\((\d+), ("(?:[^"\\]|\\.)*"), (.*)\)$', dotAll: true).firstMatch(js);
    if (m != null) {
      final id = int.parse(m.group(1)!);
      final method = jsonDecode(m.group(2)!) as String;
      final args = jsonDecode(m.group(3)!) as Map<String, dynamic>;
      scheduleMicrotask(() {
        final v = handler == null ? {'ok': true} : handler!(method, args);
        if (v.containsKey('__error')) {
          onMessage(jsonEncode({'t': 'reply', 'id': id, 'ok': false, 'error': v['__error']}));
        } else {
          onMessage(jsonEncode({'t': 'reply', 'id': id, 'ok': true, 'value': v}));
        }
      });
    }
  }
}

void main() {
  late WebBridge bridge;
  late FakePage page;
  setUp(() {
    page = FakePage((raw) => bridge.onRaw(raw));
    bridge = WebBridge(page);
  });

  test('rpc waits for the page to be ready, then returns the reply value', () async {
    page.handler = (m, a) => {'echo': m, 'args': a};
    var done = false;
    final f = bridge.rpc<Map>('open', {'id': 'a1', 'source': 'app "x"\n'}).then((v) { done = true; return v; });
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(done, isFalse);
    expect(page.ran, isEmpty);
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final v = await f;
    expect(v['echo'], 'open');
    expect(v['args'], {'id': 'a1', 'source': 'app "x"\n'});
  });

  test('arguments survive quoting: quotes, newlines, unicode and line separators', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    const nasty = 'app "Ünï"   line\nend\\ \'q\' </script>';
    page.handler = (m, a) => {'got': a['s']};
    final v = await bridge.rpc<Map>('check', {'s': nasty});
    expect(v['got'], nasty);
  });

  test('concurrent calls are matched to their own replies', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    page.handler = (m, a) => {'n': a['n']};
    final r = await Future.wait([for (var i = 0; i < 20; i++) bridge.rpc<Map>('x', {'n': i})]);
    expect(r.map((e) => e['n']).toList(), List.generate(20, (i) => i));
  });

  test('an error in the page becomes a Dart error', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    page.handler = (m, a) => {'__error': 'unknown method nope'};
    await expectLater(bridge.rpc('nope'), throwsA(predicate((e) => '$e'.contains('unknown method nope'))));
  });

  test('snapshot events reach the store callback after every change', () async {
    final got = <Map<String, dynamic>>[];
    bridge.onSnapshot = got.add;
    bridge.onRaw(jsonEncode({'t': 'snapshot', 'payload': {'id': 'a1', 'source': 's1', 'snapshot': {'data': 1}, 'undo': []}}));
    bridge.onRaw(jsonEncode({'t': 'snapshot', 'payload': {'id': 'a1', 'source': 's2', 'snapshot': {'data': 2}, 'undo': []}}));
    expect(got.map((e) => e['source']).toList(), ['s1', 's2']);
    expect(got.last['snapshot'], {'data': 2});
  });

  test('progress, log and ask events are delivered; junk is ignored', () async {
    final progress = <Map>[]; final logs = <String>[]; final asks = <String>[];
    bridge.onProgress = progress.add; bridge.onLog = logs.add; bridge.onAsk = asks.add;
    bridge.onRaw(jsonEncode({'t': 'progress', 'lines': 3, 'program': 'a\nb\nc\n', 'rejected': 1}));
    bridge.onRaw(jsonEncode({'t': 'log', 'msg': 'page error: x'}));
    bridge.onRaw(jsonEncode({'t': 'ask', 'answer': 'Water'}));
    bridge.onRaw('not json'); bridge.onRaw('[1,2]'); bridge.onRaw(jsonEncode({'t': 'mystery'}));
    expect(progress.single['lines'], 3);
    expect(logs, ['page error: x']);
    expect(asks, ['Water']);
    expect(bridge.logLines, ['page error: x']);
  });

  test('a model call from the page is run natively and answered with nativeReply', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    String? seenMethod; Map? seenArgs;
    bridge.nativeHandler = (m, a) async { seenMethod = m; seenArgs = a; return {'stop': 'stop', 'text': 'table drink ml num', 'n_gen': 5}; };
    bridge.onRaw(jsonEncode({'t': 'native', 'id': 7, 'method': 'complete', 'args': {'prompt': 'p', 'grammar': 'root ::= "a"', 'stopNl': true}}));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(seenMethod, 'complete');
    expect(seenArgs!['grammar'], 'root ::= "a"');
    final reply = page.ran.single;
    expect(reply.startsWith('Molde.nativeReply(7, '), isTrue);
    final inner = jsonDecode(jsonDecode(reply.substring('Molde.nativeReply(7, '.length, reply.length - 1)) as String) as Map;
    expect(inner['text'], 'table drink ml num');
  });

  test('a failing or missing model gives the page an error result, not silence', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    bridge.onRaw(jsonEncode({'t': 'native', 'id': 1, 'method': 'complete', 'args': {}}));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(page.ran.last.contains('no model is available'), isTrue);
    bridge.nativeHandler = (m, a) async => throw StateError('boom');
    bridge.onRaw(jsonEncode({'t': 'native', 'id': 2, 'method': 'complete', 'args': {}}));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(page.ran.last.contains('boom'), isTrue);
  });

  test('a page reload fails the calls waiting for the old page and waits for the new ready', () async {
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    page.handler = null;
    final silent = FakePage((_) {}); // a page that never answers
    final b2 = WebBridge(silent);
    b2.onRaw(jsonEncode({'t': 'ready'}));
    final f = b2.rpc('generate');
    await Future<void>.delayed(const Duration(milliseconds: 5));
    b2.pageReloading();
    await expectLater(f, throwsA(isA<StateError>()));
    expect(b2.isReady, isFalse);
  });
}
