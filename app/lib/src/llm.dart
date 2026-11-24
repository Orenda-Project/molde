import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';

/// Where the model is and how it was loaded.
class ModelInfo {
  ModelInfo(this.path, this.sizeBytes, this.loadSeconds, {this.system, this.arm, this.name});
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
      if (!await models.exists()) continue;
      final files = <File>[];
      await for (final e in models.list()) {
        if (e is File && e.path.toLowerCase().endsWith('.gguf')) files.add(e);
      }
      if (files.isEmpty) continue;
      final preferred = files.where((f) => f.uri.pathSegments.last == 'model.gguf');
      if (preferred.isNotEmpty) return preferred.first;
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
    _loading ??= _load(dirs, bundled).whenComplete(() => _loading = null);
    return _loading!.then((_) => model == null ? (loadError ?? 'no model') : null);
  }

  Future<void> _load(List<Directory> dirs, File? bundled) async {
    loadError = null;
    final f = bundled ?? await locate(dirs);
    if (f == null) {
      loadError = 'No model file is installed. Copy a .gguf into ${dirs.first.path}/models/ (see the README).';
      return;
    }
    final p = await info();
    final cores = (p['cores'] as int?) ?? 4;
    final threads = (cores ~/ 2).clamp(2, 4);
    final side = await readSidecar(f);
    final sw = Stopwatch()..start();
    final err = await _ch.invokeMethod<String>('load', {'path': f.path, 'nCtx': 2048, 'threads': threads});
    if (err != null && err.isNotEmpty) {
      loadError = err;
      return;
    }
    model = ModelInfo(f.path, await f.length(), sw.elapsedMilliseconds / 1000, system: side['system'] as String?, arm: side['arm'] as String?, name: side['name'] as String?);
  }

  Future<void> unload() async {
    model = null;
    await _ch.invokeMethod('unload');
  }

  Future<Map<String, dynamic>> complete(Map<String, dynamic> req) async {
    if (model == null) return {'stop': 'error', 'text': '', 'error': 'the model is not loaded'};
    final s = await _ch.invokeMethod<String>('complete', req);
    return Map<String, dynamic>.from(jsonDecode(s ?? '{}') as Map);
  }

  Future<void> cancel() => _ch.invokeMethod('cancel');
  Future<void> reset() => _ch.invokeMethod('reset');
}
