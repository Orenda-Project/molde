// Pure rules of the chat: what a request names, what kind of request it is, deterministic edits of the
// app line, and checks that a change did what was asked. No Flutter, no I/O: unit tested on their own.

/// Words that do not name a thing (generic, no app vocabulary).
const Set<String> kFiller = {'a', 'an', 'the', 'my', 'me', 'make', 'build', 'create', 'new', 'app', 'apps', 'please', 'simple', 'some', 'for', 'of', 'and', 'with', 'to', 'i', 'want', 'need', 'can', 'you', 'do', 'it', 'this', 'that', 'something', 'anything', 'stuff', 'thing', 'things', 'tool', 'give', 'get', 'help', 'is', 'be', 'have', 'like', 'just', 'one', 'on', 'in', 'up'};

List<String> wordsOf(String t) => RegExp(r'[a-z0-9]+').allMatches(t.toLowerCase()).map((m) => m.group(0)!).toList();

/// A request that names something builds at once: the model may not ask about it. Any request with at least one word
/// that is not filler counts (measured on r3: asks fell from 31.7% to 0% of 60 short requests, checker pass 65% -> 93%+).
/// A request that names nothing ("make me an app", "something please") may still get one question.
bool namesAThing(String request) {
  final w = wordsOf(request);
  return w.isNotEmpty && w.length <= 14 && w.any((x) => !kFiller.contains(x));
}

/// One to three words with a real noun: "sleep tracker", "kharcha". Used to tell a bare new-app name from a change.
bool bareNounPhrase(String request) {
  final w = wordsOf(request);
  return w.isNotEmpty && w.length <= 3 && w.any((x) => !kFiller.contains(x));
}

/// Names the current app uses: its title and the words of its table, field, setting and state lines.
Set<String> appNames(String source) {
  final out = <String>{};
  final title = RegExp(r'^app "([^"]*)"', multiLine: true).firstMatch(source)?.group(1);
  if (title != null) out.addAll(wordsOf(title));
  for (final l in source.split('\n')) {
    final t = l.trim();
    if (RegExp(r'^(table|setting|state|let)\b').hasMatch(t)) out.addAll(wordsOf(t.split('"').first));
  }
  const skip = {'table', 'setting', 'state', 'let', 'num', 'text', 'date', 'time', 'bool', 'pick', 'money', 'long', 'unit', 'ref', 'set', 'when', 'dur', 'image', 'the', 'and'};
  return out.where((w) => w.length >= 3 && !skip.contains(w)).toSet();
}

/// "undo", "undo that", "undo the last change", "go back", "revert", "put it back", "go back to how it was": the user wants the
/// previous version. Answered by Undo, never by the model, and never read as a new app.
bool isUndoRequest(String request) {
  final r = request.toLowerCase().replaceAll(RegExp(r"[.!?,']"), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  return RegExp(r'^(?:please |can you |could you |just )?(?:undo|revert|rollback|roll back|go back|put (?:it|that|this) back|take (?:it|that) back|change (?:it|that) back|bring (?:it|that) back)(?: (?:that|it|this|the last change|the last one|last change|my last change|the change|everything|please|now|again|to (?:how it was|before|the old version|the earlier version|the previous version)|how it was|before|one step|a step|the old version|the previous version|the earlier version|the old one))*$').hasMatch(r);
}

/// Requests that start with one of these verbs change the open app and never raise the new-app question.
final RegExp kChangeVerbs = RegExp(r'^\s*(?:please\s+|can you\s+|could you\s+)?(?:change|rename|make(?!\s+(?:me|a|an|another|new)\b)|add|remove|delete|drop|hide|show|set|move|bigger|smaller|larger|turn|put|use|switch|update|increase|decrease|swap|replace|sort|reorder|let me|i want it|call it|tidy|clean|simplify|fix|improve|rearrange|group|split|merge|shorten|rewrite|translate|tweak|adjust|count|track more|stop|start|keep|allow|display|list the|give it|can it|also)\b', caseSensitive: false);

bool startsWithChangeVerb(String request) => kChangeVerbs.hasMatch(request);

/// Reads like a new app and names nothing of the current one:
///  - "a habit tracker", "make me a budget app", "build a timer" (new-app wording plus an app noun), or
///  - a bare one to three word noun phrase that is not in the current app ("sleep tracker", "kharcha", "gym log").
/// Change verbs ("change", "add", "make it ...") always mean a change.
bool looksLikeNewApp(String request, String currentSource) {
  final r = request.trim().toLowerCase();
  if (r.isEmpty || startsWithChangeVerb(r)) return false;
  final names = appNames(currentSource);
  if (wordsOf(r).any(names.contains)) return false;
  final start = RegExp(r'^(please\s+)?(a|an|make me|make|build|create|i want|i need|give me|new|another)\b');
  final kind = RegExp(r'\b(app|tracker|list|log|counter|timer|planner|diary|journal|calculator|scoreboard|checklist|notebook)\b');
  if (start.hasMatch(r) && kind.hasMatch(r)) return true;
  return bareNounPhrase(r);
}

/// "change the goal to 3000", "set budget to 90000": a direct edit of one setting's default, no model needed.
/// Matches a setting whose name or label holds every word of the target; only plain numbers. Returns the new
/// program text (the same text when the value is already that), or null when the request is not of that shape
/// or names no setting of the app.
String? settingEditProgram(String request, String source) {
  const numRe = r'(-?[0-9][0-9,]*(?:\.[0-9]+)?)';
  final lead = r'^\s*(?:please\s+|can you\s+|could you\s+|i want you to\s+|i would like to\s+)?';
  // "change the goal to 3000", "set the target to 3000", "make my goal 3000", "make the goal 3000 please"
  var m = RegExp('$lead(?:change|set|make|update|put|raise|lower|increase|decrease)\\s+(?:the\\s+|my\\s+)?(.+?)\\s+(?:to\\s+|=\\s*|as\\s+|at\\s+)?$numRe(?:\\s+(?:instead|please|now))?[.!]?\\s*\$', caseSensitive: false).firstMatch(request);
  String? named = m?.group(1);
  String? number = m?.group(2);
  if (m == null) {
    // "i want to aim for 3000 instead", "aim for 3000", "my goal should be 3000", "the target is 3000", "let's go for 3000"
    m = RegExp('$lead(?:i want to\\s+|i wanna\\s+|let\'?s\\s+)?(?:aim for|go for|target|shoot for)\\s+$numRe(?:\\s+(?:instead|please|now))?[.!]?\\s*\$', caseSensitive: false).firstMatch(request);
    if (m != null) { named = 'goal'; number = m.group(1); }
  }
  if (m == null) {
    m = RegExp('$lead(?:the\\s+|my\\s+)(.+?)\\s+(?:should be|must be|needs to be|is now|will be)\\s+$numRe(?:\\s+(?:instead|please|now))?[.!]?\\s*\$', caseSensitive: false).firstMatch(request);
    if (m != null) { named = m.group(1); number = m.group(2); }
  }
  if (named == null || number == null) return null;
  final target = wordsOf(named).where((w) => !kFiller.contains(w)).toList();
  if (target.isEmpty) return null;
  final value = number.replaceAll(',', '');
  final lines = source.split('\n');
  final rx = RegExp(r'^(\s*setting\s+)(\w+)(\s+(?:num|money)\b[^=\n]*=\s*)(-?[0-9][0-9.]*)(.*)$');
  String? edit(int i, RegExpMatch sm) {
    if (sm.group(4) == value) return source;
    lines[i] = '${sm.group(1)}${sm.group(2)}${sm.group(3)}$value${sm.group(5)}';
    return lines.join('\n');
  }
  for (var i = 0; i < lines.length; i++) {
    final sm = rx.firstMatch(lines[i]);
    if (sm == null) continue;
    final ws = {...wordsOf(sm.group(2)!), ...wordsOf(lines[i].split('"').length > 1 ? lines[i].split('"')[1] : '')};
    if (target.every(ws.contains)) return edit(i, sm);
  }
  // "goal", "target", "aim", "limit", "budget" all mean the one number the app aims for: use it when the app has exactly one
  const aims = {'goal', 'target', 'aim', 'limit', 'budget', 'maximum', 'max'};
  if (target.every(aims.contains)) {
    final hits = <int>[for (var i = 0; i < lines.length; i++) if (rx.hasMatch(lines[i])) i];
    if (hits.length == 1) return edit(hits.first, rx.firstMatch(lines[hits.first])!);
  }
  return null;
}

/// "rename the Add button to Save", "change the Paid button to Received": a direct edit when the label occurs exactly once
/// (in `button "..."` or `form t, "..."`), or when it names the default Add button of the one form that has no label.
/// Anything ambiguous (two buttons with that label, no such button) goes to the model. Returns null when not of this shape.
DirectEdit? buttonRenameEdit(String request, String source) {
  final m = RegExp(r'^\s*(?:please\s+|can you\s+|could you\s+)?(?:rename|change|call|make|relabel|set)\s+(?:the\s+)?"?(.+?)"?\s+button\s+(?:to|as|say|read|into)\s+"?([^"]+?)"?\s*[.!]?\s*$', caseSensitive: false).firstMatch(request);
  if (m == null) return null;
  final target = m.group(1)!.trim().toLowerCase();
  final next = m.group(2)!.trim();
  if (target.isEmpty || next.isEmpty || next.length > 30 || next.contains('"')) return null;
  final lines = source.split('\n');
  final hits = <(int, RegExpMatch)>[];
  for (var i = 0; i < lines.length; i++) {
    final t = lines[i].trim();
    final bm = RegExp(r'^(button\s+)"([^"]*)"').firstMatch(t) ?? RegExp(r'^((?:form|topbar)\s+\w+\s*,\s*)"([^"]*)"').firstMatch(t);
    if (bm != null && bm.group(2)!.trim().toLowerCase() == target) hits.add((i, bm));
  }
  if (hits.length == 1) {
    final (i, bm) = hits.first;
    if (bm.group(2) == next) return DirectEdit(source, 'the button already says $next', unchanged: true);
    lines[i] = lines[i].replaceFirst('${bm.group(1)}"${bm.group(2)}"', '${bm.group(1)}"$next"');
    return DirectEdit(lines.join('\n'), 'the button now says $next');
  }
  if (hits.isNotEmpty) return null; // the label is on more than one button: which one?
  // the default Add button of the only form that has no label of its own
  final bare = <int>[for (var i = 0; i < lines.length; i++) if (RegExp(r'^(form|topbar)\s+\w+\s*$').hasMatch(lines[i].trim())) i];
  if (bare.length == 1 && (target == 'add' || RegExp(r'^add\s+\w+$').hasMatch(target))) {
    lines[bare.first] = '${lines[bare.first].trimRight()}, "$next"';
    return DirectEdit(lines.join('\n'), 'the button now says $next');
  }
  return null;
}

/// Something Molde cannot do because its apps work offline, inside the app: said plainly, with why and what it can do instead.
class CapabilityGap {
  CapabilityGap(this.reply, this.suggestion, this.offer);
  final String reply, suggestion, offer;
}

CapabilityGap? capabilityGap(String request) {
  final low = request.toLowerCase();
  const offline = 'Molde apps work offline and stay inside Molde on this phone, so';
  if (RegExp(r'\b(whatsapp|whats app|sms|text message|email|e-mail|telegram|messenger|instagram dm)\b').hasMatch(low) && RegExp(r'\b(send|message|notify|alert|remind|mail)\b').hasMatch(low) ||
      RegExp(r'\bsend (me|us|him|her|them) (a|an|the)\b').hasMatch(low) || RegExp(r'\b(push )?notifications?\b').hasMatch(low)) {
    return CapabilityGap("Molde can't send messages or notifications (WhatsApp, SMS, email). $offline nothing can leave the phone.\n\nWhat I can do instead: a reminder list inside the app that you open each day.", 'daily reminders list', 'Make a reminder list');
  }
  if (RegExp(r'\b(weather|news|exchange rate|live price|stock price|real.?time|sync|cloud|upload|website|google|internet|online|api)\b').hasMatch(low) && RegExp(r'\b(show|get|fetch|pull|load|sync|upload|download|connect|real.?time|from the internet)\b').hasMatch(low)) {
    return CapabilityGap("Molde can't get information from the internet (weather, news, live prices) or sync to the cloud. $offline there is no connection to use.\n\nWhat I can do instead: an app where you type those numbers in yourself, with totals and charts.", request.replaceAll(RegExp(r'\b(live|online|from the internet|real.?time|sync(ed)? to the cloud)\b', caseSensitive: false), '').trim(), 'Make the offline version');
  }
  if (RegExp(r'\b(gps|map|maps|location|navigate|directions|nearby)\b').hasMatch(low)) {
    return CapabilityGap("Molde can't use your location or show maps. $offline it cannot see where you are.\n\nWhat I can do instead: a list of places you type in, with notes.", 'list of places with notes', 'Make a places list');
  }
  if (RegExp(r'\b(login|log in|sign in|sign up|password|bank account|online payment|pay online|jazzcash|easypaisa|credit card)\b').hasMatch(low)) {
    return CapabilityGap("Molde can't log in to accounts or take payments. $offline it has no accounts to connect to.\n\nWhat I can do instead: a record of what you owe or have paid that you type in yourself.", 'record of money owed and paid', 'Make a payment record');
  }
  if (RegExp(r'\b(camera|scan|barcode|qr code|take a photo|microphone|voice note|speech|chatbot)\b').hasMatch(low)) {
    return CapabilityGap("Molde can't use the camera or microphone, or scan codes. $offline it has no way to read them.\n\nWhat I can do instead: a list where you type the details in.", 'list of items with details', 'Make a typed list');
  }
  return null;
}

final RegExp kRemovalWords = RegExp(r'\b(remove|delete|drop|hide|without|get rid)\b', caseSensitive: false);

List<String> programLines(String src) => src.split('\n').map((l) => l.trimRight()).where((l) => l.trim().isNotEmpty).toList();

/// Lines of the old program that are gone from the new one. Indentation does not count (wrapping lines in a section only
/// re-indents them), and a line edited in place (the same first two words, new details: a field added to a table line, a
/// button renamed) is an edit, not a removal. A repeated line counts each time.
List<String> removedLines(String oldSrc, String newSrc) {
  final have = <String, int>{};
  for (final l in programLines(newSrc)) { final k = l.trim(); have[k] = (have[k] ?? 0) + 1; }
  final gone = <String>[];
  for (final l in programLines(oldSrc)) {
    final k = l.trim();
    final n = have[k] ?? 0;
    if (n > 0) { have[k] = n - 1; } else { gone.add(l); }
  }
  // new lines that no old line matched: what the edits wrote
  final oldHave = <String, int>{};
  for (final l in programLines(oldSrc)) { final k = l.trim(); oldHave[k] = (oldHave[k] ?? 0) + 1; }
  final addedSigs = <String, int>{};
  for (final l in programLines(newSrc)) {
    final k = l.trim();
    final n = oldHave[k] ?? 0;
    if (n > 0) { oldHave[k] = n - 1; } else { final sg = lineSignature(k); addedSigs[sg] = (addedSigs[sg] ?? 0) + 1; }
  }
  final out = <String>[];
  for (final l in gone) {
    final sg = lineSignature(l);
    final n = addedSigs[sg] ?? 0;
    if (n > 0) { addedSigs[sg] = n - 1; } else { out.add(l); }
  }
  return out;
}

/// How many lines an edit may drop without the request saying "remove": a fifth of the program, but never fewer than two
/// (a one-line edit of a four-line app is 25% and still fine).
double removalLimit(int total) => total * 0.2 > 2 ? total * 0.2 : 2;

/// The line of the program that fits the request best (for "This app already does that").
String? relevantLine(String request, String source) {
  final rw = wordsOf(request).where((w) => !kFiller.contains(w) && w.length > 2).toSet();
  String? best; var score = 0;
  for (final l in programLines(source)) {
    final n = wordsOf(l).where(rw.contains).length;
    if (n > score) { score = n; best = l.trim(); }
  }
  return best;
}


// ---------------- deterministic edits of the app line ----------------

const List<String> kAccents = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey'];
const List<String> kOldThemes = ['ocean', 'mint', 'slate', 'ink', 'plum'];
const List<String> kSizes = ['small', 'large', 'huge'];

class AppLine {
  AppLine(this.name, this.icon, this.theme, this.mode, this.size);
  String name; // with the quotes
  String? icon, theme, mode, size;
  String get title => name.length >= 2 ? name.substring(1, name.length - 1) : name;
  @override
  String toString() => 'app $name${icon != null ? ' $icon' : ''}${theme != null ? ' $theme' : ''}${mode != null ? ' $mode' : ''}${size != null ? ' $size' : ''}';

  static AppLine? parse(String source) {
    final first = source.split('\n').firstWhere((l) => l.startsWith('app '), orElse: () => '');
    final m = RegExp(r'^app\s+("[^"]*")((?:\s+\w+)*)\s*$').firstMatch(first);
    if (m == null) return null;
    String? icon, theme, mode, size;
    for (final t in m.group(2)!.trim().split(RegExp(r'\s+')).where((t) => t.isNotEmpty)) {
      if (kAccents.contains(t) || kOldThemes.contains(t)) { theme = t; }
      else if (t == 'dark' || t == 'light') { mode = t; }
      else if (kSizes.contains(t)) { size = t; }
      else { icon = t; }
    }
    return AppLine(m.group(1)!, icon, theme, mode, size);
  }
}

class DirectEdit {
  DirectEdit(this.program, this.label, {this.unchanged = false});
  final String program, label;
  final bool unchanged; // the app already is like that
}

String _replaceAppLine(String source, AppLine a) {
  final lines = source.split('\n');
  final i = lines.indexWhere((l) => l.startsWith('app '));
  lines[i] = a.toString();
  return lines.join('\n');
}

/// Colour words, dark/light, bigger/smaller text and renaming the title are exact edits of line 1: no model, instant.
/// Returns null for anything else (that goes to the model).
DirectEdit? appLineEdit(String request, String source) {
  final r = request.trim();
  if (r.isEmpty) return null;
  final a = AppLine.parse(source);
  if (a == null) return null;
  final low = r.toLowerCase();
  final w = wordsOf(low);
  // rename: "change the title to My Spending", "rename it to X", "call it X"
  final rn = RegExp(r'^(?:please\s+|can you\s+|could you\s+|i want to\s+|i want you to\s+|let\x27s\s+)?(?:(?:change|set|make|update)\s+(?:the\s+|my\s+)?(?:title|name)(?:\s+of\s+(?:the\s+|this\s+|my\s+)?app)?\s+(?:to|as)|rename\s+(?:the\s+app\s+|this\s+app\s+|my\s+app\s+|this\s+|it\s+|the\s+title\s+)?(?:to|as)?|(?:call|name)\s+(?:it|this(?:\s+app)?|the\s+app|my\s+app))\s+(.+?)\s*$', caseSensitive: false).firstMatch(r);
  if (rn != null) {
    var t = rn.group(1)!.replaceAll('"', '').replaceAll(RegExp(r'[.!]+$'), '').trim();
    if (t.isEmpty || t.length > 40) return null;
    final same = t == a.title;
    a.name = '"$t"';
    return DirectEdit(_replaceAppLine(source, a), 'title is now $t', unchanged: same);
  }
  if (w.length > 8) return null;
  const verbs = {'i', 'want', 'need', 'like', 'would', 'can', 'could', 'you', 'should', 'be', 'is', 'more', 'on', 'off', 'looks', 'look', 'prefer', 'instead', 'now', 'lets', 'let', 's', 'with', 'switch', 'enable', 'activate', 'colours', 'colors', 'themes', 'rather', 'make', 'change', 'set', 'turn', 'use', 'paint', 'go', 'put', 'give', 'me', 'it', 'the', 'app', 'this', 'to', 'in', 'colour', 'color', 'theme', 'please', 'a', 'mode', 'text', 'font', 'screen', 'much', 'bit', 'little', 'size', 'bigger', 'larger', 'smaller', 'everything', 'my'};
  // colour
  final colour = [...kAccents, ...kOldThemes].where(w.contains).toList();
  if (colour.length == 1 && w.every((x) => verbs.contains(x) || colour.contains(x) || x == 'dark' || x == 'light')) {
    final c = colour.first;
    final same = a.theme == c;
    a.theme = c;
    return DirectEdit(_replaceAppLine(source, a), c, unchanged: same);
  }
  // dark / light
  final off = w.contains('off') || w.contains('disable');
  final wantsDark = (w.contains('dark') || w.contains('night')) && !off;
  final wantsLight = w.contains('light') && (w.contains('mode') || w.contains('theme')) && !off || w.contains('bright') || ((w.contains('dark') || w.contains('night')) && off);
  if ((wantsDark ^ wantsLight) && w.every((x) => verbs.contains(x) || {'dark', 'night', 'light', 'bright', 'mode', 'theme', 'off', 'disable'}.contains(x))) {
    final m = wantsDark ? 'dark' : 'light';
    final same = a.mode == m;
    a.mode = m;
    a.theme ??= 'mint'; // the mode needs a theme word before it
    return DirectEdit(_replaceAppLine(source, a), '$m mode', unchanged: same);
  }
  // text size
  final bigger = w.contains('bigger') || w.contains('larger') || w.contains('increase');
  final smaller = w.contains('smaller') || w.contains('decrease');
  if ((bigger ^ smaller) && w.every((x) => verbs.contains(x) || {'bigger', 'larger', 'smaller', 'increase', 'decrease', 'text', 'font', 'size', 'words', 'letters', 'writing'}.contains(x))) {
    // small < (phone size) < large < huge
    final order = ['small', 'normal', 'large', 'huge'];
    final cur = order.indexOf(a.size ?? 'normal');
    final next = (cur + (bigger ? 1 : -1)).clamp(0, 3);
    final same = next == cur;
    final s = order[next];
    a.size = s == 'normal' ? null : s;
    return DirectEdit(_replaceAppLine(source, a), bigger ? 'bigger text' : 'smaller text', unchanged: same);
  }
  return null;
}

// ---------------- did the change do what was asked? ----------------

/// The parts of a request we can check against the new program. Returns what was asked but is not there.
List<String> unmetClaims(String request, String oldSrc, String newSrc) {
  final out = <String>[];
  final low = request.toLowerCase();
  final w = wordsOf(low);
  final na = AppLine.parse(newSrc);
  // colour / theme word
  final colour = [...kAccents, ...kOldThemes].where(w.contains).toList();
  if (colour.length == 1 && RegExp(r'\b(make|change|set|turn|theme|colou?r)\b').hasMatch(low) && na != null && na.theme != colour.first) out.add('the ${colour.first} theme');
  if ((w.contains('dark') || w.contains('night')) && RegExp(r'\b(mode|theme|make|turn)\b').hasMatch(low) && na != null && na.mode != 'dark') out.add('dark mode');
  if (RegExp(r'\blight (mode|theme)\b').hasMatch(low) && na != null && na.mode != 'light') out.add('light mode');
  // title
  final rn = RegExp(r'(?:title|name|rename|call it)\b.*?(?:to|as)?\s+"?([A-Za-z0-9][^"]*?)"?\s*$', caseSensitive: false).firstMatch(request);
  if (rn != null && RegExp(r'\b(title|rename|call it)\b').hasMatch(low) && !RegExp(r'\b(button|field|column|tab|section|label|option|chart|header)\b').hasMatch(low) && na != null && na.title.toLowerCase() != rn.group(1)!.trim().toLowerCase()) out.add('the new title');
  // fields, buttons and charts are checked from the diff of the two programs (summary.dart: unmetFromDiff)
  return out;
}

// ---------------- titles and wording ----------------

/// A title that is a question or a sentence is replaced by the request's main noun.
String? betterTitle(String program, String request) {
  final a = AppLine.parse(program);
  if (a == null) return null;
  final t = a.title.trim();
  final bad = t.contains('?') || t.endsWith('.') || t.split(RegExp(r'\s+')).length > 5 || t.isEmpty;
  if (!bad) return null;
  final nouns = wordsOf(request).where((x) => !kFiller.contains(x) && !{'tracker', 'list', 'log'}.contains(x) || (x == 'tracker' || x == 'list' || x == 'log')).toList();
  final main = wordsOf(request).where((x) => !kFiller.contains(x)).toList();
  final pick = (main.isNotEmpty ? main : nouns).take(2).toList();
  if (pick.isEmpty) return null;
  final title = pick.join(' ');
  return title[0].toUpperCase() + title.substring(1);
}

String withTitle(String program, String title) {
  final a = AppLine.parse(program);
  if (a == null) return program;
  a.name = '"${title.replaceAll('"', '')}"';
  final lines = program.split('\n');
  final i = lines.indexWhere((l) => l.startsWith('app '));
  lines[i] = a.toString();
  return lines.join('\n');
}

/// One plain sentence about a new app, from its program (no model, no jargon).
String plainSummary(String source) {
  final a = AppLine.parse(source);
  final tables = <String, List<String>>{};
  for (final l in source.split('\n')) {
    final m = RegExp(r'^table\s+(\w+)\s+(.*)$').firstMatch(l.trim());
    if (m == null) continue;
    final fields = m.group(2)!.split(',').map((p) => p.trim().split(RegExp(r'\s+')).first).where((f) => f.isNotEmpty && f != 'at').map((f) => f.replaceAll('_', ' ')).toList();
    tables[m.group(1)!.replaceAll('_', ' ')] = fields;
  }
  final parts = <String>[];
  if (tables.isNotEmpty) {
    final e = tables.entries.first;
    final f = e.value.take(3).toList();
    parts.add('add ${e.key} entries${f.isEmpty ? '' : ' with ${f.length == 1 ? f.first : '${f.sublist(0, f.length - 1).join(', ')} and ${f.last}'}'}');
  }
  final lines = source.split('\n').map((l) => l.trim()).toList();
  final shows = <String>[];
  if (lines.any((l) => RegExp(r'\b(sum|count|avg)\(').hasMatch(l))) shows.add('your totals');
  if (lines.any((l) => RegExp(r'^(bars|trend|daybars|plot|heat)\b').hasMatch(l))) shows.add('a chart');
  if (lines.any((l) => l.startsWith('each ') || l.startsWith('list '))) shows.add('a list of what you added');
  if (shows.isNotEmpty) parts.add('see ${shows.length == 1 ? shows.first : '${shows.sublist(0, shows.length - 1).join(', ')} and ${shows.last}'}');
  return 'Made ${a?.title ?? 'your app'}${parts.isEmpty ? '.' : ': ${parts.join(', ')}.'}';
}

/// "Reading your request… (12 s)" before the first line, then "Writing line 5… (31 s)". `lines` is the number of lines
/// already written (-1 before the first one).
String progressText(String note, int lines, int seconds) =>
    lines < 0 ? '${note}Reading your request… ($seconds s)' : '${note}Writing line ${lines + 1}… ($seconds s)';

/// The progress line of an edit that the model writes in one go (format ops): what the model is doing now, from the native side.
/// Before the first reading it says what the plain line says. "Reading your app: 40% (35 s)", then "Writing the change… (52 s)".
String opsProgressText(String note, String phase, int done, int total, int seconds) {
  if (phase == 'prompt' && total > 0) return '${note}Reading your app: ${(done * 100 ~/ total).clamp(0, 100)}% ($seconds s)';
  if (phase == 'gen') return '${note}Writing the change… ($seconds s)';
  return '${note}Reading your request… ($seconds s)';
}

/// How long ago, in words. A time in the future (a device clock that moved back) reads "just now".
String ageText(int thenMs, int nowMs) {
  final d = Duration(milliseconds: nowMs - thenMs);
  if (d.inMinutes < 1) return 'just now';
  if (d.inHours < 1) return '${d.inMinutes} min ago';
  if (d.inDays < 1) return '${d.inHours} h ago';
  return '${d.inDays} d ago';
}

// ---------------- removals nobody asked for ----------------

/// The first two tokens of a line: what the line is ("table drink", "button \"1\"", "each drink"), not its details.
String lineSignature(String l) {
  final line = l.trim();
  if (line.startsWith('"')) { // a text line: what it is is the style words after the quoted text ("head", "faint")
    final end = line.indexOf('"', 1);
    final rest = end < 0 ? '' : line.substring(end + 1).trim();
    return 'text ${rest.split(RegExp(r'\s+')).first}';
  }
  return line.split(RegExp(r'\s+')).take(2).join(' ');
}

/// What a noun in a request means in program lines: "chart" is a daybars, trend, heat or plot line, "totals" a stat line.
/// Without this, "remove the chart" shares no word with the line `daybars ...` and the removal looks unasked.
const Map<String, Set<String>> kNounKinds = {
  'chart': {'daybars', 'bars', 'trend', 'heat', 'pie', 'share', 'goalbars', 'daygrid', 'weekdots', 'plot', 'tick', 'axes'},
  'graph': {'daybars', 'bars', 'trend', 'heat', 'pie', 'share', 'goalbars', 'daygrid', 'weekdots', 'plot', 'tick', 'axes'},
  'plot': {'plot', 'tick', 'axes'},
  'trend': {'trend'},
  'heatmap': {'heat'},
  'total': {'stat', 'statcard', 'goal', 'sum'},
  'totals': {'stat', 'statcard', 'goal', 'sum'},
  'numbers': {'stat', 'statcard', 'goal', 'sum'},
  'stats': {'stat', 'statcard', 'goal'},
  'stat': {'stat', 'statcard', 'goal'},
  'summary': {'stat', 'statcard', 'goal', 'sum'},
  'list': {'list', 'each'},
  'history': {'list', 'each'},
  'entries': {'list', 'each'},
  'records': {'list', 'each'},
  'form': {'form', 'topbar', 'quick', 'button', 'field'},
  'buttons': {'quick', 'button'},
  'section': {'section'},
  'sections': {'section'},
};

int _indent(String l) => l.length - l.trimLeft().length;

/// Old lines that are gone from the new program (no line of the new program is "the same line, edited") and that the
/// request does not mention. A line edited in place keeps its signature, so adding or removing a field is not a removal
/// of its table line. A removed block (a line and the more indented lines under it) counts as asked when any line of it is
/// named, and the nouns of the request map to line kinds (kNounKinds). Used to show "This would also remove: ...".
Set<String> _askedWords(String request) {
  final asked = wordsOf(request).where((w) => !kFiller.contains(w) && w.length > 2).toSet();
  for (final w in [...asked]) { asked.addAll(kNounKinds[w] ?? const <String>{}); }
  return asked;
}

/// Lines the model rewrote in place (same first two words, new text) that the request does not name: a filter dropped from a
/// loop, a formula or a chart line changed. Table, setting, form and app lines are left out: adding a field or renaming a
/// button rewrites those on purpose. The guard shows them ("This would also change") instead of calling the edit safe.
List<String> rewrittenUnasked(String request, String oldSrc, String newSrc) {
  const own = {'app', 'table', 'setting', 'state', 'form', 'quick', 'topbar', 'goal', 'text'}; // text = a label or heading: cosmetic
  final asked = _askedWords(request);
  final newLines = programLines(newSrc).map((l) => l.trim()).toList();
  final haveNew = <String, int>{};
  for (final l in newLines) { haveNew[l] = (haveNew[l] ?? 0) + 1; }
  final oldLines = programLines(oldSrc).map((l) => l.trim()).toList();
  final haveOld = <String, int>{};
  for (final l in oldLines) { haveOld[l] = (haveOld[l] ?? 0) + 1; }
  final addedBySig = <String, int>{};
  for (final l in newLines) {
    final n = haveOld[l] ?? 0;
    if (n > 0) { haveOld[l] = n - 1; } else { final sg = lineSignature(l); addedBySig[sg] = (addedBySig[sg] ?? 0) + 1; }
  }
  final out = <String>[];
  for (final l in oldLines) {
    final n = haveNew[l] ?? 0;
    if (n > 0) { haveNew[l] = n - 1; continue; }
    final sg = lineSignature(l);
    if (own.contains(sg.split(' ').first) || (addedBySig[sg] ?? 0) == 0) continue; // gone with no twin is a removal (dropsUnasked), not a rewrite
    addedBySig[sg] = addedBySig[sg]! - 1;
    if (wordsOf(l).any(asked.contains)) continue;
    out.add(l);
  }
  return out;
}

/// The data rules' own sentences are the language's syntax ("Write ... was aisle"). The user gets plain English only.
String plainRefusal(List<String> reasons) {
  String nice(String x) { final t = x.replaceAll('_', ' ').trim(); return t.isEmpty ? t : t[0].toUpperCase() + t.substring(1); }
  for (final r in reasons) {
    final f = RegExp(r'(\w+)\.(\w+) disappears and \w+\.(\w+) of the same type appears').firstMatch(r);
    if (f != null) return 'It looks like you renamed the field ${nice(f.group(2)!)} to ${nice(f.group(3)!)}, and the values already entered under ${nice(f.group(2)!)} would be lost. If you want a new field, ask me to add it and keep ${nice(f.group(2)!)}.';
    final t = RegExp(r'table (\w+) disappears and table (\w+) with the same fields appears').firstMatch(r);
    if (t != null) return 'It looks like you renamed ${nice(t.group(1)!)} to ${nice(t.group(2)!)}, and what you entered in ${nice(t.group(1)!)} would be lost.';
    if (r.contains('does not check')) return 'the new version did not pass my checks.';
  }
  return 'something you entered would not fit the new version of the app.';
}

/// Which old lines (by index) have no counterpart in the new program: a line diff on the trimmed text, so a line that appears
/// twice (a second `each student` list) is gone when only one of the two is left, and the removed one is the one that moved or went.
List<int> _unmatchedOld(List<String> old, List<String> neu) {
  final a = [for (final l in old) l.trim()], b = [for (final l in neu) l.trim()];
  final t = List.generate(a.length + 1, (_) => List<int>.filled(b.length + 1, 0));
  for (var i = a.length - 1; i >= 0; i--) {
    for (var j = b.length - 1; j >= 0; j--) { t[i][j] = a[i] == b[j] ? t[i + 1][j + 1] + 1 : (t[i + 1][j] >= t[i][j + 1] ? t[i + 1][j] : t[i][j + 1]); }
  }
  final gone = <int>[];
  var i = 0, j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] == b[j]) { i++; j++; } else if (j < b.length && t[i][j + 1] > t[i + 1][j]) { j++; } else { gone.add(i); i++; }
  }
  return gone;
}

List<String> dropsUnasked(String request, String oldSrc, String newSrc) {
  final newList = programLines(newSrc);
  final asked = _askedWords(request);
  final old = programLines(oldSrc);
  // a line edited in place keeps its signature: it is spent against one new line that no old line matched (not against any line that has it)
  final gone = _unmatchedOld(old, newList).toSet();
  final spent = <String, int>{};
  for (final k in _unmatchedOld(newList, old)) { final sg = lineSignature(newList[k]); spent[sg] = (spent[sg] ?? 0) + 1; }
  final removed = <int>[];
  for (var i = 0; i < old.length; i++) {
    if (!gone.contains(i) || old[i].startsWith('app ')) continue;
    final sg = lineSignature(old[i]);
    if ((spent[sg] ?? 0) > 0) { spent[sg] = spent[sg]! - 1; continue; }
    removed.add(i);
  }
  final isRemoved = removed.toSet();
  final covered = <int>{};
  for (final i in removed) {
    // the block: this line and the removed lines right after it that sit deeper
    final block = <int>[i];
    for (var j = i + 1; j < old.length && isRemoved.contains(j) && _indent(old[j]) > _indent(old[i]); j++) { block.add(j); }
    if (block.any((j) => wordsOf(old[j]).any(asked.contains))) covered.addAll(block);
  }
  return [for (final i in removed) if (!covered.contains(i)) old[i].trim()];
}
