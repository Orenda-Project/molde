import 'package:flutter/services.dart';

/// Android helpers used by the downloader (same channel as the model: android/.../MainActivity.kt).
class Platform {
  Platform({MethodChannel? channel}) : _ch = channel ?? const MethodChannel('molde/llm');
  final MethodChannel _ch;

  Future<int> freeSpace(String path) async => (await _ch.invokeMethod<num>('freeSpace', {'path': path}))?.toInt() ?? 1 << 40;
  /// wifi | mobile | none | other
  Future<String> networkType() async { try { return await _ch.invokeMethod<String>('networkType') ?? 'other'; } catch (_) { return 'other'; } }
  Future<void> notify(String title, String text, int pct) async { try { await _ch.invokeMethod('dlNotify', {'title': title, 'text': text, 'pct': pct}); } catch (_) {} }
  Future<void> stopNotify() async { try { await _ch.invokeMethod('dlStop'); } catch (_) {} }
  Future<void> requestNotifications() async { try { await _ch.invokeMethod('requestNotifications'); } catch (_) {} }
  Future<bool> openUrl(String url) async { try { return await _ch.invokeMethod<bool>('openUrl', {'url': url}) ?? false; } catch (_) { return false; } }
}
