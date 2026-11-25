import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// One app the user owns: its stored program, the data snapshot (which carries the schema history and every
/// earlier program version the evaluator knows), the chat Undo stack and a short log of what was asked.
class AppRecord {
  AppRecord({
    required this.id,
    required this.name,
    required this.source,
    this.snapshot,
    List<dynamic>? undo,
    List<Map<String, dynamic>>? history,
    int? createdAt,
    int? updatedAt,
    this.sample = false,
    this.exampleId,
    List<Map<String, dynamic>>? chat,
  })  : chat = chat ?? [],
        undo = undo ?? [],
        history = history ?? [],
        createdAt = createdAt ?? DateTime.now().millisecondsSinceEpoch,
        updatedAt = updatedAt ?? DateTime.now().millisecondsSinceEpoch;

  final String id;
  String name;
  String source;
  Map<String, dynamic>? snapshot;
  List<dynamic> undo;
  List<Map<String, dynamic>> history; // {at, kind: create|edit|undo|example|import, request?, summary?}
  int createdAt;
  int updatedAt;
  bool sample; // an example app still holding its sample data (one tap clears it)
  String? exampleId;
  List<Map<String, dynamic>> chat; // the last chat messages of this app (text only, no buttons)

  static const int format = 1;

  // When this app was last changed in this session, on the monotonic clock: unlike the wall clock it never jumps
  // (a phone that re-syncs its time, an emulator that boots in another zone), so "changed 3 h ago" cannot appear for an app
  // that was made a few minutes ago. Not saved; after a restart the saved wall-clock time is used.
  static final Stopwatch _mono = Stopwatch()..start();
  Duration? _touchedMono;
  void markTouched() => _touchedMono = _mono.elapsed;
  String age() {
    final t = _touchedMono;
    if (t != null) {
      final d = _mono.elapsed - t;
      if (d.inMinutes < 1) return 'just now';
      if (d.inHours < 1) return '${d.inMinutes} min ago';
      if (d.inDays < 1) return '${d.inHours} h ago';
      return '${d.inDays} d ago';
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    final d = Duration(milliseconds: now - updatedAt);
    if (d.isNegative || d.inMinutes < 1) return 'just now';
    if (d.inHours < 1) return '${d.inMinutes} min ago';
    if (d.inDays < 1) return '${d.inHours} h ago';
    return '${d.inDays} d ago';
  }

  Map<String, dynamic> toJson() => {
        'v': format,
        'id': id,
        'name': name,
        'source': source,
        'snapshot': snapshot,
        'undo': undo,
        'history': history,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        'sample': sample,
        'exampleId': exampleId,
        'chat': chat,
      };

  static AppRecord? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'], name = j['name'], source = j['source'];
    if (id is! String || id.isEmpty || source is! String) return null;
    return AppRecord(
      id: id,
      name: name is String ? name : 'App',
      source: source,
      snapshot: j['snapshot'] is Map ? Map<String, dynamic>.from(j['snapshot'] as Map) : null,
      undo: j['undo'] is List ? List<dynamic>.from(j['undo'] as List) : [],
      history: j['history'] is List
          ? (j['history'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : [],
      createdAt: j['createdAt'] is int ? j['createdAt'] as int : null,
      updatedAt: j['updatedAt'] is int ? j['updatedAt'] as int : null,
      sample: j['sample'] == true,
      exampleId: j['exampleId'] is String ? j['exampleId'] as String : null,
      chat: j['chat'] is List ? (j['chat'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : [],
    );
  }

  void log(String kind, {String? request, String? summary}) {
    history.add({'at': DateTime.now().millisecondsSinceEpoch, 'kind': kind, if (request != null) 'request': request, if (summary != null) 'summary': summary});
    if (history.length > 60) history.removeRange(0, history.length - 60);
  }
}

/// Files under [root]: `apps/<id>.json` (+ `.bak`, `.tmp` during a write) and `state.json`.
///
/// Crash safety (write-then-rename): the new text goes to `<f>.tmp` and is flushed; the current file is
/// renamed to `<f>.bak`; the tmp is renamed over `<f>`. A read tries `<f>`, then `<f>.tmp`, then `<f>.bak`
/// and takes the first that parses completely, so a kill at any point of a write leaves the last good copy.
class AppStore {
  AppStore(this.root) {
    _apps.createSync(recursive: true);
  }
  final Directory root;
  Directory get _apps => Directory('${root.path}/apps');
  File get _state => File('${root.path}/state.json');
  final Map<String, Future<void>> _queue = {};

  File _file(String id) => File('${_apps.path}/${_safe(id)}.json');
  static String _safe(String id) => id.replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');

  /// Serialises writes per file so two quick saves never interleave.
  Future<void> _serial(String key, Future<void> Function() job) {
    final prev = _queue[key] ?? Future.value();
    final next = prev.catchError((_) {}).then((_) => job());
    _queue[key] = next;
    return next.whenComplete(() { if (identical(_queue[key], next)) _queue.remove(key); });
  }

  static Future<void> writeAtomic(File f, String text) async {
    final tmp = File('${f.path}.tmp');
    final bak = File('${f.path}.bak');
    final raf = await tmp.open(mode: FileMode.write);
    try {
      await raf.writeString(text);
      await raf.flush();
    } finally {
      await raf.close();
    }
    if (await f.exists()) await f.rename(bak.path);
    await tmp.rename(f.path);
  }

  static Future<Object?> readValid(File f) async {
    for (final c in [f, File('${f.path}.tmp'), File('${f.path}.bak')]) {
      try {
        if (!await c.exists()) continue;
        final j = jsonDecode(await c.readAsString());
        if (j is Map && j['v'] != null) return j;
      } catch (_) {
        // truncated or damaged: try the next copy
      }
    }
    return null;
  }

  Future<void> save(AppRecord r, {bool touch = true}) {
    if (touch) { r.updatedAt = DateTime.now().millisecondsSinceEpoch; r.markTouched(); }
    final text = jsonEncode(r.toJson());
    return _serial(r.id, () => writeAtomic(_file(r.id), text));
  }

  Future<AppRecord?> load(String id) async => AppRecord.fromJson(await readValid(_file(id)));

  Future<List<AppRecord>> list() async {
    final ids = <String>{};
    if (await _apps.exists()) {
      await for (final e in _apps.list()) {
        if (e is! File) continue;
        final n = e.uri.pathSegments.last;
        final m = RegExp(r'^(.*?)\.json(\.bak|\.tmp)?$').firstMatch(n);
        if (m != null) ids.add(m.group(1)!);
      }
    }
    final out = <AppRecord>[];
    for (final id in ids) {
      final r = await load(id);
      if (r != null) out.add(r);
    }
    out.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return out;
  }

  Future<void> delete(String id) => _serial(id, () async {
        for (final f in [_file(id), File('${_file(id).path}.bak'), File('${_file(id).path}.tmp')]) {
          if (await f.exists()) await f.delete();
        }
      });

  Future<String?> currentId() async {
    final j = await readValid(_state);
    return j is Map && j['current'] is String ? j['current'] as String : null;
  }

  Future<void> setCurrent(String? id) => _serial('state', () => writeAtomic(_state, jsonEncode({'v': 1, 'current': id})));

  /// Backup of every app as one JSON text.
  Future<String> exportAll() async {
    final apps = await list();
    return const JsonEncoder.withIndent(' ').convert({
      'molde_backup': 1,
      'at': DateTime.now().toUtc().toIso8601String(),
      'current': await currentId(),
      'apps': apps.map((a) => a.toJson()).toList(),
    });
  }

  /// Restores a backup: every app in it is written (an app with the same id is replaced). Returns the count,
  /// or throws FormatException when the text is not a Molde backup (nothing is written then).
  Future<int> importAll(String text) async {
    final j = jsonDecode(text);
    if (j is! Map || j['molde_backup'] != 1 || j['apps'] is! List) throw const FormatException('not a Molde backup');
    final recs = <AppRecord>[];
    for (final a in j['apps'] as List) {
      final r = AppRecord.fromJson(a);
      if (r == null) throw const FormatException('a damaged app in the backup');
      recs.add(r);
    }
    for (final r in recs) {
      final updated = r.updatedAt;
      await save(r);
      r.updatedAt = updated;
    }
    if (j['current'] is String && recs.any((r) => r.id == j['current'])) await setCurrent(j['current'] as String);
    return recs.length;
  }
}
