// Measures what the app really does with a model's raw ops answers: the real MoldeController (direct paths first, then the model's
// answer applied by the Dart applier, then every safety step), over the page's real checker (js/tools/page_rpc.mjs, called per page call).
// Skipped unless MOLDE_APP_PATH_IN is set:
//   MOLDE_APP_PATH_IN=cases.json MOLDE_APP_PATH_OUT=out.json flutter test test/app_path_measure_test.dart
// cases.json: [{id, request, before, raw}]  (raw = the model's answer text, or null with `err` when the model gave nothing usable)
// out.json:   [{id, route: direct|model|none, applied: bool, source (what the app would run), message, kind}]
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/bridge.dart';
import 'package:molde/src/controller.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/store.dart';

class _Page implements JsTransport {
  _Page(this.bridge);
  final WebBridge bridge;
  final Map<String, Object? Function(Map<String, dynamic> args)> handlers = {};
  final List<String> calls = [];
  @override
  Future<void> run(String js) async {
    final m = RegExp(r'^Molde\.rpc\((\d+), ("(?:[^"\\]|\\.)*"), (.*)\)$', dotAll: true).firstMatch(js);
    if (m == null) return;
    final id = int.parse(m.group(1)!);
    final method = jsonDecode(m.group(2)!) as String;
    final a = jsonDecode(m.group(3)!) as Map<String, dynamic>;
    calls.add(method);
    scheduleMicrotask(() { final h = handlers[method]; bridge.onRaw(jsonEncode({'t': 'reply', 'id': id, 'ok': true, 'value': h == null ? {'ok': true} : h(a)})); });
  }
}

class _Holder implements JsTransport {
  JsTransport? inner;
  @override
  Future<void> run(String js) async => inner?.run(js);
}

void main() {
  final inPath = Platform.environment['MOLDE_APP_PATH_IN'];
  final outPath = Platform.environment['MOLDE_APP_PATH_OUT'] ?? '/tmp/app_path_out.json';
  final jsDir = Platform.environment['MOLDE_JS_DIR'] ?? '${Directory.current.path}/js';
  test('app path over raw ops answers', () async {
    final cases = (jsonDecode(File(inPath!).readAsStringSync()) as List).cast<Map<String, dynamic>>();
    final results = <Map<String, dynamic>>[];
    for (final cs in cases) {
      final tmp = Directory.systemTemp.createTempSync('molde_ap_');
      final holder = _Holder();
      final bridge = WebBridge(holder); final page = _Page(bridge); holder.inner = page;
      bridge.onRaw(jsonEncode({'t': 'ready'}));
      final llm = LlmService()..model = ModelInfo('/m.gguf', 1, 0.1, format: 'ops');
      final before = '${cs['before']}';
      final c = MoldeController(store: AppStore(Directory('${tmp.path}/molde')), bridge: bridge, llm: llm, modelDirs: [tmp], readAsset: (p) async => before);
      String? applied;
      var modelCalled = false;
      page.handlers['open'] = (a) => {'ok': true};
      page.handlers['generate'] = (a) {
        modelCalled = true;
        if (cs['raw'] == null) return {'ok': false, 'program': '', 'errors': [cs['err'] ?? 'the model wrote nothing'], 'stats': {'seconds': 1.0}};
        return {'ok': true, 'format': 'ops', 'ops': cs['raw'], 'stats': {'seconds': 1.0}};
      };
      page.handlers['check'] = (a) => _node(jsDir, 'check', before, '${a['source']}');
      page.handlers['evaluate'] = (a) => _node(jsDir, 'evaluate', before, '${a['source']}');
      page.handlers['applyEdit'] = (a) { applied = '${a['source']}'; return {'verdict': 'safe', 'warnings': [], 'changes': [], 'refused': []}; };
      await c.store.save(AppRecord(id: 'a1', name: 'App', source: before));
      await c.init();
      c.changeCurrent();
      await c.send('${cs['request']}');
      await c.settleSaves();
      final m = c.chat.last;
      results.add({'id': cs['id'], 'route': applied == null && !modelCalled ? 'none' : (modelCalled ? 'model' : 'direct'), 'applied': applied != null, 'source': applied, 'message': m.text, 'kind': m.kind});
      tmp.deleteSync(recursive: true);
    }
    File(outPath).writeAsStringSync(const JsonEncoder.withIndent(' ').convert(results));
  }, skip: inPath == null ? 'set MOLDE_APP_PATH_IN to measure' : false, timeout: const Timeout(Duration(minutes: 30)));
}

Map<String, dynamic> _node(String jsDir, String method, String before, String source) {
  final r = Process.runSync('node', ['$jsDir/tools/page_rpc.mjs'], stdoutEncoding: utf8, environment: {...Platform.environment, 'MOLDE_RPC': jsonEncode({'method': method, 'before': before, 'source': source})});
  return jsonDecode('${r.stdout}') as Map<String, dynamic>;
}
