import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'controller.dart';
import 'store.dart';
import 'models.dart';
import 'ui_models.dart';

/// The whole screen is the user's app; one chat button sits bottom-right and opens the chat sheet.
class ShellPage extends StatefulWidget {
  const ShellPage({super.key, required this.c, required this.web, required this.mm});
  final MoldeController c;
  final ModelManager mm;
  final WebViewController web;
  @override
  State<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends State<ShellPage> {
  bool open = false;
  bool showApps = false;
  final input = TextEditingController();
  final scroll = ScrollController();

  MoldeController get c => widget.c;

  @override
  void initState() {
    super.initState();
    c.addListener(_changed);
    widget.mm.addListener(_changed);
  }

  @override
  void dispose() {
    c.removeListener(_changed);
    widget.mm.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (!mounted) return;
    setState(() {});
    void toEnd() { if (scroll.hasClients) scroll.jumpTo(0); } // the list is reversed: offset 0 is the newest message
    // after layout, and once more when the last bubble (buttons, code block) has its final height
    WidgetsBinding.instance.addPostFrameCallback((_) { toEnd(); Future<void>.delayed(const Duration(milliseconds: 120), toEnd); });
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final cs = Theme.of(context).colorScheme;
    final panelH = (mq.size.height * 0.45).clamp(260.0, 520.0);
    return PopScope(
      canPop: !open,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (showApps) { setState(() => showApps = false); } else { FocusManager.instance.primaryFocus?.unfocus(); setState(() => open = false); }
      },
      child: Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: cs.surface,
      body: Stack(children: [
        Positioned.fill(child: Padding(padding: EdgeInsets.only(top: mq.padding.top), child: WebViewWidget(controller: widget.web))),
        if (c.booted && c.current == null && !c.busy) Positioned.fill(child: _Empty(c: c, onChat: () => setState(() { open = true; }))),
        if (widget.mm.ready && !widget.mm.hasModel && c.apps.isEmpty && !widget.mm.setupDismissed && !open)
          Positioned.fill(child: ModelSetupScreen(mm: widget.mm, onExamples: () => setState(() => widget.mm.setupDismissed = true))),
        if (!open && c.current?.sample == true)
          Positioned(
            left: 16,
            bottom: 24 + mq.padding.bottom,
            child: ActionChip(
              key: const Key('sample-clear'),
              avatar: const Icon(Icons.layers_clear_outlined, size: 18),
              label: const Text('Sample data · Clear'),
              onPressed: c.clearSample,
            ),
          ),
        if (!open)
          Positioned(
            right: 16,
            bottom: 16 + mq.padding.bottom,
            child: Semantics(
              label: 'Chat: create or change apps',
              button: true,
              child: FloatingActionButton(
                key: const Key('chat-fab'),
                tooltip: 'Chat',
                onPressed: () => setState(() { open = true; showApps = false; }),
                child: const Icon(Icons.chat_bubble_outline),
              ),
            ),
          ),
        if (open)
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: AnimatedPadding(
              duration: const Duration(milliseconds: 120),
              padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
              child: SizedBox(
                height: mq.viewInsets.bottom > 0 ? (mq.size.height - mq.viewInsets.bottom - mq.padding.top - 24).clamp(220.0, panelH) : panelH + mq.padding.bottom,
                child: _Sheet(
                  c: c, mm: widget.mm, scroll: scroll, input: input, showApps: showApps,
                  onClose: () { FocusManager.instance.primaryFocus?.unfocus(); setState(() => open = false); },
                  onToggleApps: () => setState(() => showApps = !showApps),
                  onPickedApp: () => setState(() => showApps = false),
                ),
              ),
            ),
          ),
      ]),
    ));
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.c, required this.onChat});
  final MoldeController c;
  final VoidCallback onChat;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ColoredBox(
      color: cs.surface,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.auto_awesome_outlined, size: 40, color: cs.primary),
              const SizedBox(height: 16),
              Text('Molde', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Tap the chat button and say what you want: a habit tracker, a budget, a score sheet. It appears here and keeps your data.',
                  textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: cs.onSurfaceVariant)),
              const SizedBox(height: 8),
              Text(c.modelStatus, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Sheet extends StatelessWidget {
  final ModelManager mm;
  const _Sheet({required this.c, required this.mm, required this.scroll, required this.input, required this.showApps, required this.onClose, required this.onToggleApps, required this.onPickedApp});
  final MoldeController c;
  final ScrollController scroll;
  final TextEditingController input;
  final bool showApps;
  final VoidCallback onClose, onToggleApps, onPickedApp;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHigh,
      elevation: 8,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 4, 0),
          child: Row(children: [
            Expanded(
              child: InkWell(
                key: const Key('apps-toggle'),
                borderRadius: BorderRadius.circular(8),
                onTap: onToggleApps,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(child: Text(showApps ? 'Your apps' : (c.current?.name ?? 'No app yet'), overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium)),
                      const SizedBox(width: 4),
                      Icon(showApps ? Icons.expand_less : Icons.expand_more, size: 20),
                    ]),
                    if (!showApps)
                      Semantics(
                        container: true,
                        excludeSemantics: true,
                        label: 'Mode: ${c.modeLabel}',
                        child: Container(
                          key: const Key('mode-label'),
                          margin: const EdgeInsets.only(top: 2),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: (c.current == null || c.newAppMode) ? cs.primaryContainer : cs.secondaryContainer, borderRadius: BorderRadius.circular(8)),
                          child: Text(c.modeLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: (c.current == null || c.newAppMode) ? cs.onPrimaryContainer : cs.onSecondaryContainer)),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
            IconButton(key: const Key('settings-open'), tooltip: 'Settings', onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SettingsPage(mm: mm))), icon: const Icon(Icons.settings_outlined)),
            IconButton(key: const Key('chat-close'), tooltip: 'Close chat', onPressed: onClose, icon: const Icon(Icons.close)),
          ]),
        ),
        const Divider(height: 1),
        Expanded(child: showApps ? _Apps(c: c, onPicked: onPickedApp) : _Chat(c: c, scroll: scroll, input: input)),
      ]),
    );
  }
}

class _Chat extends StatelessWidget {
  const _Chat({required this.c, required this.scroll, required this.input});
  final MoldeController c;
  final ScrollController scroll;
  final TextEditingController input;

  void _send() {
    final t = input.text;
    if (t.trim().isEmpty || c.busy) return;
    input.clear();
    FocusManager.instance.primaryFocus?.unfocus(); // the keyboard goes away so the answer is fully visible
    c.send(t);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final msgs = c.chat;
    final undoable = c.undoable;
    final creating = c.current == null || c.newAppMode;
    return Column(children: [
      Expanded(
        child: msgs.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(creating ? 'Describe the app you want.\nFor example: "a water tracker with a daily goal".' : 'Ask for a change to ${c.current!.name}, or switch to a new app below.',
                      textAlign: TextAlign.center, style: TextStyle(color: cs.onSurfaceVariant)),
                ),
              )
            : ListView.builder(
                // reversed: the newest message is anchored at the bottom and the oldest can always be scrolled fully into view
                reverse: true,
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                itemCount: msgs.length,
                itemBuilder: (_, i) { final m = msgs[msgs.length - 1 - i]; return _Bubble(c: c, m: m, canUndo: identical(m, undoable) && !c.busy); },
              ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
        child: Row(children: [
          ChoiceChip(
            key: const Key('mode-change'),
            label: const Text('Change this app'),
            selected: !creating,
            onSelected: c.current == null || c.busy ? null : (_) => c.changeCurrent(),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            key: const Key('mode-new'),
            label: const Text('New app'),
            selected: creating,
            onSelected: c.busy ? null : (_) { c.startNewApp(); },
          ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 8, 10),
        child: Row(children: [
          Expanded(
            child: TextField(
              key: const Key('chat-input'),
              controller: input,
              enabled: !c.busy,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: creating ? 'What should I make?' : 'What should change?',
                filled: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 4),
          if (c.busy)
            IconButton.filledTonal(key: const Key('chat-stop'), tooltip: 'Stop', onPressed: c.cancel, icon: const Icon(Icons.stop))
          else
            IconButton.filled(key: const Key('chat-send'), tooltip: 'Send', onPressed: _send, icon: const Icon(Icons.arrow_upward)),
        ]),
      ),
    ]);
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.c, required this.m, required this.canUndo});
  final MoldeController c;
  final ChatMsg m;
  final bool canUndo;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final mine = m.who == 'you';
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.88),
        decoration: BoxDecoration(color: mine ? cs.primaryContainer : cs.surface, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (m.live) const Padding(padding: EdgeInsets.only(bottom: 8), child: LinearProgressIndicator()),
          Text(m.text, style: TextStyle(color: mine ? cs.onPrimaryContainer : cs.onSurface)),
          if (m.code != null && m.code!.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(maxHeight: 120),
              decoration: BoxDecoration(color: cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)),
              child: SingleChildScrollView(reverse: true, child: Text(m.code!, style: const TextStyle(fontFamily: 'monospace', fontSize: 12))),
            ),
          if (canUndo)
            Padding(padding: const EdgeInsets.only(top: 8), child: OutlinedButton.icon(key: const Key('undo'), onPressed: c.undoLast, icon: const Icon(Icons.undo, size: 18), label: const Text('Undo'))),
          if (m.undone) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Undone', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12))),
          if (m.buttons.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(spacing: 8, runSpacing: 4, children: [
                for (final b in m.buttons)
                  b.primary
                      ? FilledButton(onPressed: m.disabled ? null : () { m.disabled = true; c.refresh(); b.onTap(); }, child: Text(b.label))
                      : OutlinedButton(onPressed: m.disabled ? null : () { m.disabled = true; c.refresh(); b.onTap(); }, child: Text(b.label)),
              ]),
            ),
        ]),
      ),
    );
  }
}

class _Apps extends StatelessWidget {
  const _Apps({required this.c, required this.onPicked});
  final MoldeController c;
  final VoidCallback onPicked;

  Future<void> _confirmDelete(BuildContext context, AppRecord r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete ${r.name}?'),
        content: const Text('The app and everything you saved in it will be removed from this phone. This cannot be undone.'),
        actions: [
          TextButton(key: const Key('delete-cancel'), onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')),
          FilledButton(key: const Key('delete-confirm'), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok == true) await c.deleteApp(r);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(children: [
      Expanded(
        child: ListView(children: [
          ListTile(
            key: const Key('new-app'),
            leading: CircleAvatar(backgroundColor: cs.primaryContainer, child: Icon(Icons.add, color: cs.onPrimaryContainer)),
            title: const Text('New app'),
            subtitle: const Text('Describe it in the chat'),
            onTap: () { c.startNewApp(); onPicked(); },
          ),
          for (final r in c.apps)
            ListTile(
              key: Key('app-${r.id}'),
              selected: c.current?.id == r.id,
              leading: const Icon(Icons.apps_outlined),
              title: Text(r.name),
              subtitle: Text('Changed ${_ago(r.updatedAt)}'),
              onTap: () async { await c.openApp(r); onPicked(); },
              trailing: IconButton(key: Key('delete-${r.id}'), tooltip: 'Delete ${r.name}', icon: const Icon(Icons.delete_outline), onPressed: () => _confirmDelete(context, r)),
            ),
        ]),
      ),
      GestureDetector(
        key: const Key('version'),
        behavior: HitTestBehavior.opaque,
        onLongPress: () => showDevMenu(context, c),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          child: Text('Molde $kVersion', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
        ),
      ),
    ]);
  }

  static String _ago(int ms) {
    final d = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(ms));
    if (d.inMinutes < 1) return 'just now';
    if (d.inHours < 1) return '${d.inMinutes} min ago';
    if (d.inDays < 1) return '${d.inHours} h ago';
    return '${d.inDays} d ago';
  }
}

// ---------------- developer menu (long-press the version) ----------------
Future<void> showDevMenu(BuildContext context, MoldeController c) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => _DevMenu(c: c),
  );
}

class _DevMenu extends StatefulWidget {
  const _DevMenu({required this.c});
  final MoldeController c;
  @override
  State<_DevMenu> createState() => _DevMenuState();
}

class _DevMenuState extends State<_DevMenu> {
  List<String> examples = [];
  String note = '';
  MoldeController get c => widget.c;

  @override
  void initState() {
    super.initState();
    _loadExamples();
  }

  Future<void> _loadExamples() async {
    try {
      final idx = await c.readAsset('assets/examples/INDEX.json');
      examples = RegExp(r'"([^"]+\.mo)"').allMatches(idx).map((m) => m.group(1)!).toList();
    } catch (_) {}
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final s = c.lastStats;
    final m = c.llm.model;
    return DraggableScrollableSheet(
      expand: false, initialChildSize: 0.8, maxChildSize: 0.95,
      builder: (ctx, sc) => ListView(key: const Key('dev-menu'), controller: sc, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Text('Developer menu', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Text('Last generation', style: Theme.of(context).textTheme.titleSmall),
        if (s == null) const Text('No generation yet.', key: Key('dev-stats')) else Text(
          'Request: ${c.lastStatsRequest}\n'
          'Seconds: ${s['seconds']}   Tokens: ${s['tokens']}   Tokens/s: ${s['tokPerSec']}\n'
          'Model calls: ${s['calls']}   Resamples: ${s['resamples']}   Fallback lines: ${s['fallbacks']}\n'
          'Lines: ${s['lines']}   Prompt tokens: ${s['promptTokens']} (cached ${s['cachedTokens']})\n'
          'Grammar build: ${s['grammarMs']} ms   Decoder arm: ${s['arm']}\n'
          'Draft check: ${s['draftAccepted'] ?? 0} tokens verified in batches (${s['draftTried'] ?? 0} lines tried)',
          key: const Key('dev-stats'), style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
        const SizedBox(height: 12),
        Text('Recent generations (seconds)', style: Theme.of(context).textTheme.titleSmall),
        Text(c.genHistory.isEmpty ? 'None yet.' : c.genHistory.reversed.map((g) => '${g['seconds']} s  ${g['kind']}  ${g['lines']} lines  ${g['ok'] == true ? 'ok' : 'failed'}  "${g['request']}"').join('\n'), key: const Key('dev-history'), style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
        const SizedBox(height: 12),
        Text('Model', style: Theme.of(context).textTheme.titleSmall),
        Text(m == null ? c.modelStatus : '${m.path}\n${(m.sizeBytes / 1048576).toStringAsFixed(0)} MB, loaded in ${m.loadSeconds.toStringAsFixed(1)} s', style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
        Wrap(spacing: 8, children: [
          OutlinedButton(onPressed: () async { await c.llm.unload(); await c.loadModel(); if (mounted) setState(() {}); }, child: const Text('Reload model')),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'D', label: Text('Arm D')), ButtonSegment(value: 'E', label: Text('Arm E'))],
            selected: {c.arm},
            onSelectionChanged: (v) => setState(() => c.arm = v.first),
          ),
        ]),
        const Divider(height: 32),
        Text('Load an example app (no model)', style: Theme.of(context).textTheme.titleSmall),
        Wrap(spacing: 8, runSpacing: 4, children: [
          for (final f in examples)
            ActionChip(key: Key('example-$f'), label: Text(f.replaceAll('.mo', '')), onPressed: () async { Navigator.pop(context); await c.loadExample(f); }),
        ]),
        const Divider(height: 32),
        Text('Backup', style: Theme.of(context).textTheme.titleSmall),
        Wrap(spacing: 8, children: [
          OutlinedButton(key: const Key('dev-export'), onPressed: () async { final p = await c.exportBackup(); if (mounted) setState(() => note = 'Saved $p'); }, child: const Text('Export backup')),
          OutlinedButton(key: const Key('dev-import'), onPressed: () async {
            final fs = await c.backups();
            if (!mounted) return;
            if (fs.isEmpty) { setState(() => note = 'No backup files in ${c.backupDir?.path}'); return; }
            final f = await showDialog<File>(context: context, builder: (ctx) => SimpleDialog(title: const Text('Restore which backup?'), children: [for (final f in fs.take(8)) SimpleDialogOption(onPressed: () => Navigator.pop(ctx, f), child: Text(f.uri.pathSegments.last))]));
            if (f != null) { final msg = await c.importBackup(f); if (mounted) setState(() => note = msg); }
          }, child: const Text('Import backup')),
        ]),
        if (note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: SelectableText(note, key: const Key('dev-note'), style: const TextStyle(fontSize: 12))),
        const Divider(height: 32),
        Text('Page log', style: Theme.of(context).textTheme.titleSmall),
        Text(c.bridge.logLines.isEmpty ? 'Nothing logged.' : c.bridge.logLines.reversed.take(8).join('\n'), style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
      ]),
    );
  }
}
