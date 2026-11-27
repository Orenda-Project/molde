import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';

/// Where the model is and how it was loaded.
class ModelInfo {
  ModelInfo(this.path, this.sizeBytes, this.loadSeconds, {this.system, this.arm, this.name, this.template = 'gemma', this.architecture = '', this.format = 'whole'});
  /// How the model writes an edit and starts a create: whole (the full program; r3, Qwen) or ops (patch operations on numbered lines, and a plan line before a new program; r5c).
  final String format;
  /// The prompt format the model was trained with: gemma (turn markers) or qwen (ChatML with an empty think block).
  final String template;
  final String architecture; // general.architecture of the GGUF
  final String path;
  final int sizeBytes;
  final double loadSeconds;
  final String? system; // from <model>.json: the training prompt of this model
  final String? arm; // D or E
  final String? name;
}

/// The on-device model (llama.cpp through our own JNI layer; see android/app/src/main/cpp/molde_jni.cpp).
class LlmService {
  LlmService({MethodChannel? channel}) : _ch = channel ?? const MethodChannel('molde/llm');
  final MethodChannel _ch;

  ModelInfo? model;
  /// The model chosen in Settings (or just downloaded); tried before the hand-placed ones.
  File? preferred;
  String? loadError;
  Map<String, dynamic>? platform;
  Future<void>? _loading;

  Future<Map<String, dynamic>> info() async {
    platform ??= Map<String, dynamic>.from(await _ch.invokeMethod('info') as Map);
    return platform!;
  }

  /// Where to look for a model, in this order: <external files>/models/, <app files>/models/.
  /// Inside a folder `model.gguf` wins, else the newest `*.gguf`. A file `<name>.json` next to the model (or
  /// `model.json`) may hold {"system": "...", "arm": "D"|"E", "name": "..."}.
  static Future<File?> locate(List<Directory> dirs) async {
    for (final d in dirs) {
      final models = Directory('${d.path}/models');
      // a folder made by `adb shell` may not be listable by the app, but its files can still be opened
      final direct = File('${models.path}/model.gguf');
      try {
        if (await direct.exists()) return direct;
      } catch (_) {}
      final files = <File>[];
      try {
        if (!await models.exists()) continue;
        await for (final e in models.list()) {
          if (e is File && e.path.toLowerCase().endsWith('.gguf')) files.add(e);
        }
      } catch (_) {
        continue;
      }
      if (files.isEmpty) continue;
            files.sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
      return files.first;
    }
    return null;
  }

  /// Copies a bundled model asset (assets/model/model.gguf, never committed) into the app files on first run.
  static Future<File?> copyBundled(Directory filesDir, Future<ByteData> Function() read, bool Function() exists) async {
    if (!exists()) return null;
    final out = File('${filesDir.path}/models/model.gguf');
    if (await out.exists()) return out;
    await out.parent.create(recursive: true);
    final data = await read();
    final tmp = File('${out.path}.tmp');
    await tmp.writeAsBytes(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes), flush: true);
    await tmp.rename(out.path);
    return out;
  }

  static Future<Map<String, dynamic>> readSidecar(File model) async {
    for (final f in [File(model.path.replaceAll(RegExp(r'\.gguf$', caseSensitive: false), '.json')), File('${model.parent.path}/model.json')]) {
      try {
        if (await f.exists()) {
          final j = jsonDecode(await f.readAsString());
          if (j is Map) return Map<String, dynamic>.from(j);
        }
      } catch (_) {}
    }
    return {};
  }

  /// Loads (once). Returns null when the model is ready, or a plain-language reason it is not.
  Future<String?> ensureLoaded(List<Directory> dirs, {File? bundled}) {
    if (model != null) return Future.value(null);
    _loading ??= _load(dirs, bundled).catchError((Object e) { loadError = 'The model could not be loaded: $e'; }).whenComplete(() => _loading = null);
    return _loading!.then((_) => model == null ? (loadError ?? 'no model') : null);
  }

  Future<void> _load(List<Directory> dirs, File? bundled) async {
    loadError = null;
    final f = bundled ?? ((preferred != null && await preferred!.exists()) ? preferred : await locate(dirs));
    if (f == null) {
      loadError = 'No model is installed yet. Open the chat, tap the app name, then Settings > Model to download one (or copy a .gguf into ${dirs.first.path}/models/).';
      return;
    }
    final p = await info();
    final cores = (p['cores'] as int?) ?? 4;
    final threads = (cores * 3 ~/ 4).clamp(2, 4);
    final side = await readSidecar(f);
    final sw = Stopwatch()..start();
    final err = await _ch.invokeMethod<String>('load', {'path': f.path, 'nCtx': 4096, 'threads': threads});
    if (err != null && err.isNotEmpty) {
      loadError = err;
      return;
    }
    final arch = await meta('general.architecture');
    model = ModelInfo(f.path, await f.length(), sw.elapsedMilliseconds / 1000, system: side['system'] as String?, arm: side['arm'] as String?, name: side['name'] as String?, architecture: arch, template: pickTemplate(sidecar: side['template'] as String?, hint: templateHint, architecture: arch), format: pickFormat(sidecar: side['format'] as String?, hint: formatHint));
  }

  Future<void> unload() async {
    model = null;
    await _ch.invokeMethod('unload');
  }

  Future<Map<String, dynamic>> complete(Map<String, dynamic> req) async {
    if (model == null) return {'stop': 'error', 'text': '', 'error': 'the model is not loaded'};
    final s = await _ch.invokeMethod<String>('complete', req);
    final m = Map<String, dynamic>.from(jsonDecode(s ?? '{}') as Map);
    if (noteHung(m)) model = null; // the native side abandoned a stuck call and has a fresh core: load the model again on the next request
    return m;
  }

  /// What the native call in flight is doing: reading the prompt (done of total tokens), writing (gen tokens so far) or nothing.
  /// Null when the platform cannot say (older native side, tests). Never throws.
  Future<NativeProgress?> progress() async {
    try {
      final s = await _ch.invokeMethod<String>('progress');
      return NativeProgress.parse(s);
    } catch (_) { return null; }
  }

  Future<String> meta(String key) async { try { return await _ch.invokeMethod<String>('meta', {'key': key}) ?? ''; } catch (_) { return ''; } }

  /// models.json can name the template of a model; it is used when no sidecar file says and the architecture does not.
  String? templateHint;
  /// models.json can say `format: "ops"` for a model; a sidecar `format` (for a model pushed by hand) wins over it.
  String? formatHint;
  /// `ops` only when something says so; every other value, and no value, is the whole-program format the r3 model uses.
  static String pickFormat({String? sidecar, String? hint}) {
    for (final f in [sidecar, hint]) { if (f == 'ops') return 'ops'; if (f == 'whole') return 'whole'; }
    return 'whole';
  }
  /// The name the user sees for the loaded model (catalogue name); never a file name.
  String? displayName;

  /// Which prompt format a model uses: the sidecar `template`, else the catalogue hint, else the GGUF architecture (qwen*) , else gemma.
  static String pickTemplate({String? sidecar, String? hint, String architecture = ''}) {
    for (final t in [sidecar, hint]) { if (t == 'qwen' || t == 'chatml') return 'qwen'; if (t == 'gemma') return 'gemma'; }
    return architecture.toLowerCase().startsWith('qwen') ? 'qwen' : 'gemma';
  }

  /// Set when a native call stopped answering and was abandoned (see MainActivity.abandon); the controller reads and clears it.
  bool hung = false;
  /// Records an abandoned call from a result map; true when this result is one.
  bool noteHung(Map<String, dynamic> m) {
    if (m['hung'] == true) { hung = true; return true; }
    return false;
  }
  bool takeHung() { final h = hung; hung = false; return h; }

  /// Developer menu: the next model call blocks for `ms` and ignores cancel, to check the recovery.
  Future<void> debugHang(int ms) => _ch.invokeMethod('debugHang', {'ms': ms});

  Future<void> cancel() => _ch.invokeMethod('cancel');
  Future<void> reset() => _ch.invokeMethod('reset');
}

/// One reading of the native progress ("prompt,done,total,gen" | "gen,done,total,gen" | "idle,0,0,0").
class NativeProgress {
  const NativeProgress(this.phase, this.done, this.total, this.gen);
  final String phase;
  final int done, total, gen;
  static NativeProgress? parse(String? s) {
    if (s == null) return null;
    final p = s.split(',');
    if (p.length != 4) return null;
    final n = [for (final x in p.skip(1)) int.tryParse(x)];
    if (n.contains(null) || !{'prompt', 'gen', 'idle'}.contains(p[0])) return null;
    return NativeProgress(p[0], n[0]!, n[1]!, n[2]!);
  }
}
