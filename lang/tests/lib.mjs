import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const LANG = join(dirname(fileURLToPath(import.meta.url)), '..');
export const read = p => readFileSync(p, 'utf8');
export const examples = () => readdirSync(join(LANG, 'examples')).filter(f => f.endsWith('.mo')).sort().map(f => ({ name: f, path: join(LANG, 'examples', f), src: read(join(LANG, 'examples', f)) }));
export const edits = () => readdirSync(join(LANG, 'examples', 'edits')).sort().map(d => {
  const p = join(LANG, 'examples', 'edits', d);
  return { name: d, dir: p, before: read(join(p, 'before.mo')), after: read(join(p, 'after.mo')), request: read(join(p, 'request.txt')) };
});
// every program the tests treat as valid: 30 examples + 20 edit befores + 20 edit afters
export const allPrograms = () => [
  ...examples().map(e => ({ name: e.name, src: e.src })),
  ...edits().flatMap(e => [{ name: e.name + '/before.mo', src: e.before }, { name: e.name + '/after.mo', src: e.after }]),
];
