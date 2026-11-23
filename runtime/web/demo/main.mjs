// The demo page: pick a program, see the screen it makes and the MoldeScript beside it.
// Inside the phone frame there is only the user's app and one chat button (the product shell),
// in a strip of its own at the bottom so it never sits on the app.
// The chat is scripted: there is no trained model yet, so it offers requests whose program
// changes were written by hand (requests.mjs). The change itself is real: the evaluator applies
// it (app.applyEdit, data kept by storage slot) and chat Undo goes back a program (app.revert),
// keeping everything entered since.
import { load } from '../../../lang/eval.mjs';
import { describe } from '../../../lang/describe.mjs';
import { mount } from '../render.mjs';
import { ICONS } from '../icons.mjs';
import { CATALOG } from './catalog.mjs';
import { SEEDS, NOW } from './seed.mjs';
import { requestsFor, newAppsFor } from './requests.mjs';

const $ = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const INSET = 80;   // the strip at the bottom of the phone that holds the chat button

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  return { ex: q.get('ex'), view: q.get('view'), frame: q.get('frame'), mode: q.get('mode') };
}
function systemMode() { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; } }

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
    renderer: null,
    apps: {},        // id -> { app, base, changed }: every app keeps its own data for the session
    history: [],     // chat changes, newest last: { kind: 'edit'|'app', ex, from, msg }
    chat: [],        // { who, html, change?: index into history, undone? }
  };
  const cur = () => S.apps[S.ex];
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

  // the phone: the app, and a strip at the bottom with the chat button
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

  // source and data controls (outside the phone)
  const code = $('section', 'dm-code', { 'aria-label': 'MoldeScript source' });
  const codeHead = $('div', 'dm-code-head');
  const codeTitle = $('div');
  const reset = $('button', 'dm-btn', { type: 'button' });
  reset.innerHTML = icon('_undo') + '<span>Reset demo data</span>';
  reset.setAttribute('aria-label', 'Reset demo data for this app');
  codeHead.append(codeTitle, reset);
  const pre = $('pre', 'dm-pre', { tabindex: '0', 'aria-label': 'Program source' });
  const note = $('p', 'dm-note');
  code.append(codeHead, note, pre);

  const main = $('div', 'dm-main');
  main.append(nav, stage, code);
  root.append(top, main);

  function mountApp() {
    if (S.renderer) S.renderer.destroy();
    S.renderer = mount(appEl, cur().app, { mode: S.mode, insetBottom: INSET, onAsk: a => S.renderer.toast('Answer: ' + a) });
    for (const b of list.querySelectorAll('.dm-item')) b.setAttribute('aria-current', String(b.getAttribute('data-ex') === S.ex));
    paintSource(); paintChat(); writeHash();
  }
  // open an app; one opened before keeps the data it had (nothing is reseeded behind the user)
  function open(id) {
    S.ex = id;
    if (!S.apps[id]) S.apps[id] = { app: seeded(id, sources[id]), base: sources[id], prev: [] };
    mountApp();
  }
  function paintSource() {
    const c = CATALOG.find(x => x.id === S.ex);
    const src = cur().app.source;
    const lines = src.trim().split('\n');
    const prev = cur().prev.length ? cur().prev[cur().prev.length - 1] : null;
    const old = new Set((prev || src).trim().split('\n'));
    codeTitle.innerHTML = `<p class="dm-code-t">${esc(c.title.toLowerCase().replace(/\s+/g, '-'))}.mo</p><p class="dm-code-n">${lines.length} lines, ${src.length.toLocaleString('en-US')} characters${prev ? ' · changed lines marked' : ''}</p>`;
    note.textContent = c.note;
    pre.innerHTML = lines.map(l => `<span class="dm-ln${old.has(l) ? '' : ' dm-new'}">${highlight(l)}</span>`).join('\n');
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
  function openChat() { chatWrap.hidden = false; phone.classList.add('dm-chat-open'); paintChat(); const f = sugg.querySelector('button'); (f || input).focus(); }
  function closeChat() { chatWrap.hidden = true; phone.classList.remove('dm-chat-open'); fab.focus(); }
  // the newest change not yet undone carries the Undo button; after it is undone, the one
  // before it gets the button, so every change can be stepped back in turn
  function undoable() { for (let i = S.chat.length - 1; i >= 0; i--) { const m = S.chat[i]; if (m.change !== undefined && !m.undone) return i; } return -1; }
  function paintChat() {
    msgs.textContent = '';
    if (!S.chat.length) {
      const m = $('div', 'dm-msg dm-bot');
      m.innerHTML = `<p>This is <strong>${esc(appName(cur().app.source))}</strong>. Ask me to change it, or to make a new app. In this demo, pick one of the requests below.</p>`;
      msgs.append(m);
    }
    const u = undoable();
    S.chat.forEach((c, i) => {
      const m = $('div', 'dm-msg ' + (c.who === 'you' ? 'dm-you' : 'dm-bot'));
      m.innerHTML = c.html;
      if (c.undone) m.append(Object.assign($('p', 'dm-small'), { textContent: 'Undone' }));
      if (i === u) {
        const b = $('button', 'dm-btn dm-undo', { type: 'button' });
        b.innerHTML = icon('_undo') + '<span>Undo</span>';
        b.addEventListener('click', () => undo(i));
        m.append(b);
      }
      msgs.append(m);
    });
    sugg.textContent = '';
    const reqs = requestsFor(S.ex, cur().app.source, sources), apps = newAppsFor(S.ex);
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
  function say(who, html, change) { S.chat.push({ who, html, change }); }
  function runEdit(r) {
    const a = cur();
    const oldSrc = a.app.source, newSrc = r.apply(oldSrc);
    say('you', `<p>${esc(r.text)}</p>`);
    const before = new Map([...a.app.env.tables].map(([t, tb]) => [t, new Set(tb.fields.keys())]));
    const d = a.app.applyEdit(newSrc);       // the evaluator checks it against every earlier version
    if (d.verdict === 'refused') { say('bot', `<p>I could not make that change safely.</p><ul>${(d.refused || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`); paintChat(); return; }
    a.prev.push(oldSrc);
    S.history.push({ kind: 'edit', ex: S.ex });
    const data = storesNew(before, a.app);
    say('bot', `<p>${esc(r.says || 'Done.')}</p>${data ? '<p class="dm-small">Everything you saved is still here.</p>' : ''}`, S.history.length - 1);
    mountApp();
  }
  function runNewApp(a) {
    say('you', `<p>${esc(a.text)}</p>`);
    S.history.push({ kind: 'app', from: S.ex, ex: a.to });
    const c = CATALOG.find(x => x.id === a.to);
    const known = !!S.apps[a.to];
    open(a.to);
    say('bot', `<p>Here is ${known ? 'your' : 'a new app:'} <strong>${esc(appName(cur().app.source))}</strong>${known ? ', as you left it' : ''}. ${esc(c.about || '')}</p>${known ? '' : `<p class="dm-small">${esc(plainSummary(cur().app.source))} It opens with sample data so you can try it.</p>`}`, S.history.length - 1);
    paintChat();
  }
  // chat Undo: a change goes back to the previous PROGRAM (app.revert keeps every row and setting
  // entered since); a new-app request goes back to the app before it, which kept its own data
  function undo(i) {
    const m = S.chat[i];
    const hst = S.history[m.change];
    let msg;
    if (hst.kind === 'app') {
      S.ex = hst.from;
      msg = `Back to ${appName(S.apps[hst.from].app.source)}, as you left it. ${appName(S.apps[hst.ex].app.source)} keeps what you entered; ask for it again to open it.`;
      mountApp();
    } else {
      S.ex = hst.ex;
      const a = cur();
      const newer = new Map([...a.app.env.tables].map(([t, tb]) => [t, [...tb.fields.keys()]]));
      a.app.revert();
      a.prev.pop();
      const hidden = hiddenValues(a.app, newer);
      msg = 'The app is back to the earlier version. Everything you added since is still here.' +
        (hidden.length ? ` What you wrote in ${hidden.join(' and ')} is kept but hidden; it shows again if you ask for it back.` : '');
      mountApp();
    }
    m.undone = true;
    say('bot', `<p>${esc(msg)}</p>`);
    paintChat();
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = '';
    const all = [...requestsFor(S.ex, cur().app.source, sources), ...newAppsFor(S.ex)];
    const hit = all.find(r => r.text.toLowerCase() === t.toLowerCase());
    if (hit) return hit.to ? runNewApp(hit) : runEdit(hit);
    say('you', `<p>${esc(t)}</p>`);
    say('bot', '<p>The model that understands free text is not trained yet, so this demo only knows the requests listed below.</p>');
    paintChat();
  });
  fab.addEventListener('click', openChat);
  chatClose.addEventListener('click', closeChat);
  chatWrap.addEventListener('click', e => { if (e.target === chatWrap) closeChat(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !chatWrap.hidden) closeChat(); });

  frameBtn.addEventListener('click', () => { S.frame = S.frame === 'phone' ? 'full' : 'phone'; paintTools(); writeHash(); });
  modeBtn.addEventListener('click', () => {
    S.mode = S.mode === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', S.mode);
    S.renderer.setMode(S.mode); paintTools();
  });
  // the only way the demo puts sample data back: an explicit control, outside the phone
  reset.addEventListener('click', () => {
    S.apps[S.ex] = undefined;
    S.history.forEach((x, i) => { if (x.ex === S.ex || x.from === S.ex) S.chat.forEach(m => { if (m.change === i) m.undone = true; }); });
    open(S.ex);
    S.renderer.toast('Demo data put back for this app');
  });
  list.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) open(b.getAttribute('data-ex')); });
  addEventListener('hashchange', () => { const n = readHash(); if (n.ex && n.ex !== S.ex && CATALOG.some(c => c.id === n.ex)) open(n.ex); });
  paintTools();
  open(S.ex);
  S.showBlank = id => { S.ex = id; S.apps[id] = { app: load(sources[id], { now: NOW }), base: sources[id], prev: [] }; mountApp(); };   // tests: the app with no data
  S.mountSource = src => { S.apps[S.ex] = { app: load(src, { now: NOW }), base: src, prev: [] }; mountApp(); };   // tests: any program in place of the current one
  S.runEdit = runEdit; S.runNewApp = runNewApp; S.undoLatest = () => { const i = undoable(); if (i >= 0) undo(i); }; S.openChat = openChat;
  Object.defineProperty(S, 'app', { get: () => cur().app });
  window.__molde = S;   // for tests: the running apps, renderer and chat actions
  return S;
}

function appName(src) { const m = /^app "([^"]*)"/.exec(src); return m ? m[1] : 'this app'; }
// did the change add a table or a field (stored data), not only screen lines?
function storesNew(before, app) {
  for (const [t, tb] of app.env.tables) { const b = before.get(t); if (!b) return true; for (const f of tb.fields.keys()) if (!b.has(f)) return true; }
  return false;
}
// fields that hold values but the program now running does not show
function hiddenValues(app, newer) {
  const out = [];
  for (const [t, fields] of newer) {
    const tb = app.env.tables.get(t);
    for (const f of fields) {
      if (tb && tb.fields.has(f)) continue;
      const rows = app.data.tables[app.tk ? app.tk(t) : t] || [];
      if (rows.some(r => !r.deleted && r[f] !== null && r[f] !== undefined && r[f] !== '' && r[f] !== false)) out.push(tb ? `"${f.replace(/_/g, ' ')}"` : `the ${t.replace(/_/g, ' ')} list`);
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
