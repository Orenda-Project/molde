// startCore (app/js/tools/core_complete.mjs) plus a watchdog: a native call that takes longer than `hangMs` is a hang of the phone core
// (the native cancel flag is only read between tokens). The server is killed and restarted, the call returns stop:"hang", and the
// request is saved to hangs.jsonl so the hang can be replayed.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
export function startCoreWatched({ model, threads = 4, nctx = 4096, server, libdir, hangMs = 90000, hangLog = 'hangs.jsonl', tag = '' }) {
  let p, buf = '', waiters = [], ready, restarts = 0;
  const spawnIt = () => {
    p = spawn(server, [model, libdir, String(threads), String(nctx)], { stdio: ['pipe', 'pipe', 'inherit'] });
    buf = ''; waiters = [];
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const w = waiters.shift(); if (w) w(line); } });
    ready = new Promise(res => waiters.push(res)).then(l => { const j = JSON.parse(l); if (!j.ready) throw new Error('core: ' + l); });
  };
  const next = () => new Promise(res => waiters.push(res));
  spawnIt();
  let chain = Promise.resolve();
  const complete = req => (chain = chain.then(async () => {
    await ready;
    const b = s => Buffer.from(s || '', 'utf8');
    const prompt = b(req.prompt), grammar = b(req.grammar), draft = b(req.draft);
    p.stdin.write(`C ${prompt.length} ${grammar.length} ${draft.length} ${req.nPredict} ${req.temp} ${req.seed | 0} ${req.stopNl ? 1 : 0}\n`);
    p.stdin.write(Buffer.concat([prompt, grammar, draft]));
    let timer; const t0 = Date.now();
    const reply = await Promise.race([next(), new Promise(res => { timer = setTimeout(() => res(null), hangMs); })]);
    clearTimeout(timer);
    if (reply == null) {
      restarts++;
      try { appendFileSync(hangLog, JSON.stringify({ tag, ms: Date.now() - t0, prompt_len: prompt.length, grammar_len: grammar.length, draft: req.draft || '', temp: req.temp, prompt_tail: req.prompt.slice(-600), prompt: req.prompt, grammar: req.grammar }) + '\n'); } catch (e) { /* ignore */ }
      try { p.kill('SIGKILL'); } catch (e) { /* gone */ }
      spawnIt();
      return { stop: 'error', text: '', error: 'native core hang (killed after ' + hangMs + ' ms)', hang: true };
    }
    return JSON.parse(reply);
  }));
  const restart = () => (chain = chain.then(async () => { try { p.stdin.write('Q\n'); } catch (e) {} try { p.kill('SIGKILL'); } catch (e) {} spawnIt(); await ready; }));
  const cpu = () => 0;
  return { complete, restart, cpu, restarts: () => restarts, close: () => { try { p.stdin.write('Q\n'); } catch (e) { /* gone */ } } };
}
