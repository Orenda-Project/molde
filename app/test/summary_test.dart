import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/rules.dart';
import 'package:molde/src/summary.dart';

// The 0.6.1 critic's app, as the model wrote it.
const fees = 'app "School Fees" school ocean\ntable student name text, fee money\ntable paid student ref student, amount money\nlet due_total = sum(student, if(count(it.paid month) = 0, it.fee, 0))\n"Fees due this month" due_total big\neach student sort name as s\n  row card gap 1\n    s.name bold grow\n    if count(s.paid month) = 0\n      s.fee color warn bold\n      button "Paid" tap add paid student = s, amount = s.fee\n    else\n      "Paid" color good\nform student, "Add student"\nlist paid by day\n';

void main() {
  group('change replies are plain English from the diff', () {
    test('a Phone field', () {
      final n = fees.replaceFirst('fee money', 'fee money, phone text');
      expect(summarizeChange(fees, n), ['Added a Phone field.']);
      expect(unmetFromDiff('add a field for phone number', fees, n), isEmpty); // 0.6.1 said "the field did not happen"
    });
    test('a chart of fees per day', () {
      final n = '${fees}daybars last 7 days, sum(student.fee on it)\n';
      expect(summarizeChange(fees, n), ['Added a chart of fee per day.']);
      expect(unmetFromDiff('add a chart', fees, n), isEmpty);
      expect(changeReply(summarizeChange(fees, n), chartAdded: true), contains('fills in as you add entries'));
    });
    test('renaming the button, the app, the colour and the mode', () {
      expect(summarizeChange(fees, fees.replaceFirst('"Add student"', '"Save"')), ['Renamed the Add student button to Save.']);
      expect(summarizeChange(fees, fees.replaceFirst('"Paid" tap', '"Received" tap')), ['Renamed the Paid button to Received.']);
      expect(summarizeChange(fees, fees.replaceFirst('app "School Fees" school ocean', 'app "Tuition" school ocean')), ['Renamed the app to Tuition.']);
      expect(summarizeChange(fees, fees.replaceFirst('school ocean', 'school mint dark')), ['Changed the colour to mint.', 'Switched to dark mode.']);
    });
    test('removals and settings', () {
      expect(summarizeChange('${fees}daybars last 7 days, sum(student.fee on it)\n', fees), ['Removed a chart.']);
      expect(summarizeChange(fees, fees.replaceFirst('form student, "Add student"\n', '')), contains('Removed the entry form.'));
      const a = 'app "A" x ocean\nsetting goal money = 2000 "Daily goal"\ntable t a num\n';
      expect(summarizeChange(a, a.replaceFirst('= 2000', '= 3000')), ['Set Daily goal to 3000.']);
    });
    test('no reply ever contains program text or the engine\'s wording', () {
      final cases = <String>[
        fees.replaceFirst('fee money', 'fee money, phone text'),
        '${fees}daybars last 7 days, sum(student.fee on it)\n${fees.split('\n').last}',
        fees.replaceFirst('school ocean', 'school mint dark'),
        fees.replaceFirst('"Add student"', '"Save"'),
        fees.replaceAll('  row card gap 1\n', '  row card gap 2\n').replaceFirst('let due_total = sum(student', 'let due_total = count(student'),
        fees.replaceFirst('list paid by day\n', 'stat sum(paid.amount) "Received"\nlist paid by day\n'),
        fees.replaceFirst('form student, "Add student"\n', ''),
      ];
      for (final n in cases) {
        final texts = [changeReply(summarizeChange(fees, n)), ...summarizeChange(fees, n), ...describeLines(fees.split('\n').where((l) => l.trim().isNotEmpty).toList())];
        for (final t in texts) {
          expect(kLanguageLeak.hasMatch(t), isFalse, reason: 'language leaked into: $t');
          expect(t, isNot(contains('student.fee')));
          expect(t, isNot(contains('daybars')));
        }
      }
    });
    test('describeLine speaks about what the user sees', () {
      expect(describeLine('daybars last 7 days, sum(student.fee on it)'), 'a chart');
      expect(describeLine('  button "Paid" tap add paid student = s'), 'the "Paid" button');
      expect(describeLine('stat count(movie month), "this month"'), 'a total');
      expect(describeLine('each student sort name as s'), 'a list of entries');
      expect(describeLines(['trend a, b', 'trend c, d']), ['2 × a chart']);
    });
    test('plainWarnings drops anything that is not plain English', () {
      expect(plainWarnings(['values in kind stay stored but are hidden.']), ['values in kind stay stored but are hidden.']);
      expect(plainWarnings(['drink.kind of type pick loses sum(drink.ml)']), ['Some of what you entered may be hidden or changed by this.']);
    });
  });

  group('rename a button directly (no model)', () {
    test('a label that occurs once, explicit or the default Add', () {
      final r = buttonRenameEdit('rename the Add student button to Save', fees)!;
      expect(r.program, contains('form student, "Save"'));
      expect(buttonRenameEdit('change the Paid button to Received', fees)!.program, contains('button "Received"'));
      const bare = 'app "A" x ocean\ntable t a num\nform t\n';
      expect(buttonRenameEdit('rename the Add button to Save', bare)!.program, contains('form t, "Save"'));
      expect(buttonRenameEdit('rename the Add button to Save', bare)!.label, 'the button now says Save');
    });
    test('ambiguous or unknown goes to the model', () {
      final two = '$fees  button "Paid" tap add paid student = s\n';
      expect(buttonRenameEdit('rename the Paid button to Received', two), isNull);
      expect(buttonRenameEdit('rename the Nothing button to Save', fees), isNull);
      expect(buttonRenameEdit('rename the app to Save', fees), isNull);
    });
  });

  group('requests an offline app cannot do', () {
    test('say so, why, and what can be done', () {
      final g = capabilityGap('send me a WhatsApp every morning')!;
      expect(g.reply, contains("can't send messages"));
      expect(g.reply, contains('offline'));
      expect(g.reply, contains('reminder list inside the app'));
      expect(g.reply, isNot(contains('name the part')));
      expect(capabilityGap('show me live weather')!.reply, contains('internet'));
      expect(capabilityGap('show a map of my shops')!.reply, contains('location'));
      expect(capabilityGap('a login screen')!.reply, contains('log in'));
      expect(capabilityGap('scan a barcode')!.reply, contains('camera'));
    });
    test('ordinary requests are not blocked', () {
      for (final r in ['grocery shopping list', 'add an email field', 'rename the Add button to Save', 'a budget with a text note', 'water tracker', 'class timetable online class tracker']) {
        expect(capabilityGap(r), isNull, reason: r);
      }
    });
  });
}
