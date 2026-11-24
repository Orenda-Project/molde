import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'src/controller.dart';
import 'src/llm.dart';
import 'src/store.dart';
import 'src/ui.dart';
import 'src/web.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final docs = await getApplicationDocumentsDirectory();
  final ext = await getExternalStorageDirectory(); // /sdcard/Android/data/<pkg>/files (adb push works here)
  final web = WebHost();
  final llm = LlmService();
  final dirs = <Directory>[if (ext != null) ext, docs];
  // first run: copy a bundled model (assets/model/model.gguf, never committed) into the app files
  try {
    final bundled = await LlmService.copyBundled(docs, () => rootBundle.load('assets/model/model.gguf'), () => true);
    if (bundled != null) debugPrint('bundled model copied: ${bundled.path}');
  } catch (_) {/* no bundled model: the normal case */}
  final c = MoldeController(
    store: AppStore(Directory('${docs.path}/molde')),
    bridge: web.bridge,
    llm: llm,
    modelDirs: dirs,
    readAsset: rootBundle.loadString,
    backupDir: ext == null ? null : Directory('${ext.path}/backups'),
  );
  runApp(MoldeApp(c: c, web: web));
}

class MoldeApp extends StatefulWidget {
  const MoldeApp({super.key, required this.c, required this.web});
  final MoldeController c;
  final WebHost web;
  @override
  State<MoldeApp> createState() => _MoldeAppState();
}

class _MoldeAppState extends State<MoldeApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_start());
  }

  Future<void> _start() async {
    await widget.web.load();
    await widget.web.bridge.ready.timeout(const Duration(seconds: 20), onTimeout: () {});
    await widget.c.init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.paused || s == AppLifecycleState.inactive) unawaited(widget.c.onPause());
    if (s == AppLifecycleState.resumed) unawaited(widget.c.onResume());
  }

  @override
  void didChangePlatformBrightness() {
    final dark = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    unawaited(widget.c.setMode(dark));
  }

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF1E6B5C);
    return MaterialApp(
      title: 'Molde',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: seed), useMaterial3: true),
      darkTheme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark), useMaterial3: true),
      home: ShellPage(c: widget.c, web: widget.web.controller),
    );
  }
}
