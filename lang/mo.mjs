#!/usr/bin/env node
// MoldeScript v0 command line.
//   node lang/mo.mjs check FILE...            errors (code, line, fix) or OK; exit 1 on errors
//   node lang/mo.mjs format FILE [--write]    canonical text (or rewrite the file)
//   node lang/mo.mjs describe FILE            the plain-English plan
//   node lang/mo.mjs diff V1 ... VN NEW        verdict against the whole history (oldest first); exit 1 if refused
//   node lang/mo.mjs diff --history LIST NEW   the same, with the earlier files listed one per line in LIST
//   node lang/mo.mjs migrate FILE... [--write] rewrite older text into the current spelling
//   node lang/mo.mjs expand FILE              the program with every component expanded to level 1
//   node lang/mo.mjs tokens [FILE...]         token counts (runs lang/tokens.py)
//   node lang/mo.mjs tree FILE [--now=ISO]     the UI tree from the reference evaluator (UITREE.md)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { check } from './check.mjs';
import { format } from './format.mjs';
import { describe } from './describe.mjs';
import { diff, diffText } from './diff.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [cmd, ...args] = process.argv.slice(2);
const read = f => readFileSync(f, 'utf8');
const files = args.filter(a => !a.startsWith('--'));

// Rewrites for meaning changes between v0 revisions (each keeps what the program meant):
// - round 3: time - time wraps past midnight, so the old overnight pattern
//   if(A < B, A - B + 24h, A - B)  becomes  A - B
export function migrateText(src) {
  return src.replace(/if\(([a-z_.]+) < ([a-z_.]+), \1 - \2 \+ 24h, \1 - \2\)/g, '($1 - $2)');
}

export function expandedText(src) {
  const r = check(src);
  const out = [];
  const walk = (s, d) => {
    if (s.kind === 'use') { out.push('  '.repeat(d) + '# ' + s.src); s.children.forEach(c => walk(c, d)); return; }
    if (s.kind === 'def') { out.push('  '.repeat(d) + '# ' + s.src + ' (definition, expanded where used)'); return; }
    out.push('  '.repeat(d) + s.src);
    (s.children || []).forEach(c => walk(c, d + 1));
  };
  if (r.ast.header) out.push(r.ast.header.src);
  r.ast.body.forEach(s => walk(s, 0));
  return { text: out.join('\n') + '\n', errors: r.errors };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) switch (cmd) {
  case 'check': {
    let bad = 0;
    for (const f of files) {
      const r = check(read(f));
      if (r.ok) console.log(`OK ${f}`);
      else { bad++; console.log(`ERRORS ${f}`); for (const e of r.errors) console.log('  ' + e); }
    }
    process.exit(bad ? 1 : 0);
    break;
  }
  case 'format': {
    for (const f of files) {
      const t = format(read(f));
      if (args.includes('--write')) writeFileSync(f, t); else process.stdout.write(t);
    }
    break;
  }
  case 'describe': for (const f of files) process.stdout.write(describe(read(f))); break;
  case 'diff': {
    // mo.mjs diff V1 V2 ... VN NEW   (every earlier version, oldest first; the last file is the new one)
    // mo.mjs diff --history LIST NEW (LIST: a text file naming one program file per line, oldest first)
    let hist, next;
    const hi = args.indexOf('--history');
    if (hi >= 0) {
      const listFile = args[hi + 1];
      hist = read(listFile).split('\n').map(x => x.trim()).filter(Boolean);
      next = files.filter(f => f !== listFile).pop();
    } else { hist = files.slice(0, -1); next = files[files.length - 1]; }
    if (!next || !hist.length) { console.error('usage: mo.mjs diff OLDEST ... PREVIOUS NEW  or  mo.mjs diff --history LIST NEW'); process.exit(2); }
    const r = diff(hist.map(read), read(next));
    console.log(`history used (oldest first): ${hist.map((h, i) => `${h}${r.historyUsed[i] ? '' : ' (was refused, skipped)'}`).join(', ')}`);
    console.log(`new program: ${next}`);
    process.stdout.write(diffText(r));
    process.exit(r.verdict === 'refused' ? 1 : 0);
    break;
  }
  case 'tree': {
    const { load } = await import('./eval.mjs');
    for (const f of files) { const a = load(read(f), { now: args.find(x => x.startsWith('--now='))?.slice(6) }); for (const e of a.errors) console.error(e); console.log(JSON.stringify(a.tree(), null, 1)); }
    break;
  }
  case 'migrate': {
    // rewrite older MoldeScript v0 text into the current canonical spelling (the formatter's
    // one-spelling rules: implicit text lines, style roles, bare option values); prints what changed
    for (const f of files) {
      const before = read(f); const after = format(migrateText(before));
      if (args.includes('--write')) writeFileSync(f, after); else process.stdout.write(after);
      if (before !== after) console.error(`migrated ${f}`);
    }
    break;
  }
  case 'expand': for (const f of files) { const r = expandedText(read(f)); process.stdout.write(r.text); for (const e of r.errors) console.error(String(e)); } break;
  case 'tokens': {
    const r = spawnSync('python3', [join(here, 'tokens.py'), ...args], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
    break;
  }
  default:
    console.log('usage: node lang/mo.mjs check|format|migrate|describe|diff|expand|tree|tokens FILE...');
    process.exit(cmd ? 2 : 0);
}
