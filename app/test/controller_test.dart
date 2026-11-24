import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';
import 'package:molde/src/controller.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/store.dart';

/// A page that answers rpc calls from a table of handlers (the real page is the bundled JS; see js/tests for its loop).
class ScriptedPage implements JsTransport {
  ScriptedPage(this.bridge);
  final WebBridge bridge;
  final Map<String, Object? Function(Map<String, dynamic> args)> handlers = {};
  final List<String> calls = [];
  @override
  Future<void> run(String js) async {
    final m = RegExp(r'^Molde\.rpc\((\d+), ("(?:[^"\\]|\\.)*"), (.*)\)$', dotAll: true).firstMatch(js);
    if (m == null) return;
    final id = int.parse(m.group(1)!);
    final method = jsonDecode(m.group(2)!) as String;
    final args = jsonDecode(m.group(3)!) as Map<String, dynamic>;
    calls.add(method);
    scheduleMicrotask(() async {
      final h = handlers[method];
      final v = h == null ? {'ok': true} : h(args);
      bridge.onRaw(jsonEncode({'t': 'reply', 'id': id, 'ok': true, 'value': v}));
    });
  }
}

const water = 'app "Water" drop ocean\ntable drink ml num\nform drink\n';

void main() {
  late Directory tmp;
  late WebBridge bridge;
  late ScriptedPage page;
  late MoldeController c;

  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_ctl_');
    final holder = _Holder();
    bridge = WebBridge(holder);
    page = ScriptedPage(bridge);
    holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => water, backupDir: Directory('${tmp.path}/b'));
    c.bridge.nativeHandler = null;
    page.handlers['open'] = (a) => {'ok': true, 'name': 'Water'};
    page.handlers['describe'] = (a) => {'text': 'Keeps: drink'};
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  Future<AppRecord> seed() async {
    final r = AppRecord(id: 'a1', name: 'Water', source: water);
    await c.store.save(r);
    await c.init();
    return c.current!;
  }

  test('create: a good program becomes a saved app and is opened', () async {
    page.handlers['generate'] = (a) {
      expect(a['kind'], 'create');
      return {'ok': true, 'program': water, 'errors': [], 'stats': {'seconds': 4.2, 'tokens': 90}};
    };
    await c.init();
    await c.send('a water tracker');
    expect(c.apps.length, 1);
    expect(c.current!.name, 'Water');
    expect((await c.store.list()).length, 1);
    expect(page.calls, contains('open'));
    expect(c.chat.last.text, contains('Made Water'));
    expect(c.lastStats!['seconds'], 4.2);
    expect(c.busy, isFalse);
  });

  test('create that fails the checks says so plainly and makes nothing', () async {
    page.handlers['generate'] = (a) => {'ok': false, 'program': 'x', 'errors': ['line 3: E_UNKNOWN_FIELD: drink has no field "kg". Fix: use ml.'], 'stats': {}};
    await c.init();
    await c.send('weights');
    expect(c.apps, isEmpty);
    expect(c.chat.last.text, contains('did not pass the checks'));
    expect(c.chat.last.text, contains('drink has no field "kg"'));
    expect(c.chat.last.text, contains('Nothing was made'));
  });

  test('change that fails the checks keeps the old app and says so', () async {
    await seed();
    page.handlers['generate'] = (a) {
      expect(a['kind'], 'edit');
      expect(a['current'], water);
      return {'ok': false, 'program': 'x', 'errors': ['line 2: E_SYNTAX: bad. Fix: x.'], 'stats': {}};
    };
    await c.send('add a note');
    expect(c.chat.last.text, contains('Your app is unchanged'));
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.current!.source, water);
  });

  test('safe change is applied, listed, and Undo goes back with revert', () async {
    await seed();
    page.handlers['generate'] = (a) => {'ok': true, 'program': '$water# more\n', 'errors': [], 'stats': {'seconds': 3.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds field note to drink'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': ['adds field note to drink'], 'warnings': [], 'refused': []};
    page.handlers['undoEdit'] = (a) => {'verdict': 'restore', 'changes': ['back'], 'warnings': []};
    await c.send('add a note');
    expect(page.calls, containsAllInOrder(['evaluate', 'applyEdit']));
    final m = c.chat.last;
    expect(m.text, contains('adds field note to drink'));
    expect(m.text, contains('Everything you entered is kept'));
    expect(c.undoable, same(m));
    await c.undoLast();
    expect(page.calls.last, 'undoEdit');
    expect(m.undone, isTrue);
    expect(c.undoable, isNull);
    expect(c.chat.last.text, contains('Everything you entered since is still here'));
  });

  test('refused change explains the data risk and applies nothing', () async {
    await seed();
    page.handlers['generate'] = (a) => {'ok': true, 'program': water, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'refused', 'changes': [], 'warnings': [], 'refused': ['changing drink.ml from num to text would lose data.']};
    await c.send('make ml text');
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.chat.last.text, contains('saved data at risk'));
    expect(c.chat.last.text, contains('would lose data'));
    expect(c.chat.last.text, contains('Your app is unchanged'));
  });

  test('warn: shows the warning and asks; Apply it applies, Leave it does not', () async {
    await seed();
    page.handlers['generate'] = (a) => {'ok': true, 'program': water, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'warn', 'changes': ['hides field kind'], 'warnings': ['values in kind stay stored but are hidden.'], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'warn', 'changes': ['hides field kind'], 'warnings': [], 'refused': []};
    await c.send('drop kind');
    final ask = c.chat.last;
    expect(ask.text, contains('needs a decision'));
    expect(ask.text, contains('stay stored but are hidden'));
    expect(page.calls, isNot(contains('applyEdit')));
    expect(ask.buttons.map((b) => b.label), ['Apply it', 'Leave the app as it is']);
    await ask.buttons.last.onTap();
    expect(page.calls, isNot(contains('applyEdit')));
    // ask again and apply
    await c.send('drop kind');
    await c.chat.last.buttons.first.onTap();
    expect(page.calls, contains('applyEdit'));
  });

  test('a change that changes nothing says the app already works like that', () async {
    await seed();
    page.handlers['generate'] = (a) => {'ok': true, 'program': water, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('same');
    expect(c.chat.last.text, contains('already works like that'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('cancel, timeout, model error and ask each get their own plain message', () async {
    await seed();
    Future<String> run(Map<String, dynamic> res) async {
      page.handlers['generate'] = (a) => res;
      await c.send('x');
      return c.chat.last.text;
    }
    expect(await run({'ok': false, 'cancelled': true, 'program': '', 'errors': [], 'stats': {}}), 'Stopped. Nothing changed.');
    expect(await run({'ok': false, 'timedOut': true, 'program': '', 'errors': [], 'stats': {}}), contains('took too long'));
    expect(await run({'ok': false, 'modelError': true, 'program': '', 'errors': ['out of memory'], 'stats': {}}), contains('out of memory'));
    final ask = await run({'ok': false, 'ask': {'question': 'What do you want to track?', 'options': ['Water', 'Money']}, 'program': '', 'errors': [], 'stats': {}});
    expect(ask, contains('What do you want to track?'));
    expect(ask, contains('Water, Money'));
  });

  test('no model installed: the chat says how to install one, nothing breaks', () async {
    await seed();
    final bare = LlmService();
    final c2 = MoldeController(store: c.store, bridge: bridge, llm: bare, modelDirs: [tmp], readAsset: (p) async => water);
    await c2.init();
    await c2.send('anything');
    expect(c2.chat.last.text, contains('No model is installed'));
    expect(c2.busy, isFalse);
  });

  test('delete removes the app from the store and opens another', () async {
    await seed();
    final b = AppRecord(id: 'a2', name: 'Other', source: 'app "Other" star\n');
    await c.store.save(b);
    await c.init();
    final a1 = c.apps.firstWhere((a) => a.id == 'a1');
    await c.openApp(a1);
    await c.deleteApp(a1);
    expect((await c.store.list()).map((e) => e.id), ['a2']);
    expect(c.current!.id, 'a2');
  });

  test('a snapshot from the page is saved to disk and a new controller restores it', () async {
    await seed();
    bridge.onRaw(jsonEncode({'t': 'snapshot', 'payload': {'id': 'a1', 'source': water, 'snapshot': {'data': {'tables': {'drink': [1, 2, 3]}}}, 'undo': [{'src': 'old', 'ver': 0}]}}));
    await c.settleSaves();
    final back = (await AppStore(Directory('${tmp.path}/molde')).load('a1'))!;
    expect(back.snapshot!['data'], {'tables': {'drink': [1, 2, 3]}});
    expect(back.undo.length, 1);
  });
}

class _Holder implements JsTransport {
  JsTransport? inner;
  @override
  Future<void> run(String js) async => inner?.run(js);
}
