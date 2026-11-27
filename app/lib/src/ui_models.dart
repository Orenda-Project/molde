import 'package:flutter/material.dart';
import 'catalogue.dart';
import 'downloader.dart';
import 'models.dart';

String mb(num bytes) => '${(bytes / 1048576).round()} MB';

const String kPrivacy = 'Molde works offline. Your apps and everything you enter stay on this phone and are never sent anywhere. '
    'The only things this app downloads are the list of available models and the model file you choose, from Hugging Face. '
    'Nothing about you, your requests or your data is sent with those downloads. '
    'The screen that shows your app is locked to the page inside this app and cannot open other addresses.';

/// Download progress block, shared by the setup screen and Settings.
class DownloadBar extends StatelessWidget {
  const DownloadBar({super.key, required this.mm});
  final ModelManager mm;
  @override
  Widget build(BuildContext context) {
    final s = mm.status;
    final m = mm.downloading;
    if (m == null) return const SizedBox.shrink();
    final paused = s.state == DlState.paused;
    final speed = s.bytesPerSec > 0 ? ' · ${(s.bytesPerSec / 1048576).toStringAsFixed(1)} MB/s' : '';
    final label = s.state == DlState.verifying
        ? 'Checking the file…'
        : paused
            ? 'Paused at ${mb(s.received)} of ${mb(m.bytes)}'
            : (s.message.isNotEmpty ? s.message : '${mb(s.received)} of ${mb(m.bytes)}$speed');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      LinearProgressIndicator(key: const Key('dl-progress'), value: s.state == DlState.verifying ? null : s.fraction),
      const SizedBox(height: 8),
      Text(label, key: const Key('dl-label')),
      const SizedBox(height: 8),
      Row(children: [
        if (paused) FilledButton(key: const Key('dl-resume'), onPressed: mm.resume, child: const Text('Resume')) else if (s.state == DlState.downloading) OutlinedButton(key: const Key('dl-pause'), onPressed: mm.pause, child: const Text('Pause')),
        const SizedBox(width: 8),
        if (s.state != DlState.verifying) TextButton(key: const Key('dl-cancel'), onPressed: mm.cancel, child: const Text('Cancel')),
      ]),
    ]);
  }
}

class _Licence extends StatelessWidget {
  const _Licence({required this.mm});
  final ModelManager mm;
  @override
  Widget build(BuildContext context) {
    final c = mm.catalogue;
    final url = c?.licenceUrl ?? 'https://ai.google.dev/gemma/terms';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('The Gemma model is built on Gemma. Gemma is provided under and subject to the Gemma Terms of Use.', key: Key('licence-line')),
      InkWell(
        key: const Key('licence-link'),
        onTap: () => mm.platform.openUrl(url),
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(url, style: TextStyle(color: Theme.of(context).colorScheme.primary, decoration: TextDecoration.underline))),
      ),
    ]);
  }
}

/// First run with no model: what it is, how big, offline after download, the licence, and the choice.
class ModelSetupScreen extends StatelessWidget {
  const ModelSetupScreen({super.key, required this.mm, required this.onExamples});
  final ModelManager mm;
  final VoidCallback onExamples;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final rec = mm.catalogue?.recommended;
    final busy = mm.downloading != null;
    return ColoredBox(
      color: cs.surface,
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 32, 24, 24), children: [
          Icon(Icons.download_for_offline_outlined, size: 40, color: cs.primary),
          const SizedBox(height: 16),
          Text('Get the Molde model', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          Text('Molde builds your apps with a small AI model that runs on this phone. The model is a file of ${rec == null ? 'about 250 MB' : mb(rec.bytes)}, downloaded once. After that Molde works fully offline: nothing you type leaves the phone.', style: Theme.of(context).textTheme.bodyLarge),
          if (mm.net == 'mobile') ...[
            const SizedBox(height: 12),
            Container(key: const Key('mobile-hint'), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: cs.tertiaryContainer, borderRadius: BorderRadius.circular(12)), child: Text('You are on mobile data. This download is ${rec == null ? 'about 250 MB' : mb(rec.bytes)}, so Wi-Fi is better if you have it.', style: TextStyle(color: cs.onTertiaryContainer))),
          ],
          if (mm.net == 'none') ...[
            const SizedBox(height: 12),
            Text('There is no network connection right now. Connect to Wi-Fi to download.', key: const Key('no-net-hint'), style: TextStyle(color: cs.error)),
          ],
          const SizedBox(height: 16),
          _Licence(mm: mm),
          const SizedBox(height: 8),
          if (mm.error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(mm.error!, key: const Key('dl-error'), style: TextStyle(color: cs.error))),
          if (busy) DownloadBar(mm: mm) else ...[
            FilledButton(key: const Key('dl-recommended'), onPressed: rec == null ? null : () => mm.download(rec), child: Text(rec == null ? 'Download' : 'Download ${rec.name} (${mb(rec.bytes)})')),
            if (rec != null && rec.note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(rec.note, style: TextStyle(color: cs.onSurfaceVariant))),
            const SizedBox(height: 8),
            OutlinedButton(key: const Key('dl-others'), onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SettingsPage(mm: mm))), child: const Text('Other models')),
          ],
          const SizedBox(height: 24),
          TextButton(key: const Key('try-examples'), onPressed: onExamples, child: const Text('Try the example apps first (no model needed)')),
        ]),
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.mm});
  final ModelManager mm;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  ModelManager get mm => widget.mm;
  @override
  void initState() { super.initState(); mm.addListener(_c); mm.refreshNet(); }
  @override
  void dispose() { mm.removeListener(_c); super.dispose(); }
  void _c() { if (mounted) setState(() {}); }

  Future<void> _confirmDeleteFile(String file) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Delete this model?'),
      content: Text('$file will be removed from this phone. You cannot download it again from the list.'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')), FilledButton(key: const Key('earlier-delete-confirm'), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete'))],
    ));
    if (ok == true) await mm.deleteFile(file);
  }

  Future<void> _confirmDelete(CatalogueModel m) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text('Delete ${m.name}?'),
      content: Text('The ${mb(m.bytes)} model file is removed from this phone. You can download it again later.${mm.isActive(m) ? ' It is the model in use, so you will need another one to build apps.' : ''}'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')), FilledButton(key: const Key('model-delete-confirm'), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete'))],
    ));
    if (ok == true) await mm.delete(m);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final a = mm.active;
    final cat = mm.catalogue;
    final newer = mm.newer;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(key: const Key('settings'), padding: const EdgeInsets.all(16), children: [
        Text('Model', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: a == null
            ? const Text('No model is installed. Download one below to build apps.', key: Key('active-none'))
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(a.name, key: const Key('active-name'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text('${mb(a.bytes)} · ${a.sourceLabel}', key: const Key('active-detail')),
              ]))),
        if (mm.net == 'mobile') Padding(padding: const EdgeInsets.only(top: 8), child: Text('You are on mobile data. Downloads are large; Wi-Fi is better.', style: TextStyle(color: cs.onSurfaceVariant))),
        if (mm.isBusy()) Padding(padding: const EdgeInsets.only(top: 8), child: Text(ModelManager.busyMessage, key: const Key('switch-blocked'), style: TextStyle(color: cs.onSurfaceVariant))),
        if (newer != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('A newer model is available: ${newer.name}.', key: const Key('newer'), style: TextStyle(color: cs.primary))),
        if (mm.error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(mm.error!, key: const Key('dl-error'), style: TextStyle(color: cs.error))),
        if (mm.downloading != null) Padding(padding: const EdgeInsets.only(top: 12), child: DownloadBar(mm: mm)),
        const SizedBox(height: 16),
        Text('Available models', style: Theme.of(context).textTheme.titleMedium),
        if (cat == null) const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator())
        else ...[
          if (!cat.fromNetwork) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Showing the list stored in the app (could not reach Hugging Face).', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12))),
          for (final m in mm.ordered)
            Card(key: Key('model-${m.id}'), shape: mm.isActive(m) ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: cs.primary, width: 2)) : null, child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (m.id == cat.recommended?.id) Padding(padding: const EdgeInsets.only(bottom: 6), child: Container(key: Key('rec-${m.id}'), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(8)), child: Text('Recommended', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onPrimaryContainer)))),
              Text(m.name, style: Theme.of(context).textTheme.titleSmall),
              Text('${mb(m.bytes)} · ${m.note}', style: TextStyle(color: cs.onSurfaceVariant)),
              if (mm.isActive(m)) Padding(padding: const EdgeInsets.only(top: 6), child: Row(mainAxisSize: MainAxisSize.min, key: const Key('in-use'), children: [Icon(Icons.check_circle, size: 18, color: cs.primary), const SizedBox(width: 6), Text('In use', style: TextStyle(fontWeight: FontWeight.w700, color: cs.primary))])),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                if (!mm.installed(m)) FilledButton(key: Key('download-${m.id}'), onPressed: mm.dl.running ? null : () => mm.download(m), child: const Text('Download')),
                if (mm.installed(m) && !mm.isActive(m)) FilledButton(key: Key('use-${m.id}'), onPressed: mm.switchBlocked ? null : () async { final e = await mm.use(m); if (e != null && context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e))); }, child: const Text('Use')),
                if (mm.installed(m)) OutlinedButton(key: Key('delete-${m.id}'), onPressed: () => _confirmDelete(m), child: const Text('Delete')),
              ]),
            ]))),
          if (mm.downloadedEarlier.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Downloaded earlier', key: const Key('earlier-heading'), style: Theme.of(context).textTheme.titleSmall),
            Text('Not in the list any more. Still on this phone and still works.', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
            for (final (i, e) in mm.downloadedEarlier.indexed)
              Card(key: Key('earlier-${e.file}'), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(mm.downloadedEarlier.length > 1 ? 'Older model ${i + 1}' : 'Older model', style: Theme.of(context).textTheme.bodyMedium),
                Text(mb(e.bytes), style: TextStyle(color: cs.onSurfaceVariant)),
                if (mm.isActiveFile(e.file)) Padding(padding: const EdgeInsets.only(top: 6), child: Row(mainAxisSize: MainAxisSize.min, key: const Key('in-use'), children: [Icon(Icons.check_circle, size: 18, color: cs.primary), const SizedBox(width: 6), Text('In use', style: TextStyle(fontWeight: FontWeight.w700, color: cs.primary))])),
                const SizedBox(height: 8),
                Wrap(spacing: 8, children: [
                  if (!mm.isActiveFile(e.file)) FilledButton(key: Key('use-earlier-${e.file}'), onPressed: mm.switchBlocked ? null : () async { final r = await mm.useFile(e.file); if (r != null && context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r))); }, child: const Text('Use')),
                  OutlinedButton(key: Key('delete-earlier-${e.file}'), onPressed: () => _confirmDeleteFile(e.file), child: const Text('Delete')),
                ]),
              ]))),
          ],
        ],
        if (mm.handAvailable) ...[
          const SizedBox(height: 20),
          Text('Added by hand', key: const Key('hand-heading'), style: Theme.of(context).textTheme.titleSmall),
          Card(key: const Key('hand-model'), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Model added by hand', style: Theme.of(context).textTheme.bodyMedium),
            Text(mb(mm.handBytes), style: TextStyle(color: cs.onSurfaceVariant)),
            const SizedBox(height: 8),
            FilledButton(key: const Key('use-hand'), onPressed: mm.switchBlocked ? null : () async { await mm.useHand(); }, child: const Text('Use this model')),
          ]))),
        ],
        const SizedBox(height: 16),
        _Licence(mm: mm),
        const Divider(height: 32),
        Text('Privacy', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        const Text(kPrivacy, key: Key('privacy')),
        const SizedBox(height: 24),
      ]),
    );
  }
}
