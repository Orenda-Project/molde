// Learnability: everyday names are legal, errors point at the real cause once, hints are right,
// the checker never throws, and whatever it accepts the GBNF accepts once formatted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../check.mjs';
import { format } from '../format.mjs';
import { loadGrammar, RESERVED } from '../grammar.mjs';
import { parseText } from '../engine.mjs';
import { GBNF_PATH } from '../gen-gbnf.mjs';
import { runFuzz } from './fuzz-check.mjs';

const G = loadGrammar(readFileSync(GBNF_PATH, 'utf8'));
const errs = src => check(src).errors;
const one = (src, code, re) => {
  const e = errs(src);
  const hit = e.find(x => x.code === code);
  assert.ok(hit, `wanted ${code}, got ${e.map(String).join(' | ')}`);
  if (re) assert.match(String(hit), re);
  return e;
};

test('at most 15 truly reserved words', () => assert.ok(RESERVED.size <= 15, [...RESERVED].join(' ')));

test('everyday words are legal names (keywords are contextual)', () => {
  const src = 'app "Names" note mint\n'
    + 'table item label text, size num, color text?, unit text?, line num?, top bool, from date?, to date?, slot num?, card text?, year num?, month num?, week num?, last text?, days num?, every num?, on bool, field text?, image text?, icon text?, row num?, box num?, state text?, app text?\n'
    + 'state month date = today\nsetting year num = 2026 "Year"\nstate text text = ""\n'
    + 'each item where size > 3 sort size desc\n  text it.label it.size bold\n'
    + 'count(item month of month) "this month" faint\nform item\n';
  assert.deepEqual(errs(src).map(String), []);
});

test('a name that looks like a style word is read as the style at the end of a line', () => {
  const r = check('app "x"\nstate bold text = "b"\ntext bold\ntext "a" bold\n');
  assert.ok(r.ok);
  const texts = r.ast.body.filter(s => s.kind === 'text');
  assert.equal(texts[0].parts[0].head, 'bold');
  assert.equal(texts[1].mods[0].m, 'bold');
});

test('E_SELF_COMPARE: a field hiding a state in where', () => {
  one('app "x"\ntable point team pick Red|Blue\nstate team text = "Red"\ncount(point where team = team) big\n', 'E_SELF_COMPARE', /field hides your state team.*rename the state/);
  one('app "x"\ntable spend amount money\nsetting amount money = 100 "Limit"\ncount(spend where amount > amount) big\n', 'E_SELF_COMPARE');
});

test('a failed declaration is reported once, follow-on uses say why, internal names never show', () => {
  const e = errs('app "x"\ntable drink ml\nform drink\nlist drink\ncount(drink today) "drinks"\nsum(drink.ml)\n');
  assert.equal(e.length, 2, e.map(String).join('\n'));
  assert.match(String(e[1]), /because line 2/);
  assert.ok(!e.some(x => /\b[a-z]+_\d+\b/.test(String(x))), 'an internal name leaked');
  const crash = errs(readFileSync(new URL('./data/crash.mo', import.meta.url), 'utf8'));
  assert.equal(crash.length, 2, crash.map(String).join('\n'));
});

test('"it" mistakes get the right hint', () => {
  one('app "x"\ntable habit name text\ntable check habit ref habit\neach habit\n  daybars last 7 days, count(it.check on it)\n', 'E_TYPE', /each X as NAME/);
  one('app "x"\ntable habit name text\neach habit as h\n  text it.name\n', 'E_CONTEXT', /names its item "h"; write h\.field/);
});

test('clear messages for common slips', () => {
  one('app "Power" bolt warn\n', 'E_SYNTAX', /third word of app is a theme/);
  one('app "x"\ntable t seat num 1..10?\n', 'E_SYNTAX', /right after the type/);
  one('app "x"\ntable r value num, moment pick Morning|Night\navg(r.value where moment = Morning last 30 days)\n', 'E_SYNTAX', /window first/);
  one('app "x"\nstate n num = 1\nif(n > 1, "x" n, "y") big\n', 'E_SYNTAX', /if\(\) gives one value/);
  one('app "x"\ntable day date, n num\n', 'E_SYNTAX', /table name, then fields/);
  one('app "x"\nstate a num = 1\ntext if(a > 0, "yes", 3)\n', 'E_TYPE', /two text parts, or use if\/else/);
  assert.ok(check('app "x"\nstate a num = 5\ntext max(a - 9, 0) min(a, 2)\n').ok, 'scalar min/max');
});

test('checker-accepted programs are GBNF-valid once formatted (the critic\'s cases)', () => {
  const cases = JSON.parse(readFileSync(new URL('./data/ckok.json', import.meta.url), 'utf8'));
  for (const c of cases) if (check(c).ok) assert.ok(parseText(format(c), ['root'], G).tree, format(c));
});

test('checker fuzz: 1000 mutations, no crash, accepted means GBNF-valid after format', () => {
  const r = runFuzz(1000, 99);
  assert.deepEqual(r.crashes.slice(0, 3), []);
  assert.deepEqual(r.okButGbnfRejects.slice(0, 3), []);
});
