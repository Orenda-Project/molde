// The demo page: pick a program, see the screen it makes and the MoldeScript beside it.
// Inside the phone frame there is only the user's app and one chat button (the product shell).
// The chat is scripted: there is no trained model yet, so it offers requests whose program
// changes were written by hand (requests.mjs). The change itself is real: the new program is
// diffed against the old one (lang/diff.mjs), swapped in live with the data kept, and undoable.
import { load } from '../../../lang/eval.mjs';
import { diff } from '../../../lang/diff.mjs';
import { describe } from '../../../lang/describe.mjs';
import { mount } from '../render.mjs';
import { ICONS } from '../icons.mjs';
import { CATALOG } from './catalog.mjs';
import { SEEDS, NOW } from './seed.mjs';
import { requestsFor, newAppsFor } from './requests.mjs';

const $ = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  return { ex: q.get('ex'), view: q.get('view'), frame: q.get('frame'), mode: q.get('mode') };
}
function systemMode() { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; } }

// load a program and give it existing data; tables and settings that are new get their
// empty or default values (the evaluator's restore() replaces data wholesale)
export function loadWithData(src, snap) {
  const app = load(src, { now: NOW });
  if (!snap) return app;
  const fresh = app.data;
  app.restore(snap);
  for (const t in fresh.tables) if (!(t in app.data.tables)) app.data.tables[t] = [];
  for (const s in fresh.settings) if (!(s in app.data.settings)) app.data.settings[s] = fresh.settings[s];
  return app;
}
export function seeded(id, src) {
  const app = load(src, { now: NOW });
  if (SEEDS[id]) SEEDS[id](app);
  return app;
}

export function start(root, sources) {
  const h = readHash();
  const S = {
    ex: CATALOG.some(c => c.id === h.ex) ? h.ex : CATALOG[0].id,
    view: h.view === 'app' ? 'app' : 'demo',
    frame: h.frame === 'full' ? 'full' : 'phone',
    mode: h.mode === 'dark' || h.mode === 'light' ? h.mode : systemMode(),
    renderer: null, app: null, src: '', prevSrc: '', history: [], chat: [], versions: [],
  };
  document.documentElement.setAttribute('data-mode', S.mode);
  root.textContent = '';
  root.className = 'dm' + (S.view === 'app' ? ' dm-apponly' : '');

  // header (outside the phone)
  const top = $('header', 'dm-top');
  const brand = $('div', 'dm-brand');
  brand.innerHTML = `<p class="dm-name">Molde</p><p class="dm-sub">Short MoldeScript programs, drawn live by the web runtime. <strong>Demo: requests are scripted, the model is not trained yet.</strong></p>`;
  const tools = $('div', 'dm-tools');
  const frameBtn = $('button', 'dm-btn', { type: 'button' });
  const modeBtn = $('button', 'dm-btn', { type: 'button' });
  tools.append(frameBtn, modeBtn);
  top.append(brand, tools);

  // picker (outside the phone)
  const nav = $('nav', 'dm-pick', { 'aria-label': 'Example programs' });
  const list = $('ul', 'dm-list');
  for (const c of CATALOG) {
    const li = $('li');
    const b = $('button', 'dm-item', { type: 'button', 'data-ex': c.id });
    const lines = (sources[c.id] || '').trim().split('\n').length;
    b.innerHTML = `<span class="dm-item-t">${esc(c.title)}</span><span class="dm-item-n">${lines} lines</span>`;
    li.append(b); list.append(li);
  }
  nav.append(list);

  // the phone: the app, the chat button and the chat sheet
  const stage = $('section', 'dm-stage', { 'aria-label': 'Live app' });
  const phone = $('div', 'dm-phone');
  const appEl = $('div', 'dm-appmount');
  const fab = $('button', 'dm-fab', { type: 'button', 'aria-label': 'Ask for a change', 'aria-haspopup': 'dialog' });
  fab.innerHTML = icon('_chat');
  const chatWrap = $('div', 'dm-chatwrap');
  chatWrap.hidden = true;
  const chat = $('section', 'dm-chat', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ask for a change' });
  const chatHead = $('div', 'dm-chat-head');
  chatHead.innerHTML = `<p class="dm-chat-t">Ask for a change or a new app</p>`;
  const chatClose = $('button', 'dm-iconbtn', { type: 'button', 'aria-label': 'Close' });
  chatClose.innerHTML = icon('_x');
  chatHead.append(chatClose);
  const msgs = $('div', 'dm-msgs', { 'aria-live': 'polite' });
  const sugg = $('div', 'dm-sugg');
  const form = $('form', 'dm-ask');
  const input = $('input', 'dm-input', { type: 'text', placeholder: 'Describe a change', 'aria-label': 'Your request', autocomplete: 'off' });
  const send = $('button', 'dm-send', { type: 'submit', 'aria-label': 'Send' });
  send.innerHTML = icon('_send');
  form.append(input, send);
  chat.append(chatHead, msgs, sugg, form);
  chatWrap.append(chat);
  phone.append(appEl, fab, chatWrap);
  stage.append(phone);

  // source (outside the phone)
  const code = $('section', 'dm-code', { 'aria-label': 'MoldeScript source' });
  const codeHead = $('div', 'dm-code-head');
  const codeTitle = $('div');
  const reset = $('button', 'dm-btn', { type: 'button' });
  reset.innerHTML = icon('_undo') + '<span>Reset</span>';
  reset.setAttribute('aria-label', 'Reset this app and its data');
  codeHead.append(codeTitle, reset);
  const pre = $('pre', 'dm-pre', { tabindex: '0', 'aria-label': 'Program source' });
  const note = $('p', 'dm-note');
  code.append(codeHead, note, pre);

  const main = $('div', 'dm-main');
  main.append(nav, stage, code);
  root.append(top, main);

  function mountApp(app) {
    if (S.renderer) S.renderer.destroy();
    S.app = app;
    S.renderer = mount(appEl, app, { mode: S.mode, onAsk: a => S.renderer.toast('Answer: ' + a) });
  }
  function paintSource() {
    const c = CATALOG.find(x => x.id === S.ex);
    const lines = S.src.trim().split('\n');
    const old = new Set((S.prevSrc || S.src).trim().split('\n'));
    codeTitle.innerHTML = `<p class="dm-code-t">${esc(c.title.toLowerCase().replace(/\s+/g, '-'))}.mo</p><p class="dm-code-n">${lines.length} lines, ${S.src.length.toLocaleString('en-US')} characters</p>`;
    note.textContent = c.note;
    pre.innerHTML = lines.map(l => `<span class="dm-ln${old.has(l) ? '' : ' dm-new'}">${highlight(l)}</span>`).join('\n');
  }
  function show(id, keepScroll) {
    S.ex = id; S.src = sources[id]; S.prevSrc = ''; S.history = []; S.chat = []; S.versions = [S.src];
    mountApp(seeded(id, S.src));
    for (const b of list.querySelectorAll('.dm-item')) b.setAttribute('aria-current', String(b.getAttribute('data-ex') === id));
    paintSource(); paintChat(); writeHash();
    if (!keepScroll) pre.scrollTop = 0;
  }
  function writeHash() {
    const q = new URLSearchParams({ ex: S.ex });
    if (S.view === 'app') q.set('view', 'app');
    if (S.frame === 'full') q.set('frame', 'full');
    try { history.replaceState(null, '', '#' + q.toString()); } catch { /* sandboxed: no history */ }
  }
  function paintTools() {
    frameBtn.innerHTML = icon(S.frame === 'phone' ? '_monitor' : '_phone') + `<span>${S.frame === 'phone' ? 'Full width' : 'Phone size'}</span>`;
    frameBtn.setAttribute('aria-label', S.frame === 'phone' ? 'Show the app full width' : 'Show the app at phone size');
    modeBtn.innerHTML = icon('_contrast') + `<span>${S.mode === 'dark' ? 'Light' : 'Dark'}</span>`;
    modeBtn.setAttribute('aria-label', `Switch to ${S.mode === 'dark' ? 'light' : 'dark'} mode`);
    root.classList.toggle('dm-full', S.frame === 'full');
  }

  // ----- chat -----
  function openChat() { chatWrap.hidden = false; fab.hidden = true; paintChat(); const f = sugg.querySelector('button'); (f || input).focus(); }
  function closeChat() { chatWrap.hidden = true; fab.hidden = false; fab.focus(); }
  function paintChat() {
    msgs.textContent = '';
    if (!S.chat.length) {
      const m = $('div', 'dm-msg dm-bot');
      m.innerHTML = `<p>This is <strong>${esc(appName(S.src))}</strong>. Ask me to change it, or to make a new app. In this demo, pick one of the requests below.</p>`;
      msgs.append(m);
    }
    S.chat.forEach((c, i) => {
      const m = $('div', 'dm-msg ' + (c.who === 'you' ? 'dm-you' : 'dm-bot'));
      m.innerHTML = c.html;
      if (c.undo && i === S.chat.length - 1 && S.history.length) {
        const u = $('button', 'dm-btn dm-undo', { type: 'button' });
        u.innerHTML = icon('_undo') + '<span>Undo</span>';
        u.addEventListener('click', undo);
        m.append(u);
      }
      msgs.append(m);
    });
    sugg.textContent = '';
    const reqs = requestsFor(S.ex, S.src, sources), apps = newAppsFor(S.ex);
    const lab = $('p', 'dm-sugg-t'); lab.textContent = 'Try a request'; sugg.append(lab);
    for (const r of reqs) sugg.append(chip(r.text, () => runEdit(r)));
    for (const a of apps) sugg.append(chip(a.text, () => runNewApp(a), true));
    msgs.scrollTop = msgs.scrollHeight;
  }
  function chip(text, fn, isNew) {
    const b = $('button', 'dm-chip' + (isNew ? ' dm-chip-new' : ''), { type: 'button' });
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function say(who, html, undoable) { S.chat.push({ who, html, undo: !!undoable }); }
  function runEdit(r) {
    const oldSrc = S.src, newSrc = r.apply(oldSrc);
    say('you', `<p>${esc(r.text)}</p>`);
    const d = diff(S.versions, newSrc);   // checked against every earlier version of this app
    if (d.verdict !== 'safe') { say('bot', `<p>I could not make that change safely.</p><ul>${d.refused.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`); paintChat(); return; }
    S.history.push({ kind: 'edit', ex: S.ex, src: oldSrc, prevSrc: S.prevSrc });
    mountApp(loadWithData(newSrc, S.app.snapshot()));
    S.prevSrc = oldSrc; S.src = newSrc; S.versions.push(newSrc);
    const data = touchesData(d);
    say('bot', `<p>${esc(r.says || 'Done.')}</p>${data ? '<p class="dm-small">Everything you saved is still here.</p>' : ''}`, true);
    paintSource(); paintChat();
  }
  function runNewApp(a) {
    say('you', `<p>${esc(a.text)}</p>`);
    S.history.push({ kind: 'app', ex: S.ex, src: S.src, prevSrc: S.prevSrc, versions: S.versions, snap: S.app.snapshot() });
    S.ex = a.to; S.src = sources[a.to]; S.prevSrc = ''; S.versions = [S.src];
    mountApp(seeded(a.to, S.src));
    for (const b of list.querySelectorAll('.dm-item')) b.setAttribute('aria-current', String(b.getAttribute('data-ex') === a.to));
    const c = CATALOG.find(x => x.id === a.to);
    say('bot', `<p>Here is a new app: <strong>${esc(appName(S.src))}</strong>. ${esc(c.about || '')}</p><p class="dm-small">${esc(plainSummary(S.src))} It opens with sample data so you can try it.</p>`, true);
    paintSource(); paintChat(); writeHash();
  }
  // chat Undo puts back the previous PROGRAM. Data is never rolled back by it: every row and
  // setting entered since stays, and values in fields the older program does not have stay
  // stored (hidden) and come back if those fields return.
  function undo() {
    const p = S.history.pop();
    if (!p) return;
    let msg;
    if (p.kind === 'app') {
      S.ex = p.ex; S.src = p.src; S.prevSrc = p.prevSrc; S.versions = p.versions;
      mountApp(loadWithData(p.src, p.snap));
      msg = `Back to ${appName(p.src)}, as you left it.`;
    } else {
      const hidden = hiddenData(S.app, p.src);
      mountApp(loadWithData(p.src, S.app.snapshot()));
      S.src = p.src; S.prevSrc = p.prevSrc;
      msg = 'The app is back to the earlier version. Everything you added since is still here.' +
        (hidden.length ? ` What you wrote in ${hidden.join(' and ')} is kept but hidden; it shows again if you ask for it back.` : '');
    }
    for (const b of list.querySelectorAll('.dm-item')) b.setAttribute('aria-current', String(b.getAttribute('data-ex') === S.ex));
    S.chat.forEach(c => { c.undo = false; });
    say('bot', `<p>${esc(msg)}</p>`);
    paintSource(); paintChat(); writeHash();
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = '';
    const all = [...requestsFor(S.ex, S.src, sources), ...newAppsFor(S.ex)];
    const hit = all.find(r => r.text.toLowerCase() === t.toLowerCase());
    if (hit) return hit.to ? runNewApp(hit) : runEdit(hit);
    say('you', `<p>${esc(t)}</p>`);
    say('bot', '<p>The model that understands free text is not trained yet, so this demo only knows the requests listed below.</p>');
    paintChat();
  });
  fab.addEventListener('click', openChat);
  // the chat button steps aside while the user scrolls down a long screen and comes back on the way up
  let lastTop = 0;
  appEl.addEventListener('scroll', e => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('mo-scrollarea')) return;
    const y = t.scrollTop, atEnd = y + t.clientHeight >= t.scrollHeight - 4;
    if (y > lastTop + 6 && y > 80 && !atEnd) phone.classList.add('dm-fab-away');
    else if (y < lastTop - 6 || y <= 80) phone.classList.remove('dm-fab-away');
    lastTop = y;
  }, true);
  chatClose.addEventListener('click', closeChat);
  chatWrap.addEventListener('click', e => { if (e.target === chatWrap) closeChat(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !chatWrap.hidden) closeChat(); });

  frameBtn.addEventListener('click', () => { S.frame = S.frame === 'phone' ? 'full' : 'phone'; paintTools(); writeHash(); });
  modeBtn.addEventListener('click', () => {
    S.mode = S.mode === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', S.mode);
    S.renderer.setMode(S.mode); paintTools();
  });
  reset.addEventListener('click', () => show(S.ex, true));
  list.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) show(b.getAttribute('data-ex')); });
  addEventListener('hashchange', () => { const n = readHash(); if (n.ex && n.ex !== S.ex && CATALOG.some(c => c.id === n.ex)) show(n.ex); });
  paintTools();
  show(S.ex);
  S.showBlank = id => { show(id); mountApp(load(sources[id], { now: NOW })); };   // tests: the app with no data
  S.runEdit = runEdit; S.runNewApp = runNewApp; S.undo = undo; S.openChat = openChat;
  window.__molde = S;   // for tests: the running app, renderer and chat actions
  return S;
}

// a change that adds or changes stored data (not only the screen)
function touchesData(d) { return d.changes.some(c => /\b(field|table|setting|options?)\b/.test(c) && !/^(adds|removes from the screen): /.test(c)); }
// fields (and tables) holding values in the running app that the older program does not declare
function hiddenData(app, olderSrc) {
  const older = load(olderSrc, { now: NOW });
  const out = [];
  for (const [t, tb] of app.env.tables) {
    const ot = older.env.tables.get(t);
    for (const [f] of tb.fields) {
      if (ot && ot.fields.has(f)) continue;
      if (app.rows(t).some(r => r[f] !== null && r[f] !== undefined && r[f] !== '' && r[f] !== false)) out.push(ot ? `"${f.replace(/_/g, ' ')}"` : `the ${t.replace(/_/g, ' ')} list`);
    }
  }
  return [...new Set(out)];
}
// the first line of describe.mjs and what it keeps, as one plain sentence
function plainSummary(src) {
  const lines = describe(src).split('\n');
  const keeps = [];
  let on = false;
  for (const l of lines) { if (/^Keeps:/.test(l)) on = true; else if (/^[A-Z]/.test(l)) on = false; else if (on && /^- /.test(l)) keeps.push(l.slice(2).split(':')[0].replace(/_/g, ' ')); }
  return keeps.length ? `It keeps a list of ${keeps.join(' and ')}.` : '';
}
function appName(src) { const m = /^app "([^"]*)"/.exec(src); return m ? m[1] : 'this app'; }

// light syntax colouring: statement word, strings, numbers, keywords after the first word
const KW = new Set(['tap', 'swipe', 'then', 'fill', 'stroke', 'color', 'thick', 'radius', 'opacity', 'width', 'height', 'grow', 'pad', 'gap', 'span', 'align', 'card', 'big', 'head', 'faint', 'bold', 'size', 'where', 'by', 'sort', 'desc', 'top', 'as', 'of', 'on', 'today', 'week', 'month', 'last', 'prev', 'days', 'all', 'set', 'add', 'remove', 'edit', 'save', 'toggle', 'go', 'notify', 'keep', 'new', 'unit', 'and', 'or', 'not', 'if', 'yes', 'no']);
function highlight(line) {
  const m = /^(\s*)(\S+)(.*)$/.exec(line);
  if (!m) return esc(line);
  const rest = m[3].replace(/("(?:[^"\\]|\\.)*")|\b(\d+(?:\.\d+)?[smhd]?)\b|\b([a-z_]+)\b|([^"\w]+)/g, (all, str, n, w, other) => {
    if (str) return `<span class="tk-s">${esc(str)}</span>`;
    if (n) return `<span class="tk-n">${esc(n)}</span>`;
    if (w) return KW.has(w) ? `<span class="tk-k">${w}</span>` : w;
    return esc(other || all);
  });
  return `${m[1]}<span class="tk-w">${esc(m[2])}</span>${rest}`;
}
