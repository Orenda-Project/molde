// Patch operations: how the r5c model writes an edit. The prompt shows the program with numbered lines ("1| app ...")
// and the model answers with operations on those numbers instead of the whole program:
//   insert after N | replace N or N-M | delete N or N-M | move N or N-M after K     (insert after 0 = at the top)
// Each line to write follows its operation and starts with "+ ". This is a line-by-line port of applyOps in
// molde-model/failhunt/tools/patch_ops_ref.mjs; test/patch_ops_test.dart replays real model answers through both
// and requires the same result (or the same refusal). Anything that does not apply cleanly throws PatchError:
// the caller says so and leaves the app unchanged.

class PatchError implements Exception {
  PatchError(this.message);
  final String message;
  @override
  String toString() => 'PatchError: $message';
}

/// The lines of a program: one trailing newline does not make an empty last line (the reference's `L`).
List<String> _lines(String s) => (s.endsWith('\n') ? s.substring(0, s.length - 1) : s).split('\n');

/// The program the way the model was shown it: "1| line" per line, no trailing newline.
String numberedProgram(String program) {
  final ls = _lines(program);
  return [for (var i = 0; i < ls.length; i++) '${i + 1}| ${ls[i]}'].join('\n');
}

final _range = RegExp(r'^(\d+)(?:-(\d+))?$');
final _insert = RegExp(r'^insert after (\d+)$');
final _replace = RegExp(r'^replace (\S+)$');
final _delete = RegExp(r'^delete (\S+)$');
final _move = RegExp(r'^move (\S+) after (\d+)$');
final _payloadLine = RegExp(r'^\+( |$)');
final _trailingWs = RegExp(r'\s+$');

/// Applies the model's operations to [before] and returns the new program (with a final newline).
String applyOps(String before, String text) {
  final a = _lines(before);
  final n = a.length;
  final gone = List<bool>.filled(n + 2, false);
  final ins = List<List<String>>.generate(n + 1, (_) => <String>[]);
  final lines = text.replaceFirst(_trailingWs, '').split('\n').where((x) => x.isNotEmpty).toList();
  var k = 0;

  int number(String s) {
    final v = int.tryParse(s);
    if (v == null) throw PatchError('the number $s is too large');
    return v;
  }

  (int, int) range(String s) {
    final m = _range.firstMatch(s);
    if (m == null) throw PatchError('bad line range $s');
    final x = number(m.group(1)!), y = m.group(2) != null ? number(m.group(2)!) : x;
    if (x < 1 || y < x || y > n) throw PatchError('line range $s is outside your program (it has $n lines)');
    return (x, y);
  }

  List<String> payload() {
    final p = <String>[];
    while (k < lines.length && _payloadLine.hasMatch(lines[k])) {
      final l = lines[k++];
      p.add(l.length >= 2 ? l.substring(2) : '');
    }
    return p;
  }

  void kill(int x, int y) {
    for (var q = x; q <= y; q++) {
      if (gone[q]) throw PatchError('line $q is changed twice');
      gone[q] = true;
    }
  }

  while (k < lines.length) {
    final op = lines[k++];
    RegExpMatch? m;
    if ((m = _insert.firstMatch(op)) != null) {
      final at = number(m!.group(1)!);
      if (at > n) throw PatchError('insert point $at is outside your program');
      final p = payload();
      if (p.isEmpty) throw PatchError('an insert with no lines');
      ins[at].addAll(p);
    } else if ((m = _replace.firstMatch(op)) != null) {
      final (x, y) = range(m!.group(1)!);
      final p = payload();
      if (p.isEmpty) throw PatchError('a replace with no lines');
      kill(x, y);
      ins[x - 1].addAll(p);
    } else if ((m = _delete.firstMatch(op)) != null) {
      final (x, y) = range(m!.group(1)!);
      kill(x, y);
    } else if ((m = _move.firstMatch(op)) != null) {
      final (x, y) = range(m!.group(1)!);
      final at = number(m!.group(2)!);
      if (at > n || (at >= x && at < y)) throw PatchError('cannot move lines $x-$y after $at');
      kill(x, y);
      ins[at].addAll(a.sublist(x - 1, y));
    } else {
      throw PatchError('unknown operation: ${op.length > 40 ? op.substring(0, 40) : op}');
    }
  }
  final out = <String>[...ins[0]];
  for (var i = 1; i <= n; i++) {
    if (!gone[i]) out.add(a[i - 1]);
    out.addAll(ins[i]);
  }
  return '${out.join('\n')}\n';
}
