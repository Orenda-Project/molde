// The lesson a program is given (LESSON.md). A `lesson` line in a program declares the lesson's
// read-only tables (filled from the lesson JSON, never stored as the learner's data) and the
// learner's own tables (stored like any table, so they follow the data-safety rules).
//
// Content row ids are numbers derived from the content's own ids (a section's "id", a question's
// "id"), so a learner's answer or note keeps pointing at the same section or question when the
// UI program is edited, and when the lesson is regenerated with the same ids.

// the lines a `lesson` statement stands for (checked and run as ordinary level 1)
export const LESSON_TABLES = `table lessoninfo title text, subject text?, audience text?, minutes num?, summary long?
table section title text, n num
table block section ref section, kind pick paragraph|item|step|example|keyterm|image, title text?, body long?, pic image?, n num
table question section ref section?, kind pick mc|tf|short, prompt long, solution long?, explanation long?, n num
table option question ref question, label text, right bool, n num
table term word text, meaning long, n num
table objective body long, n num
let lesson = first(lessoninfo)
table answer question ref question, option ref option?, reply long?, right bool
table note section ref section, body long
table seen section ref section`;
export const CONTENT_TABLES = ['lessoninfo', 'section', 'block', 'question', 'option', 'term', 'objective'];
export const LEARNER_TABLES = ['answer', 'note', 'seen'];

// ---- the contract (also written out as JSON Schema in LESSON.md) ----
const str = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const BLOCK_KINDS = { paragraph: ['text'], list: ['items'], steps: ['items'], example: ['text'], term: ['term', 'definition'], image: ['ref', 'alt'] };

// every problem with a lesson object, as plain sentences (empty when it is valid)
export function validateLesson(L) {
  const e = [];
  if (!L || typeof L !== 'object' || Array.isArray(L)) return ['the lesson is not a JSON object.'];
  if (!str(L.title, 200)) e.push('title: a non-empty text of at most 200 characters is required.');
  for (const k of ['subject', 'audience', 'summary']) if (L[k] !== undefined && !str(L[k])) e.push(`${k}: must be a non-empty text when given.`);
  if (L.minutes !== undefined && !(Number.isInteger(L.minutes) && L.minutes > 0 && L.minutes <= 600)) e.push('minutes: a whole number from 1 to 600 when given.');
  if (L.objectives !== undefined && !(Array.isArray(L.objectives) && L.objectives.every(o => str(o, 500)))) e.push('objectives: a list of texts.');
  if (!Array.isArray(L.sections) || !L.sections.length || L.sections.length > 50) e.push('sections: a list of 1 to 50 sections is required.');
  const secIds = new Set();
  (Array.isArray(L.sections) ? L.sections : []).forEach((s, i) => {
    const at = `sections[${i}]`;
    if (!s || typeof s !== 'object') return e.push(`${at}: must be an object.`);
    if (typeof s.id !== 'string' || !ID.test(s.id)) e.push(`${at}.id: lowercase letters, digits, - or _ (at most 40).`);
    else if (secIds.has(s.id)) e.push(`${at}.id: "${s.id}" is used twice.`); else secIds.add(s.id);
    if (!str(s.title, 200)) e.push(`${at}.title: a non-empty text is required.`);
    if (!Array.isArray(s.blocks) || !s.blocks.length || s.blocks.length > 60) e.push(`${at}.blocks: a list of 1 to 60 blocks is required.`);
    (Array.isArray(s.blocks) ? s.blocks : []).forEach((b, j) => {
      const bt = `${at}.blocks[${j}]`;
      if (!b || !BLOCK_KINDS[b.kind]) return e.push(`${bt}.kind: one of ${Object.keys(BLOCK_KINDS).join(', ')}.`);
      for (const f of BLOCK_KINDS[b.kind]) {
        if (f === 'items') { if (!Array.isArray(b.items) || !b.items.length || !b.items.every(x => str(x, 1000))) e.push(`${bt}.items: a list of texts.`); }
        else if (!str(b[f])) e.push(`${bt}.${f}: a non-empty text is required for a ${b.kind}.`);
      }
      if (b.title !== undefined && !str(b.title, 200)) e.push(`${bt}.title: a non-empty text when given.`);
      if (b.caption !== undefined && !str(b.caption, 500)) e.push(`${bt}.caption: a non-empty text when given.`);
    });
  });
  const qIds = new Set();
  if (L.questions !== undefined && !Array.isArray(L.questions)) e.push('questions: a list when given.');
  (Array.isArray(L.questions) ? L.questions : []).forEach((q, i) => {
    const at = `questions[${i}]`;
    if (!q || typeof q !== 'object') return e.push(`${at}: must be an object.`);
    if (typeof q.id !== 'string' || !ID.test(q.id)) e.push(`${at}.id: lowercase letters, digits, - or _ (at most 40).`);
    else if (qIds.has(q.id)) e.push(`${at}.id: "${q.id}" is used twice.`); else qIds.add(q.id);
    if (q.section !== undefined && !secIds.has(q.section)) e.push(`${at}.section: "${q.section}" is not a section id.`);
    if (!str(q.prompt, 1000)) e.push(`${at}.prompt: a non-empty text is required.`);
    if (q.explanation !== undefined && !str(q.explanation)) e.push(`${at}.explanation: a non-empty text when given.`);
    if (q.kind === 'mc') {
      if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6 || !q.choices.every(c => str(c, 300))) e.push(`${at}.choices: 2 to 6 texts for a multiple-choice question.`);
      else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) e.push(`${at}.answer: the index (from 0) of the right choice.`);
    } else if (q.kind === 'tf') {
      if (typeof q.answer !== 'boolean') e.push(`${at}.answer: true or false.`);
    } else if (q.kind === 'short') {
      if (!str(q.answer, 300)) e.push(`${at}.answer: the expected short answer.`);
    } else e.push(`${at}.kind: mc, tf or short.`);
  });
  if (L.terms !== undefined && !(Array.isArray(L.terms) && L.terms.every(t => t && str(t.term, 200) && str(t.definition)))) e.push('terms: a list of {term, definition}.');
  const known = new Set(['title', 'subject', 'audience', 'minutes', 'objectives', 'sections', 'questions', 'terms', 'summary']);
  for (const k of Object.keys(L)) if (!known.has(k)) e.push(`${k}: not part of the lesson contract.`);
  return e;
}

// a positive whole number for a content id (FNV-1a), the same on every load
function idNum(kind, s) {
  let h = 0x811c9dc5;
  for (const c of kind + ':' + s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 1e9 + (h % 1e9); // ponytail: 32-bit hash per table; validateLesson ids are unique, a clash is checked below
}

// the rows of the content tables, by table name, with field names as in LESSON_TABLES
// (rows are given `at` times that fall with their position, so the default newest-first order is
// the lesson's own order)
export function lessonRows(L) {
  const T = { lessoninfo: [], section: [], block: [], question: [], option: [], term: [], objective: [] };
  let k = 0;
  const row = (t, id, f) => { T[t].push({ id, at: 2e12 - (++k) * 1000, ...f }); };
  row('lessoninfo', 1, { title: L.title, subject: L.subject ?? null, audience: L.audience ?? null, minutes: L.minutes ?? null, summary: L.summary ?? null });
  const secId = new Map();
  L.sections.forEach((s, i) => {
    const sid = idNum('s', s.id); secId.set(s.id, sid);
    row('section', sid, { title: s.title, n: i + 1 });
    let n = 0;
    s.blocks.forEach((b, j) => {
      const bid = (j2 = 0) => idNum('b', `${s.id}/${j}/${j2}`);
      if (b.kind === 'list' || b.kind === 'steps') b.items.forEach((it, x) => row('block', bid(x), { section: sid, kind: b.kind === 'list' ? 'item' : 'step', title: b.title ?? null, body: it, pic: null, n: ++n }));
      else if (b.kind === 'term') row('block', bid(), { section: sid, kind: 'keyterm', title: b.term, body: b.definition, pic: null, n: ++n });
      else if (b.kind === 'image') row('block', bid(), { section: sid, kind: 'image', title: b.alt, body: b.caption ?? null, pic: b.ref, n: ++n });
      else row('block', bid(), { section: sid, kind: b.kind, title: b.title ?? null, body: b.text, pic: null, n: ++n });
    });
  });
  (L.questions || []).forEach((q, i) => {
    const qid = idNum('q', q.id);
    const choices = q.kind === 'mc' ? q.choices : q.kind === 'tf' ? ['True', 'False'] : [];
    const right = q.kind === 'mc' ? q.answer : q.kind === 'tf' ? (q.answer ? 0 : 1) : -1;
    row('question', qid, { section: q.section ? secId.get(q.section) : null, kind: q.kind, prompt: q.prompt, solution: q.kind === 'short' ? q.answer : choices[right], explanation: q.explanation ?? null, n: i + 1 });
    choices.forEach((c, x) => row('option', idNum('o', `${q.id}/${x}`), { question: qid, label: c, right: x === right, n: x + 1 }));
  });
  (L.terms || []).forEach((t, i) => row('term', idNum('t', t.term), { word: t.term, meaning: t.definition, n: i + 1 }));
  (L.objectives || []).forEach((o, i) => row('objective', idNum('j', String(i)), { body: o, n: i + 1 }));
  for (const [t, rows] of Object.entries(T)) if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error(`two ${t} ids of the lesson hash to the same number; change one id`);
  return T;
}
