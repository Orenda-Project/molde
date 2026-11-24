// The lessons page: one lesson (written ahead, as a big model would) drawn by short MoldeScript
// programs, and a scripted chat that changes the program. Switching the view and every chat change
// are real program edits on ONE app per lesson (app.applyEdit), so the learner's answers, notes and
// progress stay; chat Undo is app.revert. The programs are hand-written examples of what the tiny
// model will learn to write: it is not trained on lessons yet.
import { load } from '../../../lang/eval.mjs';
import { mount } from '../render.mjs';
import { resolvePicture } from './lesson-pictures.mjs';

const $ = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE = 'molde-lessons-v1';
const NOW = '2026-11-26T10:30:00Z';

export const LESSONS = [
  { id: 'g3', file: 'g3-maths-halves-quarters', label: 'Grade 3 maths' },
  { id: 'g6', file: 'g6-science-water-cycle', label: 'Grade 6 science' },
  { id: 'tt', file: 'teacher-checking-understanding', label: 'Teacher training' },
];
// the 12 example programs, four per lesson, with the name a learner would use for the view
export const VIEWS = {
  g3: [['g3-read-then-quiz', 'Read, then quiz'], ['g3-step-by-step', 'Step by step'], ['g3-flashcards', 'Flashcards'], ['g3-practice', 'Practice']],
  g6: [['g6-tabs', 'Tabs'], ['g6-steps-with-notes', 'Steps with notes'], ['g6-quiz-only', 'Quiz'], ['g6-overview', 'Overview']],
  tt: [['tt-read-and-note', 'Read and note'], ['tt-checklist', 'Checklist'], ['tt-true-or-false', 'True or false'], ['tt-one-page', 'One page']],
};
export const EDITS = ['01-make-it-flashcards', '02-one-step-at-a-time', '03-quiz-me-at-the-end', '04-bigger-text', '05-hide-the-answers', '06-dark-mode', '07-just-the-quiz', '08-add-notes', '09-make-it-green', '10-show-what-i-got-wrong'];

// requests that change only the app line work on any program (written by hand, like the pairs)
const THEMES = /\b(ocean|mint|slate|ink|plum|red|orange|yellow|green|teal|blue|purple|pink|grey)\b/;
function appLine(src, f) { const [first, ...rest] = src.split('\n'); const l = f(first); return l === null ? null : [l, ...rest].join('\n'); }
const parts = l => { const m = /^app ("(?:[^"\\]|\\.)*")(.*)$/.exec(l); const w = m[2].trim().split(/\s+/).filter(Boolean); const icon = w[0] && !THEMES.test(w[0]) && !['dark', 'light', 'small', 'large', 'huge'].includes(w[0]) ? w.shift() : null; return { name: m[1], icon, theme: w.find(x => THEMES.test(x)) || null, mode: w.find(x => x === 'dark' || x === 'light') || null, size: w.find(x => ['small', 'large', 'huge'].includes(x)) || null }; };
const join = p => ['app', p.name, p.icon, p.theme, p.mode, p.size].filter(Boolean).join(' ');
const GENERIC = [
  { msg: 'Bigger text', apply: s => appLine(s, l => { const p = parts(l); if (p.size === 'large' || p.size === 'huge') return null; p.size = 'large'; if (!p.theme) p.theme = 'mint'; return join(p); }) },
  { msg: 'Dark mode', apply: s => appLine(s, l => { const p = parts(l); if (p.mode === 'dark') return null; p.mode = 'dark'; if (!p.theme) p.theme = 'mint'; return join(p); }) },
  { msg: 'Light mode', apply: s => appLine(s, l => { const p = parts(l); if (p.mode !== 'dark') return null; p.mode = 'light'; return join(p); }) },
  { msg: 'Make it green', apply: s => appLine(s, l => { const p = parts(l); if (p.theme === 'green') return null; p.theme = 'green'; return join(p); }) },
];

export function start(root, S0) {
  const lessons = Object.fromEntries(LESSONS.map(l => [l.id, JSON.parse(S0['lesson:' + l.file])]));
  const prog = id => S0['prog:' + id];
  const edits = EDITS.map(n => ({ n, before: S0[`edit:${n}:before`], after: S0[`edit:${n}:after`], msg: S0[`edit:${n}:request`].trim() }));
  const S = { lesson: 'g3', mode: matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', apps: {}, chat: {}, renderer: null };
  const q = new URLSearchParams(location.hash.slice(1));
  if (LESSONS.some(l => l.id === q.get('lesson'))) S.lesson = q.get('lesson');
  if (q.get('mode') === 'dark' || q.get('mode') === 'light') S.mode = q.get('mode');

  // this device's copy: per lesson the running program, its data and history (answers and notes survive a reload)
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { saved = {}; }
  const save = () => { try { const out = {}; for (const [id, a] of Object.entries(S.apps)) out[id] = { snap: a.snapshot() }; localStorage.setItem(STORE, JSON.stringify(out)); } catch { /* no storage: the session still works */ } };
  function appFor(id) {
    if (S.apps[id]) return S.apps[id];
    let a = null;
    if (saved[id] && saved[id].snap) { a = load(prog(VIEWS[id][0][0]), { now: NOW, lesson: lessons[id], data: saved[id].snap }); if (!a.ok) a = null; }
    a ||= load(prog(VIEWS[id][0][0]), { now: NOW, lesson: lessons[id] });
    S.apps[id] = a; S.chat[id] ||= [];
    return a;
  }

  document.documentElement.setAttribute('data-mode', S.mode);
  root.textContent = '';
  root.className = 'dm ls';
  const top = $('header', 'dm-top');
  top.innerHTML = `<div class="dm-brand"><p class="dm-name">Molde lessons</p><p class="dm-sub">The lesson text is written ahead (by a bigger model or a teacher). The screen is a short MoldeScript program that only names the lesson's parts. <strong>These programs are hand-written examples of what the tiny model will learn to write; the model is not trained on lessons yet, and the chat is scripted.</strong></p></div>`;
  const modeBtn = $('button', 'dm-btn', { type: 'button' });
  const resetBtn = $('button', 'dm-btn', { type: 'button' });
  resetBtn.textContent = 'Reset this lesson';
  const tools = $('div', 'dm-tools'); tools.append(modeBtn, resetBtn); top.append(tools);

  const pick = $('nav', 'ls-pick', { 'aria-label': 'Lessons' });
  const views = $('div', 'ls-views', { role: 'group', 'aria-label': 'How the lesson is shown' });
  const stage = $('section', 'dm-stage', { 'aria-label': 'The lesson app' });
  const phone = $('div', 'dm-phone'); const mountEl = $('div', 'dm-appmount'); phone.append(mountEl); stage.append(phone);
  const side = $('section', 'ls-side');
  const chatBox = $('div', 'ls-chat', { 'aria-label': 'Ask for a change' });
  const msgs = $('div', 'ls-msgs', { 'aria-live': 'polite' });
  const chips = $('div', 'ls-chips');
  const undoBtn = $('button', 'dm-btn ls-undo', { type: 'button' }); undoBtn.textContent = 'Undo the last change';
  chatBox.innerHTML = '<p class="ls-h">Ask for a change <span class="ls-tag">scripted</span></p>';
  chatBox.append(msgs, chips, undoBtn);
  const codeBox = $('div', 'ls-code');
  side.append(chatBox, codeBox);
  const main = $('div', 'ls-main');
  const left = $('div', 'ls-left'); left.append(pick, views);
  main.append(left, stage, side);
  root.append(top, main);

  function paint() {
    const a = appFor(S.lesson);
    document.documentElement.setAttribute('data-mode', S.mode);
    modeBtn.textContent = S.mode === 'dark' ? 'Light page' : 'Dark page';
    pick.innerHTML = '<p class="ls-h">Lesson</p>';
    for (const l of LESSONS) {
      const b = $('button', 'dm-item', { type: 'button', 'aria-current': String(l.id === S.lesson) });
      b.innerHTML = `<span class="dm-item-t">${esc(lessons[l.id].title)}</span><span class="dm-item-n">${esc(l.label)}</span>`;
      b.onclick = () => { S.lesson = l.id; writeHash(); paint(); };
      pick.append(b);
    }
    views.innerHTML = '<p class="ls-h">Show it as</p>';
    for (const [id, label] of VIEWS[S.lesson]) {
      const src = prog(id);
      const b = $('button', 'dm-item', { type: 'button', 'aria-current': String(a.source === src) });
      b.innerHTML = `<span class="dm-item-t">${esc(label)}</span><span class="dm-item-n">${src.trim().split('\n').length} lines</span>`;
      b.onclick = () => change(src, `Show it as: ${label}`);
      views.append(b);
    }
    if (S.renderer) S.renderer.destroy();
    S.renderer = mount(mountEl, a, { mode: S.mode, resolveImage: resolvePicture, onChange: () => { save(); paintCode(); } });
    paintChat(); paintCode();
  }
  function paintCode() {
    const a = S.apps[S.lesson];
    const n = k => a.rows(k).length;
    codeBox.innerHTML = `<p class="ls-h">The program (${a.source.trim().split('\n').length} lines)</p><pre class="dm-pre ls-pre" tabindex="0" aria-label="Program source">${esc(a.source)}</pre><p class="ls-kept">Kept for this learner: ${n('answer')} answers, ${n('note')} notes, ${n('seen')} parts read. They stay through every change and a reload.</p>`;
  }
  function options() {
    const a = S.apps[S.lesson];
    const out = edits.filter(e => e.before.trim() === a.source.trim()).map(e => ({ msg: e.msg, src: e.after }));
    const key = m => m.toLowerCase().split(/\s+/).slice(0, 2).join(' '); // "Bigger text please" and "Bigger text" are one request
    for (const g of GENERIC) { const s = g.apply(a.source); if (s && !out.some(o => key(o.msg) === key(g.msg))) out.push({ msg: g.msg, src: s }); }
    return out;
  }
  function paintChat() {
    const log = S.chat[S.lesson];
    msgs.innerHTML = log.length ? log.map(m => `<p class="ls-msg ls-${m.who}">${esc(m.text)}</p>`).join('') : '<p class="ls-empty">Pick a request below. Each one is a hand-written program change, applied by the real evaluator.</p>';
    msgs.scrollTop = msgs.scrollHeight;
    chips.textContent = '';
    for (const o of options()) { const b = $('button', 'ls-chip', { type: 'button' }); b.textContent = o.msg; b.onclick = () => change(o.src, o.msg); chips.append(b); }
    undoBtn.disabled = !log.some(m => m.who === 'me');
  }
  function change(src, msg) {
    const a = S.apps[S.lesson];
    if (a.source.trim() === src.trim()) return;
    const r = a.applyEdit(src);
    const log = S.chat[S.lesson];
    log.push({ who: 'me', text: msg });
    log.push({ who: 'bot', text: r.verdict === 'refused' ? `That change was refused: ${(r.refused || [])[0] || 'it is not safe for your data'}.` : 'Done. Your answers and notes are kept.' });
    save(); paint();
  }
  undoBtn.onclick = () => {
    const a = S.apps[S.lesson]; const log = S.chat[S.lesson];
    if (!a.revert || a.revert() === false) return;
    log.push({ who: 'bot', text: 'Undone: back to the program before. Your answers and notes are kept.' });
    save(); paint();
  };
  modeBtn.onclick = () => { S.mode = S.mode === 'dark' ? 'light' : 'dark'; writeHash(); paint(); };
  resetBtn.onclick = () => { delete S.apps[S.lesson]; delete saved[S.lesson]; S.chat[S.lesson] = []; save(); paint(); };
  function writeHash() { history.replaceState(null, '', `#lesson=${S.lesson}&mode=${S.mode}`); }
  paint();
  S.change = change; S.options = options; S.app = () => S.apps[S.lesson];
  window.__lessons = S; // for tests
  return S;
}
