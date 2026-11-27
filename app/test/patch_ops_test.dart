import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/catalogue.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/patch_ops.dart';

void main() {
  group('applyOps (the Dart port of the reference applier)', () {
    const prog = 'app "W" drop ocean\ntable d ml num\nsetting goal num = 2000\nform d\nlist d today\n';
    test('replace, insert after, delete, move: the four operations', () {
      expect(applyOps(prog, 'replace 1\n+ app "W" drop mint'), 'app "W" drop mint\ntable d ml num\nsetting goal num = 2000\nform d\nlist d today\n');
      expect(applyOps(prog, 'insert after 2\n+ setting cap num = 5'), 'app "W" drop ocean\ntable d ml num\nsetting cap num = 5\nsetting goal num = 2000\nform d\nlist d today\n');
      expect(applyOps(prog, 'insert after 0\n+ # top'), '# top\n$prog');
      expect(applyOps(prog, 'delete 4-5'), 'app "W" drop ocean\ntable d ml num\nsetting goal num = 2000\n');
      expect(applyOps(prog, 'move 4 after 1'), 'app "W" drop ocean\nform d\ntable d ml num\nsetting goal num = 2000\nlist d today\n');
      expect(applyOps(prog, 'replace 2-3\n+ table d ml num\n+ setting goal num = 1\ndelete 5'), 'app "W" drop ocean\ntable d ml num\nsetting goal num = 1\nform d\n');
    });
    test('a payload line keeps its indent, and "+" alone is an empty line', () {
      expect(applyOps(prog, 'insert after 4\n+   "hi" faint\n+\n+ x'), 'app "W" drop ocean\ntable d ml num\nsetting goal num = 2000\nform d\n  "hi" faint\n\nx\nlist d today\n');
    });
    test('numberedProgram is what the model is shown', () {
      expect(numberedProgram('a\nb\n'), '1| a\n2| b');
      expect(numberedProgram(prog).split('\n').first, '1| app "W" drop ocean');
    });
    test('anything malformed or not fitting is refused, never half-applied', () {
      for (final bad in [
        'replace 9\n+ x', // outside the program
        'replace 0\n+ x',
        'delete 3-2',
        'delete 2\ndelete 2', // twice
        'replace 2', // no lines
        'insert after 2', // no lines
        'insert after 9\n+ x',
        'move 2-4 after 3', // into itself
        'move 9 after 1',
        'frobnicate 2',
        'replace two\n+ x',
        'app "W" drop mint', // the whole program instead of operations
        'delete 99999999999999999999999',
      ]) {
        expect(() => applyOps(prog, bad), throwsA(isA<PatchError>()), reason: bad);
      }
    });
    test('an empty answer changes nothing', () {
      expect(applyOps(prog, ''), prog);
      expect(applyOps(prog, '\n  \n'), prog);
    });
  });

  group('parity with the JavaScript reference applier on real model answers', () {
    final fx = jsonDecode(File('test/fixtures/patch_ops_parity.json').readAsStringSync()) as Map<String, dynamic>;
    final programs = (fx['programs'] as Map).cast<String, String>();
    final cases = (fx['cases'] as List).cast<Map<String, dynamic>>();

    test('at least 100 real cases, both outcomes present', () {
      expect(cases.length, greaterThanOrEqualTo(100));
      expect(cases.where((c) => c['kind'] == 'model').length, greaterThanOrEqualTo(100));
      expect(cases.where((c) => c['err'] != null).length, greaterThan(5));
      expect(cases.where((c) => c['out'] != null).length, greaterThan(100));
    });

    test('every case gives the same program, or a refusal where the reference refuses', () {
      var same = 0, refused = 0;
      final bad = <String>[];
      for (final c in cases) {
        final before = programs[c['p']]!;
        final ops = c['ops'] as String;
        String? got, err;
        try { got = applyOps(before, ops); } on PatchError catch (e) { err = e.message; }
        if (c['err'] != null) {
          if (err == null) { bad.add('${c['src']} ${c['id']}: the reference refuses (${c['err']}) but Dart applied it'); } else { refused++; }
        } else if (got != c['out']) {
          bad.add('${c['src']} ${c['id']}: ${err ?? 'different program'}');
        } else {
          same++;
        }
      }
      expect(bad, isEmpty, reason: bad.take(5).join('\n'));
      expect(same + refused, cases.length);
      // ignore: avoid_print
      print('parity: ${cases.length} real cases match the JS reference ($same same program, $refused same refusal)');
    });

    test('r3 and r4 whole-program edits written as operations (the reference diff) apply back to the same program', () {
      final diffs = cases.where((c) => c['kind'] == 'diff' && c['out'] != null).toList();
      expect(diffs.length, greaterThan(100));
      for (final c in diffs) { expect(applyOps(programs[c['p']]!, c['ops'] as String), c['out'], reason: '${c['src']} ${c['id']}'); }
    });
  });

  group('the model list entry says which format a model writes', () {
    Map<String, dynamic> entry(Map<String, dynamic> extra) => {'id': 'm', 'name': 'M', 'file': 'm.gguf', 'url': 'https://x/m.gguf', 'bytes': 5, 'sha256': 'a' * 64, ...extra};
    test('format is read from models.json; anything else is no format', () {
      expect(CatalogueModel.fromJson(entry({'format': 'ops'}))!.format, 'ops');
      expect(CatalogueModel.fromJson(entry({'format': 'whole'}))!.format, 'whole');
      expect(CatalogueModel.fromJson(entry({}))!.format, isNull);
      expect(CatalogueModel.fromJson(entry({'format': 'weird'}))!.format, isNull);
    });
    test('the bundled list keeps both models in the whole-program format', () {
      final j = jsonDecode(File('assets/models.json').readAsStringSync()) as Map<String, dynamic>;
      for (final m in (j['models'] as List).cast<Map<String, dynamic>>()) { expect(LlmService.pickFormat(hint: CatalogueModel.fromJson(m)!.format), 'whole', reason: '${m['id']}'); }
    });
    test('pickFormat: ops only when something says so; the sidecar wins over the list', () {
      expect(LlmService.pickFormat(), 'whole');
      expect(LlmService.pickFormat(hint: 'ops'), 'ops');
      expect(LlmService.pickFormat(sidecar: 'ops', hint: 'whole'), 'ops');
      expect(LlmService.pickFormat(sidecar: 'whole', hint: 'ops'), 'whole');
      expect(LlmService.pickFormat(sidecar: 'junk', hint: 'ops'), 'ops');
      expect(LlmService.pickFormat(sidecar: 'junk'), 'whole');
      expect(ModelInfo('/m', 1, 0.1).format, 'whole');
    });
  });
}
