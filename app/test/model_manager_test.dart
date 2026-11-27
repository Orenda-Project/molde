import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/catalogue.dart';
import 'package:molde/src/llm.dart';
import 'package:molde/src/models.dart';
import 'package:molde/src/platform.dart';
import 'package:molde/src/web.dart';

class FakeLlm extends LlmService {
  int loads = 0;
  @override
  Future<void> unload() async { model = null; }
  @override
  Future<String?> ensureLoaded(List<Directory> dirs, {File? bundled}) async { loads++; model = ModelInfo(preferred?.path ?? 'x', 1, 0); return null; }
}

class FakePlatform extends Platform {
  @override
  Future<String> networkType() async => 'wifi';
  @override
  Future<void> notify(String t, String x, int p) async {}
  @override
  Future<void> stopNotify() async {}
  @override
  Future<void> requestNotifications() async {}
}

void main() {
  templateTests();
  late Directory tmp;
  late CatalogueModel a, b;
  ModelManager make(FakeLlm llm) => ModelManager(
        llm: llm, settingsFile: File('${tmp.path}/settings.json'), modelsDir: Directory('${tmp.path}/models'), handDirs: [Directory('${tmp.path}/ext')],
        platform: FakePlatform(), loadCatalogue: () async => Catalogue(version: 1, licence: 'x https://l', models: [a, b]));
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('molde_mm_');
    a = CatalogueModel(id: 'a', name: 'A', file: 'd/a.gguf', url: 'https://h/a', bytes: 4, sha256: '0' * 64, recommended: true);
    b = CatalogueModel(id: 'b', name: 'B', file: 'd/b.gguf', url: 'https://h/b', bytes: 4, sha256: '1' * 64);
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('no model anywhere: hasModel is false (the setup screen shows)', () async {
    final mm = make(FakeLlm());
    await mm.init();
    expect(mm.ready, isTrue);
    expect(mm.hasModel, isFalse);
  });

  test('an adb-pushed file shows as "Added by hand" and is used', () async {
    final d = Directory('${tmp.path}/ext/models')..createSync(recursive: true);
    File('${d.path}/model.gguf').writeAsBytesSync([1, 2, 3, 4, 5]);
    final llm = FakeLlm();
    final mm = make(llm);
    await mm.init();
    expect(mm.hasModel, isTrue);
    expect(mm.active!.source, 'hand');
    expect(mm.active!.sourceLabel, 'Added by hand');
    expect(llm.preferred!.path, endsWith('model.gguf'));
  });

  test('use switches the model and the choice survives a restart; delete of the active one clears it', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/a.gguf').writeAsBytesSync([1, 2, 3, 4]);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    final mm = make(FakeLlm());
    await mm.init();
    await mm.refreshCatalogue();
    expect(await mm.use(a), isNull);
    expect(mm.isActive(a), isTrue);
    expect(await mm.use(b), isNull);
    expect(mm.isActive(b), isTrue);
    expect(mm.isActive(a), isFalse);
    final again = make(FakeLlm());
    await again.init();
    expect(again.active!.id, 'b');
    expect(again.active!.sourceLabel, contains('Hugging Face'));
    await again.delete(b);
    expect(File('${md.path}/b.gguf').existsSync(), isFalse);
    expect(again.hasModel, isFalse);
    expect(again.installed(a), isTrue);
  });

  test('a file of the wrong size is refused by use() and nothing is loaded', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/a.gguf').writeAsBytesSync([1, 2]);
    final llm = FakeLlm();
    final mm = make(llm);
    await mm.init();
    expect(await mm.use(a), contains('missing or damaged'));
    expect(llm.loads, 0);
  });

  test('"newer model available" shows only for a downloaded model the catalogue dropped, not when the user picks between listed models', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    File('${md.path}/old.gguf').writeAsBytesSync([1, 2, 3]);
    final mm = make(FakeLlm());
    await mm.init();
    await mm.refreshCatalogue();
    await mm.use(b);
    expect(mm.newer, isNull);
    await mm.useFile('old.gguf');
    expect(mm.newer?.id, 'a');
  });

  test('after a restart the active model shows the catalogue name once the catalogue is loaded', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    File('${tmp.path}/settings.json').writeAsStringSync('{"v":1,"active":{"id":"b","file":"b.gguf","source":"catalogue"}}');
    final mm = make(FakeLlm());
    await mm.init();
    await mm.refreshCatalogue();
    expect(mm.active!.name, 'B');
  });

  test('0.7.1 a model added by hand is offered next to the downloaded one and can be switched to without deleting anything', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    final d = Directory('${tmp.path}/ext/models')..createSync(recursive: true);
    File('${d.path}/model.gguf').writeAsBytesSync([1, 2, 3, 4, 5, 6]);
    File('${tmp.path}/settings.json').writeAsStringSync('{"v":1,"active":{"id":"b","file":"b.gguf","source":"catalogue"}}');
    final mm = make(FakeLlm());
    await mm.init();
    expect(mm.active!.source, 'catalogue');
    expect(mm.handAvailable, isTrue);
    expect(mm.handBytes, 6);
    await mm.useHand();
    expect(mm.active!.source, 'hand');
    expect(mm.handAvailable, isFalse); // it is the one in use: no second row
    expect(File('${md.path}/b.gguf').existsSync(), isTrue); // nothing was deleted to get there
  });

  test('0.7.1 no hand model, or one inside the downloads folder, shows no "added by hand" row', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    final mm = make(FakeLlm());
    await mm.init();
    expect(mm.handAvailable, isFalse);
  });

  test('recommended model is listed first; a downloaded model the catalogue dropped stays usable under "Downloaded earlier"', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/old.gguf').writeAsBytesSync([1, 2, 3]);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    final mm = make(FakeLlm());
    mm.catalogue = Catalogue(version: 1, licence: 'x', models: [b, a]); // file order puts B first
    await mm.init();
    await mm.refreshCatalogue();
    expect(mm.ordered.map((m) => m.id).toList(), ['a', 'b']);
    expect(mm.downloadedEarlier.map((e) => e.file).toList(), ['old.gguf']);
    expect(mm.downloadedEarlier.first.bytes, 3);
    expect(await mm.useFile('old.gguf'), isNull);
    expect(mm.isActiveFile('old.gguf'), isTrue);
    expect(mm.active!.source, 'catalogue');
    await mm.deleteFile('old.gguf');
    expect(File('${md.path}/old.gguf').existsSync(), isFalse);
    expect(mm.downloadedEarlier, isEmpty);
    expect(mm.hasModel, isFalse);
  });

  test('switching or deleting the active model is refused while the chat is building', () async {
    final md = Directory('${tmp.path}/models')..createSync(recursive: true);
    File('${md.path}/a.gguf').writeAsBytesSync([1, 2, 3, 4]);
    File('${md.path}/b.gguf').writeAsBytesSync([1, 2, 3, 4]);
    final llm = FakeLlm();
    final mm = make(llm);
    await mm.init();
    await mm.refreshCatalogue();
    expect(await mm.use(a), isNull);
    var busy = true;
    mm.isBusy = () => busy;
    expect(mm.switchBlocked, isTrue);
    expect(await mm.use(b), ModelManager.busyMessage);
    expect(mm.isActive(a), isTrue);
    await mm.delete(a);
    expect(File('${md.path}/a.gguf').existsSync(), isTrue);
    busy = false;
    expect(await mm.use(b), isNull);
    expect(mm.isActive(b), isTrue);
    expect(mm.isActive(a), isFalse);
  });

  test('a model that is in no catalogue entry is never shown by its file name', () async {
    final d = Directory('${tmp.path}/ext/models')..createSync(recursive: true);
    File('${d.path}/r3-secret-name-Q4_K_M.gguf').writeAsBytesSync(List.filled(2097152, 1));
    final mm = make(FakeLlm());
    await mm.init();
    expect(mm.active!.name, 'Model added by hand (2 MB)');
    expect(mm.active!.name, isNot(contains('.gguf')));
    expect(mm.llm.displayName, 'Model added by hand (2 MB)');
    expect(ModelManager.fallbackName('catalogue', 253155008), 'Older model (241 MB)');
  });

  group('WebView stays locked', () {
    test('only the bundled page may be navigated to', () {
      expect(allowNavigation('file:///android_asset/flutter_assets/assets/web/index.html'), isTrue);
      expect(allowNavigation('https://huggingface.co/'), isFalse);
      expect(allowNavigation('http://example.com'), isFalse);
      expect(allowNavigation('file:///sdcard/x.html'), isFalse);
      expect(allowNavigation('intent://x'), isFalse);
    });
    test('the page carries a CSP with default-src none (no fetch, no images, no frames from the network)', () {
      final html = File('assets/web/index.html').readAsStringSync();
      expect(html, contains("default-src 'none'"));
      expect(html, isNot(contains('connect-src')));
      expect(RegExp(r'(src|href)="https?://').hasMatch(html), isFalse);
    });
  });
}

void templateTests() {
  group('prompt template choice', () {
    test('sidecar beats the catalogue hint, which beats the architecture; unknown means gemma', () {
      expect(LlmService.pickTemplate(sidecar: 'qwen', hint: 'gemma', architecture: 'gemma3'), 'qwen');
      expect(LlmService.pickTemplate(hint: 'qwen', architecture: 'gemma3'), 'qwen');
      expect(LlmService.pickTemplate(architecture: 'qwen35'), 'qwen');
      expect(LlmService.pickTemplate(hint: 'chatml', architecture: 'gemma3'), 'qwen');
      expect(LlmService.pickTemplate(architecture: 'Qwen3'), 'qwen');
      expect(LlmService.pickTemplate(architecture: 'gemma3'), 'gemma');
      expect(LlmService.pickTemplate(), 'gemma');
      expect(LlmService.pickTemplate(sidecar: 'weird', architecture: 'gemma3'), 'gemma');
    });
    test('models.json may carry a template field', () {
      final c = Catalogue.parse('{"models":[{"id":"q","name":"Q","file":"q.gguf","url":"https://h/q","bytes":5,"sha256":"${'a' * 64}","template":"qwen"},{"id":"g","name":"G","file":"g.gguf","url":"https://h/g","bytes":5,"sha256":"${'b' * 64}"}]}');
      expect(c.byId('q')!.template, 'qwen');
      expect(c.byId('g')!.template, isNull);
    });
  });
}
