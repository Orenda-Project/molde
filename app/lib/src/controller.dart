import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'bridge.dart';
import 'rules.dart';
import 'summary.dart';
import 'direct.dart';
export 'rules.dart';
import 'llm.dart';
import 'patch_ops.dart';
import 'store.dart';

const String kVersion = '0.7.0-dev';
const int kOpsEditCapMs = 10 * 60 * 1000; // an edit the model writes as one answer (format ops): one call, no line-by-line progress, so a longer cap
const int kCreateCapMs = 120 * 1000; // a create past this is stopped and retried once with a shorter request

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
  bool disabled = false; // its buttons were used, or the question is no longer open

  Map<String, dynamic> toJson() => {'who': who, 'text': text, if (code != null) 'code': code, 'kind': kind == 'progress' ? 'text' : kind, 'undone': undone};
  static ChatMsg fromJson(Map<String, dynamic> j) => ChatMsg('${j['who']}', '${j['text']}', code: j['code'] as String?, kind: '${j['kind'] ?? 'text'}')..undone = j['undone'] == true;
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
    if (m != null) return 'Model ready: ${m.name ?? llm.displayName ?? 'your model'} (${(m.sizeBytes / 1048576).round()} MB, loaded in ${m.loadSeconds.toStringAsFixed(1)} s)';
    return llm.loadError ?? 'Loading the model…';
  }
  Map<String, dynamic>? lastStats;
  final List<Map<String, dynamic>> genHistory = []; // last generations: request, kind, program lines, seconds
  String? lastStatsRequest;
  String arm = 'E';
  bool booted = false;
  Future<void> _saves = Future.value();

  List<ChatMsg> get chat => chats.putIfAbsent(current?.id ?? '', () => (current?.chat ?? []).map(ChatMsg.fromJson).toList());

  /// Buttons of earlier messages stop working once answered or when the app changes.
  void _disableButtons({ChatMsg? except}) { for (final m in chat) { if (!identical(m, except) && m.buttons.isNotEmpty) m.disabled = true; } }

  void _persistChat() {
    final r = current;
    if (r == null) return;
    final keep = chat.where((m) => !m.live && m.kind != 'progress').toList();
    final tail = keep.length > 40 ? keep.sublist(keep.length - 40) : keep;
    r.chat = tail.map((m) => m.toJson()).toList();
    _saves = _saves.then((_) => store.save(r, touch: false)).catchError((Object e) { debugPrint('save failed: $e'); });
  }

  void _say(String who, String text, {String? code, List<ChatBtn> buttons = const [], String kind = 'text'}) {
    final msg = ChatMsg(who, text, code: code, buttons: buttons, kind: kind);
    if (buttons.isNotEmpty) _disableButtons(); // a newer question makes every older unanswered one stale
    chat.add(msg);
    _persistChat();
    notifyListeners();
  }

  // ---------- start ----------
  Future<void> init() async {
    bridge.onSnapshot = _onSnapshot;
    bridge.nativeHandler = _native;
    bridge.onProgress = (p) {
      _progressSeen = true;
      final m = _liveMsg;
      if (m != null) {
        _lines = (p['lines'] is num) ? (p['lines'] as num).toInt() : _lines;
        m.text = progressText(_longNote, _lines, DateTime.now().difference(_startedAt).inSeconds);
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
    _disableButtons();
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

  void refresh() => notifyListeners();
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
  bool _progressSeen = false;
  int _lines = 0;
  DateTime _startedAt = DateTime.now();
  Timer? _tick;
  String _longNote = '';

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
    _disableButtons(); // moving on from an unanswered question makes it stale
    _say('you', request);
    if (current != null && isUndoRequest(request)) { // "undo that": back to the previous version, no model, never a new app
      if (undoable != null) { await undoLast(); } else { _say('bot', 'There is nothing earlier to go back to.'); }
      return;
    }
    final gap = capabilityGap(request);
    if (gap != null) { // not possible in an offline app: say so plainly, with the reason and what can be built instead
      _say('bot', gap.reply, buttons: [
        ChatBtn(gap.offer, () async { startNewApp(); await _run('create', gap.suggestion); }, primary: true),
        ChatBtn('No thanks', () async {}),
      ]);
      return;
    }
    if (kind == 'edit') {
      // exact edits of line 1 (colour, dark/light, text size, title) and of one setting value: no model, instant
      final src = current!.source;
      if (isVagueRequest(request)) { // too vague to act on: answer at once with real, exact choices instead of minutes of guessing
        final opts = <Choice>[];
        for (final (label, req) in [('Make the text bigger', 'make the text bigger'), ('Dark mode', 'turn on dark mode'), ('A blue theme', 'make it blue'), ('A green theme', 'make it green')]) {
          final e = appLineEdit(req, src);
          if (e != null && !e.unchanged) opts.add(Choice(label, e.program, e.label));
        }
        _offer('"${request.trim()}" is too vague for me to act on without guessing. Pick one of these, or tell me what to change (a colour, bigger text, a new field, a chart).', opts);
        return;
      }
      final cm = missingChartField(request, src);
      if (cm != null) {
        _say('bot', cm.text, buttons: [for (final f in cm.fields.take(4)) ChatBtn('${f[0].toUpperCase()}${f.substring(1).replaceAll('_', ' ')}', () async { await _run('edit', 'add a chart of ${f.replaceAll('_', ' ')}'); })]);
        return;
      }
      for (final plan in [removeButtonPlan, removeFieldPlan, addFieldPlan, renameButtonPlan]) {
        final o = plan(request, src);
        if (o == null) continue;
        if (o.edit != null) { await _direct(request, o.edit!.program, label: o.edit!.label, unchanged: o.edit!.unchanged); return; }
        _offer(o.ask!, o.choices);
        return;
      }
      final be = buttonRenameEdit(request, src);
      if (be != null) { await _direct(request, be.program, label: be.label, unchanged: be.unchanged); return; }
      final de = appLineEdit(request, src);
      if (de != null) { await _direct(request, de.program, label: de.label, unchanged: de.unchanged); return; }
      final se = settingEditProgram(request, src);
      if (se != null) { await _direct(request, se, unchanged: se == src); return; }
      if (looksLikeNewApp(request, src)) {
        final name = current!.name;
        _say('bot', 'That sounds like a new app. Do you want a new app, or a change to $name?', buttons: [
          ChatBtn('New app', () async { startNewApp(); await _run('create', request); }, primary: true),
          ChatBtn('Change $name', () async { changeCurrent(); await _run('edit', request); }),
        ]);
        return;
      }
    }
    await _run(kind, request);
  }

  /// A question with exact choices: each choice applies its own edit at once (no model); "No thanks" leaves the app alone.
  void _offer(String text, List<Choice> choices) {
    _say('bot', text, buttons: [
      for (final c in choices) ChatBtn(c.label, () async { await _direct(c.label, c.program, label: c.done); }, primary: c == choices.first),
      if (choices.isNotEmpty) ChatBtn('No thanks', () async {}),
    ]);
  }

  /// A change worked out by the app itself (line 1 or a setting value): the same checks and messages as a model change.
  Future<void> _direct(String request, String program, {String? label, bool unchanged = false}) async {
    if (busy) return;
    final live = ChatMsg('bot', 'Changing the app…', kind: 'progress');
    chat.add(live);
    if (unchanged) {
      _finishLive(live, label != null ? 'It already is that way: $label.' : 'That setting already has this value. Your app is unchanged.');
      return;
    }
    busy = true;
    notifyListeners();
    try {
      await _afterGenerate(live, 'edit', request, {'ok': true, 'program': program, 'stats': {'seconds': 0}}, doneLabel: label ?? '', direct: true);
    } catch (e) {
      _finishLive(live, 'Something went wrong: $e. Your app is unchanged.');
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  /// Answers the open question (a tapped option or typed text); the next prompt carries Question and Answer.
  Future<void> answerAsk(String answer) async {
    final p = pendingAsk;
    if (p == null || busy) return;
    pendingAsk = null;
    _disableButtons();
    _say('you', answer);
    await _run(p.kind, p.request, ask: {'question': p.question, 'answer': answer}, allowAsk: false);
  }

  String _lastEditRequest = '';

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
      final m = llm.model!;
      final oldLines = kind == 'edit' ? programLines(current!.source).length : 0;
      _longNote = oldLines > 30 ? 'This app is long, changes can take a few minutes.\n' : '';
      live.text = '${_longNote}Reading your request…';
      notifyListeners();
      _progressSeen = false; _lines = 0;
      _lastEditRequest = request;
      _startedAt = DateTime.now();
      _tick?.cancel();
      // the seconds keep counting between lines; the text never depends on a value the page might not send
      final opsEdit = kind == 'edit' && m.format == 'ops'; // one silent native call: the progress comes from the native side
      NativeProgress? nat;
      var polling = false;
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!live.live) return;
        final secs = DateTime.now().difference(_startedAt).inSeconds;
        if (opsEdit) {
          if (!polling) { polling = true; unawaited(llm.progress().then((p) { nat = p; polling = false; })); }
          final n = nat;
          live.text = n == null ? progressText(_longNote, -1, secs) : opsProgressText(_longNote, n.phase, n.done, n.total, secs);
        } else {
          live.text = progressText(_longNote, _progressSeen ? _lines : -1, secs);
        }
        notifyListeners();
      });
      Future<Map<String, dynamic>> gen(String req) async => Map<String, dynamic>.from(await bridge.rpc<Map>('generate', {
        'kind': kind, 'request': req, 'current': kind == 'edit' ? current!.source : '',
        'system': m.system, 'arm': m.arm ?? arm, 'template': m.template, 'format': m.format,
        'allowAsk': may, 'ask': ask, 'hardCapMs': kind == 'edit' ? (opsEdit ? kOpsEditCapMs : 7 * 60 * 1000) : kCreateCapMs, 'maxLines': oldLines + 40 > 70 ? oldLines + 40 : 70,
      }));
      var res = await gen(request);
      var usedRequest = request;
      // a create that runs past about 120 s is stopped and tried once more with a shorter request; then it gives up honestly
      if (kind == 'create' && res['timedOut'] == true && !llm.hung) {
        final shorter = shorterRequest(request);
        if (shorter == null) {
          _finishLive(live, 'I stopped after about ${kCreateCapMs ~/ 1000} seconds. This took too long and nothing was built. Try a shorter request, one idea at a time.');
          return;
        }
        live.text = 'That was taking too long. Trying again with a shorter request: "$shorter"…';
        notifyListeners();
        _progressSeen = false; _lines = 0; _startedAt = DateTime.now();
        res = await gen(shorter);
        usedRequest = shorter;
        if (res['timedOut'] == true) {
          _finishLive(live, 'I stopped twice after about ${kCreateCapMs ~/ 1000} seconds each, the second time with the shorter request "$shorter". Nothing was built. Try a very short request, for example "grocery list".');
          return;
        }
      }
      if (llm.takeHung()) {
        _finishLive(live, 'The model stopped responding, so I stopped it and started it again. ${kind == 'edit' ? 'Your app is unchanged.' : 'Nothing was made.'} Please try again.');
        return;
      }
      final stats = res['stats'] is Map ? Map<String, dynamic>.from(res['stats'] as Map) : null;
      if (stats != null) {
        lastStats = stats; lastStatsRequest = request;
        genHistory.add({'request': request, 'kind': kind, 'lines': oldLines, 'seconds': stats['seconds'], 'ok': res['ok'] == true});
        if (genHistory.length > 8) genHistory.removeAt(0);
        unawaited(AppStore.writeAtomic(File('${store.root.path}/last_stats.json'), jsonEncode({'v': 1, 'request': request, 'stats': stats})).catchError((Object _) {}));
      }
      if (kind == 'edit' && res['ok'] == true && res['ops'] is String) res = await _applyPatch(res); // r5c format: operations on numbered lines
      await _afterGenerate(live, kind, usedRequest == request ? request : usedRequest, res);
    } catch (e) {
      _finishLive(live, 'Something went wrong while building: $e. Your app is unchanged.');
    } finally {
      _tick?.cancel();
      _liveMsg = null;
      busy = false;
      notifyListeners();
    }
  }

  /// An ops-format answer: apply the operations to the open app's program and check the result. Anything that does not apply
  /// cleanly comes back as `patchError` (nothing is changed); a program that applies but fails the checks is an ordinary failed check.
  Future<Map<String, dynamic>> _applyPatch(Map<String, dynamic> res) async {
    final stats = res['stats'];
    unawaited(_debugRaw(res));
    final String program;
    try {
      program = applyOps(current!.source, '${res['ops']}');
    } on PatchError catch (e) {
      return {'ok': false, 'patchError': true, 'errors': [e.message], 'stats': stats};
    }
    final c = Map<String, dynamic>.from(await bridge.rpc<Map>('check', {'source': program}));
    return {'ok': c['ok'] == true, 'program': program, 'errors': c['errors'] ?? [], 'stats': stats};
  }

  /// Debug aid, off unless the file `debug_raw_answers` exists in the app's data folder (adb shell run-as <package> touch files/molde/debug_raw_answers):
  /// every raw operations answer is appended to `raw_answers.jsonl` there with the request and the line count of the open app, so a failed
  /// edit can be replayed offline through the applier and the checker. Never throws; no effect for the user.
  Future<void> _debugRaw(Map<String, dynamic> res) async {
    try {
      if (!File('${store.root.path}/debug_raw_answers').existsSync()) return;
      final cur = current;
      final row = jsonEncode({'t': DateTime.now().toIso8601String(), 'request': _lastEditRequest, 'lines': cur == null ? 0 : programLines(cur.source).length, 'app': cur?.name, 'ops': res['ops'], 'stats': res['stats']});
      await File('${store.root.path}/raw_answers.jsonl').writeAsString('$row\n', mode: FileMode.append);
    } catch (_) {}
  }

  void _finishLive(ChatMsg live, String text, {List<ChatBtn> buttons = const [], String kind = 'text'}) {
    live.text = text; live.code = null; live.live = false; live.buttons = buttons; live.kind = kind;
    if (buttons.isNotEmpty) { _disableButtons(except: live); live.disabled = false; }
    _persistChat();
    notifyListeners();
  }

  static String firstProblem(List errors) {
    if (errors.isEmpty) return 'it did not pass the checks';
    final e = '${errors.first}'.replaceFirst(RegExp(r'^line \d+: E_[A-Z_]+: '), '').replaceFirst(RegExp(r'\s*Fix:.*$'), '');
    return e;
  }

  Future<void> _afterGenerate(ChatMsg live, String kind, String request, Map<String, dynamic> res, {String? doneLabel, bool direct = false}) async {
    final secs = (res['stats']?['seconds'] ?? 0);
    if (res['cancelled'] == true) { _finishLive(live, 'Stopped. Nothing changed.'); return; }
    if (res['timedOut'] == true) { _finishLive(live, 'I stopped because nothing new was written for a while. ${kind == 'edit' ? 'Your app is unchanged.' : 'Nothing was made.'} Try again, or a shorter request.'); return; }
    if (res['modelError'] == true) { _finishLive(live, 'The model stopped with an error: ${(res['errors'] as List).join('; ')}. ${kind == 'edit' ? 'Your app is unchanged.' : ''}'); return; }
    final ask = res['ask'];
    if (ask is Map) {
      final opts = (ask['options'] as List?)?.map((e) => '$e').toList() ?? [];
      final q = '${ask['question']}';
      pendingAsk = PendingAsk(kind, request, q, opts);
      _finishLive(live, '$q\nTap an answer, or type your own.', buttons: [for (final o in opts) ChatBtn(o, () => answerAsk(o))]);
      return;
    }
    if (res['patchError'] == true) { // the change instructions did not fit the app: said plainly, nothing touched
      final why = firstProblem((res['errors'] as List?) ?? []);
      _finishLive(live, 'I did not apply this. The changes the model wrote did not fit your app ($why), so I kept your app exactly as it is. Your app is unchanged. Try saying it another way.', buttons: [
        ChatBtn('Try again', () async { live.buttons = []; notifyListeners(); await _run(kind, request); }, primary: true),
      ]);
      return;
    }
    if (res['ok'] != true) {
      final why = firstProblem((res['errors'] as List?) ?? []);
      _finishLive(live, 'I could not build that: the program the model wrote did not pass the checks ($why). ${kind == 'edit' ? 'Your app is unchanged.' : 'Nothing was made.'} Try saying it another way.');
      return;
    }
    var program = '${res['program']}';
    if (kind == 'create') {
      final better = betterTitle(program, request);
      if (better != null) program = withTitle(program, better);
      final r = await _newRecord(program, 'create', request: request);
      // the request and the answer belong to the new app's chat
      final here = chat;
      final moved = here.length >= 2 ? here.sublist(here.length - 2) : List<ChatMsg>.of(here);
      here.removeRange(here.length - moved.length, here.length);
      await openApp(r); // after a create the mode is "Change <new app>"
      chat.addAll(moved);
      final gaps = keyNounGaps(request, program);
      _finishLive(live, '${describeApp(program)}${gaps.isEmpty ? '' : '\n\nWhat you asked for that is missing: ${gaps.map((g) => g.phrase).join(' and ')}. The app does not have ${gaps.length > 1 ? 'them' : 'it'} yet.'}', buttons: [
        for (final g in gaps.take(2)) ChatBtn('Add ${g.phrase}', () async { changeCurrent(); await _run('edit', g.editRequest); }, primary: g == gaps.first),
      ]);
      return;
    }
    // change: ask the data rules first
    final ev = Map<String, dynamic>.from(await bridge.rpc<Map>('evaluate', {'source': program}));
    final verdict = '${ev['verdict']}';
    final changes = ((ev['changes'] as List?) ?? []).map((e) => '$e').toList();
    final warnings = ((ev['warnings'] as List?) ?? []).map((e) => '$e').toList();
    if (verdict == 'refused') {
      final why = plainRefusal(((ev['refused'] as List?) ?? []).map((e) => '$e').toList());
      _finishLive(live, 'I did not make that change, because it would put your saved data at risk. $why\nYour app is unchanged.');
      return;
    }
    final sets = ((ev['settings'] as List?) ?? []).map((e) => '${(e as Map)['text']}').toList();
    // a change that drops more than a fifth of the program is not applied unless the request asked to remove something
    final gone = removedLines(current!.source, program);
    final total = programLines(current!.source).length;
    if (!direct && total > 0 && gone.length > removalLimit(total) && !kRemovalWords.hasMatch(request)) {
      final pct = (gone.length * 100 / total).round();
      _finishLive(live, 'I did not apply this change: it would have removed ${gone.length} of $total lines of your app ($pct%), and you did not ask to remove anything. It would have removed:\n${_bullets(describeLines(gone))}\nYour app is unchanged.', buttons: [
        ChatBtn('Try again', () async { live.buttons = []; notifyListeners(); await _run(kind, request); }, primary: true),
      ]);
      return;
    }
    // the model handed the program back unchanged, or what changed shows nothing: never say Done
    if (!direct && (programLines(program).join('\n') == programLines(current!.source).join('\n') || (sets.isEmpty && verdict != 'restore' && summarizeChange(current!.source, program).isEmpty && (sayScreenChanges(changes).isEmpty || [...unmetClaims(request, current!.source, program), ...unmetFromDiff(request, current!.source, program)].isNotEmpty)))) {
      _finishLive(live, "I did not apply this. After ${secs is num ? secs.round() : 0} s the model's answer did not change your app in any way you could see, so I kept your app exactly as it is. Your app is unchanged. Try one clear change at a time, ${exampleRequests(current!.source)}.", buttons: [
        ChatBtn('Try again', () async { live.buttons = []; notifyListeners(); await _run(kind, request); }, primary: true),
        ChatBtn('Keep my app', () async { live.text = 'Kept your app as it is.'; notifyListeners(); }),
      ]);
      return;
    }
    final oldSrc = current!.source;
    Future<void> apply() async {
      final a = Map<String, dynamic>.from(await bridge.rpc<Map>('applyEdit', {'source': program}));
      if (a['verdict'] == 'refused') {
        _finishLive(live, 'I could not apply the change. ${plainRefusal(((a['refused'] as List?) ?? []).map((e) => '$e').toList())} Your app is unchanged.');
        return;
      }
      current!.log('edit', request: request, summary: changes.take(3).join('; '));
      final said = _saidOf(oldSrc, program, changes); // from the checked before and after programs, never the model's words
      final unmet = direct ? <String>[] : [...unmetClaims(request, oldSrc, program), ...unmetFromDiff(request, oldSrc, program)];
      final chartAdded = said.any((x) => x.startsWith('Added a chart') || x.startsWith('Added a bar chart') || x.startsWith('Added a calendar'));
      if (doneLabel != null && doneLabel.isNotEmpty) {
        _finishLive(live, 'Done: $doneLabel', kind: 'change');
      } else if (unmet.isNotEmpty) {
        _finishLive(live, "I did not do everything you asked. Not done: ${unmet.join(' and ')}.\n${said.isEmpty ? 'Something small changed that does not show on the screen.' : 'What I did:\n${_bullets(said)}'}\nYou can Undo it.", kind: 'change');
      } else {
        _finishLive(live, '${direct ? 'Done' : 'Done in ${_fmtSecs(secs)}'}:\n${changeReply(said, chartAdded: chartAdded)}', kind: 'change');
      }
      await settleSaves();
    }
    // lines the request did not mention that the model dropped: not applied silently, the default is to keep the app
    final wrongPart = direct ? null : namedPartMismatch(request, oldSrc, program);
    if (wrongPart != null) { // the model did something else: never "Done" for the wrong part
      final did = summarizeChange(oldSrc, program);
      // the request named a button or field that is not there: list the real ones as one-tap choices
      final real = <Choice>[];
      final nm = RegExp(r'\b(?:remove|delete|drop|hide|get rid of|take away)\s+(?:the\s+|my\s+)?"?(.+?)"?\s+(button|field|column)\b', caseSensitive: false).firstMatch(request);
      final asks = nm == null ? <String>[request] : ['remove the ${nm.group(1)} ${nm.group(2)}'];
      for (final plan in [removeButtonPlan, removeFieldPlan]) { for (final q in asks) { final o = plan(q, oldSrc); if (o != null && o.choices.isNotEmpty) { real.addAll(o.choices); break; } } if (real.isNotEmpty) break; }
      final realNote = real.isEmpty ? '' : '\nThe ones in your app are: ${real.map((c) => '"${c.label}"').join(', ')}. Tap one to remove it.';
      _finishLive(live, 'I did not apply this change, because it does not do what you asked: $wrongPart.${did.isEmpty ? '' : '\nWhat it would have done instead:\n${_bullets(did)}'}$realNote\nYour app is unchanged.', buttons: [
        for (final c in real.take(4)) ChatBtn(c.label, () async { live.buttons = []; notifyListeners(); await _direct(c.label, c.program, label: c.done); }),
        ChatBtn('Keep my app', () async { live.text = 'Kept your app as it is.'; notifyListeners(); }, primary: true),
        ChatBtn('Apply it anyway', () async { live.buttons = []; notifyListeners(); await apply(); notifyListeners(); }),
      ]);
      return;
    }
    final extra = direct ? <String>[] : dropsUnasked(request, oldSrc, program);
    final rewritten = direct ? <String>[] : rewrittenUnasked(request, oldSrc, program);
    if (extra.isNotEmpty || rewritten.isNotEmpty) {
      final what = [if (extra.isNotEmpty) 'This would also remove:\n${_bullets(describeLines(extra))}', if (rewritten.isNotEmpty) 'This would also change something you did not mention:\n${_bullets(describeLines(rewritten))}'].join('\n');
      _finishLive(live, '$what\nYou did not ask for that, so I have not applied the change.', buttons: [
        ChatBtn('Keep my app', () async { live.text = 'Kept your app as it is.'; notifyListeners(); }, primary: true),
        ChatBtn('Apply anyway', () async { live.buttons = []; notifyListeners(); await apply(); notifyListeners(); }),
      ]);
      return;
    }
    if (verdict == 'warn' || warnings.isNotEmpty) {
      _finishLive(live, 'This change needs a decision:\n${_bullets(plainWarnings(warnings))}\n\nIt would:\n${_bullets(summarizeChange(oldSrc, program))}', kind: 'text', buttons: [
        ChatBtn('Apply it', () async { live.buttons = []; notifyListeners(); await apply(); notifyListeners(); }, primary: true),
        ChatBtn('Leave the app as it is', () async { live.buttons = []; live.text = 'Left the app as it is.'; notifyListeners(); }),
      ]);
      return;
    }
    await apply();
  }

  /// What changed, in plain sentences: the diff of the two programs, or (when that names nothing) the screen changes the page listed.
  List<String> _saidOf(String oldSrc, String newSrc, List<String> changes) {
    final said = summarizeChange(oldSrc, newSrc);
    return said.isNotEmpty ? said : sayScreenChanges(changes);
  }

  String _fmtSecs(Object? s) => '${(s is num ? s : 0).toStringAsFixed(1)} s';
  String _bullets(List<String> xs) => xs.take(8).map((e) => '• $e').join('\n') + (xs.length > 8 ? '\n• and ${xs.length - 8} more' : '');

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
