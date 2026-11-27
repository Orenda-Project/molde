import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'catalogue.dart';
import 'downloader.dart';
import 'llm.dart';
import 'platform.dart';
import 'store.dart';

/// The model in use.
class ActiveModel {
  ActiveModel({required this.path, required this.name, required this.bytes, required this.source, this.id});
  final String path, name, source; // source: catalogue | hand
  final int bytes;
  final String? id;
  String get sourceLabel => source == 'catalogue' ? 'Downloaded from Hugging Face (oyekamal/molde-tiny)' : 'Added by hand';
}

/// Which model the app uses, what can be downloaded, and the download itself.
/// settings.json (next to the apps) records the choice: {"v":1,"active":{"id","file","source"}}.
class ModelManager extends ChangeNotifier {
  ModelManager({required this.llm, required this.settingsFile, required this.modelsDir, required this.handDirs, required this.platform, required this.loadCatalogue, ModelDownloader? downloader})
      : dl = downloader ?? ModelDownloader(dir: modelsDir, freeSpace: platform.freeSpace);
  final LlmService llm;
  final File settingsFile;
  final Directory modelsDir; // downloaded models live here
  final List<Directory> handDirs; // adb-pushed models: <dir>/models/*.gguf
  final Platform platform;
  final Future<Catalogue> Function() loadCatalogue;
  final ModelDownloader dl;

  Catalogue? catalogue;
  ActiveModel? active;
  bool ready = false; // init finished
  bool setupDismissed = false; // the user chose "try the examples first"
  DlStatus status = DlStatus(DlState.idle);
  String? error;
  String net = 'other';
  CatalogueModel? downloading;
  final Set<String> _installed = {};
  final Map<String, int> _installedBytes = {};
  Stopwatch? _sw;
  /// Last finished download: for the developer menu (seconds, average speed).
  String? lastDownloadNote;
  StreamSubscription<DlStatus>? _sub;
  DateTime _lastNotify = DateTime.fromMillisecondsSinceEpoch(0);

  /// Set by the shell: true while the chat is building or changing an app. Switching models then is blocked
  /// (unloading a model under a running generation would break it); Stop first, then switch.
  bool Function() isBusy = () => false;
  bool get switchBlocked => isBusy() || dl.running;
  static const busyMessage = 'Molde is building right now. Tap Stop in the chat, or wait, then switch the model.';
  void poke() => notifyListeners();

  bool get hasModel => active != null;
  bool installed(CatalogueModel m) => _installed.contains(m.localName);
  bool isActive(CatalogueModel m) => active != null && active!.source == 'catalogue' && active!.id == m.id;

  /// The catalogue models with the recommended one first (the order of the file otherwise).
  List<CatalogueModel> get ordered {
    final ms = catalogue?.models ?? const <CatalogueModel>[];
    final r = catalogue?.recommended;
    return [if (r != null) r, for (final m in ms) if (m.id != r?.id) m];
  }

  /// Downloaded models that the catalogue no longer lists: file name and size. They stay usable and deletable
  /// ("Downloaded earlier"); nothing disappears from under the user when the catalogue is cut.
  List<({String file, int bytes})> get downloadedEarlier {
    final c = catalogue;
    if (c == null) return const [];
    final listed = c.models.map((m) => m.localName).toSet();
    final out = [for (final n in _installed) if (!listed.contains(n)) (file: n, bytes: _installedBytes[n] ?? 0)];
    out.sort((a, b) => a.file.compareTo(b.file));
    return out;
  }

  bool isActiveFile(String file) => active != null && active!.source == 'catalogue' && active!.path.split('/').last == file;

  /// A catalogue model that is recommended now but is not the one in use (only when a catalogue model is in use).
  CatalogueModel? get newer {
    final r = catalogue?.recommended;
    final a = active;
    if (r == null || a == null || a.source != 'catalogue' || a.id == r.id) return null;
    if (catalogue!.byId(a.id ?? '') != null) return null; // the user chose between models that are both listed: no nagging
    return r;
  }

  Future<void> init() async {
    _sub = dl.status.listen(_onStatus);
    await _scan();
    final s = await _readSettings();
    final want = s?['active'] is Map ? Map<String, dynamic>.from(s!['active'] as Map) : null;
    File? use;
    String source = 'hand';
    String? id;
    if (want != null && want['source'] == 'catalogue') {
      final f = File('${modelsDir.path}/${want['file']}');
      if (await f.exists()) { use = f; source = 'catalogue'; id = want['id'] as String?; }
    }
    if (use == null) { use = await LlmService.locate(handDirs); source = 'hand'; }
    if (use == null) { // a verified download exists but nothing is chosen
      final any = _installed.isNotEmpty ? File('${modelsDir.path}/${_installed.first}') : null;
      if (any != null) { use = any; source = 'catalogue'; }
    }
    if (use != null) await _setActive(use, source, id, save: false);
    ready = true;
    notifyListeners();
    unawaited(refreshCatalogue());
    unawaited(platform.networkType().then((n) { net = n; notifyListeners(); }));
  }

  /// A model that is in no catalogue entry is never shown by its file name (the user did not choose that name).
  static String fallbackName(String source, int bytes) => '${source == 'hand' ? 'Model added by hand' : 'Older model'} (${(bytes / 1048576).round()} MB)';

  Future<void> refreshCatalogue() async {
    catalogue = await loadCatalogue();
    if (active != null && active!.source == 'catalogue') { // the catalogue arrived after the model was chosen: use its name for the file
      final m = catalogue!.models.where((m) => m.localName == active!.path.split('/').last).firstOrNull;
      if (m != null) { active = ActiveModel(path: active!.path, name: m.name, bytes: active!.bytes, source: 'catalogue', id: m.id); llm.templateHint = m.template; llm.displayName = m.name; }
    }
    notifyListeners();
  }

  Future<void> refreshNet() async { net = await platform.networkType(); notifyListeners(); }

  Future<void> _scan() async {
    _installed.clear();
    _installedBytes.clear();
    try {
      if (await modelsDir.exists()) {
        await for (final e in modelsDir.list()) {
          if (e is File && e.path.endsWith('.gguf')) { _installed.add(e.uri.pathSegments.last); _installedBytes[e.uri.pathSegments.last] = await e.length(); }
        }
      }
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> _readSettings() async {
    final j = await AppStore.readValid(settingsFile);
    return j is Map ? Map<String, dynamic>.from(j) : null;
  }

  Future<void> _setActive(File f, String source, String? id, {bool save = true}) async {
    final bytes = await f.length();
    final fallback = fallbackName(source, bytes);
    final name = id != null ? (catalogue?.byId(id)?.name ?? fallback) : (source == 'hand' ? fallback : (catalogue?.models.where((m) => m.localName == f.uri.pathSegments.last).firstOrNull?.name ?? fallback));
    active = ActiveModel(path: f.path, name: name, bytes: bytes, source: source, id: id ?? catalogue?.models.where((m) => m.localName == f.uri.pathSegments.last).firstOrNull?.id);
    llm.preferred = f;
    llm.displayName = name;
    llm.templateHint = id != null ? catalogue?.byId(id)?.template : null;
    if (save) await AppStore.writeAtomic(settingsFile, jsonEncode({'v': 1, 'active': {'id': active!.id, 'file': f.uri.pathSegments.last, 'source': source}}));
  }

  /// Switches to an installed catalogue model (size checked; it was hash-verified when it arrived).
  Future<String?> use(CatalogueModel m) async {
    if (isBusy()) return busyMessage;
    final f = File('${modelsDir.path}/${m.localName}');
    if (!await f.exists() || await f.length() != m.bytes) { _installed.remove(m.localName); notifyListeners(); return 'That model file is missing or damaged. Download it again.'; }
    await llm.unload();
    await _setActive(f, 'catalogue', m.id);
    notifyListeners();
    final err = await llm.ensureLoaded(handDirs);
    if (err != null) { error = err; notifyListeners(); return err; }
    notifyListeners();
    return null;
  }

  /// Switches to a model that was downloaded earlier and is no longer in the catalogue.
  Future<String?> useFile(String file) async {
    if (isBusy()) return busyMessage;
    final f = File('${modelsDir.path}/$file');
    if (!await f.exists()) { _installed.remove(file); notifyListeners(); return 'That model file is missing. It may have been deleted.'; }
    await llm.unload();
    await _setActive(f, 'catalogue', null);
    notifyListeners();
    final err = await llm.ensureLoaded(handDirs);
    if (err != null) { error = err; notifyListeners(); return err; }
    notifyListeners();
    return null;
  }

  Future<void> deleteFile(String file) async {
    final wasActive = isActiveFile(file);
    if (wasActive && isBusy()) return;
    if (wasActive) { await llm.unload(); active = null; llm.preferred = null; }
    final f = File('${modelsDir.path}/$file');
    if (await f.exists()) await f.delete();
    final p = File('${f.path}.part');
    if (await p.exists()) await p.delete();
    _installed.remove(file); _installedBytes.remove(file);
    if (wasActive) {
      await AppStore.writeAtomic(settingsFile, jsonEncode({'v': 1, 'active': null}));
      final hand = await LlmService.locate(handDirs);
      if (hand != null) { await _setActive(hand, 'hand', null, save: false); await llm.ensureLoaded(handDirs); }
    }
    notifyListeners();
  }

  /// Uses the model placed by hand (adb push).
  Future<void> useHand() async {
    if (isBusy()) return;
    final f = await LlmService.locate(handDirs);
    if (f == null) return;
    await llm.unload();
    await _setActive(f, 'hand', null);
    await llm.ensureLoaded(handDirs);
    notifyListeners();
  }

  Future<void> delete(CatalogueModel m) async {
    final f = File('${modelsDir.path}/${m.localName}');
    final wasActive = isActive(m);
    if (wasActive && isBusy()) return;
    if (wasActive) { await llm.unload(); active = null; llm.preferred = null; }
    if (await f.exists()) await f.delete();
    final p = File('${f.path}.part');
    if (await p.exists()) await p.delete();
    _installed.remove(m.localName);
    if (wasActive) {
      await AppStore.writeAtomic(settingsFile, jsonEncode({'v': 1, 'active': null}));
      final hand = await LlmService.locate(handDirs);
      if (hand != null) { await _setActive(hand, 'hand', null, save: false); await llm.ensureLoaded(handDirs); }
    }
    notifyListeners();
  }

  // ---------- download ----------
  Future<void> download(CatalogueModel m) async {
    if (dl.running) return;
    error = null;
    downloading = m;
    _sw = Stopwatch()..start();
    await platform.requestNotifications();
    notifyListeners();
    try {
      final f = await dl.download(m);
      await _scan();
      // verified: use it (the first model, or the one the user asked for)
      await llm.unload();
      await _setActive(f, 'catalogue', m.id);
      final secs = _sw!.elapsedMilliseconds / 1000;
      lastDownloadNote = '${m.name}: ${(m.bytes / 1048576).toStringAsFixed(0)} MB in ${secs.toStringAsFixed(0)} s (average ${(m.bytes / 1048576 / (secs <= 0 ? 1 : secs)).toStringAsFixed(1)} MB/s)';
      debugPrint('MOLDE_DL ${lastDownloadNote}');
      final err = await llm.ensureLoaded(handDirs);
      if (err != null) error = err;
    } on DlError catch (e) {
      if (e.message != 'paused' && e.message != 'cancelled') error = e.message;
      await _scan();
    } catch (e) {
      error = 'The download failed: $e';
    } finally {
      downloading = dl.current.state == DlState.paused ? m : null;
      if (dl.current.state != DlState.paused) await platform.stopNotify();
      notifyListeners();
    }
  }

  void pause() => dl.pause();
  Future<void> resume() async { final m = downloading; if (m != null) await download(m); }
  void cancel() {
    if (dl.running) { dl.cancel(); } else { // paused: nothing running, just remove the part
      final m = downloading;
      if (m != null) { final p = dl.partFile(m); if (p.existsSync()) p.deleteSync(); downloading = null; status = DlStatus(DlState.idle); unawaited(platform.stopNotify()); notifyListeners(); }
    }
  }

  void _onStatus(DlStatus s) {
    status = s;
    if (s.state == DlState.downloading || s.state == DlState.verifying) {
      final now = DateTime.now();
      if (now.difference(_lastNotify).inMilliseconds > 1000 || s.state == DlState.verifying) {
        _lastNotify = now;
        final pct = s.total > 0 ? (s.fraction * 100).floor() : -1;
        final txt = s.state == DlState.verifying ? 'Checking the file…' : (s.message.isNotEmpty ? s.message : '$pct% · ${(s.received / 1048576).round()} of ${(s.total / 1048576).round()} MB');
        unawaited(platform.notify('Downloading the Molde model', txt, s.state == DlState.verifying ? 100 : pct));
      }
    }
    notifyListeners();
  }

  @override
  void dispose() { _sub?.cancel(); dl.dispose(); super.dispose(); }
}
