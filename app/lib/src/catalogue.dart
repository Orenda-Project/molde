import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// One downloadable model from models.json.
class CatalogueModel {
  CatalogueModel({required this.id, required this.name, required this.file, required this.url, required this.bytes, required this.sha256, this.recommended = false, this.note = '', this.template, this.format});
  final String id, name, file, url, sha256, note;
  final String? template; // 'qwen' for ChatML models; absent for Gemma
  /// 'ops' for a model trained on patch-operation edits and plan-first creates (r5c); absent or 'whole' for the full-program models.
  final String? format;
  final int bytes;
  final bool recommended;

  /// The file name on the phone (the catalogue path may have folders).
  String get localName => file.split('/').last;

  static CatalogueModel? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'], name = j['name'], file = j['file'], url = j['url'], bytes = j['bytes'], sha = j['sha256'];
    if (id is! String || name is! String || file is! String || url is! String || bytes is! int || bytes <= 0 || sha is! String) return null;
    if (!RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(sha)) return null;
    if (!url.startsWith('https://')) return null; // never plain http
    return CatalogueModel(id: id, name: name, file: file, url: url, bytes: bytes, sha256: sha.toLowerCase(), recommended: j['recommended'] == true, note: j['note'] is String ? j['note'] as String : '', template: j['template'] is String ? j['template'] as String : null, format: j['format'] == 'ops' || j['format'] == 'whole' ? j['format'] as String : null);
  }
}

class Catalogue {
  Catalogue({required this.version, required this.models, required this.licence, this.updated = '', this.fromNetwork = false});
  final int version;
  final List<CatalogueModel> models;
  final String licence, updated;
  final bool fromNetwork;

  CatalogueModel? get recommended => models.where((m) => m.recommended).firstOrNull ?? models.firstOrNull;
  CatalogueModel? byId(String id) => models.where((m) => m.id == id).firstOrNull;

  /// Throws FormatException on anything that is not a usable catalogue (a bad entry is skipped; none usable is an error).
  static Catalogue parse(String text, {bool fromNetwork = false}) {
    final j = jsonDecode(text);
    if (j is! Map || j['models'] is! List) throw const FormatException('not a catalogue');
    final ms = (j['models'] as List).map(CatalogueModel.fromJson).whereType<CatalogueModel>().toList();
    if (ms.isEmpty) throw const FormatException('the catalogue has no usable model');
    return Catalogue(version: j['version'] is int ? j['version'] as int : 1, models: ms, licence: j['licence'] is String ? j['licence'] as String : 'Gemma Terms of Use: https://ai.google.dev/gemma/terms', updated: '${j['updated'] ?? ''}', fromNetwork: fromNetwork);
  }

  static const url = 'https://huggingface.co/oyekamal/molde-tiny/resolve/main/models.json';

  /// The licence text's link (first https URL in the line).
  String get licenceUrl => RegExp(r'https://\S+').firstMatch(licence)?.group(0) ?? 'https://ai.google.dev/gemma/terms';

  /// Fetches the live catalogue; on any failure (offline, bad JSON, timeout) returns the bundled copy.
  static Future<Catalogue> load({required Future<String> Function() bundled, Future<String> Function()? fetch, Duration timeout = const Duration(seconds: 8)}) async {
    try {
      final text = await (fetch ?? _fetch)().timeout(timeout);
      return parse(text, fromNetwork: true);
    } catch (_) {
      return parse(await bundled());
    }
  }

  static Future<String> _fetch() async {
    final c = HttpClient()..connectionTimeout = const Duration(seconds: 6);
    try {
      var uri = Uri.parse(url);
      for (var hop = 0; hop < 5; hop++) {
        final req = await c.getUrl(uri)..followRedirects = false;
        final res = await req.close();
        if (res.isRedirect) {
          await res.drain<void>();
          uri = uri.resolve(res.headers.value('location')!);
          continue;
        }
        if (res.statusCode != 200) throw HttpException('catalogue status ${res.statusCode}');
        return await utf8.decodeStream(res);
      }
      throw const HttpException('too many redirects');
    } finally {
      c.close(force: true);
    }
  }
}
