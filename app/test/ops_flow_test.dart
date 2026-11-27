import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';
import 'package:molde/src/controller.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/store.dart';

class _Page implements JsTransport {
  _Page(this.bridge);
  final WebBridge bridge;
  final Map<String, Object? Function(Map<String, dynamic> args)> handlers = {};
  final List<String> calls = [];
  final List<Map<String, dynamic>> args = [];
  @override
  Future<void> run(String js) async {
    final m = RegExp(r'^Molde\.rpc\((\d+), ("(?:[^"\\]|\\.)*"), (.*)\)$', dotAll: true).firstMatch(js);
    if (m == null) return;
    final id = int.parse(m.group(1)!);
    final method = jsonDecode(m.group(2)!) as String;
    final a = jsonDecode(m.group(3)!) as Map<String, dynamic>;
    calls.add(method); args.add({'method': method, ...a});
    scheduleMicrotask(() { final h = handlers[method]; bridge.onRaw(jsonEncode({'t': 'reply', 'id': id, 'ok': true, 'value': h == null ? {'ok': true} : h(a)})); });
  }
}

class _Holder implements JsTransport {
  JsTransport? inner;
  @override
  Future<void> run(String js) async => inner?.run(js);
}

const water = 'app "Water" drop ocean\ntable drink ml num\nsetting goal num = 2000 "Daily goal"\nform drink\nlist drink today\n';

void main() {
  late Directory tmp; late WebBridge bridge; late _Page page; late MoldeController c;
  Future<void> boot(String format) async {
    tmp = Directory.systemTemp.createTempSync('molde_ops_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = _Page(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1, format: format);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => water);
    page.handlers['open'] = (a) => {'ok': true};
    await c.store.save(AppRecord(id: 'a1', name: 'Water', source: water));
    await c.init();
    c.changeCurrent();
  }
  tearDown(() async { await c.settleSaves(); tmp.deleteSync(recursive: true); });

  test('the model format goes to the page; the r3 model says whole', () async {
    await boot('whole');
    page.handlers['generate'] = (a) => {'ok': true, 'program': water, 'errors': [], 'stats': {}};
    await c.send('add a note');
    expect(page.args.firstWhere((x) => x['method'] == 'generate')['format'], 'whole');
    await c.settleSaves();
    tmp.deleteSync(recursive: true);
    await boot('ops');
    await c.send('add a note');
    expect(page.args.firstWhere((x) => x['method'] == 'generate')['format'], 'ops');
  });

  test('ops: the operations are applied in Dart, checked by the page, then go through every ordinary safety step', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'insert after 2\n+ table note text', 'stats': {'seconds': 4.0}};
    page.handlers['check'] = (a) { expect(a['source'], 'app "Water" drop ocean\ntable drink ml num\ntable note text\nsetting goal num = 2000 "Daily goal"\nform drink\nlist drink today\n'); return {'ok': true, 'errors': []}; };
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds table note'], 'warnings': [], 'refused': [], 'settings': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': ['adds table note'], 'warnings': [], 'refused': []};
    await c.send('keep a table of notes');
    expect(page.calls, containsAllInOrder(['generate', 'check', 'evaluate', 'applyEdit']));
    expect(c.chat.last.kind, 'change');
  });

  test('ops: instructions that do not fit are reported honestly and nothing is applied', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'replace 40\n+ x', 'stats': {'seconds': 4.0}};
    await c.send('keep a table of notes');
    final m = c.chat.last;
    expect(m.text, contains('I did not apply this'));
    expect(m.text, contains('Your app is unchanged'));
    expect(m.text, contains('outside your program'));
    expect(page.calls, isNot(contains('check')));
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.current!.source, water);
    expect(m.buttons.map((b) => b.label), ['Try again']);
  });

  test('ops: a whole program instead of operations is refused the same way', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': water, 'stats': {}};
    await c.send('keep a table of notes');
    expect(c.chat.last.text, contains('I did not apply this'));
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.current!.source, water);
  });

  test('ops: an answer cut off at the token limit (the page says patchError) is not applied', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': false, 'patchError': true, 'errors': ['the model\'s change instructions were cut off before the end'], 'stats': {}};
    await c.send('keep a table of notes');
    expect(c.chat.last.text, contains('I did not apply this'));
    expect(c.chat.last.text, contains('cut off'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('ops: a patched program that fails the checks keeps the app and says so', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'replace 4\n+ form nothing', 'stats': {}};
    page.handlers['check'] = (a) => {'ok': false, 'errors': ['line 4: E_UNKNOWN_TABLE: no table "nothing". Fix: use drink.']};
    await c.send('keep a table of notes');
    expect(c.chat.last.text, contains('did not pass the checks'));
    expect(c.chat.last.text, contains('Your app is unchanged'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('ops: operations that change nothing are never reported as done', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'replace 1\n+ app "Water" drop ocean', 'stats': {'seconds': 3}};
    page.handlers['check'] = (a) => {'ok': true, 'errors': []};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    await c.send('add a goal');
    expect(c.chat.last.text, contains('I did not apply this'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('ops: the removal guard still holds (a patch that deletes a fifth of the app without being asked)', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'delete 3-5', 'stats': {}};
    page.handlers['check'] = (a) => {'ok': true, 'errors': []};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    await c.send('tidy it up');
    expect(c.chat.last.text, contains('would have removed'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('ops: the direct paths (exact edits) still run without the model', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => throw StateError('the model must not run for a colour change');
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('make it green');
    expect(page.calls, isNot(contains('generate')));
    expect(c.chat.last.text, contains('Done'));
  });

  test('0.7.1 ops: a move of lines (nothing added, nothing removed) is applied and said as a move, not refused as no change', () async {
    await boot('ops');
    page.handlers['generate'] = (a) => {'ok': true, 'format': 'ops', 'ops': 'move 5 after 3', 'stats': {'seconds': 3.0}};
    page.handlers['check'] = (a) => {'ok': true, 'errors': []};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('put the list above the form');
    expect(page.calls, contains('applyEdit'));
    expect(c.chat.last.text, contains('Moved'));
    expect(c.chat.last.text, isNot(contains('I did not apply this')));
  });

  test('ops: a create still goes through the ordinary create path (the page drops the plan line)', () async {
    await boot('ops');
    c.startNewApp();
    page.handlers['generate'] = (a) { expect(a['kind'], 'create'); return {'ok': true, 'program': water, 'plan': '# need: field drink', 'errors': [], 'stats': {'seconds': 5}}; };
    await c.send('water tracker');
    expect(c.apps.length, 2);
    expect(c.apps.first.source, isNot(contains('# need')));
  });
}
