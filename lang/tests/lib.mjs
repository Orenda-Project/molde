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
export const demo15 = () => readdirSync(join(LANG, 'examples', 'demo15')).filter(f => f.endsWith('.mo')).sort().map(f => ({ name: 'demo15/' + f, src: read(join(LANG, 'examples', 'demo15', f)) }));
const dirPrograms = (dir, tag) => readdirSync(join(LANG, ...dir)).flatMap(f => f.endsWith('.mo') ? [{ name: tag + f, src: read(join(LANG, ...dir, f)) }] : ['before.mo', 'after.mo'].map(x => ({ name: `${tag}${f}/${x}`, src: read(join(LANG, ...dir, f, x)) })));
// the 12 lesson programs and the 10 lesson edit pairs (they run with a lesson from lang/lessons; without one the lesson tables are empty)
export const lessonExamples = () => [...dirPrograms(['examples', 'lessons'], 'lessons/'), ...dirPrograms(['examples', 'lesson-edits'], 'lesson-edits/')];
// every program the tests treat as valid: 30 examples + 20 edit befores + 20 edit afters + the 15 demos written with the std library
export const allPrograms = () => [
  ...examples().map(e => ({ name: e.name, src: e.src })),
  ...demo15(),
  ...lessonExamples(),
  ...edits().flatMap(e => [{ name: e.name + '/before.mo', src: e.before }, { name: e.name + '/after.mo', src: e.after }]),
];
