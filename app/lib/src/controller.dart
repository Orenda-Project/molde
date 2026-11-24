import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'bridge.dart';
import 'llm.dart';
import 'store.dart';

const String kVersion = '0.3.0';

class ChatBtn {
  ChatBtn(this.label, this.onTap, {this.primary = false});
  final String label;
  final Future<void> Function() onTap;
  final bool primary;
}

class PendingAsk {
  PendingAsk(this.kind, this.request, this.question, this.options);
  final String kind, request, question;
  final List<String> options;
}

/// Words that do not name a thing (generic, no app vocabulary).
const Set<String> kFiller = {'a', 'an', 'the', 'my', 'me', 'make', 'build', 'create', 'new', 'app', 'apps', 'please', 'simple', 'some', 'for', 'of', 'and', 'with', 'to', 'i', 'want', 'need', 'can', 'you', 'do', 'it', 'this', 'that', 'something', 'anything', 'stuff', 'thing', 'things', 'tool', 'give', 'get', 'help', 'is', 'be', 'have', 'like', 'just', 'one', 'on', 'in', 'up'};

List<String> _words(String t) => RegExp(r'[a-z0-9]+').allMatches(t.toLowerCase()).map((m) => m.group(0)!).toList();

/// A request of 1 to 3 words that names a thing builds at once (the model may not ask about it).
bool namesAThing(String request) {
  final w = _words(request);
  return w.isNotEmpty && w.length <= 3 && w.any((x) => !kFiller.contains(x));
}

/// Names the current app uses: its title and the words of its table, field, setting and state lines.
Set<String> appNames(String source) {
  final out = <String>{};
  final title = RegExp(r'^app "([^"]*)"', multiLine: true).firstMatch(source)?.group(1);
  if (title != null) out.addAll(_words(title));
  for (final l in source.split('\n')) {
    final t = l.trim();
    if (RegExp(r'^(table|setting|state|let)\b').hasMatch(t)) out.addAll(_words(t.split('"').first));
  }
  const skip = {'table', 'setting', 'state', 'let', 'num', 'text', 'date', 'time', 'bool', 'pick', 'money', 'long', 'unit', 'ref', 'set', 'when', 'dur', 'image', 'the', 'and'};
  return out.where((w) => w.length >= 3 && !skip.contains(w)).toSet();
}

/// "a habit tracker", "make me a budget app", "build a timer": reads like a new app and names nothing of the current one.
bool looksLikeNewApp(String request, String currentSource) {
  final r = request.trim().toLowerCase();
  final start = RegExp(r'^(please\s+)?(a|an|make me|make|build|create|i want|i need|give me|new|another)\b');
  final kind = RegExp(r'\b(app|tracker|list|log|counter|timer|planner|diary|journal|calculator|scoreboard|checklist|notebook)\b');
  if (!start.hasMatch(r) || !kind.hasMatch(r)) return false;
  final names = appNames(currentSource);
  return !_words(r).any(names.contains);
}

final RegExp kRemovalWords = RegExp(r'\b(remove|delete|drop|hide|without|get rid)\b', caseSensitive: false);

List<String> programLines(String src) => src.split('\n').map((l) => l.trimRight()).where((l) => l.trim().isNotEmpty).toList();

/// Lines of the old program that are missing from the new one (counted, so a repeated line counts each time).
List<String> removedLines(String oldSrc, String newSrc) {
  final have = <String, int>{};
  for (final l in programLines(newSrc)) { have[l] = (have[l] ?? 0) + 1; }
  final out = <String>[];
  for (final l in programLines(oldSrc)) {
    final n = have[l] ?? 0;
    if (n > 0) { have[l] = n - 1; } else { out.add(l); }
  }
  return out;
}

/// The line of the program that fits the request best (for "This app already does that").
String? relevantLine(String request, String source) {
  final rw = _words(request).where((w) => !kFiller.contains(w) && w.length > 2).toSet();
  String? best; var score = 0;
  for (final l in programLines(source)) {
    final n = _words(l).where(rw.contains).length;
    if (n > score) { score = n; best = l.trim(); }
  }
  return best;
}

/// One bubble in the chat sheet.
class ChatMsg {
  ChatMsg(this.who, this.text, {this.code, this.buttons = const [], this.kind = 'text'});
  final String who; // you | bot
  String text;
  String? code; // monospace block (live program while writing)
  List<ChatBtn> buttons;
  String kind; // text | change | progress
  bool undone = false;
  bool live = false;
}

/// All app logic outside the widgets: which apps exist, the create / change / undo flows, the model, the developer menu actions.
class MoldeController extends ChangeNotifier {
  MoldeController({required this.store, required this.bridge, required this.llm, required this.modelDirs, required this.readAsset, this.backupDir, this.listAssets});
  final AppStore store;
  final WebBridge bridge;
  final LlmService llm;
  final List<Directory> modelDirs;
  final Future<String> Function(String path) readAsset;
  final Future<List<String>> Function()? listAssets;
  final Directory? backupDir;

  List<AppRecord> apps = [];
  AppRecord? current;
  final Map<String, List<ChatMsg>> chats = {};
  bool busy = false;
  bool newAppMode = false;
  PendingAsk? pendingAsk;
  String get modelStatus {
    final m = llm.model;
    if (m != null) return 'Model ready: ${m.path.split('/').last} (${(m.sizeBytes / 1048576).round()} MB, loaded in ${m.loadSeconds.toStringAsFixed(1)} s)';
    return llm.loadError ?? 'Loading the model…';
  }
  Map<String, dynamic>? lastStats;
  String? lastStatsRequest;
  String arm = 'E';
  bool booted = false;
  Future<void> _saves = Future.value();

  List<ChatMsg> get chat => chats.putIfAbsent(current?.id ?? '', () => []);

  void _say(String who, String text, {String? code, List<ChatBtn> buttons = const [], String kind = 'text'}) {
    chat.add(ChatMsg(who, text, code: code, buttons: buttons, kind: kind));
    notifyListeners();
  }

  // ---------- start ----------
  Future<void> init() async {
    bridge.onSnapshot = _onSnapshot;
    bridge.nativeHandler = _native;
    bridge.onProgress = (p) {
      final m = _liveMsg;
      if (m != null) {
        m.text = 'Writing the app… ${p['lines']} lines';
        m.code = '${p['program']}';
        notifyListeners();
      }
    };
    try {
      final j = await AppStore.readValid(File('${store.root.path}/last_stats.json'));
      if (j is Map && j['stats'] is Map) { lastStats = Map<String, dynamic>.from(j['stats'] as Map); lastStatsRequest = '${j['request']}'; }
    } catch (_) {}
    apps = await store.list();
    final id = await store.currentId();
    final r = apps.where((a) => a.id == id).isNotEmpty ? apps.firstWhere((a) => a.id == id) : (apps.isNotEmpty ? apps.first : null);
    booted = true;
    notifyListeners();
    if (r != null) await openApp(r, remember: false);
    unawaited(loadModel());
  }

  Future<void> loadModel() async {
    notifyListeners();
    String? err;
    try {
      err = await llm.ensureLoaded(modelDirs);
    } catch (e) {
      err = 'The model could not be loaded: $e';
    }
    final m = llm.model;
    if (err == null && m == null) llm.loadError = 'No model';
    notifyListeners();
  }

  // ---------- storage hooks ----------
  void _onSnapshot(Map<String, dynamic> p) {
    final r = apps.where((a) => a.id == p['id']).firstOrNull;
    if (r == null) return;
    r.source = '${p['source']}';
    r.name = nameOf(r.source) ?? r.name;
    r.snapshot = p['snapshot'] is Map ? Map<String, dynamic>.from(p['snapshot'] as Map) : r.snapshot;
    r.undo = p['undo'] is List ? List<dynamic>.from(p['undo'] as List) : r.undo;
    _saves = _saves.then((_) => store.save(r)).catchError((Object e) { debugPrint('save failed: $e'); });
    notifyListeners();
  }

  Future<void> settleSaves() async { await _saves; }

  static String? nameOf(String src) {
    final m = RegExp(r'^app "([^"]*)"', multiLine: true).firstMatch(src);
    return m?.group(1);
  }

  // ---------- apps ----------
  Future<void> openApp(AppRecord r, {bool remember = true, bool keepMode = false}) async {
    pendingAsk = null;
    if (current != null && current!.id != r.id) {
      try { await bridge.rpc('flush'); } catch (_) {}
      await settleSaves();
    }
    current = r;
    if (!keepMode) newAppMode = false;
    if (remember) await store.setCurrent(r.id);
    notifyListeners();
    final res = await bridge.rpc<Map>('open', {'id': r.id, 'source': r.source, 'snapshot': r.snapshot, 'undo': r.undo, 'nowMs': DateTime.now().millisecondsSinceEpoch, if (r.snapshot == null && r.sample && r.exampleId != null) 'seed': r.exampleId});
    if (res['ok'] != true) {
      _say('bot', 'This app could not be opened: ${(res['errors'] as List?)?.join('; ') ?? 'unknown error'}. Its data was not touched.');
    }
  }

  Future<AppRecord> _newRecord(String source, String kind, {String? request, String? summary}) async {
    final id = 'a${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
    final r = AppRecord(id: id, name: nameOf(source) ?? 'App', source: source)..log(kind, request: request, summary: summary);
    apps.insert(0, r);
    await store.save(r);
    return r;
  }

  Future<void> deleteApp(AppRecord r) async {
    final wasCurrent = current?.id == r.id;
    apps.removeWhere((a) => a.id == r.id);
    chats.remove(r.id);
    await settleSaves();
    await store.delete(r.id);
    if (wasCurrent) {
      current = null;
      await bridge.rpc('close');
      await store.setCurrent(null);
      if (apps.isNotEmpty) {
        await openApp(apps.first);
      } else {
        notifyListeners();
      }
    }
    notifyListeners();
  }

  Future<void> loadExample(String file) async {
    final src = await readAsset('assets/examples/$file');
    final r = await _newRecord(src, 'example', summary: file);
    r.sample = true;
    r.exampleId = file.replaceAll('.mo', '');
    await store.save(r);
    await openApp(r);
    _say('bot', 'Opened the example "${r.name}" with sample data (no model used). Tap "Sample data · Clear" to start empty.');
  }

  /// Drops the sample data of the open example app: the same program, with no rows.
  Future<void> clearSample() async {
    final r = current;
    if (r == null || !r.sample) return;
    await bridge.rpc('flush');
    await settleSaves();
    r.snapshot = null; r.undo = []; r.sample = false;
    await store.save(r);
    await bridge.rpc<Map>('open', {'id': r.id, 'source': r.source, 'nowMs': DateTime.now().millisecondsSinceEpoch});
    notifyListeners();
  }

  void startNewApp() { newAppMode = true; pendingAsk = null; notifyListeners(); }
  void changeCurrent() { newAppMode = false; pendingAsk = null; notifyListeners(); }

  /// The mode shown in the sheet header.
  String get modeLabel => (current == null || newAppMode) ? 'New app' : 'Changing ${current!.name}';

  // ---------- the model ----------
  Future<Object?> _native(String method, Map<String, dynamic> args) async {
    if (method == 'cancel') { await llm.cancel(); return {'ok': true}; }
    if (method == 'complete') return llm.complete(args);
    return {'stop': 'error', 'text': '', 'error': 'unknown model call $method'};
  }

  ChatMsg? _liveMsg;

  Future<void> cancel() async {
    if (!busy) return;
    try { await bridge.rpc('cancel'); } catch (_) {}
  }

  /// A typed message: the answer to an open question, a request for a new app, or a change to the current one.
  Future<void> send(String request) async {
    request = request.trim();
    if (request.isEmpty || busy) return;
    if (pendingAsk != null) { await answerAsk(request); return; }
    final kind = (current == null || newAppMode) ? 'create' : 'edit';
    _say('you', request);
    if (kind == 'edit' && looksLikeNewApp(request, current!.source)) {
      final name = current!.name;
      _say('bot', 'That sounds like a new app. Do you want a new app, or a change to $name?', buttons: [
        ChatBtn('New app', () async { startNewApp(); await _run('create', request); }, primary: true),
        ChatBtn('Change $name', () async { changeCurrent(); await _run('edit', request); }),
      ]);
      return;
    }
    await _run(kind, request);
  }

  /// Answers the open question (a tapped option or typed text); the next prompt carries Question and Answer.
  Future<void> answerAsk(String answer) async {
    final p = pendingAsk;
    if (p == null || busy) return;
    pendingAsk = null;
    _say('you', answer);
    await _run(p.kind, p.request, ask: {'question': p.question, 'answer': answer}, allowAsk: false);
  }

  Future<void> _run(String kind, String request, {Map<String, String>? ask, bool? allowAsk}) async {
    if (busy) return;
    // one ask per request at most; a short request that names a thing is built at once
    final may = ask == null && (allowAsk ?? !namesAThing(request));
    busy = true;
    notifyListeners();
    final live = ChatMsg('bot', 'Starting the model…', kind: 'progress')..live = true;
    chat.add(live);
    _liveMsg = live;
    notifyListeners();
    try {
      final err = await llm.ensureLoaded(modelDirs);
      if (err != null) { _finishLive(live, err); return; }  // plain reason: no model installed, or it failed to load
      live.text = 'Writing the app…';
      notifyListeners();
      final m = llm.model!;
      final oldLines = kind == 'edit' ? programLines(current!.source).length : 0;
      final res = Map<String, dynamic>.from(await bridge.rpc<Map>('generate', {
        'kind': kind, 'request': request, 'current': kind == 'edit' ? current!.source : '',
        'system': m.system, 'arm': m.arm ?? arm,
        'allowAsk': may, 'ask': ask, 'maxLines': oldLines + 40 > 70 ? oldLines + 40 : 70,
      }));
      final stats = res['stats'] is Map ? Map<String, dynamic>.from(res['stats'] as Map) : null;
      if (stats != null) {
        lastStats = stats; lastStatsRequest = request;
        unawaited(AppStore.writeAtomic(File('${store.root.path}/last_stats.json'), jsonEncode({'v': 1, 'request': request, 'stats': stats})).catchError((Object _) {}));
      }
      await _afterGenerate(live, kind, request, res);
    } catch (e) {
      _finishLive(live, 'Something went wrong while building: $e. Your app is unchanged.');
    } finally {
      _liveMsg = null;
      busy = false;
      notifyListeners();
    }
  }

  void _finishLive(ChatMsg live, String text, {List<ChatBtn> buttons = const [], String kind = 'text'}) {
    live.text = text; live.code = null; live.live = false; live.buttons = buttons; live.kind = kind;
    notifyListeners();
  }

  static String firstProblem(List errors) {
    if (errors.isEmpty) return 'it did not pass the checks';
    final e = '${errors.first}'.replaceFirst(RegExp(r'^line \d+: E_[A-Z_]+: '), '').replaceFirst(RegExp(r'\s*Fix:.*$'), '');
    return e;
  }

  Future<void> _afterGenerate(ChatMsg live, String kind, String request, Map<String, dynamic> res) async {
    final secs = (res['stats']?['seconds'] ?? 0);
    if (res['cancelled'] == true) { _finishLive(live, 'Stopped. Nothing changed.'); return; }
    if (res['timedOut'] == true) { _finishLive(live, 'That took too long, so I stopped. ${kind == 'edit' ? 'Your app is unchanged.' : 'Nothing was made.'} Try a shorter request.'); return; }
    if (res['modelError'] == true) { _finishLive(live, 'The model stopped with an error: ${(res['errors'] as List).join('; ')}. ${kind == 'edit' ? 'Your app is unchanged.' : ''}'); return; }
    final ask = res['ask'];
    if (ask is Map) {
      final opts = (ask['options'] as List?)?.map((e) => '$e').toList() ?? [];
      final q = '${ask['question']}';
      pendingAsk = PendingAsk(kind, request, q, opts);
      _finishLive(live, '$q\nTap an answer, or type your own.', buttons: [for (final o in opts) ChatBtn(o, () => answerAsk(o))]);
      return;
    }
    if (res['ok'] != true) {
      final why = firstProblem((res['errors'] as List?) ?? []);
      _finishLive(live, 'I could not build that: the program the model wrote did not pass the checks ($why). ${kind == 'edit' ? 'Your app is unchanged.' : 'Nothing was made.'} Try saying it another way.');
      return;
    }
    final program = '${res['program']}';
    if (kind == 'create') {
      final r = await _newRecord(program, 'create', request: request);
      final d = await bridge.rpc<Map>('describe', {'source': program});
      // the request and the answer belong to the new app's chat
      final here = chat;
      final moved = here.length >= 2 ? here.sublist(here.length - 2) : List<ChatMsg>.of(here);
      here.removeRange(here.length - moved.length, here.length);
      final keepNew = newAppMode;
      await openApp(r, keepMode: keepNew);
      chat.addAll(moved);
      _finishLive(live, 'Made ${r.name} in ${_fmtSecs(secs)}. It is open now and keeps what you enter.\n${_plain('${d['text']}')}');
      return;
    }
    // change: ask the data rules first
    final ev = Map<String, dynamic>.from(await bridge.rpc<Map>('evaluate', {'source': program}));
    final verdict = '${ev['verdict']}';
    final changes = ((ev['changes'] as List?) ?? []).map((e) => '$e').toList();
    final warnings = ((ev['warnings'] as List?) ?? []).map((e) => '$e').toList();
    if (verdict == 'refused') {
      final why = ((ev['refused'] as List?) ?? []).map((e) => '$e').join(' ');
      _finishLive(live, 'I did not make that change, because it would put your saved data at risk: $why\nYour app is unchanged.');
      return;
    }
    final sets = ((ev['settings'] as List?) ?? []).map((e) => '${(e as Map)['text']}').toList();
    // a change that drops more than a fifth of the program is not applied unless the request asked to remove something
    final gone = removedLines(current!.source, program);
    final total = programLines(current!.source).length;
    if (total > 0 && gone.length > total * 0.2 && !kRemovalWords.hasMatch(request)) {
      final pct = (gone.length * 100 / total).round();
      _finishLive(live, 'I did not apply this change: it would have removed ${gone.length} of $total lines of your app ($pct%), and you did not ask to remove anything. It would have removed:\n${_bullets(gone.map((l) => l.trim()).toList())}\nYour app is unchanged.', buttons: [
        ChatBtn('Try again', () async { live.buttons = []; notifyListeners(); await _run(kind, request); }, primary: true),
      ]);
      return;
    }
    if (changes.isEmpty && verdict != 'restore') {
      final line = relevantLine(request, current!.source);
      _finishLive(live, 'This app already does that.${line == null ? '' : ' The line that does it:'}');
      if (line != null) live.code = line;
      return;
    }
    Future<void> apply() async {
      final a = Map<String, dynamic>.from(await bridge.rpc<Map>('applyEdit', {'source': program}));
      if (a['verdict'] == 'refused') {
        _finishLive(live, 'I could not apply the change: ${((a['refused'] as List?) ?? []).join(' ')} Your app is unchanged.');
        return;
      }
      current!.log('edit', request: request, summary: changes.take(3).join('; '));
      final headline = sets.isEmpty ? '' : '${sets.join('\n')}\n';
      final rest = changes.where((c) => !sets.contains(c)).toList();
      _finishLive(live, '${sets.isEmpty ? 'Changed' : 'Done'} in ${_fmtSecs(secs)}:\n$headline${rest.isEmpty ? '' : _bullets(rest)}\nEverything you entered is kept.', kind: 'change');
      await settleSaves();
    }
    if (verdict == 'warn' || warnings.isNotEmpty) {
      _finishLive(live, 'This change needs a decision:\n${_bullets(warnings)}\n\nIt would: \n${_bullets(changes)}', kind: 'text', buttons: [
        ChatBtn('Apply it', () async { live.buttons = []; notifyListeners(); await apply(); notifyListeners(); }, primary: true),
        ChatBtn('Leave the app as it is', () async { live.buttons = []; live.text = 'Left the app as it is.'; notifyListeners(); }),
      ]);
      return;
    }
    await apply();
  }

  String _fmtSecs(Object? s) => '${(s is num ? s : 0).toStringAsFixed(1)} s';
  String _bullets(List<String> xs) => xs.take(8).map((e) => '• $e').join('\n') + (xs.length > 8 ? '\n• and ${xs.length - 8} more' : '');
  String _plain(String t) {
    final out = <String>[];
    for (final l in t.split('\n')) {
      if (l.startsWith('Shows:')) break;
      out.add(l);
    }
    return out.take(6).join('\n');
  }

  /// The newest change message that has not been undone (it carries the Undo button).
  ChatMsg? get undoable {
    for (final m in chat.reversed) {
      if (m.kind == 'change' && m.who == 'bot' && !m.undone && current != null && current!.history.isNotEmpty) return m;
    }
    return null;
  }

  Future<void> undoLast() async {
    final m = undoable;
    if (m == null || current == null) return;
    final res = Map<String, dynamic>.from(await bridge.rpc<Map>('undoEdit'));
    if (res['verdict'] == 'none') {
      m.undone = true;
      _say('bot', 'There is nothing earlier to go back to.');
      return;
    }
    m.undone = true;
    current!.log('undo');
    _say('bot', 'Undone. The app is back to the earlier version. Everything you entered since is still here.');
    await settleSaves();
  }

  // ---------- lifecycle ----------
  Future<void> onPause() async { if (current != null) { try { await bridge.rpc('flush'); } catch (_) {} await settleSaves(); } }
  Future<void> onResume() async { if (current != null) { try { await bridge.rpc('resume', {'nowMs': DateTime.now().millisecondsSinceEpoch}); } catch (_) {} } }
  Future<void> setMode(bool dark) async { try { await bridge.rpc('setMode', {'mode': dark ? 'dark' : 'light'}); } catch (_) {} }

  // ---------- backup ----------
  Future<String> exportBackup() async {
    await onPause();
    final dir = backupDir!;
    await dir.create(recursive: true);
    final t = DateTime.now();
    String p(int n) => n.toString().padLeft(2, '0');
    final f = File('${dir.path}/molde-backup-${t.year}${p(t.month)}${p(t.day)}-${p(t.hour)}${p(t.minute)}${p(t.second)}.json');
    await AppStore.writeAtomic(f, await store.exportAll());
    return f.path;
  }

  Future<List<File>> backups() async {
    final dir = backupDir;
    if (dir == null || !await dir.exists()) return [];
    final fs = <File>[];
    await for (final e in dir.list()) { if (e is File && e.path.endsWith('.json')) fs.add(e); }
    fs.sort((a, b) => b.path.compareTo(a.path));
    return fs;
  }

  Future<String> importBackup(File f) async {
    try {
      final n = await store.importAll(await f.readAsString());
      apps = await store.list();
      final id = await store.currentId();
      final r = apps.where((a) => a.id == id).firstOrNull ?? apps.firstOrNull;
      if (r != null) { current = null; await openApp(r, remember: false); }
      notifyListeners();
      return 'Restored $n app${n == 1 ? '' : 's'} from ${f.uri.pathSegments.last}.';
    } on FormatException catch (e) {
      return 'That file is not a Molde backup (${e.message}). Nothing was changed.';
    } catch (e) {
      return 'Could not read that backup: $e. Nothing was changed.';
    }
  }
}
