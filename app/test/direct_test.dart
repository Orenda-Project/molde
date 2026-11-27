import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';
import 'package:molde/src/controller.dart';
import 'package:molde/src/direct.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/store.dart';
import 'package:molde/src/summary.dart';

const lessons = 'app "Tutor" school ocean\ntable student name text, fee money\ntable lesson student ref student, topic text\ntable paid student ref student, amount money\nstat sum(paid.amount) "Received"\ndaybars last 7 days, sum(student.fee on it)\neach student sort name as s\n  row card gap 1\n    s.name bold grow\n    button "Paid" tap add paid student = s, amount = s.fee\nform lesson, "Add lesson"\nform student, "Add student"\nlist paid by day\n';

void main() {
  group('direct paths', () {
    test('remove a named button', () {
      final o = removeButtonPlan('remove the Paid button', lessons)!;
      expect(o.edit!.program, isNot(contains('button "Paid"')));
      expect(o.edit!.program, contains('form lesson, "Add lesson"'));
    });
    test('the form\'s own save button is explained, not removed and not sent to the model', () {
      final o = removeButtonPlan('remove the Add lesson button', lessons)!;
      expect(o.edit, isNull);
      expect(o.ask, contains('saves a new entry'));
    });
    test('a missing button lists the real ones and offers each', () {
      final o = removeButtonPlan('remove the Delete button', lessons)!;
      expect(o.ask, contains('"Paid"'));
      expect(o.choices.map((c) => c.label), contains('Paid'));
      expect(o.choices.first.program, isNot(contains('button "Paid"')));
    });
    test('remove a named field, ask when it is missing, refuse the only field', () {
      expect(removeFieldPlan('remove the topic field', lessons)!.edit!.program, contains('table lesson student ref student\n'));
      final miss = removeFieldPlan('remove the phone field', lessons)!;
      expect(miss.ask, contains('Fee'));
      expect(miss.choices, isNotEmpty);
      expect(removeFieldPlan('remove the fee field', lessons), isNull); // the chart and total use it: the model must rework them
      expect(removeFieldPlan('remove the amount field', 'app "A" x ocean\ntable t amount money\nform t\n')!.ask, contains('only field'));
    });
    test('add a named field as an optional text field', () {
      final which = addFieldPlan('add a field for phone number', lessons)!; // two tables have a form: which one?
      expect(which.ask, contains('Which one'));
      expect(which.choices.map((c) => c.label), ['Student', 'Lesson']);
      expect(which.choices.first.program, contains('fee money, phone_number text?'));
      expect(addFieldPlan('add a phone number field to the student', lessons)!.edit!.program, contains('phone_number text?'));
      const one = 'app "A" x ocean\ntable student name text, fee money\nform student\nlist student\n';
      expect(addFieldPlan('add a field for phone number', one)!.edit!.program, contains('table student name text, fee money, phone_number text?'));
      expect(addFieldPlan('add a notes field', one)!.edit!.program, contains('notes text?'));
      expect(addFieldPlan('add a due date field', one)!.edit!.program, contains('due_date date?'));
      expect(addFieldPlan('add a field called total fee', one)!.edit!.program, contains('total_fee money?'));
      expect(addFieldPlan('add a fee field', one)!.ask, contains('already has a Fee field'));
    });
    test('rename a button in the wordings people use', () {
      expect(renameButtonPlan('change the Add student button to say Enrol', lessons)!.edit!.program, contains('form student, "Enrol"'));
      expect(renameButtonPlan('rename Paid to Received', lessons)!.edit!.program, contains('button "Received"'));
      expect(renameButtonPlan('call Paid Received', lessons)!.edit!.program, contains('button "Received"'));
      expect(renameButtonPlan('call it Zakat', lessons), isNull);
      final miss = renameButtonPlan('change the Save button to say Done', lessons)!;
      expect(miss.ask, contains('"Paid"'));
      expect(miss.choices, isNotEmpty);
    });
    test('vague requests', () {
      expect(isVagueRequest('make it nicer'), isTrue);
      expect(isVagueRequest('can you make it look better'), isTrue);
      expect(isVagueRequest('make the buttons better at tracking fees'), isFalse);
      expect(isVagueRequest('add a chart'), isFalse);
    });
  });

  group('the model change must touch the named part', () {
    final noChart = lessons.replaceFirst('daybars last 7 days, sum(student.fee on it)\n', '');
    test('removing the chart when asked to remove a button is caught (the 0.6.2 verdict)', () {
      expect(namedPartMismatch('remove the Paid button', lessons, noChart), contains('"Paid" button is still there'));
      expect(namedPartMismatch('remove the Paid button', lessons, lessons.replaceFirst('    button "Paid" tap add paid student = s, amount = s.fee\n', '')), isNull);
    });
    test('a field, a rename and a chart of the named field', () {
      final withPhone = lessons.replaceFirst('fee money', 'fee money, phone text?');
      expect(namedPartMismatch('add a field for phone number', lessons, withPhone), isNull);
      expect(namedPartMismatch('add a field for phone number', lessons, lessons.replaceFirst('fee money', 'fee money, city text?')), contains('not called phone number'));
      expect(namedPartMismatch('rename the Paid button to Received', lessons, lessons), contains('no button says "received"'));
      expect(namedPartMismatch('add a chart of fees', lessons, '${lessons}daybars last 7 days, sum(student.fee on it)\n'), isNull);
      expect(namedPartMismatch('add a chart of fees', lessons, '${lessons}daybars last 7 days, count(student on it)\n'), contains('does not plot fees'));
    });
    test('a chart of a field the app does not have', () {
      final m = missingChartField('add a chart of salary', lessons)!;
      expect(m.text, contains('no field called "salary"'));
      expect(m.fields, contains('fee'));
      expect(missingChartField('add a chart of fees', lessons), isNull);
      expect(missingChartField('add a chart', lessons), isNull);
    });
  });

  group('a built app in plain words', () {
    test('describeApp', () {
      final d = describeApp(lessons);
      expect(d, startsWith('Made Tutor with '));
      expect(d, contains('a "Paid" button'));
      expect(d, contains('a total'));
      expect(d, contains('a chart'));
      expect(kLanguageLeak.hasMatch(d), isFalse, reason: d);
      expect(d, isNot(contains('entries with')));
    });
    test('key nouns the request names but the app lacks', () {
      const bare = 'app "T" x ocean\ntable student name text\nform student\n';
      expect(keyNounGaps('tutor fees with a paid button and a list', bare).map((g) => g.phrase), ['a list of the entries', 'a way to mark things paid']);
      expect(keyNounGaps('tutor fees with a paid button and a list', lessons), isEmpty);
      expect(keyNounGaps('water tracker with a goal', bare).map((g) => g.phrase), ['a goal']);
    });
  });

  group('chat flows', () {
    late Directory tmp; late WebBridge bridge; late _Page page; late MoldeController c;
    setUp(() async {
      tmp = Directory.systemTemp.createTempSync('molde_r63_');
      final holder = _Holder();
      bridge = WebBridge(holder); page = _Page(bridge); holder.inner = page;
      bridge.onRaw(jsonEncode({'t': 'ready'}));
      final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1);
      c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => lessons);
      page.handlers['open'] = (a) => {'ok': true};
      page.handlers['evaluate'] = (a) => {'verdict': 'safe', 'changes': ['x'], 'warnings': [], 'refused': []};
      page.handlers['applyEdit'] = (a) => {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []};
      await c.store.save(AppRecord(id: 'l1', name: 'Tutor', source: lessons));
      await c.init();
      c.changeCurrent();
    });
    tearDown(() => tmp.deleteSync(recursive: true));

    test('"remove the Paid button" is exact and instant, the model never runs', () async {
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      page.handlers['applyEdit'] = (a) { expect(a['source'], isNot(contains('button "Paid"'))); return {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []}; };
      await c.send('remove the Paid button');
      expect(c.chat.last.text, contains('Done: the "Paid" button is gone'));
      expect(page.calls, contains('applyEdit'));
    });

    test('a missing button: the real ones are listed and a tap applies that one', () async {
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      await c.send('remove the Delete button');
      final m = c.chat.last;
      expect(m.text, contains('"Paid"'));
      expect(m.buttons.map((b) => b.label), ['Paid', 'No thanks']);
      await m.buttons.first.onTap();
      expect(page.calls, contains('applyEdit'));
    });

    test('the model removed the chart instead of the button: held, never "Done"', () async {
      final noChart = lessons.replaceFirst('daybars last 7 days, sum(student.fee on it)\n', '');
      page.handlers['generate'] = (a) => {'ok': true, 'program': noChart, 'errors': [], 'stats': {'seconds': 5}};
      await c.send('delete the Paid button please');
      final m = c.chat.last;
      expect(m.text, isNot(startsWith('Done')));
      expect(m.text, contains('does not do what you asked'));
      expect(m.text, contains('"Paid" button is still there'));
      expect(m.text, contains('Removed a chart.'));
      expect(m.text, contains('Your app is unchanged'));
      expect(m.buttons.map((b) => b.label), ['Keep my app', 'Apply it anyway']);
      expect(page.calls, isNot(contains('applyEdit')));
      expect(kLanguageLeak.hasMatch(m.text), isFalse, reason: m.text);
    });

    test('"make it nicer" is answered at once with exact choices', () async {
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      await c.send('make it nicer');
      final m = c.chat.last;
      expect(m.text, contains('too vague'));
      expect(m.buttons.map((b) => b.label), containsAll(['Dark mode', 'Make the text bigger']));
      await m.buttons.firstWhere((b) => b.label == 'Dark mode').onTap();
      expect(page.calls, contains('applyEdit'));
    });

    test('a chart of a field that does not exist says so and offers the numeric fields', () async {
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      await c.send('add a chart of salary');
      expect(c.chat.last.text, contains('no field called "salary"'));
      expect(c.chat.last.buttons.map((b) => b.label), contains('Fee'));
    });

    test('a create that lacks what the request named says so and offers to add it', () async {
      const made = 'app "Tutor fees" school ocean\ntable student name text, fee money\nform student\n';
      c.startNewApp();
      page.handlers['generate'] = (a) => {'ok': true, 'program': made, 'errors': [], 'stats': {'seconds': 5}};
      page.handlers['open'] = (a) => {'ok': true};
      await c.send('tutor fees with a paid button and a list of students');
      final m = c.chat.last;
      expect(m.text, startsWith('Made Tutor fees with '));
      expect(m.text, contains('You asked for'));
      expect(m.text, contains('a way to mark things paid'));
      expect(m.buttons.first.label, startsWith('Add '));
      expect(kLanguageLeak.hasMatch(m.text), isFalse, reason: m.text);
    });
  });
}

class _Holder implements JsTransport {
  JsTransport? inner;
  @override
  Future<void> run(String js) => inner!.run(js);
}

class _Page implements JsTransport {
  _Page(this.bridge);
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
