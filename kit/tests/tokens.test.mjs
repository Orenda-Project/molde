// Qwen3.5 token budget. Uses the Qwen3.5-2B tokenizer.json (planned base model) from the local Hugging Face cache or $QWEN_TOKENIZER_DIR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import { FIXTURES, KIT } from './lib.mjs';

function dir() {
  if (process.env.QWEN_TOKENIZER_DIR) return process.env.QWEN_TOKENIZER_DIR;
  const root = join(process.env.HOME || '', '.cache/huggingface/hub/models--Qwen--Qwen3.5-2B/snapshots');
  return existsSync(root) ? join(root, readdirSync(root)[0]) : null;
}
const d = dir();
test('Qwen3.5 tokens: each app.html <= 650 (water 540; exercise 900 and habits 1000 are documented exceptions), median <= 650 (app.json <= 200)', { skip: d ? false : 'Qwen3.5-2B tokenizer.json not found (set QWEN_TOKENIZER_DIR)' }, () => {
  const tk = new Tokenizer(JSON.parse(readFileSync(join(d, 'tokenizer.json'), 'utf8')), JSON.parse(readFileSync(join(d, 'tokenizer_config.json'), 'utf8')));
  const counts = FIXTURES.map((f) => tk.encode(readFileSync(`${KIT}/fixtures/${f}/app.html`, 'utf8')).ids.length);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log('# tokens ' + FIXTURES.map((f, i) => `${f}=${counts[i]}`).join(' ') + ` mean=${mean.toFixed(1)}`);
  const med = [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)];
  console.log(`# tokens median=${med} max=${Math.max(...counts)}`);
  const js = FIXTURES.map((f) => tk.encode(readFileSync(`${KIT}/fixtures/${f}/app.json`, 'utf8')).ids.length);
  console.log('# app.json tokens ' + FIXTURES.map((f, i) => `${f}=${js[i]}`).join(' ') + ` max=${Math.max(...js)}`);
  const CAP = { exercise: 900, habits: 1000, water: 540 }; counts.forEach((c, i) => assert.ok(c <= (CAP[FIXTURES[i]] || 650), FIXTURES[i] + ' ' + c)); assert.ok(med <= 650); js.forEach((c) => assert.ok(c <= 200));
});
