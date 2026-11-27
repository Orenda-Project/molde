// Requests the app can carry out itself, exactly, without the model: remove a named button or field, add a named field,
// rename a button ("change X to say Y"). When the named thing does not exist the answer lists what does and asks which one
// is meant. Also: checks that a model change touched the part the user named, plain descriptions of a built app, and the
// key things a request named that the built app lacks. Pure Dart, unit tested. No templates: nothing here writes a
// program for a new app; these are exact edits of lines the user's own app already has.
import 'rules.dart';
import 'summary.dart';

class Choice {
  Choice(this.label, this.program, this.done);
  final String label, program, done; // button text, the edited program, the "Done: ..." wording
}

/// What a direct rule decided: an edit to apply now, or a question with the real choices, or (both null) "not mine".
class DirectOutcome {
  DirectOutcome.edit(DirectEdit e) : edit = e, ask = null, choices = const [];
  DirectOutcome.ask(String text, this.choices) : edit = null, ask = text;
  DirectOutcome.say(String text) : edit = null, ask = text, choices = const [];
  final DirectEdit? edit;
  final String? ask;
  final List<Choice> choices;
}

String _norm(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
String _sing(String w) {
  var t = _norm(w);
  if (t.length > 4 && t.endsWith('ies')) return '${t.substring(0, t.length - 3)}y';
  if (t.length > 3 && t.endsWith('s')) return t.substring(0, t.length - 1);
  return t;
}
bool _sameName(String a, String b) => _sing(a) == _sing(b) || _norm(a) == _norm(b);
String _human(String n) { final t = n.replaceAll('_', ' ').trim(); return t.isEmpty ? t : t[0].toUpperCase() + t.substring(1); }

class _Tbl {
  _Tbl(this.line, this.name, this.parts);
  final int line;
  final String name;
  final List<String> parts; // each field's text ("fee money")
  String get fieldNames => parts.map((p) => p.trim().split(RegExp(r'\s+')).first).join(', ');
  String fieldName(int i) => parts[i].trim().split(RegExp(r'\s+')).first;
}

List<_Tbl> _tables(List<String> lines) {
  final out = <_Tbl>[];
  for (var i = 0; i < lines.length; i++) {
    final m = RegExp(r'^table\s+(\w+)\s+(.*)$').firstMatch(lines[i]);
    if (m == null) continue;
    out.add(_Tbl(i, m.group(1)!, m.group(2)!.split(',').map((p) => p.trim()).where((p) => p.isNotEmpty).toList()));
  }
  return out;
}

/// Labels of the buttons the user can tap: `button "X"` lines and the quoted label of a form. Lowercase key -> shown label.
List<String> buttonLabels(String source) {
  final out = <String>[];
  for (final raw in source.split('\n')) {
    final t = raw.trim();
    final m = RegExp(r'^button\s+"([^"]*)"').firstMatch(t) ?? RegExp(r'^(?:form|topbar)\s+\w+\s*,\s*"([^"]*)"').firstMatch(t);
    if (m != null && m.group(1)!.isNotEmpty) out.add(m.group(1)!);
  }
  return out;
}

String _list(List<String> xs) => xs.isEmpty ? 'none' : xs.map((x) => '"$x"').join(', ');

// ---------------- remove a named button ----------------

/// "remove the Paid button", "get rid of the Add lesson button". Exact when the label occurs on one `button` line; asks with
/// the real buttons when it does not exist; explains when it is the form's own save button.
DirectOutcome? removeButtonPlan(String request, String source) {
  final m = RegExp(r'^\s*(?:please\s+|can you\s+|could you\s+|i want to\s+)?(?:remove|delete|drop|hide|get rid of|take away|take off)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+button\s*[.!]?\s*$', caseSensitive: false).firstMatch(request);
  if (m == null) return null;
  final target = m.group(1)!.trim();
  final lines = source.split('\n');
  final hits = <int>[for (var i = 0; i < lines.length; i++) if (RegExp(r'^button\s+"').hasMatch(lines[i].trim()) && RegExp(r'^button\s+"([^"]*)"').firstMatch(lines[i].trim())!.group(1)!.trim().toLowerCase() == target.toLowerCase()) i];
  List<String> without(int i) => [...lines]..removeAt(i);
  if (hits.length == 1) {
    // a button alone in its block (an `if` branch) would leave an empty block: that goes to the model
    final i = hits.first;
    final ind = lines[i].length - lines[i].trimLeft().length;
    final prevDeeper = i > 0 && lines[i - 1].trim().isNotEmpty && (lines[i - 1].length - lines[i - 1].trimLeft().length) < ind;
    final nextSame = i + 1 < lines.length && lines[i + 1].trim().isNotEmpty && (lines[i + 1].length - lines[i + 1].trimLeft().length) >= ind;
    if (prevDeeper && !nextSame) return null;
    return DirectOutcome.edit(DirectEdit(without(i).join('\n'), 'the "${target}" button is gone'));
  }
  if (hits.length > 1) return null; // two buttons with that label: which one?
  final labels = buttonLabels(source);
  final formLabeled = labels.any((l) => l.toLowerCase() == target.toLowerCase()) || target.toLowerCase() == 'add' || RegExp(r'^add\s+\w+$').hasMatch(target.toLowerCase());
  if (formLabeled) {
    return DirectOutcome.say('"$target" is the button that saves a new entry, so removing it would leave the form with no way to add anything. I left your app as it is. If you want to change what it says, say "rename the $target button to ...".');
  }
  final real = buttonLabels(source).where((l) => !RegExp(r'^button').hasMatch(l)).toList();
  final removable = <Choice>[
    for (var i = 0; i < lines.length; i++)
      if (RegExp(r'^button\s+"([^"]+)"').hasMatch(lines[i].trim()))
        Choice(RegExp(r'^button\s+"([^"]+)"').firstMatch(lines[i].trim())!.group(1)!, without(i).join('\n'), 'the "${RegExp(r'^button\s+"([^"]+)"').firstMatch(lines[i].trim())!.group(1)!}" button is gone'),
  ];
  final seen = <String>{};
  final uniq = [for (final c in removable) if (seen.add(c.label.toLowerCase())) c];
  return DirectOutcome.ask('I can\'t find a button called "$target". The buttons in this app are: ${_list(real)}. Which one do you want to remove?', uniq.take(4).toList());
}

// ---------------- remove / add a named field ----------------

DirectOutcome? removeFieldPlan(String request, String source) {
  final m = RegExp(r'^\s*(?:please\s+|can you\s+|could you\s+)?(?:remove|delete|drop|get rid of|take away)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+(?:field|column|box|input)\s*[.!]?\s*$', caseSensitive: false).firstMatch(request);
  if (m == null) return null;
  final target = m.group(1)!.trim();
  final lines = source.split('\n');
  final tbls = _tables(lines);
  final hits = <(_Tbl, int)>[for (final t in tbls) for (var i = 0; i < t.parts.length; i++) if (_sameName(t.fieldName(i), target.replaceAll(' ', '_')) || _sameName(t.fieldName(i), target)) (t, i)];
  String build(_Tbl t, int i) {
    final parts = [...t.parts]..removeAt(i);
    final copy = [...lines];
    copy[t.line] = 'table ${t.name} ${parts.join(', ')}';
    return copy.join('\n');
  }
  if (hits.length == 1) {
    final (t, i) = hits.first;
    if (t.parts.length < 2) return DirectOutcome.say('"${_human(t.fieldName(i))}" is the only field of ${_human(t.name)}, so I did not remove it. Your app is unchanged.');
    final nm = t.fieldName(i);
    final used = lines.asMap().entries.any((e) => e.key != t.line && RegExp('\\b$nm\\b').hasMatch(e.value));
    if (used) return null; // other parts of the screen use it: the model has to rework them
    return DirectOutcome.edit(DirectEdit(build(t, i), 'the ${_human(nm)} field is gone'));
  }
  if (hits.length > 1) return null;
  final names = <String>{for (final t in tbls) for (var i = 0; i < t.parts.length; i++) if (!RegExp(r'\bref\b').hasMatch(t.parts[i])) _human(t.fieldName(i))}.toList();
  final choices = <Choice>[];
  for (final t in tbls) {
    if (t.parts.length < 2) continue;
    for (var i = 0; i < t.parts.length; i++) {
      final nm = t.fieldName(i);
      if (RegExp(r'\bref\b').hasMatch(t.parts[i])) continue;
      if (lines.asMap().entries.any((e) => e.key != t.line && RegExp('\\b$nm\\b').hasMatch(e.value))) continue;
      choices.add(Choice(_human(nm), build(t, i), 'the ${_human(nm)} field is gone'));
    }
  }
  return DirectOutcome.ask('I can\'t find a field called "$target". The fields in this app are: ${_list(names)}. Which one do you want to remove?', choices.take(4).toList());
}

const _moneyWords = {'fee', 'fees', 'amount', 'price', 'cost', 'salary', 'rent', 'balance', 'budget', 'payment', 'charge'};
const _dateWords = {'date', 'birthday', 'dob', 'deadline', 'due'};
const _numWords = {'age', 'quantity', 'qty', 'marks', 'score', 'km', 'kg', 'pages', 'ml', 'count', 'weight', 'height', 'reps', 'sets', 'minutes', 'mins', 'hours'};
const _textWords = {'phone', 'number', 'id', 'code', 'roll', 'cnic', 'mobile', 'address', 'email', 'name', 'note', 'notes', 'comment'};

/// "add a note field", "add a field for phone number", "add a field called Address": an optional field on the one table that has the
/// entry form. Text unless the name says money, a date or a count.
DirectOutcome? addFieldPlan(String request, String source) {
  final low = request.trim().toLowerCase().replaceAll(RegExp(r'[.!?]+$'), '');
  var name = RegExp(r'^(?:please\s+|can you\s+|could you\s+)?(?:add|create|put in|include)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|one\s+)?(?:new\s+)?(?:field|column|box|input)\s+(?:for|called|named|to hold|to store|to record|of)\s+(?:the\s+|a\s+|an\s+)?(.+)$').firstMatch(low)?.group(1);
  name ??= RegExp(r'^(?:please\s+|can you\s+|could you\s+)?(?:add|create|put in|include)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|one\s+)?(?:new\s+)?(.+?)\s+(?:field|column|box|input)(?:\s+(?:to|for|in)\s+(?:the\s+|my\s+)?(.+))?$').firstMatch(low)?.group(1);
  if (name == null) return null;
  final words = RegExp(r'[a-z0-9]+').allMatches(name).map((m) => m.group(0)!).where((w) => !const {'a', 'an', 'the', 'of', 'for', 'each', 'every', 'student', 'students', 'entry', 'entries', 'new'}.contains(w)).toList();
  if (words.isEmpty || words.length > 3) return null;
  final ident = words.join('_');
  if (ident.length > 24 || RegExp(r'^[0-9]').hasMatch(ident)) return null;
  final lines = source.split('\n');
  final tbls = _tables(lines);
  final withForm = tbls.where((t) => lines.any((l) => RegExp('^(form|topbar)\\s+${t.name}\\b').hasMatch(l.trim()))).toList();
  final named = tbls.where((t) => RegExp('\\b${RegExp.escape(t.name)}s?\\b').hasMatch(low)).toList();
  final target = named.length == 1 ? named.first : withForm.length == 1 ? withForm.first : (tbls.length == 1 ? tbls.first : null);
  final type0 = words.any(_textWords.contains) ? 'text' : words.any(_moneyWords.contains) ? 'money' : words.any(_dateWords.contains) ? 'date' : words.any(_numWords.contains) ? 'num' : 'text';
  if (target == null) {
    final cands = withForm.isNotEmpty ? withForm : tbls;
    if (cands.length < 2) return null;
    final choices = <Choice>[];
    for (final t in cands.take(4)) {
      if (t.parts.any((p) => _sameName(p.split(RegExp(r'\s+')).first, ident))) continue;
      final copy = [...lines];
      copy[t.line] = 'table ${t.name} ${[...t.parts, '$ident $type0?'].join(', ')}';
      choices.add(Choice(_human(t.name), copy.join('\n'), 'added a ${_human(ident)} field to ${_human(t.name)}'));
    }
    return DirectOutcome.ask('Which one should get the ${_human(ident)} field? Pick the list it belongs to:', choices);
  }
  if (target.parts.any((p) => _sameName(p.split(RegExp(r'\s+')).first, ident))) {
    return DirectOutcome.say('This app already has a ${_human(ident)} field. Your app is unchanged.');
  }
  final type = type0;
  final copy = [...lines];
  copy[target.line] = 'table ${target.name} ${[...target.parts, '$ident $type?'].join(', ')}';
  return DirectOutcome.edit(DirectEdit(copy.join('\n'), 'added a ${_human(ident)} field'));
}

// ---------------- rename a button: "change X to say Y", "call X Y", "rename X to Y" ----------------

/// A button rename in the wordings people use. The label must exist exactly once; otherwise the real buttons are listed.
/// Without the word "button" only an exact existing label counts ("rename Paid to Received"), so "call it Zakat" stays a title.
DirectOutcome? renameButtonPlan(String request, String source) {
  final r = request.trim().replaceAll(RegExp(r'[.!]+$'), '');
  RegExpMatch? m = RegExp(r'^(?:please\s+|can you\s+|could you\s+)?(?:rename|change|call|make|relabel|set|edit)\s+(?:the\s+)?"?(.+?)"?\s+button\s+(?:to say|to read|to be|to|as|say|read|into|says)\s+"?([^"]+?)"?$', caseSensitive: false).firstMatch(r);
  var named = true;
  if (m == null) {
    m = RegExp(r'^(?:please\s+|can you\s+|could you\s+)?(?:rename|change|relabel|call)\s+"?(.+?)"?\s+(?:to say|to read|to|as|into)\s+"?([^"]+?)"?$', caseSensitive: false).firstMatch(r) ?? RegExp(r'^(?:please\s+|can you\s+|could you\s+)?call\s+(?:the\s+)?"?([^" ]+(?: [^" ]+)?)"?\s+"?([^"]+?)"?$', caseSensitive: false).firstMatch(r);
    named = false;
  }
  if (m == null) return null;
  final target = m.group(1)!.trim();
  final next = m.group(2)!.trim();
  if (target.isEmpty || next.isEmpty || next.length > 30 || next.contains('"') || const {'it', 'this', 'app', 'this app', 'the app'}.contains(target.toLowerCase())) return null;
  final labels = buttonLabels(source);
  final exact = labels.where((l) => l.toLowerCase() == target.toLowerCase()).toList();
  if (!named && exact.isEmpty) return null; // not about a button we know: the title rename or the model decides
  final direct = buttonRenameEdit('rename the $target button to $next', source);
  if (direct != null) return DirectOutcome.edit(direct);
  if (exact.length > 1) return null;
  if (!named) return null;
  if (exact.isEmpty && labels.isEmpty) return DirectOutcome.say('This app has no buttons with their own label that I can rename. Your app is unchanged.');
  final choices = <Choice>[];
  final seen = <String>{};
  for (final l in labels) {
    if (!seen.add(l.toLowerCase())) continue;
    final p = buttonRenameEdit('rename the $l button to $next', source);
    if (p != null && !p.unchanged) choices.add(Choice(l, p.program, p.label));
  }
  return DirectOutcome.ask('I can\'t find a button called "$target". The buttons in this app are: ${_list(labels)}. Which one do you want to rename to "$next"?', choices.take(4).toList());
}

// ---------------- vague requests ----------------

/// "make it nicer", "improve it": too vague to act on. Answered at once with real choices (all exact edits), not after minutes.
bool isVagueRequest(String request) {
  final w = wordsOf(request);
  if (w.isEmpty || w.length > 6) return false;
  const vague = {'nicer', 'better', 'prettier', 'cooler', 'nice', 'pretty', 'improve', 'beautiful', 'modern', 'good', 'professional', 'cleaner', 'fancy'};
  const act = {'make', 'it', 'look', 'looks', 'this', 'the', 'app', 'more', 'a', 'bit', 'little', 'please', 'can', 'you', 'improve', 'i', 'want', 'to', 'be', 'much', 'way', 'so', 'is', 'not', 'very', 'that', 'my'};
  return w.any(vague.contains) && w.every((x) => vague.contains(x) || act.contains(x));
}

// ---------------- did the model change touch what the user named? ----------------

/// The model's program, checked against the part the user named. Returns what went wrong in plain words (null = fine or nothing
/// checkable). A "Done" is only said when this is null.
String? namedPartMismatch(String request, String oldSrc, String newSrc) {
  final low = request.toLowerCase().trim();
  final ol = buttonLabels(oldSrc).map((l) => l.toLowerCase()).toList();
  final nl = buttonLabels(newSrc).map((l) => l.toLowerCase()).toList();
  int count(List<String> xs, String x) => xs.where((e) => e == x).length;
  // remove the <label> button
  final rb = RegExp(r'\b(?:remove|delete|drop|hide|get rid of|take away)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+button\b').firstMatch(low);
  if (rb != null) {
    final l = rb.group(1)!.trim();
    if (ol.contains(l) && count(nl, l) >= count(ol, l)) return 'the "${RegExp(r'\b(?:remove|delete|drop|hide|get rid of|take away)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+button\b', caseSensitive: false).firstMatch(request)!.group(1)}" button is still there';
    if (!ol.contains(l) && ol.isNotEmpty) return 'there is no button called "${rb.group(1)}" to remove';
  }
  // rename / change a button to say Y
  final rn = RegExp(r'\b(?:rename|change|call|relabel|make)\s+(?:the\s+)?"?(.+?)"?\s+button\s+(?:to say|to read|to be|to|as|say|read|into|says)\s+"?(.+?)"?$').firstMatch(low);
  if (rn != null && !nl.contains(rn.group(2)!.trim())) return 'no button says "${rn.group(2)!.trim()}"';
  // remove the <name> field
  final rf = RegExp(r'\b(?:remove|delete|drop|get rid of)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+(?:field|column)\b').firstMatch(low);
  if (rf != null) {
    final t = rf.group(1)!.trim().replaceAll(' ', '_');
    final still = _tables(newSrc.split('\n')).any((tb) => [for (var i = 0; i < tb.parts.length; i++) tb.fieldName(i)].any((f) => _sameName(f, t)));
    final was = _tables(oldSrc.split('\n')).any((tb) => [for (var i = 0; i < tb.parts.length; i++) tb.fieldName(i)].any((f) => _sameName(f, t)));
    if (was && still) return 'the ${_human(t)} field is still there';
  }
  // add a <name> field
  final af = RegExp(r'\badd\b.*?\b(?:field|column|box)\s+(?:for|called|named)\s+(?:the\s+|a\s+)?(.+)$').firstMatch(low) ?? RegExp(r'\badd\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:field|column|box)\b').firstMatch(low);
  if (af != null) {
    final key = wordsOf(af.group(1)!).where((w) => w.length > 2 && !kFiller.contains(w)).toList();
    if (key.isNotEmpty) {
      final before = {for (final tb in _tables(oldSrc.split('\n'))) for (var i = 0; i < tb.parts.length; i++) '${tb.name}.${tb.fieldName(i)}'};
      final added = [for (final tb in _tables(newSrc.split('\n'))) for (var i = 0; i < tb.parts.length; i++) if (!before.contains('${tb.name}.${tb.fieldName(i)}')) tb.fieldName(i)];
      if (added.isNotEmpty && !added.any((f) => key.any((k) => _norm(f).contains(_sing(k)) || _sing(k).contains(_norm(f))))) return 'the new field is not called ${key.join(' ')}';
    }
  }
  // a chart of <field>: plot the field named
  final cf = RegExp(r'\b(?:chart|graph|plot)\s+(?:of|for|by|showing|with)\s+(?:the\s+|my\s+)?(.+)$').firstMatch(low);
  if (cf != null) {
    final key = wordsOf(cf.group(1)!).where((w) => w.length > 2 && !kFiller.contains(w) && !const {'per', 'day', 'days', 'week', 'month', 'each', 'daily', 'weekly', 'monthly', 'over', 'time'}.contains(w)).toList();
    final newCharts = newSrc.split('\n').where((l) => kChartKinds.contains(l.trim().split(RegExp(r'\s+')).first)).toList();
    final oldCharts = oldSrc.split('\n').where((l) => kChartKinds.contains(l.trim().split(RegExp(r'\s+')).first)).toSet();
    final added = newCharts.where((l) => !oldCharts.contains(l)).toList();
    if (key.isNotEmpty && added.isNotEmpty) {
      final plotted = RegExp(r'\b\w+\.(\w+)').allMatches(added.join(' ')).map((m) => m.group(1)!).toSet();
      final ok = plotted.any((f) => key.any((k) => _norm(f).contains(_sing(k)) || _sing(k).contains(_norm(f)))) || key.any((k) => RegExp(r'\b\w*' + RegExp.escape(_sing(k)) + r'\w*\b', caseSensitive: false).hasMatch(added.join(' ')));
      if (!ok) return 'the chart does not plot ${key.join(' ')}${plotted.isEmpty ? '' : ' (it plots ${plotted.map(_human).join(', ')})'}';
    }
  }
  // things the diff added that the request never named (the model's own idea): a chart when none was asked for
  final addedChart = _chartLines(newSrc).where((l) => !_chartLines(oldSrc).contains(l)).isNotEmpty;
  if (addedChart && !RegExp(r'\b(chart|graph|plot|bars?|trend|heat ?map|calendar|visual|picture|diagram|per day|by day|each day|over time)\b').hasMatch(low)) {
    return 'it adds a chart, and you did not ask for a chart';
  }
  // a total / sum asked for: a new total has to be in the result
  if (RegExp(r'\b(add|show|put|give|make|want|need)\b.*\b(total|totals|sum|subtotal)\b').hasMatch(low) && _totalCount(newSrc) <= _totalCount(oldSrc)) {
    return 'no new total was added';
  }
  return null;
}

List<String> _chartLines(String src) => [for (final l in src.split('\n')) if (!l.startsWith(' ') && kChartKinds.contains(l.trim().split(RegExp(r'\s+')).first)) l.trim()];
int _totalCount(String src) => src.split('\n').where((l) => RegExp(r'^(stat|statcard)\b|^let\s+\w+\s*=\s*sum\(|\bsum\(').hasMatch(l.trim())).length;

/// "add a chart of fees": the field the user named has to exist. Returns the plain answer when it does not (null = fine / not asked).
({String text, List<String> fields})? missingChartField(String request, String source) {
  final low = request.toLowerCase().trim();
  final cf = RegExp(r'^(?:please\s+|can you\s+|could you\s+)?(?:add|show|put|make|create)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:chart|graph)\s+(?:of|for|by|showing)\s+(?:the\s+|my\s+)?(.+?)\s*[.!]?$').firstMatch(low);
  if (cf == null) return null;
  final key = wordsOf(cf.group(1)!).where((w) => w.length > 2 && !kFiller.contains(w) && !const {'per', 'day', 'days', 'week', 'month', 'each', 'daily', 'weekly', 'monthly', 'over', 'time', 'entries', 'everything', 'all'}.contains(w)).toList();
  if (key.isEmpty) return null;
  final fields = <String>[for (final t in _tables(source.split('\n'))) for (var i = 0; i < t.parts.length; i++) if (!RegExp(r'\bref\b').hasMatch(t.parts[i])) t.fieldName(i)];
  if (fields.any((f) => key.any((k) => _norm(f).contains(_sing(k)) || _sing(k).contains(_norm(f))))) return null;
  final srcLines = source.split('\n');
  bool hasForm(_Tbl t) => srcLines.any((l) => RegExp('^(form|topbar)\\s+${t.name}\\b').hasMatch(l.trim()));
  final nums = <String>[for (final t in _tables(srcLines)) if (hasForm(t)) for (var i = 0; i < t.parts.length; i++) if (RegExp(r'\b(money|num|dur)\b').hasMatch(t.parts[i])) t.fieldName(i)];
  return (text: 'This app has no field called "${key.join(' ')}", so I can\'t chart it. ${nums.isEmpty ? '' : 'I can chart: ${nums.map(_human).join(', ')}. Which one?'}'.trim(), fields: nums);
}

// ---------------- a built app in plain words ----------------

/// What the built app has, from its program, in words the user knows (the table's own names are the user's words).
String _joinAnd(List<String> xs) => xs.length < 2 ? xs.join() : '${xs.sublist(0, xs.length - 1).join(', ')} and ${xs.last}';

String describeApp(String source) {
  final a = AppLine.parse(source);
  final lines = source.split('\n');
  final tbls = _tables(lines);
  final forms = <String>[], lists = <String>[], items = <String>[];
  // the app's own labels: the form's button text and the field names, never the table's name (that is the model's word)
  for (final t in tbls) {
    final isRef = t.parts.every((p) => RegExp(r'\bref\b').hasMatch(p) || RegExp(r'^(amount|at)\b').hasMatch(p));
    final fields = [for (var i = 0; i < t.parts.length; i++) if (!RegExp(r'\bref\b').hasMatch(t.parts[i]) && t.fieldName(i) != 'at') t.fieldName(i).replaceAll('_', ' ')];
    final fm = [for (final l in lines) RegExp('^(?:form|topbar)\\s+${t.name}\\b(?:\\s*,\\s*"([^"]*)")?').firstMatch(l.trim())].whereType<RegExpMatch>().toList();
    final listed = lines.any((l) => RegExp('^(list|log)\\s+${t.name}\\b').hasMatch(l.trim()) || RegExp('^each\\s+${t.name}\\b').hasMatch(l.trim()));
    if (fm.isNotEmpty && !isRef) {
      final label = fm.first.group(1);
      final fl = fields.isEmpty ? '' : ' with ${_joinAnd(fields.take(4).toList())}';
      forms.add(label != null && label.isNotEmpty ? 'a form with an "$label" button$fl' : 'a form$fl');
    }
    if (listed && !isRef) lists.add(fields.isEmpty ? 'what you add' : _joinAnd(fields.take(3).toList()));
  }
  items.addAll(forms);
  if (lists.isNotEmpty) items.add(lists.length == 1 ? 'a list showing ${lists.first}' : '${lists.length} lists of what you add');
  final labels = <String>[for (final raw in lines) if (RegExp(r'^\s+button\s+"([^"]+)"').hasMatch(raw)) RegExp(r'^\s+button\s+"([^"]+)"').firstMatch(raw)!.group(1)!];
  final seen = <String>{};
  for (final l in labels) { if (seen.add(l.toLowerCase())) items.add('a "$l" button'); }
  if (lines.any((l) => RegExp(r'^\s*(?:stat|statcard)\b').hasMatch(l) || RegExp(r'^let\s+\w+\s*=\s*sum\(').hasMatch(l.trim()))) items.add('a total');
  final charts = lines.where((l) => kChartKinds.contains(l.trim().split(RegExp(r'\s+')).first) && !l.startsWith(' ')).toList();
  if (charts.isNotEmpty) items.add(_chartAdded0(charts.first));
  for (final l in lines) {
    final m = RegExp(r'^setting\s+\w+\s+[^"\n]*"([^"]+)"').firstMatch(l.trim());
    if (m != null) items.add('a ${m.group(1)!.toLowerCase()} setting');
  }
  final uniq = <String>[];
  for (final i in items) { if (!uniq.contains(i)) uniq.add(i); }
  final title = a?.title ?? 'your app';
  if (uniq.isEmpty) return 'Made $title. It is open now and keeps what you enter.';
  final shown = uniq.take(6).toList();
  final text = shown.length == 1 ? shown.first : '${shown.sublist(0, shown.length - 1).join(', ')} and ${shown.last}';
  return 'Made $title with $text. It is open now and keeps what you enter.';
}

String _chartAdded0(String line) {
  final s = summarizeChange('app "x" a b\n', 'app "x" a b\n$line\n');
  final t = s.isEmpty ? 'Added a chart.' : s.first;
  return 'a ${t.replaceFirst('Added a ', '').replaceFirst(RegExp(r'\.$'), '')}';
}

// ---------------- what the request named that the app lacks ----------------

class Gap {
  Gap(this.phrase, this.editRequest);
  final String phrase, editRequest;
}

/// Key things the request names that the built app does not have: a list, a paid button or field, a goal, a chart, a total.
List<Gap> keyNounGaps(String request, String source) {
  final w = wordsOf(request).toSet();
  final lines = source.split('\n').map((l) => l.trim()).toList();
  final low = source.toLowerCase();
  final out = <Gap>[];
  bool anyStart(Set<String> kinds) => lines.any((l) => kinds.contains(l.split(RegExp(r'\s+')).first));
  if ((w.contains('list') || w.contains('history') || w.contains('log')) && !anyStart({'list', 'log', 'each'})) out.add(Gap('a list of the entries', 'add a list of the entries'));
  if ((w.contains('paid') || w.contains('pay') || w.contains('payment') || w.contains('payments')) && !RegExp(r'paid|pay').hasMatch(low)) out.add(Gap(w.contains('button') ? 'a Paid button' : 'a way to mark things paid', 'add a Paid button'));
  if ((w.contains('goal') || w.contains('target') || w.contains('limit')) && !(lines.any((l) => l.startsWith('setting ')) || anyStart({'goal'}))) out.add(Gap('a goal', 'add a goal'));
  if ((w.contains('chart') || w.contains('graph')) && !anyStart(kChartKinds)) out.add(Gap('a chart', 'add a chart'));
  if ((w.contains('total') || w.contains('totals') || w.contains('sum')) && !(lines.any((l) => RegExp(r'\bsum\(|\bstat\b|\bstatcard\b').hasMatch(l)))) out.add(Gap('a total', 'add a total'));
  if ((w.contains('expense') || w.contains('expenses') || w.contains('spending') || w.contains('cost') || w.contains('costs') || w.contains('price') || w.contains('money') || w.contains('fee') || w.contains('fees') || w.contains('salary')) && !RegExp(r'\bmoney\b').hasMatch(low)) out.add(Gap('an amount of money', 'add a field for amount'));
  return out;
}

// ---------------- a shorter request for the one retry of a create ----------------

/// The same ask in fewer words: the first clause, cut at "with", "and", a comma or a full stop, at most 7 words. Null when
/// there is nothing shorter to try.
String? shorterRequest(String request) {
  final t = request.trim();
  final first = t.split(RegExp(r'\s*(?:[.,;:]|\bwith\b|\band\b|\bthat\b|\bwhere\b|\bso\b)\s*', caseSensitive: false)).firstWhere((x) => x.trim().isNotEmpty, orElse: () => t);
  final w = first.trim().split(RegExp(r'\s+')).take(7).join(' ');
  if (w.isEmpty || w.length >= t.length) return null;
  return w;
}
