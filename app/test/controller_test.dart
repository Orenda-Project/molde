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
  roundThree();
  roundThreeFlows();
  roundFour();
  roundFourFlows();
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
    await c.send('tidy it up');
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
    expect(c.chat.last.text, contains("couldn't make that change yet"));
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
    expect(await run({'ok': false, 'timedOut': true, 'program': '', 'errors': [], 'stats': {}}), contains('took too long'));
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
      expect(settingEditProgram('make the goal 3000', waterFull), isNull); // no "to": not this shape
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
    expect(c.chat.last.text, contains('Goal is now 3000'));
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
    expect(c.chat.last.text, contains('Goal is now 3000'));
    expect(page.calls, contains('applyEdit'));
  });

  test('an edit that removes more than 20% of the lines is refused unless the request asked to remove', () async {
    c.changeCurrent();
    final cut = 'app "Water" drop ocean\ntable drink ml num, kind text\n';
    page.handlers['generate'] = (a) => {'ok': true, 'program': cut, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['removes from the screen: trend'], 'warnings': [], 'refused': []};
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('tidy it up');
    expect(page.calls, isNot(contains('applyEdit')));
    expect(c.chat.last.text, contains('would have removed'));
    expect(c.chat.last.text, contains('trend drink'));
    expect(c.chat.last.buttons.map((b) => b.label), ['Try again']);
    await c.send('remove the chart and the form');
    expect(page.calls, contains('applyEdit'));
  });

  test('model echo (nothing changed): never "already does that", says it could not', () async {
    c.changeCurrent();
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterFull, 'errors': [], 'stats': {}};
    page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': [], 'settings': []};
    await c.send('add a goal');
    expect(c.chat.last.text, contains("I couldn't make that change yet"));
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
      expect(unmetClaims('add a note field', o, o), contains('the note'));
      expect(unmetClaims('add a note field', o, o.replaceFirst('ml num', 'ml num, note text')), isEmpty);
      expect(unmetClaims('remove the streak', o, o), contains('removing the streak'));
      expect(unmetClaims('remove the streak', o, o.replaceFirst('stat count(drink) "streak"\n', '')), isEmpty);
      expect(unmetClaims('add a chart', o, o), contains('a chart'));
      expect(unmetClaims('remove the chart', o, o), contains('removing the chart'));
      expect(unmetClaims('remove the chart', o, o.replaceFirst('trend drink, it.ml\n', '')), isEmpty);
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
    await c.send('add a note field');
    expect(c.chat.last.text, "I couldn't make that change yet. Your app is unchanged.");
    expect(page.calls, isNot(contains('applyEdit')));
  });

  test('an applied change that lacks the asked part does not say "Changed"', () async {
    page.handlers['generate'] = (a) => {'ok': true, 'program': waterHdr.replaceFirst('"Today" head', '"Today now" head'), 'errors': [], 'stats': {'seconds': 3}};
    page.handlers['evaluate'] = (a) => okEval(['adds: "Today now" head']);
    page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
    await c.send('add a note field');
    final t = c.chat.last.text;
    expect(t, isNot(startsWith('Changed')));
    expect(t, contains('not what you asked'));
    expect(t, contains('the note'));
    expect(t, contains('Today now'));
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
    expect(c.chat.last.text, startsWith('Made Sleep tracker: add s entries'));
  });
}
