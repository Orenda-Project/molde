// Plain-English account of a change, built from the checked before and after programs (never from the model's own text and
// never from the engine's wording). No line of program text is ever shown: every line is turned into a phrase about what the
// user sees ("a chart", "the Paid button", "a Phone field"). Pure Dart, unit tested.
import 'rules.dart';

const Set<String> kChartKinds = {'daybars', 'bars', 'trend', 'heat', 'pie', 'share', 'goalbars', 'daygrid', 'weekdots', 'plot'};

String _human(String name) {
  final t = name.replaceAll('_', ' ').trim();
  return t.isEmpty ? t : t[0].toUpperCase() + t.substring(1);
}

String _firstWord(String line) => line.trim().split(RegExp(r'\s+')).first;
int _indentOf(String l) => l.length - l.trimLeft().length;

/// "fee" from `sum(student.fee on it)` or `avg(sale.amount ...)`; null when the line names no field.
String? _fieldOfLine(String line) {
  final m = RegExp(r'(?:sum|avg|max|min|last|count)\(\s*\w+\.(\w+)').firstMatch(line);
  return m?.group(1);
}

/// What one top-level program line is, as a phrase for the user ("a chart", "a total", "the Paid button").
String describeLine(String raw) {
  final line = raw.trim();
  if (line.isEmpty) return 'a part of the screen';
  if (line.startsWith('"')) {
    final end = line.indexOf('"', 1);
    final txt = end > 1 ? line.substring(1, end) : '';
    return txt.isEmpty ? 'a line of text' : 'the text "$txt"';
  }
  final k = _firstWord(line);
  if (kChartKinds.contains(k)) return 'a chart';
  switch (k) {
    case 'stat': case 'statcard': return 'a total';
    case 'goal': return 'a goal bar';
    case 'list': case 'each': return 'a list of entries';
    case 'form': {
      final l = RegExp(r'"([^"]+)"').firstMatch(line)?.group(1);
      return l == null ? 'the entry form' : 'the entry form (button "$l")';
    }
    case 'quick': return 'the quick-add buttons';
    case 'topbar': return 'the top bar';
    case 'button': {
      final l = RegExp(r'"([^"]*)"').firstMatch(line)?.group(1);
      return l == null ? 'a button' : 'the "$l" button';
    }
    case 'section': return 'a section';
    case 'let': return 'a calculation';
    case 'setting': return 'a setting';
    case 'table': return 'a group of entries';
    case 'state': return 'a saved choice';
    case 'if': case 'else': return 'a condition';
    case 'row': case 'stack': case 'box': return 'a block of the screen';
    default: return 'a part of the screen';
  }
}

/// Phrases for several lines, repeated ones counted ("2 charts"); never program text.
List<String> describeLines(List<String> lines) {
  final counts = <String, int>{};
  final order = <String>[];
  for (final l in lines) {
    final d = describeLine(l);
    if (!counts.containsKey(d)) order.add(d);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return [for (final d in order) counts[d]! > 1 ? '${counts[d]} × $d' : d];
}

class _Facts {
  final Map<String, List<String>> tables = {}; // table -> field names in order
  final Map<String, String> renamedFrom = {}; // "table.new" -> old (a field written with was)
  final List<String> chartLines = []; // top-level chart lines
  final Map<String, ({String label, String? dflt})> settings = {}; // name -> label, default
  final List<String> labels = []; // button labels (form and button lines), in order
  final List<String> formLines = [];
  final List<String> topLines = []; // every top-level line except the app line, trimmed
  AppLine? app;

  static _Facts of(String src) {
    final f = _Facts();
    f.app = AppLine.parse(src);
    for (final raw in src.split('\n')) {
      if (raw.trim().isEmpty) continue;
      final line = raw.trimRight();
      final t = line.trim();
      if (_indentOf(line) == 0 && !t.startsWith('app ')) f.topLines.add(t);
      if (_indentOf(line) > 0) {
        final m = RegExp(r'^button\s+"([^"]*)"').firstMatch(t);
        if (m != null) f.labels.add(m.group(1)!);
        continue;
      }
      final k = _firstWord(t);
      if (k == 'table') {
        final m = RegExp(r'^table\s+(\w+)\s+(.*)$').firstMatch(t);
        if (m != null) {
          final names = <String>[];
          for (final part in m.group(2)!.split(',')) {
            final p = part.trim();
            if (p.isEmpty) continue;
            final name = p.split(RegExp(r'\s+')).first;
            names.add(name);
            final was = RegExp(r'\bwas\s+(\w+)').firstMatch(p);
            if (was != null) f.renamedFrom['${m.group(1)}.$name'] = was.group(1)!;
          }
          f.tables[m.group(1)!] = names;
        }
      } else if (kChartKinds.contains(k)) {
        f.chartLines.add(t);
      } else if (k == 'setting') {
        final m = RegExp(r'^setting\s+(\w+)\s+[^=\n]*?(?:=\s*([^"\n]+?))?\s*(?:"([^"]*)")?\s*$').firstMatch(t);
        if (m != null) f.settings[m.group(1)!] = (label: m.group(3) ?? _human(m.group(1)!), dflt: m.group(2)?.trim());
      } else if (k == 'form') {
        f.formLines.add(t);
        final l = RegExp(r'"([^"]+)"').firstMatch(t)?.group(1);
        if (l != null) f.labels.add(l);
      } else if (k == 'button') {
        final l = RegExp(r'^button\s+"([^"]*)"').firstMatch(t)?.group(1);
        if (l != null) f.labels.add(l);
      }
    }
    return f;
  }
}

String _chartAdded(String line) {
  final k = _firstWord(line);
  final fld = _fieldOfLine(line);
  final of = fld == null ? '' : ' of ${fld.replaceAll('_', ' ')}';
  switch (k) {
    case 'daybars': return 'Added a chart$of per day.';
    case 'trend': return 'Added a chart$of over time.';
    case 'bars': return 'Added a bar chart$of.';
    case 'heat': case 'daygrid': case 'weekdots': return 'Added a calendar view of your entries.';
    case 'pie': case 'share': return 'Added a chart that shows how the total is split$of.';
    default: return 'Added a chart$of.';
  }
}

/// The change from `oldSrc` to `newSrc` as short plain sentences. Empty list = nothing a user would see changed.
List<String> summarizeChange(String oldSrc, String newSrc) {
  final o = _Facts.of(oldSrc), n = _Facts.of(newSrc);
  final out = <String>[];

  // the app line
  if (o.app != null && n.app != null) {
    if (o.app!.title != n.app!.title) out.add('Renamed the app to ${n.app!.title}.');
    if (o.app!.theme != n.app!.theme && n.app!.theme != null) out.add('Changed the colour to ${n.app!.theme}.');
    if (o.app!.mode != n.app!.mode) out.add(n.app!.mode == 'dark' ? 'Switched to dark mode.' : 'Switched to light mode.');
    if (o.app!.size != n.app!.size) {
      const order = ['small', 'normal', 'large', 'huge'];
      out.add(order.indexOf(n.app!.size ?? 'normal') > order.indexOf(o.app!.size ?? 'normal') ? 'Made the text bigger.' : 'Made the text smaller.');
    }
  }

  // fields
  for (final e in n.tables.entries) {
    final before = o.tables[e.key];
    if (before == null) { out.add('Added a new list of entries: ${_human(e.key)}.'); continue; }
    for (final f in e.value) {
      if (before.contains(f)) continue;
      final was = n.renamedFrom['${e.key}.$f'];
      if (was != null && before.contains(was)) { out.add('Renamed the ${was.replaceAll('_', ' ')} field to ${f.replaceAll('_', ' ')}.'); continue; }
      out.add('Added a ${_human(f)} field.');
    }
    for (final f in before) {
      if (e.value.contains(f)) continue;
      final renamed = n.renamedFrom.entries.any((r) => r.key.startsWith('${e.key}.') && r.value == f);
      if (!renamed) out.add('Removed the ${_human(f)} field.');
    }
  }
  for (final t in o.tables.keys) { if (!n.tables.containsKey(t)) out.add('Removed the list of entries ${_human(t)}.'); }

  // settings
  for (final e in n.settings.entries) {
    final b = o.settings[e.key];
    if (b == null) { out.add('Added a setting: ${e.value.label}.'); continue; }
    if (b.dflt != e.value.dflt && e.value.dflt != null) out.add('Set ${e.value.label} to ${e.value.dflt}.');
  }
  for (final e in o.settings.entries) { if (!n.settings.containsKey(e.key)) out.add('Removed the setting ${e.value.label}.'); }

  // charts
  if (n.chartLines.length > o.chartLines.length) {
    final oldKinds = o.chartLines.map((l) => l).toSet();
    final added = n.chartLines.where((l) => !oldKinds.contains(l)).toList();
    for (final l in added.take(2)) { out.add(_chartAdded(l)); }
    if (added.isEmpty) out.add('Added a chart.');
  } else if (n.chartLines.length < o.chartLines.length) {
    final k = o.chartLines.length - n.chartLines.length;
    out.add(k > 1 ? 'Removed $k charts.' : 'Removed a chart.');
  }

  // buttons and labels
  final oldLabels = [...o.labels], newLabels = [...n.labels];
  for (final l in [...newLabels]) { if (oldLabels.remove(l)) newLabels.remove(l); }
  final nOldForms = o.formLines.where((l) => !l.contains('"')).length, nNewForms = n.formLines.where((l) => !l.contains('"')).length;
  if (oldLabels.isEmpty && newLabels.length == 1 && nOldForms > nNewForms) {
    out.add('Renamed the Add button to ${newLabels.first}.');
  } else {
    final k = newLabels.length < oldLabels.length ? newLabels.length : oldLabels.length;
    for (var i = 0; i < k; i++) { out.add('Renamed the ${oldLabels[i]} button to ${newLabels[i]}.'); }
    for (var i = k; i < newLabels.length; i++) { out.add('Added a button: ${newLabels[i]}.'); }
    for (var i = k; i < oldLabels.length; i++) { out.add('Removed the button ${oldLabels[i]}.'); }
  }

  // the other top-level lines: totals, lists, sections, text
  const skip = {'table', 'setting', 'state', 'form', 'button', 'quick', 'topbar'};
  final oldCount = <String, int>{};
  for (final l in o.topLines) { oldCount[l] = (oldCount[l] ?? 0) + 1; }
  final oldSigs = o.topLines.map(lineSignature).toList();
  final added = <String>[];
  for (final l in n.topLines) {
    final c = oldCount[l] ?? 0;
    if (c > 0) { oldCount[l] = c - 1; continue; }
    if (kChartKinds.contains(_firstWord(l)) || skip.contains(_firstWord(l))) continue;
    if (oldSigs.contains(lineSignature(l))) continue; // an edit of a line that was there: not a new part
    added.add(l);
  }
  final newCount = <String, int>{};
  for (final l in n.topLines) { newCount[l] = (newCount[l] ?? 0) + 1; }
  final newSigs = n.topLines.map(lineSignature).toList();
  final removed = <String>[];
  for (final l in o.topLines) {
    final c = newCount[l] ?? 0;
    if (c > 0) { newCount[l] = c - 1; continue; }
    if (kChartKinds.contains(_firstWord(l)) || skip.contains(_firstWord(l))) continue;
    if (newSigs.contains(lineSignature(l))) continue;
    removed.add(l);
  }
  for (final d in describeLines(added)) { out.add('Added $d.'); }
  for (final d in describeLines(removed)) { out.add('Removed $d.'); }

  // a form line removed or added on its own
  if (n.formLines.isEmpty && o.formLines.isNotEmpty) out.add('Removed the entry form.');
  if (o.formLines.isEmpty && n.formLines.isNotEmpty) out.add('Added an entry form.');
  return out;
}

/// What to say when the change is done. Never empty, never program text.
String changeReply(List<String> sentences, {String? secs, bool chartAdded = false}) {
  final body = sentences.isEmpty ? 'I made a small change that does not show on the screen.' : sentences.take(6).join('\n') + (sentences.length > 6 ? '\nand ${sentences.length - 6} more changes.' : '');
  final note = chartAdded ? '\nThe chart fills in as you add entries.' : '';
  return '$body$note\nEverything you entered is kept.';
}

/// Words and shapes of the program language: a reply that contains one of these is a bug. Used by tests.
final RegExp kLanguageLeak = RegExp(
    r'\b(daybars|statcard|sum\(|count\(|avg\(|last\(|where |each |plot |rect |tick |fill |tap |stack |quick |state |let |setting |table |trend |heat )|\w\.\w+\s*(\(|\b(text|num|money|date|bool|pick)\b)|\bapp "|\b(mint|ocean|slate|ink|plum) (dark|light)\b|[{}\[\]`]');

/// What the request asked for that the checked result lacks, from the diff of the two programs (not from word matching).
/// Plain phrases ("a new field", "a chart"); empty when nothing checkable was asked or everything asked is there.
List<String> unmetFromDiff(String request, String oldSrc, String newSrc) {
  final low = request.toLowerCase();
  final o = _Facts.of(oldSrc), n = _Facts.of(newSrc);
  final out = <String>[];
  String tableText(String s) => s.split('\n').where((l) => l.trim().startsWith('table ')).map((l) => l.trim()).join('\n');
  final tableChanged = tableText(oldSrc) != tableText(newSrc);
  if (RegExp(r'\badd\b[^.]*\b(field|column|box|option|input)\b').hasMatch(low) && !tableChanged) out.add('the new field');
  if (RegExp(r'\b(remove|delete|drop|get rid of)\b[^.]*\b(field|column)\b').hasMatch(low) && !tableChanged) out.add('removing the field');
  if (RegExp(r'\b(add|show|put)\b[^.]*\b(chart|graph)\b').hasMatch(low) && n.chartLines.length <= o.chartLines.length) out.add('a chart');
  if (RegExp(r'\b(remove|delete|hide|get rid of)\b[^.]*\b(chart|graph)\b').hasMatch(low) && o.chartLines.isNotEmpty && n.chartLines.length >= o.chartLines.length) out.add('removing the chart');
  if (RegExp(r'\b(rename|change|call)\b[^.]*\bbutton\b').hasMatch(low) && o.labels.join('|') == n.labels.join('|') && o.formLines.where((l) => !l.contains('"')).length == n.formLines.where((l) => !l.contains('"')).length) out.add('the new button name');
  return out;
}

/// The engine's data warnings, kept only when they read as plain English (no program words, no table.field names).
List<String> plainWarnings(List<String> warnings) {
  final ok = warnings.where((w) => !kLanguageLeak.hasMatch(w) && !RegExp(r'\b\w+\.\w+\b').hasMatch(w)).toList();
  return ok.isEmpty ? ['Some of what you entered may be hidden or changed by this.'] : ok;
}
