import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:molde/src/store.dart';

void main() {
  late Directory tmp;
  late AppStore store;
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('molde_store_');
    store = AppStore(tmp);
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  AppRecord rec(String id, {String source = 'app "A" drop\n', Map<String, dynamic>? snap}) =>
      AppRecord(id: id, name: 'A', source: source, snapshot: snap ?? {'data': {'tables': {'t': [1, 2, 3]}}});

  test('save then load gives back the same app, data and undo stack', () async {
    final r = rec('a1')..undo = [{'src': 'old', 'ver': 0}]..log('create', request: 'water');
    await store.save(r);
    final back = (await store.load('a1'))!;
    expect(back.source, r.source);
    expect(back.snapshot, r.snapshot);
    expect(back.undo, r.undo);
    expect(back.history.single['request'], 'water');
  });

  test('a new store object on the same folder (a restart) restores everything', () async {
    await store.save(rec('a1'));
    await store.save(rec('a2', source: 'app "B" star\n'));
    await store.setCurrent('a2');
    final again = AppStore(tmp);
    expect((await again.list()).map((e) => e.id).toSet(), {'a1', 'a2'});
    expect(await again.currentId(), 'a2');
  });

  test('crash in the middle of a write: a truncated main file falls back to the last good copy', () async {
    await store.save(rec('a1', snap: {'data': {'n': 1}}));
    await store.save(rec('a1', snap: {'data': {'n': 2}})); // now .bak holds n=1, main n=2
    final main = File('${tmp.path}/apps/a1.json');
    final text = await main.readAsString();
    await main.writeAsString(text.substring(0, text.length ~/ 2)); // power cut: half a file
    final back = (await store.load('a1'))!;
    expect(back.snapshot!['data'], {'n': 1}); // the .bak, never a broken app
  });

  test('crash after the rename to .bak but before the new file is in place: tmp or bak is used', () async {
    await store.save(rec('a1', snap: {'data': {'n': 1}}));
    final main = File('${tmp.path}/apps/a1.json');
    // state left by a kill between the two renames: main is gone, tmp holds the complete new text
    final newText = jsonEncode(rec('a1', snap: {'data': {'n': 9}}).toJson());
    await main.rename('${main.path}.bak');
    await File('${main.path}.tmp').writeAsString(newText);
    expect((await store.load('a1'))!.snapshot!['data'], {'n': 9});
    // and with a half-written tmp the old copy wins
    await File('${main.path}.tmp').writeAsString(newText.substring(0, 20));
    expect((await store.load('a1'))!.snapshot!['data'], {'n': 1});
  });

  test('a half-written tmp never replaces a good main file', () async {
    await store.save(rec('a1', snap: {'data': {'n': 1}}));
    await File('${tmp.path}/apps/a1.json.tmp').writeAsString('{"v":1,"id":"a1","sou');
    expect((await store.load('a1'))!.snapshot!['data'], {'n': 1});
  });

  test('quick consecutive saves of one app all land, in order', () async {
    final futures = <Future<void>>[];
    for (var i = 0; i < 25; i++) {
      futures.add(store.save(rec('a1', snap: {'data': {'n': i}})));
    }
    await Future.wait(futures);
    expect((await store.load('a1'))!.snapshot!['data'], {'n': 24});
  });

  test('delete removes the app and its backup copies', () async {
    await store.save(rec('a1'));
    await store.save(rec('a1'));
    await store.delete('a1');
    expect(await store.load('a1'), isNull);
    expect(Directory('${tmp.path}/apps').listSync(), isEmpty);
  });

  test('list is newest first and skips damaged files', () async {
    await store.save(rec('old'));
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await store.save(rec('new'));
    await File('${tmp.path}/apps/junk.json').writeAsString('not json');
    expect((await store.list()).map((e) => e.id).toList(), ['new', 'old']);
  });

  test('backup round trip: export, wipe, import', () async {
    await store.save(rec('a1', snap: {'data': {'n': 1}}));
    await store.save(rec('a2', source: 'app "B" star\n'));
    await store.setCurrent('a1');
    final text = await store.exportAll();
    for (final a in await store.list()) { await store.delete(a.id); }
    expect(await store.list(), isEmpty);
    expect(await store.importAll(text), 2);
    expect((await store.load('a1'))!.snapshot!['data'], {'n': 1});
    expect((await store.load('a2'))!.source, 'app "B" star\n');
    expect(await store.currentId(), 'a1');
  });

  test('importing something that is not a backup writes nothing and says so', () async {
    await store.save(rec('a1'));
    expect(() => store.importAll('{"hello": 1}'), throwsFormatException);
    expect(() => store.importAll('nonsense'), throwsFormatException);
    expect(() => store.importAll(jsonEncode({'molde_backup': 1, 'apps': [{'id': 'x'}]})), throwsFormatException);
    expect((await store.list()).length, 1);
  });

  test('odd ids cannot escape the apps folder', () async {
    await store.save(rec('../../evil'));
    expect(File('${tmp.path}/../evil.json').existsSync(), isFalse);
    expect((await store.load('../../evil')) != null, isTrue);
  });
}
