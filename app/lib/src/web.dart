import 'dart:ui' show Color;
import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'bridge.dart';

/// The WebView may only show the page bundled in the app. Everything else (the network, other files) is refused.
bool allowNavigation(String url) => url.startsWith('file:///android_asset/');

/// The WebView that holds the user's app. Loads the bundled page only; every other address is refused.
class WebHost implements JsTransport {
  WebHost() {
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..addJavaScriptChannel('MoldeHost', onMessageReceived: (m) => bridge.onRaw(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (r) => allowNavigation(r.url) ? NavigationDecision.navigate : NavigationDecision.prevent,
        onWebResourceError: (e) => bridge.onRaw('{"t":"log","msg":"web error: ${e.description.replaceAll('"', "'")}"}'),
      ));
    final p = controller.platform;
    if (p is AndroidWebViewController) {
      // debug builds only: lets the test scripts read the page over the DevTools socket
      if (kDebugMode) AndroidWebViewController.enableDebugging(true);
      p.setAllowFileAccess(true);
      p.setAllowContentAccess(false);
    }
    bridge = WebBridge(this);
  }
  late final WebViewController controller;
  late final WebBridge bridge;

  Future<void> load() {
    bridge.pageReloading();
    return controller.loadFlutterAsset('assets/web/index.html');
  }

  @override
  Future<void> run(String js) => controller.runJavaScript(js);
}
