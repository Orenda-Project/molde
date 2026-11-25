// The app's `complete(req)` over the host test server (tools/host/core_server.cpp): the phone's native core, run on the laptop.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function startCore({ model, threads = 4, nctx = 4096, server = '/tmp/molde-app-scratch/core_server', libdir = `${process.env.HOME}/llama.cpp-b12144/llama-b12144` }) {
  const p = spawn(server, [model, libdir, String(threads), String(nctx)], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  const waiters = [];
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const w = waiters.shift(); if (w) w(line); } });
  const next = () => new Promise(res => waiters.push(res));
  const ready = next().then(l => { const j = JSON.parse(l); if (!j.ready) throw new Error('core: ' + l); });
  let chain = Promise.resolve();
  const complete = req => (chain = chain.then(async () => {
    await ready;
    const b = s => Buffer.from(s || '', 'utf8');
    const prompt = b(req.prompt), grammar = b(req.grammar), draft = b(req.draft);
    p.stdin.write(`C ${prompt.length} ${grammar.length} ${draft.length} ${req.nPredict} ${req.temp} ${req.seed | 0} ${req.stopNl ? 1 : 0}\n`);
    p.stdin.write(Buffer.concat([prompt, grammar, draft]));
    return JSON.parse(await next());
  }));
  // CPU seconds the server has used (user + system): unlike wall time it does not grow when the laptop is busy
  const cpu = () => { try { const f = readFileSync(`/proc/${p.pid}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / 100; } catch (e) { return 0; } };
  return { complete, cpu, close: () => { try { p.stdin.write('Q\n'); } catch (e) { /* gone */ } } };
}
