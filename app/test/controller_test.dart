import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';
import 'package:molde/src/controller.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/store.dart';
import 'package:molde/src/summary.dart';

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
  roundThree();
  roundThreeFlows();
  roundFour();
  roundFourFlows();
  roundFive();
  roundFiveOne();
  roundFiveOneFlow();
  roundSixOne();
  roundSixOneFlow();
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
    page.handlers['generate'] = (a) => {'ok': true, 'program': water.replaceFirst('ml num', 'ml num, note text'), 'errors': [], 'stats': {'seconds': 3.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds field note to drink'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': ['adds field note to drink'], 'warnings': [], 'refused': []};
    page.handlers['undoEdit'] = (a) => {'verdict': 'restore', 'changes': ['back'], 'warnings': []};
    await c.send('tidy it up');
    expect(page.calls, containsAllInOrder(['evaluate', 'applyEdit']));
    final m = c.chat.last;
    expect(m.text, contains('Added a Note field.'));
    expect(m.text, isNot(contains('drink.')));
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
    page.handlers['evaluate'] = (a) => {'verdict': 'refused', 'changes': [], 'warnings': [], 'refused': ['drink.ml disappears and drink.amount of the same type appears: this looks like a rename. Write "amount num was ml" to move the values.']};
    await c.send('make ml text');
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.chat.last.text, contains('saved data at risk'));
    expect(c.chat.last.text, contains('renamed the field Ml to Amount'));
    expect(c.chat.last.text, isNot(contains('Write')));
    expect(c.chat.last.text, contains('Your app is unchanged'));
  });

  test('warn: shows the warning and asks; Apply it applies, Leave it does not', () async {
    await seed();
    page.handlers['generate'] = (a) => {'ok': true, 'program': '$water# x\n', 'errors': [], 'stats': {}};
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
    await c.send('add same');
    expect(c.chat.last.text, contains('I did not apply this'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('cancel, timeout, model error and ask each get their own plain message', () async {
    await seed();
    Future<String> run(Map<String, dynamic> res) async {
      page.handlers['generate'] = (a) => res;
      await c.send('add x');
      return c.chat.last.text;
    }
    expect(await run({'ok': false, 'cancelled': true, 'program': '', 'errors': [], 'stats': {}}), 'Stopped. Nothing changed.');
    expect(await run({'ok': false, 'timedOut': true, 'program': '', 'errors': [], 'stats': {}}), contains('nothing new was written'));
    expect(await run({'ok': false, 'modelError': true, 'program': '', 'errors': ['out of memory'], 'stats': {}}), contains('out of memory'));
    final ask = await run({'ok': false, 'ask': {'question': 'What do you want to track?', 'options': ['Water', 'Money']}, 'program': '', 'errors': [], 'stats': {}});
    expect(ask, contains('What do you want to track?'));
    expect(c.chat.last.buttons.map((b) => b.label), ['Water', 'Money']);
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

// ---------------- round 3 ----------------
const waterFull = 'app "Water" drop ocean\ntable drink ml num, kind text\nsetting goal num = 2000 "Daily goal (ml)"\n"Today" head\nbutton "250" tap add drink ml = 250\nform drink\ntrend drink, it.ml\n';

void roundThree() {
  group('round 3 rules', () {
    test('namesAThing: any request that names something builds at once; only contentless ones may ask', () {
      for (final r in ['todo', 'water', 'budget', 'notes', 'medicine', 'reminders', 'counter', 'habits', 'expenses', 'workout', 'a todo list', 'budget app']) {
        expect(namesAThing(r), isTrue, reason: r);
      }
      expect(namesAThing('make me an app'), isFalse);
      expect(namesAThing('something please'), isFalse);
      expect(namesAThing('I want a thing that helps me keep track of my days'), isTrue); // names something: no question
      expect(namesAThing('i want to build something please'), isFalse);
      expect(namesAThing(''), isFalse);
    });
    test('looksLikeNewApp: new-app wording without a name of the current app', () {
      expect(looksLikeNewApp('a habit tracker', waterFull), isTrue);
      expect(looksLikeNewApp('make me a budget app', waterFull), isTrue);
      expect(looksLikeNewApp('build a timer', waterFull), isTrue);
      expect(looksLikeNewApp('create a to do list', waterFull), isTrue);
      expect(looksLikeNewApp('make a drink counter', waterFull), isFalse); // names "drink"
      expect(looksLikeNewApp('a water log', waterFull), isFalse); // names the app
      expect(looksLikeNewApp('change the goal to 3000', waterFull), isFalse);
      expect(looksLikeNewApp('make it green', waterFull), isFalse);
      expect(looksLikeNewApp('sleep tracker', waterFull), isTrue);
      expect(looksLikeNewApp('kharcha', waterFull), isTrue);
      expect(looksLikeNewApp('gym log', waterFull), isTrue);
      for (final v in ['change the title', 'rename it to X', 'add a note', 'remove the streak', 'delete the chart', 'hide the form', 'show the totals', 'set goal 5', 'move the chart up', 'bigger', 'smaller text']) {
        expect(looksLikeNewApp(v, waterFull), isFalse, reason: v);
      }
      expect(looksLikeNewApp('add a note to each drink', waterFull), isFalse);
    });
    test('settingEditProgram: a number change of a named setting is edited directly', () {
      final r = settingEditProgram('change the goal to 3000', waterFull)!;
      expect(r, contains('setting goal num = 3000 "Daily goal (ml)"'));
      expect(settingEditProgram('set daily goal to 2,500', waterFull), contains('= 2500'));
      expect(settingEditProgram('make the goal 3000', waterFull), contains('= 3000')); // 0.6.1: "to" is optional
      expect(settingEditProgram('change the colour to 3000', waterFull), isNull); // no such setting
      expect(settingEditProgram('make it green', waterFull), isNull);
      expect(settingEditProgram('change the goal to 2000', waterFull), waterFull);
    });
    test('removedLines counts what the new program lost', () {
      expect(removedLines('a\nb\nc\n', 'a\nc\nd\n'), ['b']);
      expect(removedLines('a\na\nb\n', 'a\nb\n'), ['a']);
    });
  });
}

void roundThreeFlows() {
  late Directory tmp; late WebBridge bridge; late ScriptedPage page; late MoldeController c;
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_r3_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = ScriptedPage(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => waterFull);
    page.handlers['open'] = (a) => {'ok': true};
    page.handlers['describe'] = (a) => {'text': 'Keeps: drink'};
    await c.store.save(AppRecord(id: 'w', name: 'Water', source: waterFull));
    await c.init();
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('ask: options are buttons; tapping one sends Question and Answer with the original request and no second ask', () async {
    c.startNewApp();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) {
      seen.add(a);
      if (seen.length == 1) return {'ok': false, 'ask': {'question': 'What is it for?', 'options': ['Home', 'Work']}, 'program': '', 'errors': [], 'stats': {}};
      return {'ok': true, 'program': 'app "Home" drop ocean\n', 'errors': [], 'stats': {'seconds': 1}};
    };
    await c.send('make me an app'); // vague: may ask
    expect(seen.first['allowAsk'], isTrue);
    final m = c.chat.last;
    expect(m.buttons.map((b) => b.label), ['Home', 'Work']);
    expect(c.pendingAsk, isNotNull);
    await m.buttons.first.onTap();
    expect(seen.length, 2);
    expect(seen[1]['request'], 'make me an app');
    expect(seen[1]['ask'], {'question': 'What is it for?', 'answer': 'Home'});
    expect(seen[1]['allowAsk'], isFalse);
    expect(c.pendingAsk, isNull);
  });

  test('ask: typed text answers the open question too', () async {
    c.startNewApp();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) {
      seen.add(a);
      return seen.length == 1 ? {'ok': false, 'ask': {'question': 'For?', 'options': ['A']}, 'program': '', 'errors': [], 'stats': {}} : {'ok': true, 'program': 'app "X" drop ocean\n', 'errors': [], 'stats': {}};
    };
    await c.send('an app');
    await c.send('my own answer');
    expect(seen[1]['ask'], {'question': 'For?', 'answer': 'my own answer'});
    expect(seen[1]['request'], 'an app');
  });

  test('a named one to three word request never gets a chance to ask', () async {
    c.startNewApp();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) { seen.add(a); return {'ok': true, 'program': 'app "Todo" drop ocean\n', 'errors': [], 'stats': {}}; };
    for (final r in ['todo', 'water', 'budget']) { c.startNewApp(); await c.send(r); }
    expect(seen.map((a) => a['allowAsk']), [false, false, false]);
  });

  test('after a create the mode is Change <new app>', () async {
    c.startNewApp();
    expect(c.modeLabel, 'New app');
    page.handlers['generate'] = (a) => {'ok': true, 'program': 'app "Todo" drop ocean\n', 'errors': [], 'stats': {}};
    await c.send('todo');
    expect(c.newAppMode, isFalse);
    expect(c.modeLabel, 'Changing Todo');
    expect(c.apps.length, 2);
  });

  test('Change mode + a new-app request: asks with two buttons, never silently changes', () async {
    c.changeCurrent();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) { seen.add(a); return {'ok': true, 'program': 'app "Habits" drop ocean\n', 'errors': [], 'stats': {}}; };
    await c.send('a habit tracker');
    expect(seen, isEmpty);
    final m = c.chat.last;
    expect(m.buttons.map((b) => b.label), ['New app', 'Change Water']);
    await m.buttons.first.onTap();
    expect(seen.single['kind'], 'create');
    expect(c.apps.length, 2);
    expect(c.apps.any((a) => a.id == 'w'), isTrue); // Water is not lost
  });

  test('Change Water button sends the request as an edit', () async {
    c.changeCurrent();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) { seen.add(a); return {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}}; };
    await c.send('a habit tracker');
    await c.chat.last.buttons.last.onTap();
    expect(seen.single['kind'], 'edit');
  });

  test('setting-only change: reported as "Goal is now 3000" and applied', () async {
    c.changeCurrent();
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterFull.replaceAll('= 2000', '= 3000'), 'errors': [], 'stats': {'seconds': 2}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['Goal is now 3000'], 'warnings': [], 'refused': [], 'settings': [{'name': 'goal', 'text': 'Goal is now 3000'}]};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('change the goal to 3000');
    expect(c.chat.last.text, contains('to 3000'));
    expect(c.chat.last.text, isNot(contains('nothing changed')));
    expect(page.calls, contains('applyEdit'));
  });

  test('"change the goal to 3000" is applied without the model and reported', () async {
    c.changeCurrent();
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['Goal is now 3000'], 'warnings': [], 'refused': [], 'settings': [{'name': 'goal', 'text': 'Goal is now 3000'}]};
    page.handlers['applyEdit'] = (a) { expect(a['source'], contains('= 3000')); return {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []}; };
    page.handlers['generate'] = (a) => throw StateError('the model must not run');
    await c.send('change the goal to 3000');
    expect(page.calls, isNot(contains('generate')));
    expect(c.chat.last.text, contains('to 3000'));
    expect(page.calls, contains('applyEdit'));
  });

  test('an edit that removes more than 20% of the lines is refused unless the request asked to remove', () async {
    c.changeCurrent();
    final cut = 'app "Water" drop ocean\ntable drink ml num, kind text\n';
    final longer = 'app "Water" drop ocean\ntable drink ml num\nsetting goal num = 3\nrow\n  "a" head\n  "b" head\ntrend drink\nform drink\nform drink\nform drink\n';
    await c.store.save(AppRecord(id: 'a1', name: 'Water', source: longer));
    await c.init();
    c.changeCurrent();
    page.handlers['generate'] = (a) => {'ok': true, 'program': cut, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['removes from the screen: trend'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('tidy it up');
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.chat.last.text, contains('would have removed'));
    expect(c.chat.last.text, contains('a chart'));
    expect(c.chat.last.text, isNot(contains('trend drink')));
    expect(c.chat.last.buttons.map((b) => b.label), ['Try again']);
    await c.send('remove the chart and the form');
    expect(c.chat.last.text, isNot(contains('did not ask to remove anything')));
  });

  test('model echo (nothing changed): never "already does that", says it could not', () async {
    c.changeCurrent();
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterFull, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    await c.send('add a goal');
    expect(c.chat.last.text, contains('I did not apply this'));
    expect(c.chat.last.text, contains('Your app is unchanged'));
    expect(c.chat.last.text, isNot(contains('already does that')));
  });

  test('edits get a line budget of at least the current length plus room', () async {
    c.changeCurrent();
    final seen = <Map<String, dynamic>>[];
    page.handlers['generate'] = (a) { seen.add(a); return {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}}; };
    await c.send('tidy it up');
    expect(seen.single['maxLines'], greaterThanOrEqualTo(70));
    expect(seen.single['maxLines'], greaterThanOrEqualTo(programLines(waterFull).length));
  });

  test('examples open with sample data (seed passed once) and Clear removes it', () async {
    await c.loadExample('water.mo');
    expect(page.calls.where((x) => x == 'open').length, greaterThan(0));
    expect(c.current!.sample, isTrue);
    expect(c.current!.exampleId, 'water');
    var cleared = false;
    page.handlers['open'] = (a) { cleared = !a.containsKey('seed'); return {'ok': true}; };
    await c.clearSample();
    expect(c.current!.sample, isFalse);
    expect(c.current!.snapshot, isNull);
    expect(cleared, isTrue);
    expect(page.calls, contains('flush'));
  });
}

void roundFour() {
  const hdr = 'app "Water" drop ocean\ntable drink ml num, note text\n';
  group('round 4 rules', () {
    test('appLineEdit: colours, dark/light, size, title; anything else goes to the model', () {
      expect(appLineEdit('make it green', hdr)!.program.startsWith('app "Water" drop green\n'), isTrue);
      expect(appLineEdit('make it green', hdr)!.label, 'green');
      expect(appLineEdit('purple', hdr)!.program, startsWith('app "Water" drop purple\n'));
      expect(appLineEdit('change the colour to pink', hdr)!.program, startsWith('app "Water" drop pink\n'));
      expect(appLineEdit('make it dark', hdr)!.program, startsWith('app "Water" drop ocean dark\n'));
      expect(appLineEdit('dark mode', 'app "X" star\n')!.program, startsWith('app "X" star mint dark\n'));
      expect(appLineEdit('light mode', 'app "X" star ink dark\n')!.program, startsWith('app "X" star ink light\n'));
      expect(appLineEdit('bigger text', hdr)!.program, startsWith('app "Water" drop ocean large\n'));
      expect(appLineEdit('make it bigger', 'app "X" star ink large\n')!.program, startsWith('app "X" star ink huge\n'));
      expect(appLineEdit('smaller text', hdr)!.program, startsWith('app "Water" drop ocean small\n'));
      expect(appLineEdit('change the title to My Spending', hdr)!.program, startsWith('app "My Spending" drop ocean\n'));
      expect(appLineEdit('rename it to Gym', hdr)!.label, 'title is now Gym');
      expect(appLineEdit('make it green', 'app "W" drop green\n')!.unchanged, isTrue);
      expect(appLineEdit('add a note field', hdr), isNull);
      expect(appLineEdit('make the chart green and add a note', hdr), isNull);
      expect(appLineEdit('remove the streak', hdr), isNull);
      // the rest of the program is untouched
      expect(appLineEdit('make it red', hdr)!.program.split('\n').skip(1).join('\n'), hdr.split('\n').skip(1).join('\n'));
    });
    test('unmetClaims: what was asked but is not in the new program', () {
      const o = 'app "Water" drop ocean\ntable drink ml num\ntrend drink, it.ml\nstat count(drink) "streak"\n';
      expect(unmetClaims('make it green', o, o), contains('the green theme'));
      expect(unmetClaims('make it green', o, o.replaceFirst('ocean', 'green')), isEmpty);
      expect(unmetClaims('dark mode', o, o), contains('dark mode'));
      expect(unmetClaims('change the title to Spend', o, o), contains('the new title'));
      // fields, buttons and charts come from the diff (summary.dart)
      expect(unmetFromDiff('add a note field', o, o), contains('the new field'));
      expect(unmetFromDiff('add a field for phone number', o, o.replaceFirst('ml num', 'ml num, phone text')), isEmpty);
      expect(unmetFromDiff('add a chart', o, o), contains('a chart'));
      expect(unmetFromDiff('remove the chart', o, o), contains('removing the chart'));
      expect(unmetFromDiff('remove the chart', o, o.replaceFirst('trend drink, it.ml\n', '')), isEmpty);
    });
    test('betterTitle replaces a question or a sentence by the request noun', () {
      expect(betterTitle('app "What do you want to track?" star ink\n', 'sleep tracker'), 'Sleep tracker');
      expect(betterTitle('app "Savings" star ink\n', 'savings'), isNull);
      expect(withTitle('app "What?" star ink\n', 'Savings'), 'app "Savings" star ink\n');
    });
    test('plainSummary is one plain sentence', () {
      final s = plainSummary('app "Savings" star ink\ntable income amount money, note text\nstat sum(income.amount) "Total"\ntrend income, it.amount\n');
      expect(s, startsWith('Made Savings: add income entries with amount and note'));
      expect(s, contains('your totals'));
      expect(s, contains('a chart'));
      expect(s, isNot(contains('Keeps')));
      expect(s.split('\n').length, 1);
    });
  });
}

void roundFourFlows() {
  late Directory tmp; late WebBridge bridge; late ScriptedPage page; late MoldeController c;
  const waterHdr = 'app "Water" drop ocean\ntable drink ml num\nsetting goal num = 2000 "Daily goal"\n"Today" head\nform drink\ntrend drink, it.ml\n';
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_r4_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = ScriptedPage(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => waterHdr);
    page.handlers['open'] = (a) => {'ok': true};
    page.handlers['describe'] = (a) => {'text': ''};
    await c.store.save(AppRecord(id: 'w', name: 'Water', source: waterHdr));
    await c.init();
    c.changeCurrent();
  });
  tearDown(() => tmp.deleteSync(recursive: true));
  Map<String, dynamic> okEval(List<String> ch) => {'verdict': 'safe', 'changes': ch, 'warnings': [], 'refused': [], 'settings': []};

  test('"make it green" is done at once, without the model, and says "Done: green"', () async {
    page.handlers['generate'] = (a) => throw StateError('no model');
    page.handlers['evaluate'] = (a) { expect(a['source'], startsWith('app "Water" drop green\n')); return okEval(['changes the theme to green']); };
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('make it green');
    expect(c.chat.last.text, 'Done: green');
    expect(page.calls, isNot(contains('generate')));
    expect(c.undoable, isNotNull);
  });

  test('"change the title to My Spending" right after a create works on the new app', () async {
    c.startNewApp();
    page.handlers['generate'] = (a) => {'ok': true, 'program': 'app "Savings" star ink\ntable income amount money\n', 'errors': [], 'stats': {}};
    await c.send('savings');
    expect(c.modeLabel, 'Changing Savings');
    page.handlers['evaluate'] = (a) { expect(a['source'], startsWith('app "My Spending" star ink\n')); return okEval(['renames the app']); };
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('change the title to My Spending');
    expect(c.chat.last.text, 'Done: title is now My Spending');
  });

  test('model returns the program unchanged: "I couldn\'t make that change yet", never "already does that"', () async {
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterHdr, 'errors': [], 'stats': {'seconds': 3}};
    page.handlers['evaluate'] = (a) => okEval([]);
    await c.send('tidy it up');
    expect(c.chat.last.text, startsWith('I did not apply this'));
    expect(c.chat.last.text, contains('Your app is unchanged'));
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('an applied change that lacks the asked part does not say "Changed"', () async {
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterHdr.replaceFirst('"Today" head', '"Today now" head'), 'errors': [], 'stats': {'seconds': 3}};
    page.handlers['evaluate'] = (a) => okEval(['adds: "Today now" head']);
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('add a chart');
    final t = c.chat.last.text;
    expect(t, isNot(startsWith('Changed')));
    expect(t, contains('I did not apply this'));
    expect(t, isNot(contains('Today now')));
  });

  test('bare noun in Change mode asks the two-button question; "add ..." never does', () async {
    page.handlers['generate'] = (a) => {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}};
    await c.send('sleep tracker');
    expect(c.chat.last.buttons.map((b) => b.label), ['New app', 'Change Water']);
    await c.send('add a sleep field');
    expect(c.chat.last.text, isNot(contains('sounds like a new app')));
  });

  test('buttons of an answered ask or clarifier are disabled; chat is kept per app and survives a restart', () async {
    page.handlers['generate'] = (a) => {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}};
    await c.send('sleep tracker');
    final m = c.chat.last;
    expect(m.disabled, isFalse);
    await c.openApp(c.current!); // the app "changes": old buttons stop working
    expect(m.disabled, isTrue);
    await c.settleSaves();
    final again = MoldeController(store: c.store, bridge: bridge, llm: c.llm, modelDirs: [tmp], readAsset: (p) async => waterHdr);
    await again.init();
    expect(again.chat.any((x) => x.text.contains('sounds like a new app')), isTrue);
    expect(again.chat.every((x) => x.buttons.isEmpty), isTrue);
  });

  test('a long app (over 30 lines) says up front that changes take minutes; a model title that is a question is replaced', () async {
    final long = waterHdr + List.generate(30, (i) => '"line $i" faint').join('\n') + '\n';
    await c.store.save(AppRecord(id: 'l', name: 'Water', source: long));
    await c.init();
    final l = c.apps.firstWhere((a) => a.id == 'l');
    await c.openApp(l);
    c.changeCurrent();
    String? seenText;
    page.handlers['generate'] = (a) { seenText = c.chat.last.text; return {'ok': false, 'program': '', 'errors': ['x'], 'stats': {'seconds': 1}}; };
    await c.send('tidy it up');
    expect(seenText, contains('This app is long, changes can take a few minutes'));
    expect(c.genHistory.single['lines'], greaterThan(30));
    c.startNewApp();
    page.handlers['generate'] = (a) => {'ok': true, 'program': 'app "What do you want to track?" star ink\ntable s x num\n', 'errors': [], 'stats': {}};
    await c.send('sleep tracker');
    expect(c.current!.name, 'Sleep tracker');
    expect(c.chat.last.text, startsWith('Made Sleep tracker'));
  });
}

void roundFive() {
  late Directory tmp; late WebBridge bridge; late ScriptedPage page; late MoldeController c;
  const w = 'app "Water" drop ocean\ntable drink ml num\nform drink\n';
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_r5_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = ScriptedPage(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => w);
    page.handlers['open'] = (a) => {'ok': true};
    await c.store.save(AppRecord(id: 'w', name: 'Water', source: w));
    await c.init();
    c.changeCurrent();
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('a newer question disables every older unanswered one (New/Change and asks alike)', () async {
    page.handlers['generate'] = (a) => {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}};
    await c.send('sleep tracker');
    final first = c.chat.last;
    expect(first.buttons, isNotEmpty);
    expect(first.disabled, isFalse);
    await c.send('kharcha');
    final second = c.chat.last;
    expect(second.buttons, isNotEmpty);
    expect(first.disabled, isTrue, reason: 'the older question is stale');
    expect(second.disabled, isFalse);
    await c.send('gym log');
    expect(second.disabled, isTrue);
    expect(c.chat.last.disabled, isFalse);
    // an ask question disables the New/Change one before it
    c.startNewApp();
    page.handlers['generate'] = (a) => {'ok': false, 'ask': {'question': 'For what?', 'options': ['A', 'B']}, 'program': '', 'errors': [], 'stats': {}};
    await c.send('make me an app');
    expect(c.chat.where((m) => m.buttons.isNotEmpty && !m.disabled).length, 1);
  });

  test('the live message shows the line being written and the seconds', () async {
    String? seen;
    page.handlers['generate'] = (a) {
      bridge.onRaw(jsonEncode({'t': 'progress', 'lines': 11, 'program': 'x\n', 'rejected': 0, 'seconds': 45}));
      seen = c.chat.last.text;
      return {'ok': false, 'program': '', 'errors': ['x'], 'stats': {}};
    };
    await c.send('add something');
    expect(seen, contains('Writing line 12'));
    expect(RegExp(r'\(\d+ s\)').hasMatch(seen!), isTrue);
    expect(seen, isNot(contains('null')));
  });
}

void roundFiveOne() {
  const vit = 'app "Vitamins" pill ocean\ntable dose name text, note text\nsetting goal num = 3 "Daily goal"\nrow\n  button "1" tap add dose name = "one"\n  button "2" tap add dose name = "two"\nform dose\n';
  group('0.5.1', () {
    test('progressText always has numbers: reading before the first line, then the next line and the seconds', () {
      expect(progressText('', -1, 12), 'Reading your request… (12 s)');
      expect(progressText('', 0, 3), 'Writing line 1… (3 s)');
      expect(progressText('', 11, 45), 'Writing line 12… (45 s)');
      expect(progressText('This app is long.\n', 4, 7), 'This app is long.\nWriting line 5… (7 s)');
      for (final t in [progressText('', -1, 0), progressText('', 3, 0)]) { expect(t, isNot(contains('null'))); }
    });
    test('ageText: never a time in the future, hours and days in words', () {
      const now = 10000000000;
      expect(ageText(now + 5000, now), 'just now');
      expect(ageText(now - 30 * 1000, now), 'just now');
      expect(ageText(now - 5 * 60000, now), '5 min ago');
      expect(ageText(now - 3 * 3600000, now), '3 h ago');
      expect(ageText(now - 50 * 3600000, now), '2 d ago');
    });
    test('an app changed in this session reads "just now" even if the wall clock moved by hours', () async {
      final tmp = Directory.systemTemp.createTempSync('molde_age_');
      final store = AppStore(tmp);
      final r = AppRecord(id: 'a', name: 'A', source: 'app "A" star\n');
      await store.save(r);
      r.updatedAt = DateTime.now().millisecondsSinceEpoch - 3 * 3600000; // the device clock jumped
      expect(r.age(), 'just now');
      final fromDisk = (await AppStore(tmp).load('a'))!;
      expect(fromDisk.age(), 'just now'); // freshly written, wall clock fine
      tmp.deleteSync(recursive: true);
      final old = AppRecord(id: 'b', name: 'B', source: 'x', updatedAt: DateTime.now().millisecondsSinceEpoch - 3 * 3600000);
      expect(old.age(), '3 h ago');
      final future = AppRecord(id: 'c', name: 'C', source: 'x', updatedAt: DateTime.now().millisecondsSinceEpoch + 7200000);
      expect(future.age(), 'just now');
    });
    test('dropsUnasked: dropped lines the request does not name; edited lines and named lines do not count', () {
      final noNote = vit.replaceAll(', note text', '');
      expect(dropsUnasked('remove the note field', vit, noNote), isEmpty);
      final alsoButtons = noNote.split('\n').where((l) => !l.contains('button')).join('\n') + '\n';
      final d = dropsUnasked('remove the note field', vit, alsoButtons);
      expect(d.length, 2);
      expect(d.first, startsWith('button "1"'));
      expect(dropsUnasked('remove the buttons', vit, alsoButtons).isEmpty, isTrue); // 0.6.1: "buttons" means the button and quick lines
      expect(dropsUnasked('remove button', vit, alsoButtons).isEmpty, isTrue);
      expect(dropsUnasked('add a chart', vit, '$vit"x" faint\n'), isEmpty);
    });
  });
}

void roundSixOne() {
  group('0.6.1 rules from the failure hunt', () {
    test('undo requests are recognised, other sentences with the same words are not', () {
      for (final r in ['undo', 'undo that', 'Undo that!', 'undo the last change', 'go back', 'go back to how it was', 'revert', 'revert it', 'please undo it', 'put it back', 'can you undo that', 'take that back']) {
        expect(isUndoRequest(r), isTrue, reason: r);
      }
      for (final r in ['add an undo button', 'revert to the blue theme', 'go back button', 'a habit tracker', 'undo tracker']) {
        expect(isUndoRequest(r), isFalse, reason: r);
      }
    });
    const chartApp = 'app "Spend" wallet ocean\ntable spend amount money\nstat total sum(spend.amount)\nplot 0..7, 0..100 axes\n  each days last 7 days\n    rect index, 0, 1, sum(spend.amount on it) fill accent\n    tick index, dayname(it)\nform spend\n';
    test('0.7.1 dropsUnasked: a removed list block whose first line has an identical twin elsewhere is one removal, not its children', () {
      const old = 'app "A" users ocean\ntable student name text\ngrid 2\n  each student sort name as s\n    s.name\neach student sort name as s\n  row\n    s.name grow\nform student, "Add"\n';
      const gone = 'app "A" users ocean\ntable student name text\ngrid 2\n  each student sort name as s\n    s.name\nform student, "Add"\n';
      expect(dropsUnasked('remove the list at the bottom', old, gone), isEmpty);
      expect(dropsUnasked('make it blue', old, gone), isNotEmpty); // nobody asked for it: still shown
    });
    test('dropsUnasked: "remove the chart" may remove the chart block, "remove the totals" the stat line', () {
      final noChart = 'app "Spend" wallet ocean\ntable spend amount money\nstat total sum(spend.amount)\nform spend\n';
      expect(dropsUnasked('remove the chart', chartApp, noChart), isEmpty);
      expect(dropsUnasked('get rid of the graph', chartApp, noChart), isEmpty);
      final noStat = chartApp.replaceAll('stat total sum(spend.amount)\n', '');
      expect(dropsUnasked('remove the totals', chartApp, noStat), isEmpty);
      // but a removal nobody asked for is still caught: asked for the chart, the stat line went too
      final both = noChart.replaceAll('stat total sum(spend.amount)\n', '');
      expect(dropsUnasked('remove the chart', chartApp, both), ['stat total sum(spend.amount)']);
    });
    test('removedLines: re-indenting is not a removal, an edited line is not a removal, a short app may lose a line', () {
      const flat = 'app "A" x ocean\ntable t a num\nlist t\nform t\nstat s 1\n';
      const sectioned = 'app "A" x ocean\ntable t a num\nsection "Log"\n  list t\n  form t\nsection "Totals"\n  stat s 1\n';
      expect(removedLines(flat, sectioned), isEmpty);
      expect(removedLines('app "A" x ocean\ntable t a num\nform t\nlist t\n', 'app "A" x ocean\ntable t a num, note text\nform t\nlist t\n'), isEmpty);
      expect(removalLimit(4), 2);
      expect(removalLimit(40), 8);
    });
    test('plainRefusal: the user never sees the language syntax', () {
      final a = plainRefusal(['dose.aisle disappears and dose.details of the same type appears: this looks like a rename. Write "details pick ... was aisle" to move the values, or remove the old field in a separate change.']);
      expect(a, contains('renamed the field Aisle to Details'));
      for (final bad in ['Write', 'was aisle', 'pick ...', 'table ']) { expect(a, isNot(contains(bad))); }
      expect(plainRefusal(['table old disappears and table fresh with the same fields appears: this looks like a rename. Write "table fresh was old" to move the rows.']), contains('renamed Old to Fresh'));
      expect(plainRefusal(['something odd']), isNot(contains('odd')));
    });
    test('rewrittenUnasked: an untouched filter, formula or chart line changed in place is reported; a named or table line is not', () {
      const old = 'app "A" x ocean\ntable t a num, done bool\nlet open = count(t where done = no)\neach t where done = no as r\n  r.a bold\nform t\n';
      final dropsFilter = old.replaceAll('each t where done = no as r', 'each t as r');
      expect(rewrittenUnasked('add a priority', old, dropsFilter), ['each t where done = no as r']);
      final addField = old.replaceAll('a num, done bool', 'a num, done bool, note text').replaceAll('form t', 'form t');
      expect(rewrittenUnasked('add a note field', old, addField), isEmpty); // the table line is edited on purpose
      expect(rewrittenUnasked('show all of them in the list', old, dropsFilter), isEmpty); // "list" maps to the each line
      expect(rewrittenUnasked('remove the chart', old, old.replaceAll('form t\n', '')), isEmpty); // a removal is dropsUnasked's job
    });
    test('unmetClaims: renaming a button is not a claim about the app title', () {
      const old = 'app "Fund" home mint\ntable d amount money\nform d\n';
      final nu = old.replaceAll('form d', 'form d, "Save"');
      expect(unmetClaims('rename the Add button to Save', old, nu), isEmpty);
      expect(unmetClaims('rename the app to Savings', old, old), contains('the new title'));
    });
    test('direct edits: wider wordings for dark mode, a colour theme, the title and the goal', () {
      const app = 'app "A" home mint\nsetting goal num = 2000 "Daily goal"\ntable t a num\n';
      String? prog(String r) => appLineEdit(r, app)?.program;
      expect(prog('turn on dark mode'), contains('dark'));
      expect(prog('can you make it dark'), contains('dark'));
      expect(prog('i want a blue theme'), contains('blue'));
      expect(prog('the colour should be teal'), contains('teal'));
      expect(prog('make it more green'), contains('green'));
      expect(prog('call this app Zakat'), contains('"Zakat"'));
      expect(prog('name it Rozana'), contains('"Rozana"'));
      expect(appLineEdit('turn off dark mode', 'app "A" home mint dark\n')?.program, isNot(contains('dark')));
      expect(appLineEdit('i want to track my green tea', app), isNull);
      expect(appLineEdit('make a green energy tracker', app), isNull);
      expect(settingEditProgram('make my goal 3000', app), contains('= 3000'));
      expect(settingEditProgram('set the target to 3000', app), contains('= 3000'));
      expect(settingEditProgram('i want to aim for 3000 instead', app), contains('= 3000'));
      expect(settingEditProgram('my goal should be 1500', app), contains('= 1500'));
      expect(settingEditProgram('make my colour 3000', app), isNull);
    });
  });
}

void roundSixOneFlow() {
  late Directory tmp; late WebBridge bridge; late ScriptedPage page; late MoldeController c;
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_r61_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = ScriptedPage(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => water);
    page.handlers['open'] = (a) => {'ok': true};
    await c.store.save(AppRecord(id: 'a1', name: 'Water', source: water));
    await c.init();
    c.changeCurrent();
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('"undo that" goes back to the previous version without the model and never asks "new app"', () async {
    page.handlers['generate'] = (a) => {'ok': true, 'program': '$water# more\n', 'errors': [], 'stats': {'seconds': 3.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds field note to drink'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    page.handlers['undoEdit'] = (a) => {'verdict': 'restore', 'changes': ['back'], 'warnings': []};
    await c.send('tidy it up');
    final change = c.chat.last;
    expect(c.undoable, same(change));
    page.calls.clear();
    page.handlers['generate'] = (a) => throw StateError('the model must not run for undo');
    await c.send('undo that');
    expect(page.calls, ['undoEdit']);
    expect(change.undone, isTrue);
    expect(c.chat.last.text, contains('Undone'));
    expect(c.chat.map((m) => m.text).join('\n'), isNot(contains('sounds like a new app')));
    // nothing left to undo: said plainly, still no model
    await c.send('undo that');
    expect(c.chat.last.text, contains('nothing earlier'));
    expect(page.calls, ['undoEdit']);
  });

  test('a native call that hung and was abandoned: honest message, the app is unchanged, the model reloads', () async {
    c.llm.model = ModelInfo('/m.gguf', 1, 0.1);
    page.handlers['generate'] = (a) { c.llm.noteHung({'stop': 'cancel', 'text': '', 'hung': true}); return {'ok': false, 'cancelled': true, 'program': '', 'errors': [], 'stats': {}}; };
    await c.send('tidy it up');
    expect(c.chat.last.text, contains('stopped responding'));
    expect(c.chat.last.text, contains('Your app is unchanged'));
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.llm.hung, isFalse); // read once
    expect(c.busy, isFalse);
    final m = <String, dynamic>{'stop': 'cancel', 'hung': true};
    expect(LlmService().noteHung(m), isTrue);
    expect(LlmService().noteHung({'stop': 'stop'}), isFalse);
  });

  test('a data-rule refusal shows plain English, no syntax', () async {
    page.handlers['generate'] = (a) => {'ok': true, 'program': '$water# more\n', 'errors': [], 'stats': {'seconds': 3.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'refused', 'changes': [], 'warnings': [], 'refused': ['drink.ml disappears and drink.amount of the same type appears: this looks like a rename. Write "amount num was ml" to move the values, or remove the old field in a separate change.']};
    await c.send('rename ml to amount');
    final t = c.chat.last.text;
    expect(t, contains('renamed the field Ml to Amount'));
    expect(t, isNot(contains('Write')));
    expect(t, isNot(contains('was ml')));
    expect(t, contains('Your app is unchanged'));
  });

  test('an edit that rewrites an untouched line is held for a decision, Keep my app is the default', () async {
    const app = 'app "T" x ocean\ntable t a num, done bool\neach t where done = no as r\n  r.a bold\nform t\n';
    await c.store.save(AppRecord(id: 'a3', name: 'T', source: app));
    await c.init();
    c.changeCurrent();
    final prog = app.replaceAll('each t where done = no as r', 'each t as r').replaceAll('a num, done bool', 'a num, done bool, priority text');
    page.handlers['generate'] = (a) => {'ok': true, 'program': prog, 'errors': [], 'stats': {'seconds': 3.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds field t.priority'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('add a priority');
    final m = c.chat.last;
    expect(m.text, contains('would also change something you did not mention'));
    expect(m.text, contains('a list of entries'));
    expect(m.text, isNot(contains('where done')));
    expect(m.buttons.map((b) => b.label), ['Keep my app', 'Apply anyway']);
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('an impossible request is answered plainly with the reason and an in-app offer, the model never runs', () async {
    page.handlers['generate'] = (a) => throw StateError('the model must not run');
    await c.send('send me a WhatsApp every morning');
    final m = c.chat.last;
    expect(m.text, contains("can't send messages"));
    expect(m.text, contains('offline'));
    expect(m.text, contains('reminder list inside the app'));
    expect(m.text, isNot(contains('name the part')));
    expect(m.buttons.map((b) => b.label), ['Make a reminder list', 'No thanks']);
  });

  test('"rename the Add button to Save" is applied without the model when the label is clear', () async {
    const app = 'app "Todo" check mint\ntable task title text\nlist task\nform task\n';
    await c.store.save(AppRecord(id: 'a4', name: 'Todo', source: app));
    await c.init();
    c.changeCurrent();
    page.handlers['generate'] = (a) => throw StateError('the model must not run');
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['x'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) { expect(a['source'], contains('form task, "Save"')); return {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []}; };
    await c.send('rename the Add button to Save');
    expect(page.calls, contains('applyEdit'));
    expect(c.chat.last.text, contains('Done: the button now says Save'));
  });

  test('a one-line edit of a small app is applied (the 20% guard no longer blocks it)', () async {
    const small = 'app "Todo" check mint\ntable task title text\nlist task\nform task\n';
    await c.store.save(AppRecord(id: 'a2', name: 'Todo', source: small));
    await c.init();
    c.changeCurrent();
    final edited = small.replaceAll('title text', 'title text, priority pick low|high');
    page.handlers['generate'] = (a) => {'ok': true, 'program': edited, 'errors': [], 'stats': {'seconds': 4.0}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['adds field task.priority'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('can you add a priority');
    expect(page.calls, contains('applyEdit'));
    expect(c.chat.last.text, isNot(contains('did not apply')));
  });
}

void roundFiveOneFlow() {
  late Directory tmp; late WebBridge bridge; late ScriptedPage page; late MoldeController c;
  const vit = 'app "Vitamins" pill ocean\ntable dose name text, note text\nsetting goal num = 3 "Daily goal"\nrow\n  button "1" tap add dose name = "one"\n  button "2" tap add dose name = "two"\nform dose\nform dose\nform dose\nform dose\n';
  setUp(() async {
    tmp = Directory.systemTemp.createTempSync('molde_r51_');
    final holder = _Holder();
    bridge = WebBridge(holder); page = ScriptedPage(bridge); holder.inner = page;
    bridge.onRaw(jsonEncode({'t': 'ready'}));
    final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
    c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => vit);
    page.handlers['open'] = (a) => {'ok': true};
    await c.store.save(AppRecord(id: 'v', name: 'Vitamins', source: vit));
    await c.init();
    c.changeCurrent();
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('an edit that also drops unasked lines is not applied: Keep my app is the default, Apply anyway applies', () async {
    final program = vit.replaceAll(', note text', '').split('\n').where((l) => !l.contains('button')).join('\n');
    page.handlers['generate'] = (a) => {'ok': true, 'program': program, 'errors': [], 'stats': {'seconds': 5}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['removes field dose.note', 'removes from the screen: button "1"'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('drop notes');
    final m = c.chat.last;
    expect(m.text, contains('This would also remove'));
    expect(m.text, contains('the "1" button'));
    expect(m.buttons.map((b) => b.label), ['Keep my app', 'Apply anyway']);
    expect(m.buttons.first.primary, isTrue);
    expect(page.calls, isNot(contains('applyEdit')));
    await m.buttons.first.onTap();
    expect(m.text, 'Kept your app as it is.');
    expect(page.calls, isNot(contains('applyEdit')));
    // ask again and apply anyway
    await c.send('drop notes');
    await c.chat.last.buttons.last.onTap();
    expect(page.calls, contains('applyEdit'));
  });
}
