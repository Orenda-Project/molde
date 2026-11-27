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

const cricket = 'app "Cricket" ball ocean\ntable ball runs num 0..6 = 0, wide bool, out bool\nsetting overs num = 20\n"Runs off this ball" head\ngrid 4 gap 1\n  each [0, 1, 2, 3, 4, 6]\n    button it tap add ball runs = it\n  button "Wide" tap add ball wide = yes\nbutton "Undo last ball" tap remove last(ball today)\n';
const phone = 'app "Phone fund" coin mint\ntable gift amount money\nform gift\nrow gap 1\n  each [500, 1000, 2000, 5000]\n    button it grow tap add gift amount = it\nlist gift\n';

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

  group('0.6.5: visible changes, real button list, grammar, instant removals', () {
    test('add a field needs a form to show it on', () {
      final o = addFieldPlan('add a field for umpire name', cricket)!;
      expect(o.edit, isNull);
      expect(o.ask, contains('no form to put an Umpire name field on'));
      expect(o.choices.length, 1);
      expect(o.choices.first.program, contains('umpire_name text?'));
      expect(o.choices.first.program, contains('form ball, "Add ball"'));
      // with a form the change is applied and says where it shows
      final ok = addFieldPlan('add a field for venue', o.choices.first.program)!;
      expect(ok.edit!.label, 'added a Venue field, on the form');
      // a draft shown with `field d` counts as a form (Savings style)
      const sav = 'app "S" coin mint\ntable deposit amount money\nstate d new deposit\nstack card\n  field d\n';
      expect(addFieldPlan('add a note field', sav)!.edit, isNotNull);
    });
    test('the model path: a new field with no form is a mismatch, with a form it is fine', () {
      final hidden = cricket.replaceFirst('out bool', 'out bool, umpire_name text?');
      expect(namedPartMismatch('add a field for umpire name', cricket, hidden), contains('no form to put the Umpire name field on'));
      expect(namedPartMismatch('add a field for umpire name', cricket, '$hidden' 'form ball, "Add ball"\n'), isNull);
    });
    test('every button on screen is listed, presets included', () {
      expect(buttonLabelsShown(phone), ['Add', '500', '1,000', '2,000', '5,000']);
      expect(buttonLabelsShown(cricket), ['0', '1', '2', '3', '4', '6', 'Wide', 'Undo last ball']);
      expect(buttonLabelsShown('app "W" x ocean\ntable drink ml num\nquick drink.ml 250 500\n'), ['250', '500']);
      expect(buttonLabelsShown('app "A" x ocean\nbutton if(open, "Close", "Other") tap set open = not open\n'), ['Close', 'Other']);
      final o = removeButtonPlan('remove the Delete button', phone)!;
      expect(o.ask, contains('"Add", "500", "1,000", "2,000", "5,000"'));
      expect(o.ask, isNot(contains('none')));
      expect(removeButtonPlan('remove the 500 button', phone)!.ask, contains('quick buttons'));
    });
    test('hint examples come from this app', () {
      expect(exampleRequests(phone), isNot(contains('Paid')));
      expect(exampleRequests(phone), contains('add a chart of amount'));
      expect(exampleRequests(lessons), contains('"remove the Paid button"'));
      expect(exampleRequests(cricket), contains('"remove the Wide button"'));
      expect(exampleRequests('app "A" x ocean\ntable t name text\nform t\n'), isNot(contains('remove the')));
    });
    test('a or an', () {
      expect(aAn('Umpire name'), 'an Umpire name');
      expect(aAn('Phone'), 'a Phone');
      expect(aAn('Hour'), 'an Hour');
      expect(aAn('User'), 'a User');
      expect(aAn('Email'), 'an Email');
      expect(summarizeChange('app "A" x ocean\ntable t name text\nform t\n', 'app "A" x ocean\ntable t name text, umpire text?\nform t\n'), contains('Added an Umpire field.'));
      for (final r in ['add a field for umpire name', 'add an email field']) {
        final o = addFieldPlan(r, 'app "A" x ocean\ntable t name text\nform t\n')!;
        expect(o.edit!.label, isNot(contains('a Umpire')));
        expect(o.edit!.label, isNot(contains('a Email')));
      }
    });
    test('delete/remove/get rid of the X button, with now and please, never reaches the model', () {
      for (final r in ['delete Remove all button now', 'delete the Remove all button now', 'remove the Remove all button', 'get rid of the Remove all button please', 'please remove the Remove all button now', 'can you delete the Remove all button right now', 'now delete the "Remove all" button', 'Remove the Remove all button, please.', 'take away the Remove all button now']) {
        final o = removeButtonPlan(r, lessons);
        expect(o, isNotNull, reason: r);
        expect(o!.ask, contains('can\'t find a button called "Remove all"'), reason: r);
        expect(o.ask, contains('"Paid"'), reason: r);
      }
      for (final r in ['delete the Remove all field now', 'please remove the Remove all field']) { expect(removeFieldPlan(r, lessons)!.ask, contains('can\'t find a field'), reason: r); }
      expect(removeButtonPlan('remove the Paid button now', lessons)!.edit, isNotNull);
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
      // only fields on a form: the amount of the paid table is not on any form
      expect(m.fields, isNot(contains('amount')));
    });
    test('a chart the request did not name is a mismatch; a weekly total needs a total', () {
      const tea = 'app "Daily Tea" x ocean\ntable cup kind text, price money\nform cup, "Add"\nlist cup by day\n';
      final withChart = '${tea}daybars last 7 days, sum(cup.price on it)\n';
      expect(namedPartMismatch('add a weekly total of all spending', tea, withChart), contains('did not ask for a chart'));
      expect(namedPartMismatch('add a chart of price', tea, withChart), isNull);
      expect(namedPartMismatch('add a weekly total of all spending', tea, '${tea}stat sum(cup.price) "Total"\n'), isNull);
      expect(namedPartMismatch('add a weekly total of all spending', tea, tea), contains('no new total'));
    });
    test('shorter request for the create retry', () {
      expect(shorterRequest('tutor fees tracker with a paid button and a list of students'), 'tutor fees tracker');
      expect(shorterRequest('grocery list'), isNull);
    });
    test('the expense noun needs money on the form', () {
      const cups = 'app "T" x ocean\ntable cup kind text\nform cup\n';
      expect(keyNounGaps('tea stall expense tracker', cups).map((g) => g.phrase), contains('an amount of money'));
      expect(keyNounGaps('tea stall expense tracker', lessons), isEmpty);
    });
  });

  group('a built app in plain words', () {
    test('describeApp', () {
      final d = describeApp(lessons);
      expect(d, startsWith('Made Tutor with '));
      expect(d, contains('a "Paid" button'));
      expect(d, isNot(contains('a form to add a')));
      expect(d, contains('a form with an "Add student" button with name and fee'));
      expect(d, contains('a total'));
      expect(d, contains('a chart'));
      expect(kLanguageLeak.hasMatch(d), isFalse, reason: d);
      expect(d, isNot(contains('entries with')));
    });
    test('key nouns the request names but the app lacks', () {
      const bare = 'app "T" x ocean\ntable student name text\nform student\n';
      expect(keyNounGaps('tutor fees with a paid button and a list', bare).map((g) => g.phrase), ['a list of the entries', 'a Paid button', 'an amount of money']);
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
      await c.send('please get rid of the Paid button for the tutors');
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

    test('FALSE DONE: a model edit that adds an unasked chart is held, never Done in ...', () async {
      const tea = 'app "Daily Tea" x ocean\ntable cup kind text, price money\nform cup, "Add"\nlist cup by day\n';
      await c.store.save(AppRecord(id: 't1', name: 'Daily Tea', source: tea));
      await c.openApp((await c.store.load('t1'))!);
      c.changeCurrent();
      page.handlers['generate'] = (a) => {'ok': true, 'program': '${tea}daybars last 7 days, sum(cup.price on it)\n', 'errors': [], 'stats': {'seconds': 118.8}};
      await c.send('add a weekly total of all spending');
      final m = c.chat.last;
      expect(m.text, isNot(contains('Done')));
      expect(m.text, contains('I did not apply this'));
      expect(m.text, contains('did not ask for a chart'));
      expect(m.buttons.first.label, 'Keep my app');
      expect(page.calls, isNot(contains('applyEdit')));
    });

    test('FALSE DONE: a model edit that returns the same program says "I did not apply this"', () async {
      page.handlers['generate'] = (a) => {'ok': true, 'program': lessons, 'errors': [], 'stats': {'seconds': 30}};
      await c.send('add a weekly total of all spending');
      final m = c.chat.last;
      expect(m.text, startsWith('I did not apply this'));
      expect(m.text, isNot(contains('Done')));
      expect(page.calls, isNot(contains('applyEdit')));
    });

    test('"delete the Remove all button now" is answered at once from the real buttons, the model never runs', () async {
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      await c.send('delete the Remove all button now');
      final m = c.chat.last;
      expect(m.text, contains('can\'t find a button called "Remove all"'));
      expect(m.buttons.map((b) => b.label), contains('Paid'));
      expect(page.calls, isNot(contains('generate')));
    });

    test('FALSE DONE (0.6.4 verdict): "add a field for umpire name" on an app with no form says so and offers a form', () async {
      await c.store.save(AppRecord(id: 'k1', name: 'Cricket', source: cricket));
      await c.openApp((await c.store.load('k1'))!);
      c.changeCurrent();
      page.handlers['generate'] = (a) => throw StateError('the model must not run');
      await c.send('add a field for umpire name');
      final m = c.chat.last;
      expect(m.text, isNot(contains('Done')));
      expect(m.text, contains('no form to put an Umpire name field on'));
      expect(m.text, contains('I did not change your app'));
      expect(m.buttons.map((b) => b.label), ['Add a form with an Umpire name field', 'No thanks']);
      expect(page.calls, isNot(contains('applyEdit')));
      page.handlers['applyEdit'] = (a) { expect(a['source'], contains('umpire_name text?')); expect(a['source'], contains('form ball, "Add ball"')); return {'verdict': 'safe', 'changes': [], 'warnings': [], 'refused': []}; };
      await m.buttons.first.onTap();
      expect(page.calls, contains('applyEdit'));
      expect(c.chat.last.text, startsWith('Done: added a form'));
    });

    test('a model edit that adds a field no form can show is held, never Done', () async {
      await c.store.save(AppRecord(id: 'k2', name: 'Cricket', source: cricket));
      await c.openApp((await c.store.load('k2'))!);
      c.changeCurrent();
      page.handlers['generate'] = (a) => {'ok': true, 'program': cricket.replaceFirst('out bool', 'out bool, umpire text?'), 'errors': [], 'stats': {'seconds': 20}};
      await c.send('please put an umpire box on the scoring');
      expect(c.chat.last.text, isNot(startsWith('Done')));
      await c.send('add a field for the umpire name in the ball table');
      expect(c.chat.last.text, isNot(startsWith('Done')));
    });

    test('a create that times out is retried once with a shorter request, then gives up with nothing built', () async {
      c.startNewApp();
      final asked = <String>[];
      page.handlers['generate'] = (a) { asked.add(a['request'] as String); return {'ok': false, 'timedOut': true, 'program': '', 'errors': [], 'stats': {}}; };
      await c.send('tutor fees tracker with a paid button and a list of students');
      expect(asked, ['tutor fees tracker with a paid button and a list of students', 'tutor fees tracker']);
      expect(c.chat.last.text, contains('Nothing was built'));
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
      expect(m.text, contains('What you asked for that is missing'));
      expect(m.text, contains('a Paid button'));
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
