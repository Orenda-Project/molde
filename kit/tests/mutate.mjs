// Mutation check for the SDK: 70+ small source mutations, each run against kit/tests/sdk.test.mjs (memory + sqlite adapters).
// A mutant is "killed" when the suite fails. Runs under America/Los_Angeles by default (MUT_TZ=... to change) so a UTC-based "today" dies. Usage: node kit/tests/mutate.mjs   (not part of `npm test`: it takes about a minute)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/sdk.cjs'), 'utf8');
const M = [
  ['week start modulo', '(d.getDay() - ws + 7) % 7', '(d.getDay() + ws + 7) % 7'], ['week start range', 'ws >= 0 && ws <= 6', 'ws >= 0 && ws <= 5'],
  ['rel weekday upper', 'days > 1 && days < 7', 'days > 1 && days < 6'], ['rel weekday upper+', 'days > 1 && days < 7', 'days > 1 && days < 8'], ['rel weekday lower', 'days > 1 && days < 7', 'days > 2 && days < 7'],
  ['rel yesterday', 'if (days === 1) return', 'if (days === 2) return'], ['rel today', 'if (days === 0) return', 'if (days === -1) return'],
  ['clamp upper', 'Math.min(NUM_MAX, n)', 'Math.min(NUM_MAX * 2, n)'], ['clamp lower', 'Math.max(-NUM_MAX,', 'Math.max(-NUM_MAX * 2,'], 
  ['text limit', 's.length > max', 's.length >= max'], ['text max', 'TEXT_MAX = 1000', 'TEXT_MAX = 1001'], ['long max', 'LONG_MAX = 20000', 'LONG_MAX = 20001'],
  ['timer upper', 'sec > 86400', 'sec >= 86400'], ['timer lower', 'sec <= 0', 'sec < 0'], ['timer ceil', 'sec = Math.ceil(sec);', ''],
  ['toast ms', 'undo ? 10000 : 3000', 'undo ? 10000 : 3001'], ['toast undo ms', 'undo ? 10000 : 3000', 'undo ? 9999 : 3000'],
  ['notify hour', 'h > 23 || m > 59', 'h > 24 || m > 59'], ['notify minute', 'h > 23 || m > 59', 'h > 23 || m > 60'], ['notify tomorrow', 'd.getTime() <= now()', 'd.getTime() < now()'], ['notify max', 'NOTE_MAX = 200', 'NOTE_MAX = 201'],
  ['notify empty text', "String(text).trim() === ''", "String(text) === ''"], ['toast max check', "String(msg).length > NOTE_MAX", "String(msg).length > NOTE_MAX + 1"],
  ['series clamp', 'Math.min(366, Math.floor(last))', 'Math.min(367, Math.floor(last))'], ['series min', 'last < 1', 'last < 0'], ['series default', 'o.last === undefined ? 7 : o.last', 'o.last === undefined ? 6 : o.last'],
  ['avg empty', 'a.n ? a.s / a.n : 0', 'a.s / a.n'], ['avg op', "op === 'avg' ? (a.n", "op === 'sum' ? (a.n"], ['series count', "op === 'count' ? a.n", "op === 'count' ? a.s"],
  ['splice two', 'st.rows.splice(i, 1); st.ver++;\n        return true;', 'st.rows.splice(i, 2); st.ver++;\n        return true;'], ['undo sort tie', 'st.rows.sort((a, b) => a.at - b.at || a.id - b.id); st.ver++;', 'st.rows.sort((a, b) => a.at - b.at); st.ver++;'], ['undo sort dir', 'st.rows.sort((a, b) => a.at - b.at || a.id - b.id); st.ver++;', 'st.rows.sort((a, b) => b.at - a.at || a.id - b.id); st.ver++;'],
  ['nextId', 'return m + 1; }', 'return m; }'], ['nextId gt', 'if (id > m) m = id;', 'if (id >= m && false) m = id;'],
  ['kv key length', 'key.length > 60', 'key.length > 61'], ['kv depth', 'if (depth > 6) return false;', 'if (depth > 7) return false;'], ['kv falsy', 'got === undefined ? dfl : got', 'got ? got : dfl'], ['kv proto', "key in Object.prototype || key === 'prototype'", "key === 'prototype'"],
  ['since last30', 'addDays(t0, -29)', 'addDays(t0, -30)'], ['since last7', 'addDays(t0, -6)', 'addDays(t0, -7)'], ['since month start', 'new Date(t0.getFullYear(), t0.getMonth(), 1, 12)', 'new Date(t0.getFullYear(), t0.getMonth(), 2, 12)'], ['since week start', "o.since === 'week' ? startOfWeek(t0)", "o.since === 'week' ? addDays(t0, -6)"],
  ['since day', "o.since === 'day' ? t0", "o.since === 'day' ? addDays(t0, -1)"], ['window where', '(!o.where || eq(r, o.where))', '(true)'], ['window from', '(!f || day(r) >= f)', '(!f || day(r) > f)'],
  ['streak skip today', 'if (!days.has(ymd(d))) d = addDays(d, -1);', ''], ['streak count', 'n++; d = addDays(d, -1);', 'n += 2; d = addDays(d, -1);'], ['streak needs date col', 'if (!dateCol) bad', 'if (false) bad'],
  ['toggle default day', 'if (withDay && dateCol && !(dateCol in o)) o[dateCol] = today();', ''], ['toggle result', 'if (hit) { softDelete(hit.id); return false; }', 'if (hit) { softDelete(hit.id); return true; }'], ['toggle add', 'h.add(o); return true;', 'return true;'],
  ['eq every', 'Object.entries(o).every(([k, v]) => r[k] === v)', 'Object.entries(o).some(([k, v]) => r[k] === v)'], ['group sort', '.sort((a, b) => b.v - a.v)', '.sort((a, b) => a.v - b.v)'], ['sum nan', 'col == null ? 1 : Number(r[col]) || 0', 'col == null ? 1 : Number(r[col])'],
  ['set tombstone', 'if (!rec || rec.deleted_at) bad', 'if (!rec) bad'], ['set integer', 'if (!Number.isInteger(id)) bad(\'E_ARG\', \'t.set', 'if (typeof id !== \'number\') bad(\'E_ARG\', \'t.set'], ['remove integer', "if (!Number.isInteger(id)) bad('E_ARG', 't.remove", "if (typeof id !== 'number') bad('E_ARG', 't.remove"],
  ['initial tombstones', '.filter((r) => !r.deleted_at).sort', '.sort'], ['at override', 'Number.isFinite(row.at) ? row.at : now()', 'now()'], ['at validation', "if ('at' in row && row.at !== undefined && !Number.isFinite(row.at))", 'if (false)'],
  
  ['unknown col', "if (!(k in defs) && !(allowAt && k === 'at'))", 'if (false)'], ['value types', "['string', 'number', 'boolean'].includes(typeof v)", "['string', 'number'].includes(typeof v)"], ['needNum', "defs[c].k === 'num'", "defs[c].k !== 'text'"],
  ['where null', "if ('where' in o)", "if (o.where != null)"], ['since null', "if ('since' in o &&", 'if (o.since != null &&'], ['refresh compare', 'if (clock.d !== d) clock.d = d;', 'if (clock.d === d) clock.d = d;'], ['refresh on add', 'refresh();\n          const data = pickCols(row, true, true);', 'const data = pickCols(row, true, true);'],
  ['today live', 'void clock.d; return ymd(new Date(now()));', 'return clock.d;'], ['fmt how list', "const HOW = ['date', 'time', 'rel'];", "const HOW = ['date', 'rel'];"], ['fmt dateonly time', "if (dateOnly) bad('E_ARG', 'app.fmt: a date-only", "if (false) bad('E_ARG', 'app.fmt: a date-only"],
  ['fmt year', 'd.getFullYear() === t0.getFullYear() ? undefined', 'd.getFullYear() !== t0.getFullYear() ? undefined'], ['timer restart', 'if (s.left <= 0) s.left = sec;', ''], ['timer cb', 'if (s.left === 0) { stop(); if (cb) cb(); }', 'if (s.left === 0) { stop(); }'], ['timer double start', 'if (s.running) return;', ''],
  ['today via UTC', "const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());", "const ymd = (d) => d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());"],
  ['strict num NaN', 'if (!Number.isFinite(n)) bad(', 'if (false) bad('], ['strict null', "if (v === null) bad('E_ARG', 'null is not", "if (false) bad('E_ARG', 'null is not"],
  ['strict pick', 'if (def.opts.includes(v)) return v;\n        return bad(', 'return v;\n        return bad('], ['strict bool text', "if (v === 'true' || v === 'false') return v === 'true';", "if (v === 'true' || v === 'false') return v === 'false';"], ['strict text type', "typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))", 'false'],
  ['strict date', "if (validYmd(v)) return v;\n        return bad(", "return v;\n        return bad("], ['loose date', "case 'date': return miss ? dflt() : validYmd(v) ? v : dflt();", "case 'date': return miss ? dflt() : v;"], ['loose pick', "case 'pick': return def.opts.includes(v) ? v : def.opts[0];\n      default: return v;\n    }\n  }\n  const coerce", "case 'pick': return v;\n      default: return v;\n    }\n  }\n  const coerce"],
  ['toast evict plain first', 'const i = uiState.toasts.findIndex((x) => !x.undo);', 'const i = -1;'], ['toast cap 3', 'while (uiState.toasts.length >= 3) {', 'while (uiState.toasts.length >= 4) {'], ['toast undo cap', 'if (i < 0 && uiState.toasts.length < 5) break;', 'if (i < 0 && uiState.toasts.length < 6) break;'],
  ['group no toast', "ui.toast(msg || 'Removed', () => batch(", "(msg || 'Removed', () => batch("], ['group undo children', 'done.forEach(([x, id]) => x.undel(id))', 'done.slice(0, 1).forEach(([x, id]) => x.undel(id))'],
  ['table reserved', "!own(manifest.tables || {}, name)", "!(name in (manifest.tables || {}))"], ['group col', "if (col == null) bad('E_COL', 't.group(col, valCol): col is required');", ''], ['series by', "if (!['day', 'week', 'month'].includes(by))", 'if (false)'], ['key obj', 'if (!isObj(k) || !Object.keys(k).length)', 'if (!isObj(k))'],
];
const dir = mkdtempSync(join(tmpdir(), 'molde-mut-')); let killed = 0, skipped = 0; const survived = [];
for (const [name, a, b] of M) {
  if (!src.includes(a)) { console.log('SKIP (pattern not found):', name); skipped++; continue; }
  const f = join(dir, 'sdk.cjs'); writeFileSync(f, src.replace(a, b));
  try { execFileSync(process.execPath, ['--test', join(here, 'sdk.test.mjs')], { env: { ...process.env, MOLDE_SDK: f, TZ: process.env.MUT_TZ || 'America/Los_Angeles' }, stdio: 'pipe', timeout: 60000 }); survived.push(name); console.log('SURVIVED', name); }
  catch (e) { killed++; }
}
const total = M.length - skipped;
console.log(`\\nmutants ${total}, killed ${killed}, survived ${survived.length} (${(100 * killed / total).toFixed(1)}%), skipped ${skipped}`);
if (survived.length) console.log('survivors: ' + survived.join(', '));
process.exitCode = killed / total >= 0.9 ? 0 : 1;
