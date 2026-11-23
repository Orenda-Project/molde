// Each broken program must be rejected with the expected error code, a line number and a hint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';

const A = 'app "x"\n';
export const CASES = [
  ['no app line', 'table t a text\n', 'E_HEADER', 1],
  ['missing field type', A + 'table drink ml\n', 'E_SYNTAX', 2],
  ['open quote', A + 'text "hello\n', 'E_SYNTAX', 2],
  ['stray character', A + 'text "a" @\n', 'E_SYNTAX', 2],
  ['shape args without commas', A + 'draw\n  rect 0 0 10 10\n', 'E_SYNTAX', 3],
  ['reserved word as table name', A + 'table it n num\n', 'E_RESERVED', 2],
  ['built-in field redeclared', A + 'table t at date\n', 'E_RESERVED', 2],
  ['dedent to unknown level', A + 'row\n    text "a"\n  text "b"\n', 'E_INDENT', 4],
  ['indented first line', '  app "x"\n', 'E_INDENT', 1],
  ['child under a leaf', A + 'text "a"\n  text "b"\n', 'E_CHILD', 3],
  ['ask plus more lines', 'ask "Which one?" "A" "B"\ntext "x"\n', 'E_ASK', 2],
  ['unknown table', A + 'text count(drink today)\n', 'E_UNKNOWN_TABLE', 2],
  ['unknown field', A + 'table drink ml num\ntext sum(drink.litres today)\n', 'E_UNKNOWN_FIELD', 3],
  ['unknown name', A + 'text goal\n', 'E_UNKNOWN_NAME', 2],
  ['use before declare', A + 'text goal\nsetting goal num = 3\n', 'E_UNKNOWN_NAME', 2],
  ['sum of text', A + 'table t name text\ntext sum(t.name)\n', 'E_TYPE', 3],
  ['if on a number', A + 'if 3\n  text "a"\n', 'E_TYPE', 2],
  ['text times number', A + 'setting s text = "a"\ntext s * 2\n', 'E_TYPE', 3],
  ['fill with a number', A + 'box fill 3\n', 'E_TYPE', 2],
  ['window on text', A + 'table t\nstate d text = "a"\ntext count(t on d)\n', 'E_WINDOW', 4],
  ['endless day loop', A + 'each days all\n  text it\n', 'E_WINDOW', 2],
  ['ref to a later table', A + 'table check habit ref habit\ntable habit name text\n', 'E_REF', 2],
  ['no back link', A + 'table a n text\ntable b n text\neach a\n  text count(it.b)\n', 'E_REF', 5],
  ['table twice', A + 'table t a text\ntable t b text\n', 'E_DUP', 3],
  ['field twice', A + 'table t a text, a num\n', 'E_DUP', 2],
  ['it outside each', A + 'table t n text\ntext it.n\n', 'E_CONTEXT', 3],
  ['shape outside draw', A + 'rect 0, 0, 10, 10\n', 'E_CONTEXT', 2],
  ['pt outside poly', A + 'draw\n  pt 1, 2\n', 'E_CONTEXT', 3],
  ['else without if', A + 'else\n  text "a"\n', 'E_CONTEXT', 2],
  ['table inside a row', A + 'row\n  table t a text\n', 'E_CONTEXT', 3],
  ['index outside each', A + 'text index\n', 'E_CONTEXT', 2],
  ['missing component value', A + 'goal 3\n', 'E_ARGS', 2],
  ['too many component values', A + 'stat 1, "a", 3\n', 'E_ARGS', 2],
  ['formula where a table is needed', A + 'form 3 + 4\n', 'E_KIND', 2],
  ['unknown component', A + 'chart 3\n', 'E_UNKNOWN_COMPONENT', 2],
  ['component uses itself', A + 'def loop\n  loop\nloop\n', 'E_RECURSION', 4],
  ['redefining a std component', A + 'def stat\n  text "x"\n', 'E_DUP', 2],
  ['not one of the options', A + 'table p name pick A|B\ntext count(p where name = "C")\n', 'E_OPTION', 3],
  ['unknown icon', 'app "x" rocketship\n', 'E_ICON', 1],
  ['button without tap', A + 'button "Go"\n', 'E_ACTION', 2],
  ['set a let', A + 'let a = 3\nbutton "b" tap set a = 4\n', 'E_TARGET', 3],
  ['save something that is not a new row', A + 'state d num = 1\nbutton "b" tap save d\n', 'E_TARGET', 3],
  ['add without a required field', A + 'table t name text\nbutton "b" tap add t\n', 'E_REQUIRED', 3],
  ['backwards slider', A + 'state v num = 1\nslider v 5..1\n', 'E_RANGE', 3],
  ['default outside range', A + 'table t n num 1..5 = 9\n', 'E_RANGE', 2],
  ['default not an option', A + 'table t c pick A|B = C\n', 'E_DEFAULT', 2],
  ['go to an unknown screen', A + 'button "b" tap go stats\n', 'E_UNKNOWN_NAME', 2],
  ['toggle a number', A + 'state v num = 1\ntoggle v\n', 'E_TYPE', 3],
  ['image of text', A + 'table t n text\neach t\n  image it.n\n', 'E_TYPE', 4],
  ['countof with a number', A + 'table t n num\ntext count(t, it.n)\n', 'E_TYPE', 3],
  ['sort by unknown name', A + 'table t n num\neach t sort colour\n  text it\n', 'E_UNKNOWN_NAME', 3],
  ['bad add value type', A + 'table t n num\nbutton "b" tap add t n = "a"\n', 'E_TYPE', 3],
];

test('there are at least 40 invalid programs', () => assert.ok(CASES.length >= 40));

for (const [name, src, code, line] of CASES) {
  test(`rejects (${code}): ${name}`, () => {
    const r = check(src);
    assert.equal(r.ok, false, 'program was accepted');
    const hit = r.errors.find(e => e.code === code);
    assert.ok(hit, `expected ${code}, got: ${r.errors.map(String).join(' | ')}`);
    assert.equal(hit.line, line, String(hit));
    assert.ok(hit.msg.length > 10 && hit.hint !== undefined, 'error needs a message and a hint');
  });
}
