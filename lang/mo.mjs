#!/usr/bin/env node
// MoldeScript v0 command line.
//   node lang/mo.mjs check FILE...            errors (code, line, fix) or OK; exit 1 on errors
//   node lang/mo.mjs format FILE [--write]    canonical text (or rewrite the file)
//   node lang/mo.mjs describe FILE            the plain-English plan
//   node lang/mo.mjs diff OLD NEW             what changes + data-safety verdict; exit 1 if refused
//   node lang/mo.mjs expand FILE              the program with every component expanded to level 1
//   node lang/mo.mjs tokens [FILE...]         token counts (runs lang/tokens.py)
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

switch (cmd) {
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
    const r = diff(read(files[0]), read(files[1]));
    process.stdout.write(diffText(r));
    process.exit(r.verdict === 'refused' ? 1 : 0);
    break;
  }
  case 'expand': for (const f of files) { const r = expandedText(read(f)); process.stdout.write(r.text); for (const e of r.errors) console.error(String(e)); } break;
  case 'tokens': {
    const r = spawnSync('python3', [join(here, 'tokens.py'), ...args], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
    break;
  }
  default:
    console.log('usage: node lang/mo.mjs check|format|describe|diff|expand|tokens FILE...');
    process.exit(cmd ? 2 : 0);
}
