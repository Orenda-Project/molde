// The GBNF is generated from the one grammar file and accepts every valid program.
// Checked two ways: (1) llama.cpp's own grammar engine (libllama), when available;
// (2) always: our engine running the generated moldescript.gbnf file as a whole-program grammar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generate, GBNF_PATH, SOURCES_PATH, sourcesText } from '../gen-gbnf.mjs';
import { loadGrammar } from '../grammar.mjs';
import { parseText } from '../engine.mjs';
import { allPrograms, LANG } from './lib.mjs';

// The GBNF is a superset of the language (it cannot tell keywords from names), so these are
// plain syntax breaks: a name starting with a digit, a line that starts with =, an
// indented line with no parent, no app line, an open quote, a missing comma.
const BAD = ['app "x"\ntable 9 a num\n', 'app "x"\n= 3\n', 'app "x"\n    text "a"\n', 'table t a num\n', 'app "x"\ntext "a\n', 'app "x"\ndraw\n  rect 0 0 1 1\n'];

test('moldescript.gbnf and sources.gen.mjs are up to date with the grammar and std sources', () => {
  assert.equal(readFileSync(GBNF_PATH, 'utf8'), generate());
  assert.equal(readFileSync(SOURCES_PATH, 'utf8'), sourcesText());
});

test('generated GBNF (run by our engine) accepts every valid program and rejects broken syntax', () => {
  const G = loadGrammar(readFileSync(GBNF_PATH, 'utf8'));
  for (const p of allPrograms()) assert.ok(parseText(p.src, ['root'], G).tree, `rejected ${p.name}`);
  for (const b of BAD) assert.equal(parseText(b, ['root'], G).tree, null, `accepted ${JSON.stringify(b)}`);
});

const LIB = process.env.LLAMA_LIB_DIR || '/home/oye/llama.cpp-b12144/llama-b12144';
const haveLlama = existsSync(join(LIB, 'libllama.so')) && spawnSync('g++', ['--version']).status === 0;

test('llama.cpp grammar engine accepts every valid program and rejects broken syntax', { skip: haveLlama ? false : `needs g++ and libllama.so (set LLAMA_LIB_DIR)` }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'molde-gbnf-'));
  const bin = join(dir, 'gbnf-check');
  const cc = spawnSync('g++', ['-O1', '-std=c++17', join(LANG, 'tools', 'gbnf-check.cpp'), '-o', bin, `-L${LIB}`, '-lllama', `-Wl,-rpath,${LIB}`], { encoding: 'utf8' });
  assert.equal(cc.status, 0, cc.stderr);
  const files = allPrograms().map((p, i) => { const f = join(dir, `p${i}.mo`); writeFileSync(f, p.src); return f; });
  const ok = spawnSync(bin, [GBNF_PATH, ...files], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal((ok.stdout.match(/^ACCEPT /gm) || []).length, files.length);
  const bad = BAD.map((b, i) => { const f = join(dir, `bad${i}.mo`); writeFileSync(f, b); return f; });
  const no = spawnSync(bin, [GBNF_PATH, ...bad], { encoding: 'utf8' });
  assert.equal((no.stdout.match(/^REJECT /gm) || []).length, bad.length, no.stdout);
});
