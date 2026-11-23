// Molde web renderer: draws a MoldeScript UI tree (lang/UITREE.md) into the DOM.
// It knows level-1 nodes only (layout, text, buttons, inputs, draw shapes, screens). Nothing
// app-specific lives here: a habit grid, a water glass or a chart reaches this file already
// expanded into boxes, rects and texts by the evaluator.
// No framework, no eval, no inline handlers: one delegated listener per event type.
import { ICONS } from './icons.mjs';

const SVGNS = 'http://www.w3.org/2000/svg';
const ROLES = new Set(['accent', 'ink', 'muted', 'soft', 'good', 'warn', 'bad', 'bg', 'surface', 'edge']);
const SCALE = [0, 8, 12, 16, 24, 32, 48];   // `gap N` / `pad N` in px
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const h = (tag, cls, attrs) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  return el;
};
const iconSvg = (name, label) => {
  const body = ICONS[name] || ICONS[String(name).replace(/^_/, '')] || '<circle cx="12" cy="12" r="4"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pt = n => (n / 16).toFixed(4) + 'rem';   // screen points follow the system text size
const sc = n => SCALE[Math.max(0, Math.min(6, Math.round(n)))] + 'px';
const fin = n => typeof n === 'number' && isFinite(n);
const pad2 = n => String(n).padStart(2, '0');

// colour value from the tree: a theme role, a named colour, "hue:N" or null.
// Named colours become hues (grey, black and white become neutral roles) so the theme keeps
// every text on them readable in light and dark mode.
const NAMED = { red: 'hue:4', orange: 'hue:24', yellow: 'hue:46', green: 'hue:140', teal: 'hue:176', blue: 'hue:214', purple: 'hue:270', pink: 'hue:330', grey: 'muted', gray: 'muted', black: 'ink', white: 'surface' };
function normColor(c) { return c && NAMED[c] ? NAMED[c] : c; }
function colorClass(c) {
  c = normColor(c);
  if (!c) return null;
  if (ROLES.has(c)) return c;
  if (/^hue:\d+(\.\d+)?$/.test(c)) return 'hue';
  return null;
}
function applyFill(el, c) {
  c = normColor(c);
  const k = colorClass(c);
  if (k === 'hue') { el.setAttribute('data-fill', 'hue'); el.style.setProperty('--hue', /\d+/.exec(c)[0]); }
  else if (k) el.setAttribute('data-fill', k);
  else el.removeAttribute('data-fill');
}

/**
 * mount(el, app, opts) -> controller
 *   app:  an evaluator App (load(source) from lang/eval.mjs): tree(), dispatch(id, ev, v), tick(ms), undo(), log
 *   opts: { mode: 'light'|'dark', tickMs: 1000, onAsk(answer), autoTick: true }
 */
export function mount(root, app, opts = {}) {
  const R = new Renderer(root, app, opts);
  R.render();
  return R;
}

class Renderer {
  constructor(root, app, opts) {
    this.root = root; this.app = app; this.opts = opts;
    this.logSeen = app.log ? app.log.length : 0;
    this.toasts = [];
    this.sheet = null;           // { kind: 'row'|'setting'|'settings', ... }
    this.undoArmed = null;       // undo stack depth right after a remove
    this.destroyed = false;
    this.build();
    this.bind();
    if (opts.autoTick !== false) this.startClock();
  }

  // ---------- shell ----------
  build() {
    const t = this.app.tree();
    this.root.textContent = '';
    const shell = h('div', 'mo-app');
    shell.setAttribute('data-theme', t.theme || 'mint');
    shell.setAttribute('data-mode', this.opts.mode || 'light');
    this.shell = shell;
    this.head = h('header', 'mo-head');
    this.scroller = h('main', 'mo-scrollarea');
    this.screenEl = h('div', 'mo-screen');
    this.scroller.append(this.screenEl);
    this.tabs = h('nav', 'mo-tabs', { 'aria-label': 'Screens' });
    this.toastEl = h('div', 'mo-toasts', { 'aria-live': 'polite' });
    this.sheetEl = null;
    shell.append(this.scroller, this.tabs, this.toastEl);
    // space the host keeps for its own controls (the demo's chat button): nothing of the app is under it
    if (this.opts.insetBottom) { const f = h('div', 'mo-inset', { 'aria-hidden': 'true' }); f.style.height = this.opts.insetBottom + 'px'; shell.insertBefore(f, this.toastEl); shell.style.setProperty('--inset', this.opts.insetBottom + 'px'); }
    this.scroller.prepend(this.head);
    this.root.append(shell);
  }
  setMode(mode) { this.opts.mode = mode; this.shell.setAttribute('data-mode', mode); }
  destroy() { this.destroyed = true; clearInterval(this.timer); if (this.ro) this.ro.disconnect(); this.root.textContent = ''; document.removeEventListener('visibilitychange', this.onVis); }

  startClock() {
    const ms = this.opts.tickMs || 1000;
    this.timer = setInterval(() => {
      if (document.hidden || this.destroyed) return;
      this.app.tick(ms);
      this.afterChange(false);
    }, ms);
  }

  // ---------- render ----------
  render() {
    const t = this.app.tree();
    this.lastTree = t;
    this.shell.setAttribute('data-theme', t.theme || 'mint');
    this.renderHead(t);
    if (this.app.prog && this.app.prog.header && this.app.prog.header.kind === 'ask') this.renderAsk(this.app.prog.header);
    else if (!this.app.ok && this.app.errors && this.app.errors.length) {
      this.screenEl.textContent = '';
      this.screenEl.append(Object.assign(h('p', 'mo-error'), { textContent: this.app.errors.join('\n') }));
    } else {
      let kids = this.screenChildren(t);
      // a first row made only of small controls (a month switcher, the app's one main button)
      // joins the app bar, to the right of the title
      const bar = (!t.screens || t.screens.length < 2) && kids.length > 1 && isToolbar(kids[0]) ? kids[0] : null;
      if (bar) kids = kids.slice(1);
      this.patchChildren(this.headTools, bar ? [bar] : [], {});
      this.head.classList.toggle('mo-head-tools', !!bar);
      // a screen that is one block (a board, one drawing) sits in the middle of the free height;
      // anything else starts at the top
      this.screenEl.classList.toggle('mo-single', kids.length === 1 && isBoard(kids[0]));
      this.patchChildren(this.screenEl, kids, { top: true });
    }
    this.renderTabs(t);
    this.renderSheet();
    this.shell.classList.toggle('mo-sheet-open', !!this.sheetEl);
    this.markScrolls();
  }
  // a sideways-scrolling row shows a fade on the side that has more
  markScrolls() {
    for (const el of this.shell.querySelectorAll('.mo-scroll')) {
      el.classList.toggle('mo-more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
      el.classList.toggle('mo-more-start', el.scrollLeft > 2);
    }
  }

  // children of the visible screen (lines outside screens are the first tab)
  screenChildren(t) {
    if (!t.screens || !t.screens.length) return t.children;
    if (t.screen === '_main') return t.children.filter(c => c.t !== 'screen');
    const s = t.children.find(c => c.t === 'screen');
    return s ? s.children : [];
  }

  // the runtime's own bar: the app's name and, when the program has settings, a settings button.
  // Everything below it is the program's (its first line decides how the screen opens).
  renderHead(t) {
    const key = `${t.name}|${this.hasSettings()}`;
    if (this.head._key === key) return;
    this.head._key = key;
    this.head.textContent = '';
    const title = h('h1', 'mo-title');
    title.textContent = t.name || 'App';
    this.headTools = h('div', 'mo-head-bar');
    this.head.append(title, this.headTools);
    if (this.hasSettings()) {
      const b = h('button', 'mo-iconbtn', { type: 'button', 'aria-label': 'Settings', 'data-ui': 'settings' });
      b.innerHTML = iconSvg('_settings');
      this.head.append(b);
    }
  }
  today() { return this.app.today ? this.app.today() : new Date().toISOString().slice(0, 10); }
  hasSettings() { return bridge.settingsList(this.app).length > 0; }

  renderTabs(t) {
    const has = t.screens && t.screens.length > 1;
    this.shell.classList.toggle('mo-has-tabs', !!has);
    this.tabs.hidden = !has;
    if (!has) return;
    const key = JSON.stringify([t.screens, t.screen]);
    if (this.tabs._key === key) return;
    this.tabs._key = key;
    this.tabs.textContent = '';
    this.tabs.setAttribute('role', 'tablist');
    for (const s of t.screens) {
      const b = h('button', 'mo-tab', { type: 'button', role: 'tab', 'aria-selected': String(s.name === t.screen), 'data-id': s.id, 'data-ev': 'tap' });
      b.innerHTML = iconSvg(s.icon || (s.name === '_main' ? (t.icon || 'home') : 'list'));
      b.append(Object.assign(h('span'), { textContent: s.name === '_main' ? 'Home' : (s.label || s.name) }));
      this.tabs.append(b);
    }
  }

  renderAsk(a) {
    if (this.screenEl._ask) return;
    this.screenEl._ask = true;
    this.screenEl.textContent = '';
    const box = h('div', 'mo-ask');
    const q = h('p', 'mo-text mo-head-t'); q.textContent = unq(a.question);
    box.append(q);
    for (const o of a.options || []) {
      const b = h('button', 'mo-btn', { type: 'button', 'data-ui': 'ask', 'data-answer': unq(o) });
      b.textContent = unq(o);
      box.append(b);
    }
    this.screenEl.append(box);
  }

  // keyed patch of a container's children
  patchChildren(parent, nodes, cx) {
    const old = new Map();
    for (const el of parent.children) if (el._key) old.set(el._key, el);
    let i = 0;
    const list = this.decorate(nodes, cx);
    for (const n of list) {
      const key = n.id + '|' + n.t;
      let el = old.get(key);
      if (el) { old.delete(key); el = this.update(el, n, cx); }
      else el = this.create(n, cx);
      el._key = key;
      const at = parent.children[i];
      if (at !== el) parent.insertBefore(el, at || null);
      i++;
    }
    for (const el of old.values()) el.remove();
  }

  // structural hints the CSS needs (generic layout rules, documented in README)
  decorate(nodes, cx) {
    return nodes;
  }

  create(n, cx) {
    const el = this.make(n, cx);
    this.fill(el, n, cx, true);
    return el;
  }
  update(el, n, cx) {
    if (el._t !== n.t || el._kind !== (n.kind || '')) { const fresh = this.create(n, cx); el.replaceWith(fresh); return fresh; }
    this.fill(el, n, cx, false);
    return el;
  }

  make(n) {
    let el;
    switch (n.t) {
      case 'stack': case 'row': case 'grid': case 'box': case 'scroll': case 'screen': el = h('div'); break;
      case 'text': el = h('p'); break;
      case 'button': el = h('button', null, { type: 'button' }); break;
      case 'icon': el = h('span'); break;
      case 'image': el = h('img', null, { alt: '' }); break;
      case 'space': el = h('div', 'mo-space', { 'aria-hidden': 'true' }); break;
      case 'divider': el = h('hr', 'mo-divider'); break;
      case 'input': el = this.makeInput(n); break;
      case 'form': el = h('div', 'mo-stack mo-form'); break;
      case 'choice': el = h('div', 'mo-chips', { role: 'radiogroup' }); break;
      case 'slider': el = h('div', 'mo-slider'); el.append(h('input', null, { type: 'range' }), h('output')); break;
      case 'toggle': el = h('button', 'mo-toggle', { type: 'button', role: 'checkbox' }); el.innerHTML = `<span class="mo-tick">${iconSvg('check')}</span>`; break;
      case 'draw': el = h('div', 'mo-draw'); break;
      case 'error': el = h('p', 'mo-error'); break;
      default: el = h('div'); el.hidden = true;
    }
    el._t = n.t; el._kind = n.kind || '';
    return el;
  }

  // set classes, styles, attributes and children; called on create and on every update
  fill(el, n, cx, fresh) {
    const st = n.style || {};
    const cls = [];
    const style = el.style;
    const sig = JSON.stringify(n.t === 'draw' ? n : { ...n, children: undefined, fields: n.t === 'form' ? n.fields : undefined });
    const same = el._sig === sig;
    el._sig = sig;
    el.setAttribute('data-id', n.id);
    if (n.t === 'draw') { if (!same) this.fillDraw(el, n); return; }
    if (same && !n.children) return;
    if (!same) {
      el.removeAttribute('style');
      switch (n.t) {
        case 'stack': case 'screen': cls.push('mo-stack'); break;
        case 'row': cls.push('mo-row'); break;
        case 'grid': {
          cls.push('mo-grid');
          const N = Math.max(1, n.cols || 2), g = SCALE[fin(st.gap) ? Math.max(0, Math.min(6, Math.round(st.gap))) : 1];
          // cells with words keep at least 4.5rem, so large system text drops a column instead of
          // breaking names letter by letter; cells without text (heat maps) keep N columns
          style.gridTemplateColumns = hasText(n)
            ? `repeat(auto-fill, minmax(max(4.5rem, calc((100% - ${(N - 1) * g}px) / ${N} - 0.5px)), 1fr))`
            : `repeat(${N}, minmax(0, 1fr))`;
          break;
        }
        case 'box': cls.push('mo-box'); break;
        case 'scroll': cls.push('mo-scroll'); break;
        case 'text': cls.push('mo-text'); break;
        case 'button': cls.push('mo-btn'); break;
        case 'icon': cls.push('mo-icon'); break;
        case 'image': cls.push('mo-image'); break;
        case 'form': cls.push('mo-stack', 'mo-form'); break;
        case 'error': cls.push('mo-error'); break;
        case 'space': cls.push('mo-space'); break;
        case 'divider': cls.push('mo-divider'); break;
        case 'choice': cls.push('mo-chips'); break;
        case 'slider': cls.push('mo-slider'); break;
        case 'toggle': cls.push('mo-toggle'); break;
        case 'input': cls.push('mo-field'); break;
      }
      // text roles
      if (st.role === 'big') cls.push('mo-big');
      if (st.role === 'head') cls.push('mo-head-t');
      if (st.role === 'faint') cls.push('mo-faint');
      if (st.size) cls.push('mo-size-' + st.size);
      if (st.bold) cls.push('mo-bold');
      if (st.card) cls.push('mo-card');
      if (st.grow) cls.push('mo-grow');
      if (st.align) {
        if (n.t !== 'row') cls.push('mo-align-' + st.align);   // in a row, align is the cross axis only
        const flex = { start: 'flex-start', center: 'center', end: 'flex-end' }[st.align];
        if (n.t === 'row') style.alignItems = flex;
        else if (n.t === 'stack' || n.t === 'box' || n.t === 'form') { style.alignItems = flex; }
      }
      if (fin(st.gap)) style.gap = sc(st.gap);
      if (fin(st.pad)) style.padding = sc(st.pad);
      if (fin(st.span)) style.gridColumn = `span ${Math.max(1, Math.round(st.span))}`;
      if (fin(st.width)) { style.width = pt(st.width); style.maxWidth = '100%'; style.flex = 'none'; }
      else if (n.t === 'box') style.alignSelf = 'stretch';   // a box with no width fills its column
      if (fin(st.height)) style.height = pt(st.height);
      if (fin(st.radius)) style.borderRadius = Math.max(0, st.radius) + 'px';
      if (n.t === 'text' && st.opacity === 0) cls.push('mo-sr');   // invisible text is read aloud only
      else if (fin(st.opacity)) style.opacity = String(Math.max(0, Math.min(1, st.opacity)));
      if (st.stroke && n.t !== 'text' && n.t !== 'button' && colorClass(st.stroke)) {   // an outline ring on a block
        const c = normColor(st.stroke);
        style.boxShadow = `inset 0 0 0 ${fin(st.thick) ? Math.max(1, Math.min(6, st.thick)) : 2}px ${colorClass(c) === 'hue' ? `hsl(${/\d+/.exec(c)[0]} var(--hue-s) var(--hue-l))` : `var(--${c === 'accent' ? 'accent-ink' : c})`}`;
      }
      if (st.fill) { applyFill(el, st.fill); if (n.t !== 'button') cls.push('mo-filled'); } else el.removeAttribute('data-fill');
      const cc = colorClass(st.color);
      if (cc === 'hue') { el.setAttribute('data-color', 'hue'); el.style.setProperty('--hue', /\d+/.exec(normColor(st.color))[0]); }
      else if (cc) el.setAttribute('data-color', cc); else el.removeAttribute('data-color');
      if (n.t === 'button' && (st.fill === 'accent' || n.primary)) cls.push('mo-primary');
      if (n.t === 'row' && n.children && !n.children.some(c => c.style && c.style.grow) && n.children.filter(c => c.t === 'stack').length >= 2) cls.push('mo-row-even');
      // a row whose children are all growing stacks (a week strip, a mood picker) is a strip:
      // its columns stay side by side at any text size
      if (n.t === 'row' && n.children && n.children.length >= 3 && n.children.every(c => c.t === 'stack' && c.style && c.style.grow)) cls.push('mo-strip');

      // events on blocks and texts
      const tappable = n.tap && n.t !== 'button' && n.t !== 'toggle';
      if (tappable) {
        cls.push('mo-tap');
        el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
      } else if (n.t !== 'button' && n.t !== 'toggle') { el.removeAttribute('role'); el.removeAttribute('tabindex'); }
      if (n.tap) el.setAttribute('data-ev', 'tap'); else if (n.t !== 'input' && n.t !== 'slider' && n.t !== 'choice') el.removeAttribute('data-ev');
      if (n.swipe) { cls.push('mo-swipe'); el.setAttribute('data-swipe', '1'); if (!n.tap) { el.setAttribute('tabindex', '0'); el.setAttribute('aria-keyshortcuts', 'Delete'); } }
      else el.removeAttribute('data-swipe');
      el.className = cls.join(' ');
    }

    switch (n.t) {
      case 'text': this.fillText(el, n); break;
      case 'button': {
        const tx = (n.text || '').trim();
        if (tx === '<' || tx === '>') {   // arrows written as < and > are drawn as chevrons
          el.innerHTML = iconSvg(tx === '<' ? '_left' : '_right');
          el.classList.add('mo-chev');
          el.setAttribute('aria-label', tx === '<' ? 'Previous' : 'Next');
        } else { el.textContent = typo(n.text || ''); el.removeAttribute('aria-label'); }
        break;
      }
      case 'icon': el.innerHTML = iconSvg(n.name, null); break;
      case 'image': if (typeof n.src === 'string' && /^data:image\//.test(n.src)) el.src = n.src; else el.removeAttribute('src'); break;
      case 'space': el.style.height = sc(fin(n.size) ? n.size : 2); break;
      case 'error': el.textContent = (n.line ? `Line ${n.line}: ` : '') + (n.text || 'error'); break;
      case 'toggle': el.setAttribute('aria-checked', String(!!n.on)); el.setAttribute('aria-label', n.label || this.nearLabel(n) || 'Done'); el.setAttribute('data-ev', 'tap'); break;
      case 'choice': this.fillChoice(el, n, n.label); break;
      case 'slider': this.fillSlider(el, n); break;
      case 'input': this.fillInput(el, n, cx); break;
      case 'form': this.patchChildren(el, (n.fields || []).map(f => ({ ...f, inForm: true })), cx); break;
    }
    if (n.children && n.t !== 'form') this.patchChildren(el, n.children, cx);
    if (n.t === 'grid') this.rove(el);
    if (n.tap && el.getAttribute('role') === 'button' && !el.hasAttribute('aria-label')) {
      const label = (el.textContent || '').trim();
      if (!label) el.setAttribute('aria-label', 'Open');
    }
  }

  // a grid with more than 12 tappable cells is one tab stop; arrow keys move between cells
  rove(el) {
    const cells = [...el.children].filter(c => c.getAttribute('role') === 'button');
    if (cells.length <= 12) { el.removeAttribute('data-rove'); return; }
    el.setAttribute('data-rove', '1');
    el.setAttribute('role', 'group');
    const cur = cells.find(c => c.getAttribute('tabindex') === '0' && c._roved) || cells[cells.length - 1];
    for (const c of cells) { c.setAttribute('tabindex', c === cur ? '0' : '-1'); c._roved = true; }
  }
  // accessible name for a tick box: the nearest text in the same row
  nearLabel(n) { return null; }

  fillText(el, n) {
    const text = typo(n.text ?? '');
    const big = n.style && (n.style.role === 'big' || n.style.size === 'huge');
    const m = big && /^(-?[\d][\d,.:]*)\s([A-Za-z%]{1,5})$/.exec(text);
    if (n.tap) {
      let b = el.firstElementChild;
      if (!b || b.tagName !== 'SPAN') { el.textContent = ''; b = h('span', 'mo-textbtn'); el.append(b); }
      b.innerHTML = esc(text).replace(/\d[\d,.:]*\d/g, x => `<span class="mo-num">${x}</span>`);
      el.classList.add('mo-tapped-text');
      return;
    }
    // numbers never break inside (1,480 stays whole); a unit after a big number is set smaller
    if (m) el.innerHTML = `<span class="mo-num">${esc(m[1])}</span> <span class="mo-unit">${esc(m[2])}</span>`;
    else if (/\d[\d,.:]*\d/.test(text)) el.innerHTML = esc(text).replace(/\d[\d,.:]*\d/g, x => `<span class="mo-num">${x}</span>`);
    else el.textContent = text;
  }

  // ---------- inputs ----------
  makeInput(n) {
    const wrap = h('div', 'mo-field');
    return wrap;
  }
  fillInput(wrap, n, cx) {
    const kind = n.kind;
    const key = kind + '|' + JSON.stringify(n.options || null) + '|' + JSON.stringify(n.labels || null);
    const id = 'f-' + n.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const optional = n.inForm && !n.required && kind !== 'bool';
    const base = n.unit && String(n.label).toLowerCase() === String(n.unit).toLowerCase() ? 'Amount' : cap(n.label || '');
    const labelText = base + (n.unit ? ` (${n.unit})` : kind === 'dur' ? ' (min)' : '');
    if (wrap._ikey !== key) {
      wrap._ikey = key;
      wrap.textContent = '';
      if (kind === 'bool') {
        wrap.className = 'mo-togglefield';
        const t = h('button', 'mo-toggle', { type: 'button', role: 'checkbox', id, 'data-id': n.id, 'data-ev': 'change-bool' });
        t.innerHTML = `<span class="mo-tick">${iconSvg('check')}</span>`;
        const l = h('label', 'mo-text', { for: id });
        wrap.append(t, l);
      } else if (kind === 'pick' || kind === 'ref') {
        const l = h('span', 'mo-label', { id: id + '-l' });
        const chips = h('div', 'mo-chips', { role: 'radiogroup', 'aria-labelledby': id + '-l' });
        wrap.append(l, chips);
      } else {
        const l = h('label', 'mo-label', { for: id });
        let inp;
        if (kind === 'long') inp = h('textarea', 'mo-input', { id, rows: '3' });
        else if (kind === 'image') inp = h('input', 'mo-input', { id, type: 'file', accept: 'image/*' });
        else {
          const type = { num: 'number', money: 'number', date: 'date', time: 'time', when: 'datetime-local', dur: 'number' }[kind] || 'text';
          inp = h('input', 'mo-input', { id, type, autocomplete: 'off' });
          if (type === 'number') { inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('step', 'any'); }
        }
        inp.setAttribute('data-id', n.id); inp.setAttribute('data-ev', kind === 'image' ? 'change-image' : 'change'); inp.setAttribute('data-kind', kind);
        if (kind === 'date' || kind === 'time' || kind === 'when') {
          // the value reads as "Thu 26 Nov" or "08:30"; the browser's picker opens on tap
          inp.className = 'mo-dt-native';
          const box = h('div', 'mo-input mo-dt', { 'data-ui': 'picker' });
          box.append(h('span', 'mo-dt-v', { 'aria-hidden': 'true' }), inp);
          wrap.append(l, box);
        } else wrap.append(l, inp);
      }
    }
    wrap.removeAttribute('data-id');
    if (kind === 'bool') {
      const t = wrap.firstElementChild;
      t.setAttribute('aria-checked', String(!!n.value));
      t.setAttribute('data-id', n.id);
      wrap.lastElementChild.textContent = labelText;
      return;
    }
    if (kind === 'pick' || kind === 'ref') {
      wrap.firstElementChild.innerHTML = esc(labelText) + (optional ? ' <span class="mo-opt">optional</span>' : '');
      this.fillChoice(wrap.lastElementChild, n, labelText);
      return;
    }
    const l = wrap.firstElementChild, inp = wrap.querySelector('[data-ev]');
    l.innerHTML = esc(labelText) + (optional ? ' <span class="mo-opt">optional</span>' : '');
    inp.setAttribute('data-id', n.id);
    if (fin(n.min)) inp.setAttribute('min', kind === 'dur' ? n.min / 60 : n.min); else inp.removeAttribute('min');
    if (fin(n.max)) inp.setAttribute('max', kind === 'dur' ? n.max / 60 : n.max); else inp.removeAttribute('max');
    if (n.required) inp.setAttribute('aria-required', 'true');
    if (kind === 'image') return;
    const shown = toInputValue(kind, n.value);
    if (document.activeElement !== inp && inp.value !== shown) inp.value = shown;
    const dv = wrap.querySelector('.mo-dt-v');
    if (dv) { const t = readableValue(kind, n.value); dv.textContent = t || (kind === 'time' ? 'Pick a time' : 'Pick a date'); dv.classList.toggle('mo-dt-empty', !t); }
  }

  fillChoice(el, n, label) {
    const opts = n.options || [];
    const labels = n.labels || opts.map(o => typeof o === 'boolean' ? (o ? 'Yes' : 'No') : String(o).replace(/_/g, ' '));
    const key = JSON.stringify([opts, labels]);
    if (el._ckey !== key) {
      el._ckey = key; el.textContent = '';
      opts.forEach((o, i) => {
        const b = h('button', 'mo-chip', { type: 'button', role: 'radio', 'data-id': n.id, 'data-ev': 'choose', 'data-i': String(i) });
        b.textContent = labels[i];
        el.append(b);
      });
    }
    if (label && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', label);
    el._opts = opts;
    [...el.children].forEach((b, i) => b.setAttribute('aria-checked', String(opts[i] === n.value)));
  }

  fillSlider(el, n) {
    const inp = el.firstElementChild, out = el.lastElementChild;
    inp.setAttribute('min', n.min); inp.setAttribute('max', n.max); inp.setAttribute('step', '1');
    inp.setAttribute('data-id', n.id); inp.setAttribute('data-ev', 'slide');
    inp.setAttribute('aria-label', n.label || 'Value');
    const v = fin(n.value) ? n.value : n.min;
    if (document.activeElement !== inp) inp.value = String(v);
    out.textContent = fmtNum(v);
  }

  // ---------- drawing ----------
  fillDraw(el, n) {
    const W = fin(n.w) && n.w > 0 ? n.w : 100, H = fin(n.h) && n.h > 0 ? n.h : 100;
    const st = n.style || {};
    el.removeAttribute('style');
    el.className = 'mo-draw' + (st.grow ? ' mo-grow' : '');
    const s = el.style;
    s.aspectRatio = `${W} / ${H}`;
    if (fin(st.width) && fin(st.height)) { s.width = pt(st.width); s.height = pt(st.height); s.aspectRatio = ''; }
    else if (fin(st.width)) { s.width = pt(st.width); s.maxWidth = '100%'; s.flex = 'none'; }
    else if (fin(st.height)) { s.width = pt(st.height * W / H); s.maxWidth = '100%'; s.flex = 'none'; }
    else {
      const cap = H > W ? 120 : 280;           // a tall canvas in a column (a bar) or a wide one (a chart)
      s.width = `min(100%, ${(cap * W / H / 16).toFixed(3)}rem)`;
    }
    if (fin(st.opacity)) s.opacity = String(st.opacity);
    if (n.tap) {
      el.classList.add('mo-tap'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('data-ev', 'tap');
      if (!n.children.some(c => c.t === 'circle' || c.t === 'arc')) el.classList.add('mo-draw-rect');
    } else { el.removeAttribute('role'); el.removeAttribute('tabindex'); el.removeAttribute('data-ev'); }
    if (n.swipe) el.setAttribute('data-swipe', '1');

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const labels = [];
    const shapes = [];
    for (const c of n.children || []) this.drawShape(svg, c, W, H, labels, shapes);
    el.textContent = '';
    el.append(svg);
    // labels are HTML so text keeps real sizes and contrast; colour follows the shape under it
    for (const l of labels) {
      const st2 = l.style || {};
      const d = h('span', 'mo-lbl');
      if (st2.role === 'big') d.classList.add('mo-big');
      if (st2.role === 'head') d.classList.add('mo-head-t');
      if (st2.role === 'faint') d.classList.add('mo-faint');
      if (st2.size) d.classList.add('mo-size-' + st2.size);
      if (st2.bold) d.classList.add('mo-bold');
      d.style.left = (100 * l.x / W) + '%';
      d.style.top = (100 * l.y / H) + '%';
      d.textContent = typo(l.text ?? '');
      const under = colorClass(st2.color) ? null : underFill(shapes, l.x, l.y);
      const lc = colorClass(st2.color);
      if (lc === 'hue') { d.setAttribute('data-color', 'hue'); d.style.setProperty('--hue', /\d+/.exec(normColor(st2.color))[0]); }
      else if (lc) d.setAttribute('data-color', lc);
      else if (under) d.setAttribute('data-on', under);
      if (l.tap) { d.setAttribute('data-id', l.id); d.setAttribute('data-ev', 'tap'); d.style.pointerEvents = 'auto'; d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); }
      el.append(d);
    }
    if (n.tap && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', labels.map(l => l.text).join(' ') || 'Tap');
  }

  drawShape(svg, c, W, H, labels, shapes) {
    const st = c.style || {};
    const mk = tag => document.createElementNS(SVGNS, tag);
    let el = null;
    const paint = (e, defFill, defStroke) => {
      const fill = st.fill !== undefined ? st.fill : (st.stroke ? null : defFill);
      const stroke = st.stroke !== undefined ? st.stroke : defStroke;
      setPaint(e, 'fill', fill); setPaint(e, 'stroke', stroke);
      e.setAttribute('stroke-width', fin(st.thick) ? st.thick : 1);
      if (fin(st.opacity)) e.setAttribute('opacity', st.opacity);
    };
    switch (c.t) {
      case 'rect': {
        if (![c.x, c.y, c.w, c.h].every(fin)) return;
        let { x, y, w, h: hh } = c;
        if (w < 0) { x += w; w = -w; } if (hh < 0) { y += hh; hh = -hh; }
        if (w === 0 || hh === 0) return;
        el = mk('rect');
        el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', w); el.setAttribute('height', hh);
        if (fin(st.radius)) { const r = Math.min(st.radius, w / 2, hh / 2); el.setAttribute('rx', r); el.setAttribute('ry', r); }
        paint(el, 'accent', null);
        shapes.push({ k: 'rect', x, y, w, h: hh, fill: st.fill !== undefined ? st.fill : (st.stroke ? null : 'accent') });
        break;
      }
      case 'circle': {
        if (![c.cx, c.cy, c.r].every(fin) || c.r <= 0) return;
        el = mk('circle');
        el.setAttribute('cx', c.cx); el.setAttribute('cy', c.cy); el.setAttribute('r', c.r);
        paint(el, 'accent', null);
        shapes.push({ k: 'circle', cx: c.cx, cy: c.cy, r: c.r, fill: st.fill !== undefined ? st.fill : (st.stroke ? null : 'accent') });
        break;
      }
      case 'arc': {
        if (![c.cx, c.cy, c.r, c.from, c.to].every(fin) || c.r <= 0) return;
        const span = c.to - c.from;
        if (span <= 0.01) return;
        const a1 = Math.min(c.to, c.from + 359.99);
        el = mk('path');
        if (st.fill && !st.stroke) {           // a pie wedge from the centre
          el.setAttribute('d', `M${c.cx} ${c.cy}L` + arcPath(c.cx, c.cy, c.r, c.from, a1).slice(1) + 'Z');
          paint(el, 'accent', null);
          shapes.push({ k: 'wedge', cx: c.cx, cy: c.cy, r: c.r, from: c.from, to: a1, fill: st.fill });
        } else {
          el.setAttribute('d', arcPath(c.cx, c.cy, c.r, c.from, a1));
          setPaint(el, 'fill', null);
          paint(el, null, 'accent');
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke-linecap', 'round');
        }
        break;
      }
      case 'line': {
        if (![c.x1, c.y1, c.x2, c.y2].every(fin)) return;
        el = mk('line');
        el.setAttribute('x1', c.x1); el.setAttribute('y1', c.y1); el.setAttribute('x2', c.x2); el.setAttribute('y2', c.y2);
        paint(el, null, 'muted');
        el.setAttribute('stroke-linecap', 'round');
        break;
      }
      case 'path': {
        const d = String(c.d || '');
        if (!/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-e]*$/.test(d)) return;
        el = mk('path');
        el.setAttribute('d', d);
        paint(el, st.stroke ? null : 'accent', null);
        el.setAttribute('stroke-linejoin', 'round');
        break;
      }
      case 'poly': {
        const pts = (c.points || []).filter(p => fin(p[0]) && fin(p[1]));
        if (pts.length < 2) return;
        el = mk('polyline');
        el.setAttribute('points', pts.map(p => `${round3(p[0])},${round3(p[1])}`).join(' '));
        setPaint(el, 'fill', st.fill || null);
        paint(el, null, 'accent');
        el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('stroke-linecap', 'round');
        break;
      }
      case 'label': labels.push(c); return;
      default: return;
    }
    if (c.tap && (c.t === 'line' || c.t === 'poly')) {
      const hit = el.cloneNode(false);
      hit.removeAttribute('class'); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke-width', String(24 * W / 360)); hit.setAttribute('pointer-events', 'stroke');
      hit.setAttribute('data-id', c.id); hit.setAttribute('data-ev', 'tap');
      svg.append(el, hit);
      return;
    }
    if (c.tap) {
      el.setAttribute('data-id', c.id); el.setAttribute('data-ev', 'tap');
      el.setAttribute('class', (el.getAttribute('class') || '') + ' mo-shape-tap');
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
    }
    // strokes stay the same width in screen pixels when a canvas is stretched unevenly
    el.setAttribute('vector-effect', 'none');
    svg.append(el);
  }

  // ---------- sheets (runtime editor for rows and settings) ----------
  renderSheet() {
    if (!this.sheet) { if (this.sheetEl) { this.sheetEl.remove(); this.sheetEl = null; } return; }
    const spec = this.sheetSpec(this.sheet);
    if (!spec) { this.sheet = null; return this.renderSheet(); }
    if (!this.sheetEl) {
      this.sheetEl = h('div', 'mo-sheet-wrap', { 'data-ui': 'scrim' });
      const s = h('section', 'mo-sheet', { role: 'dialog', 'aria-modal': 'true' });
      this.sheetEl.append(s);
      this.shell.append(this.sheetEl);
      this.sheetEl._new = true;
    }
    const s = this.sheetEl.firstElementChild;
    s.setAttribute('aria-label', spec.title);
    if (!s._head) {
      s._head = h('h2'); s.append(s._head);
      s._body = h('div', 'mo-stack'); s._body.style.gap = '16px'; s.append(s._body);
      s._acts = h('div', 'mo-sheet-actions'); s.append(s._acts);
    }
    s._head.textContent = spec.title;
    this.patchChildren(s._body, spec.fields, {});
    // the action buttons are made once and patched in place: a re-render caused by the blur of a
    // field must never replace the button the pointer or the keyboard is on
    if (!s._done) {
      s._remove = Object.assign(h('button', 'mo-btn mo-danger', { type: 'button', 'data-ui': 'sheet-remove' }), { textContent: 'Remove' });
      s._done = Object.assign(h('button', 'mo-btn mo-primary', { type: 'button', 'data-ui': 'sheet-done' }), { textContent: 'Done' });
      s._acts.append(s._remove, s._done);
    }
    s._remove.hidden = !spec.removable;
    if (this.sheetEl._new) { this.sheetEl._new = false; const f = s.querySelector('input, textarea, button'); if (f) f.focus(); }
  }
  sheetSpec(sh) { return bridge.sheetSpec(this.app, sh); }

  // ---------- toasts ----------
  toast(text, undo) {
    const t = h('div', 'mo-toast', { role: 'status' });
    t.append(Object.assign(h('span'), { textContent: text }));
    if (undo) t.append(Object.assign(h('button', 'mo-btn', { type: 'button', 'data-ui': 'undo' }), { textContent: 'Undo' }));
    this.toastEl.append(t);
    while (this.toastEl.children.length > 2) this.toastEl.firstElementChild.remove();
    setTimeout(() => t.remove(), undo ? 6000 : 3500);
    return t;
  }

  // ---------- events ----------
  bind() {
    const S = this.shell;
    this.suppressClick = false;
    S.addEventListener('click', e => {
      if (this.suppressClick) { this.suppressClick = false; e.preventDefault(); return; }
      const ui = e.target.closest('[data-ui]');
      if (ui && S.contains(ui)) return this.onUi(ui, e);
      const t = e.target.closest('[data-ev]');
      if (!t || !S.contains(t)) return;
      const ev = t.getAttribute('data-ev'), id = t.getAttribute('data-id');
      if (ev === 'tap') this.send(id, 'tap');
      else if (ev === 'choose') { const opts = t.parentElement._opts || []; this.send(id, 'change', opts[+t.getAttribute('data-i')]); }
      else if (ev === 'change-bool') this.send(id, 'change', t.getAttribute('aria-checked') !== 'true');
    });
    S.addEventListener('keydown', e => {
      const t = e.target;
      const g = t instanceof Element && t.parentElement && t.parentElement.getAttribute('data-rove') ? t.parentElement : null;
      if (g && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        const cells = [...g.children].filter(c => c.getAttribute('role') === 'button');
        const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length || 1;
        let i = cells.indexOf(t);
        i = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' ? i - cols : e.key === 'ArrowDown' ? i + cols : e.key === 'Home' ? 0 : cells.length - 1;
        if (i >= 0 && i < cells.length) { e.preventDefault(); for (const c of cells) c.setAttribute('tabindex', '-1'); cells[i].setAttribute('tabindex', '0'); cells[i].focus(); }
        return;
      }
      if (e.key === 'Escape' && this.sheet) { this.closeSheet(); return; }
      if (!(t instanceof Element) || !t.hasAttribute('data-id')) return;
      if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') { e.preventDefault(); t.click(); }
      if ((e.key === 'Enter' || e.key === ' ') && t.classList.contains('mo-dt-native')) { e.preventDefault(); try { t.showPicker(); } catch { /* no picker */ } }
      if ((e.key === 'Delete' || e.key === 'Backspace') && t.hasAttribute('data-swipe')) { e.preventDefault(); this.send(t.getAttribute('data-id'), 'swipe'); }
    });
    const onInput = e => {
      const t = e.target;
      if (!t.hasAttribute || !t.hasAttribute('data-ev')) return;
      const ev = t.getAttribute('data-ev'), id = t.getAttribute('data-id');
      if (ev === 'slide') { t.nextElementSibling.textContent = fmtNum(+t.value); this.send(id, 'change', +t.value); }
      else if (ev === 'change') {
        const kind = t.getAttribute('data-kind');
        const v = fromInputValue(kind, t.value);
        const live = kind === 'text' || kind === 'long' || kind === 'num' || kind === 'money' || kind === 'dur';
        if (e.type === 'input' && !live) return;
        clearTimeout(t._deb);
        t._sent = t.value;
        if (e.type === 'input') t._deb = setTimeout(() => { t._deb = null; this.send(id, 'change', v, true); }, 120);
        else { t._deb = null; this.send(id, 'change', v, true); }
      } else if (ev === 'change-image' && e.type === 'change' && t.files && t.files[0]) {
        const r = new FileReader();
        r.onload = () => this.send(id, 'change', r.result);
        r.readAsDataURL(t.files[0]);
      }
    };
    S.addEventListener('input', onInput);
    S.addEventListener('change', onInput);
    this.bindSwipe(S);
    S.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('mo-scroll')) this.markScrolls(); }, true);
    if (typeof ResizeObserver === 'function') { this.ro = new ResizeObserver(() => this.markScrolls()); this.ro.observe(S); }
    this.onVis = () => {};
  }

  bindSwipe(S) {
    let st = null;
    S.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-swipe]');
      if (!t || e.button !== 0 || e.target.closest('input, textarea, .mo-toggle, .mo-btn')) return;
      st = { t, x: e.clientX, y: e.clientY, dx: 0, on: false };
    });
    S.addEventListener('pointermove', e => {
      if (!st) return;
      st.dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      if (!st.on && Math.abs(st.dx) > 12 && Math.abs(st.dx) > Math.abs(dy) * 1.5) { st.on = true; st.t.classList.add('mo-swiping'); }
      if (st.on) { st.t.style.transform = `translateX(${st.dx}px)`; st.t.style.opacity = String(Math.max(.3, 1 - Math.abs(st.dx) / 300)); }
    });
    const end = () => {
      if (!st) return;
      const { t, dx, on } = st; st = null;
      t.classList.remove('mo-swiping'); t.style.transform = ''; t.style.opacity = '';
      if (on) { this.suppressClick = true; setTimeout(() => { this.suppressClick = false; }, 0); }
      if (on && Math.abs(dx) > 88) this.send(t.getAttribute('data-id'), 'swipe');
    };
    S.addEventListener('pointerup', end);
    S.addEventListener('pointercancel', end);
  }

  onUi(el, e) {
    const k = el.getAttribute('data-ui');
    if (k === 'settings') { this.sheet = { kind: 'settings' }; this.sheetReturn = el; this.render(); }
    else if (k === 'picker') { const i = el.querySelector('input'); if (i && e.target !== i) { try { i.showPicker(); } catch { i.focus(); } } }
    else if (k === 'scrim') { if (e.target === el) this.closeSheet(); }
    else if (k === 'sheet-done') this.closeSheet();
    else if (k === 'sheet-remove') { const sh = this.sheet; this.closeSheet(); bridge.removeRow(this.app, sh); this.afterChange(true); }
    else if (k === 'undo') {
      el.closest('.mo-toast')?.remove();
      if (this.app.undo && this.app.undo()) { this.toast('Restored'); this.afterChange(false); }
    } else if (k === 'ask') { if (this.opts.onAsk) this.opts.onAsk(el.getAttribute('data-answer')); }
  }
  closeSheet() {
    // send a value still waiting in a field's debounce before the sheet goes
    const a = document.activeElement;
    if (a && this.sheetEl && this.sheetEl.contains(a) && a._deb) { clearTimeout(a._deb); a._deb = null; a.dispatchEvent(new Event('change', { bubbles: true })); }
    this.sheet = null;
    this.render();
    const back = this.sheetReturn && this.sheetReturn.isConnected ? this.sheetReturn : null;
    this.sheetReturn = null;
    if (back) back.focus();
  }

  send(id, ev, payload, quiet) {
    if (!id) return;
    // the toast's Undo restores the last step only; once anything else happens it is gone
    for (const t of this.toastEl.querySelectorAll('.mo-toast')) if (t.querySelector('[data-ui="undo"]')) t.remove();
    if (id.startsWith('sheet:')) { bridge.sheetChange(this.app, this.sheet, id, payload); this.afterChange(false); return; }
    const ok = this.app.dispatch(id, ev, payload);
    if (ok === false) return;
    this.afterChange(!quiet, id);
  }

  // read new log entries (notify, removed, edit, error) and draw again
  afterChange(user, srcId) {
    const log = this.app.log || [];
    for (; this.logSeen < log.length; this.logSeen++) {
      const l = log[this.logSeen];
      if (l.kind === 'notify') this.toast(l.text);
      else if (l.kind === 'removed') this.toast(bridge.removedText(this.app, l), true);
      else if (l.kind === 'edit') { this.sheet = { kind: typeof l.target === 'string' ? 'setting' : 'row', target: l.target }; this.sheetReturn = document.activeElement; }
      else if (l.kind === 'error' && user) this.toast(friendlyError(l.text));
      else if (l.kind === 'remind') this.toast('Reminder set: ' + l.text);
    }
    this.render();
  }
}

// ---------- helpers ----------
// a first row of compact controls only: buttons, short texts, icons, empty boxes, tick boxes
// one block that is a board or a drawing: a draw or a grid, or a plain (not card) stack around one
function isBoard(n) {
  if (n.t === 'draw' || n.t === 'grid') return true;
  return n.t === 'stack' && !(n.style && n.style.card) && (n.children || []).some(c => c.t === 'draw' || c.t === 'grid');
}
function isToolbar(n) {
  if (!n || n.t !== 'row' || (n.style && n.style.card) || !n.children || !n.children.length || n.children.length > 4) return false;
  return n.children.every(c => c.t === 'button' || c.t === 'icon' || c.t === 'toggle' || (c.t === 'text' && (c.text || '').length <= 24) || (c.t === 'box' && !(c.children || []).length));
}
// the runtime's number typography (SPEC 12: numbers in the user's locale): thousands separators
// for 4-digit numbers too (the evaluator groups from 10,000), but never in a year after a month
// name, a time or a date; a short word before a number and a short unit after it do not wrap away
const MONTHW = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const YEAR_AFTER_MONTH = new RegExp(`(${MONTHW}) $`);
function typo(t) {
  t = String(t).replace(/(^|[^\d.,:\/\-])(\d)(\d{3})(?=(\.\d+)?(?![\d:,\-\/]))/g, (all, pre, a, b, dec, off, str) => {
    const before = str.slice(0, off + pre.length);
    if (YEAR_AFTER_MONTH.test(before) || /\d{4}$/.test(before)) return all;
    return `${pre}${a},${b}`;
  });
  return t.replace(/\b([A-Za-z]{1,3}) (?=[\d–-])/g, '$1\u00a0').replace(/(\d) ([A-Za-z%]{1,3})\b/g, '$1\u00a0$2');
}
function hasText(n) { return (n.children || []).some(c => ((c.t === 'text' || c.t === 'button') && /[A-Za-z]{4}/.test(c.text || '')) || hasText(c)); }
function unq(s) { return typeof s === 'string' ? s.replace(/^"|"$/g, '') : String(s); }
function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
function round3(n) { return Math.round(n * 1000) / 1000; }
function fmtNum(n) { return fin(n) ? (Math.round(n * 100) / 100).toLocaleString('en-US') : ''; }
function friendlyError(t) {
  const m = /needs (.+)$/.exec(t || '');
  return m ? `Fill in ${m[1].replace(/_/g, ' ')} first` : (t || 'Something went wrong');
}
function setPaint(e, prop, c) {
  c = normColor(c);
  if (c === null || c === undefined) { e.setAttribute(prop, 'none'); return; }
  const k = colorClass(c);
  if (k === 'hue') { e.setAttribute(prop, `var(--hue-${prop === 'fill' ? 'f' : 's'})`); e.style.setProperty('--hue', /\d+/.exec(c)[0]); e.classList.add('hue-' + prop); e.setAttribute(prop, ''); e.removeAttribute(prop); return; }
  if (!k) { e.setAttribute(prop, 'none'); return; }
  e.classList.add((prop === 'fill' ? 'f-' : 's-') + k);
}
function arcPath(cx, cy, r, a0, a1) {
  const p = a => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${round3(x0)} ${round3(y0)}A${r} ${r} 0 ${large} 1 ${round3(x1)} ${round3(y1)}`;
}
// the fill role of the top-most shape that covers a point (for label text colour)
function underFill(shapes, x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    let inside = s.k === 'rect' ? x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h : (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    if (inside && s.k === 'wedge') { const a = ((Math.atan2(x - s.cx, s.cy - y) * 180 / Math.PI) + 360) % 360; inside = a >= s.from % 360 && a <= s.to; }
    if (inside) return s.fill && colorClass(s.fill) ? normColor(s.fill) : null;
  }
  return null;
}
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function readableValue(kind, v) {
  if (v === null || v === undefined || v === '') return '';
  const day = ms => { const d = new Date(ms); return `${WD[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MON3[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  if (kind === 'date') { const ms = Date.parse(String(v).slice(0, 10) + 'T00:00:00Z'); return isFinite(ms) ? day(ms) : ''; }
  if (kind === 'when') { if (typeof v !== 'number') return ''; const d = new Date(v); return `${day(v)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; }
  if (kind === 'time') return toInputValue('time', v);
  return '';
}
function toInputValue(kind, v) {
  if (v === null || v === undefined) return '';
  switch (kind) {
    case 'time': return typeof v === 'number' ? `${pad2(Math.floor(v / 3600) % 24)}:${pad2(Math.floor(v % 3600 / 60))}` : String(v);
    case 'when': return typeof v === 'number' ? new Date(v).toISOString().slice(0, 16) : String(v);
    case 'dur': return typeof v === 'number' ? String(Math.round(v / 6) / 10) : String(v);
    case 'date': return String(v).slice(0, 10);
    default: return String(v);
  }
}
function fromInputValue(kind, s) {
  if (s === '' || s === null || s === undefined) return null;
  switch (kind) {
    case 'num': case 'money': { const n = Number(s); return isFinite(n) ? n : null; }
    case 'dur': { const n = Number(s); return isFinite(n) ? Math.round(n * 60) : null; }
    case 'when': { const t = Date.parse(s + ':00Z'); return isFinite(t) ? t : null; }
    case 'time': return s;
    default: return s;
  }
}

// ---------- bridge: the few things the UI tree does not carry yet ----------
// The runtime gives every app an editor sheet for rows and settings (SPEC section 12). The
// evaluator logs `edit` with a target but has no public "describe this row's fields" call, so
// these functions read the program's declarations from the App object. See README, contract gaps.
export const bridge = {
  // storage slots (lang/SEMANTICS.md "Storage and edits"): program names map to slot ids
  T(app, t) { return app.tk ? app.tk(t) : t; },
  F(app, t, f) { return app.fk ? app.fk(t, f) : f; },
  S(app, n) { return app.sk ? app.sk(n) : n; },
  rowOf(app, table, id) { return (app.data.tables[this.T(app, table)] || []).find(r => r.id === id); },
  settingsList(app) {
    return (app.prog && app.prog.body || []).filter(s => s.kind === 'setting');
  },
  sheetSpec(app, sh) {
    if (sh.kind === 'settings' || sh.kind === 'setting') {
      const list = this.settingsList(app).filter(s => sh.kind === 'settings' || s.name === sh.target);
      if (!list.length) return null;
      return {
        title: sh.kind === 'settings' ? 'Settings' : cap(unq(list[0].label || list[0].name).replace(/_/g, ' ')),
        fields: list.map(s => ({ id: 'sheet:set:' + s.name, t: 'input', kind: s.type.t, label: unq(s.label || s.name).replace(/_/g, ' '), value: app.data.settings[this.S(app, s.name)], options: s.type.options, ...(s.range ? { min: s.range.lo, max: s.range.hi ?? undefined } : {}) })),
      };
    }
    if (sh.kind === 'row') {
      const { table, id } = sh.target || {};
      const tb = app.env && app.env.tables && app.env.tables.get(table);
      const row = this.rowOf(app, table, id);
      if (!tb || !row || row.deleted) return null;
      const fields = [];
      for (const [name, f] of tb.fields) {
        const o = { id: `sheet:row:${table}:${id}:${name}`, t: 'input', kind: f.type.t, label: unq(f.label || name).replace(/_/g, ' '), value: row[this.F(app, table, name)], unit: f.unit ? unq(f.unit) : undefined };
        if (f.type.t === 'pick') o.options = f.type.options;
        if (f.type.t === 'ref') { const rs = app.rows(f.type.table); o.options = rs.map(r => r.id); o.labels = rs.map(r => app.summary({ table: f.type.table, r })); }
        if (f.range) { o.min = f.range.lo; if (f.range.hi !== null) o.max = f.range.hi; }
        fields.push(o);
      }
      fields.push({ id: `sheet:row:${table}:${id}:at`, t: 'input', kind: 'when', label: 'When', value: row.at });
      return { title: 'Edit ' + (unq(tb.label || '') || table.replace(/_/g, ' ')), fields, removable: true };
    }
    return null;
  },
  sheetChange(app, sh, id, v) {
    const p = id.split(':');
    if (p[1] === 'set') {
      const s = this.settingsList(app).find(x => x.name === p[2]);
      if (!s) return;
      app.pushUndo();
      let val = coerce(s.type, v);
      if (s.range && typeof val === 'number') { if (val < s.range.lo) val = s.range.lo; if (s.range.hi !== null && val > s.range.hi) val = s.range.hi; }
      app.data.settings[this.S(app, s.name)] = val;
      app.runWhen && app.runWhen();
    } else if (p[1] === 'row') {
      const [, , table, rid, field] = p;
      const row = this.rowOf(app, table, +rid);
      if (!row) return;
      const f = field === 'at' ? { type: { t: 'when' } } : app.env.tables.get(table).fields.get(field);
      let val = coerce(f.type, v);
      if (val === null && field === 'at') return;
      if (f.range && typeof val === 'number') { if (val < f.range.lo) val = f.range.lo; if (f.range.hi !== null && val > f.range.hi) val = f.range.hi; }
      app.pushUndo();
      row[field === 'at' ? 'at' : this.F(app, table, field)] = val;
      app.runWhen && app.runWhen();
    }
  },
  removeRow(app, sh) {
    if (!sh || sh.kind !== 'row') return;
    const { table, id } = sh.target;
    const row = this.rowOf(app, table, id);
    if (!row) return;
    app.pushUndo();
    row.deleted = true;
    app.log.push({ kind: 'removed', table, id, at: app.clock });
  },
  // "Removed Petrol, Rs 5,740": the row's words first, then its amounts, in the runtime's formats
  removedText(app, l) {
    const tb = app.env && app.env.tables && app.env.tables.get(l.table);
    const row = this.rowOf(app, l.table, l.id);
    if (!tb || !row) return 'Removed';
    const words = [], amounts = [];
    for (const [name, f] of tb.fields) {
      const v = row[this.F(app, l.table, name)];
      if (v === null || v === undefined || v === '' || v === false) continue;
      const t = f.type.t;
      if (t === 'text' || t === 'long') words.push(String(v).length > 40 ? String(v).slice(0, 38) + '…' : String(v));
      else if (t === 'pick') words.push(String(v).replace(/_/g, ' '));
      else if (t === 'money') amounts.push(money(v));
      else if (t === 'num') amounts.push(group(v) + (f.unit ? ' ' + unq(f.unit) : ''));
      else if (t === 'ref') { const r = app.rows(f.type.table).find(x => x.id === v); if (r) { try { words.push(app.summary({ table: f.type.table, r }).split(' · ')[0]); } catch { /* skip */ } } }
    }
    const parts = [...words.slice(0, 2), ...amounts.slice(0, 2)];
    return 'Removed ' + (parts.length ? parts.join(', ') : (unq(tb.label || '') || l.table.replace(/_/g, ' ')));
  },
};
// the runtime's number and money formats (SPEC section 12: the runtime formats numbers and
// money in the user's locale; the demo locale is English, Pakistan)
export function group(n) { return typeof n === 'number' && isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(n); }
export function money(n) { return 'Rs\u00a0' + group(n); }
function coerce(type, v) {
  if (v === null || v === undefined || v === '') return type.t === 'bool' ? false : null;
  switch (type.t) {
    case 'num': case 'money': case 'dur': { const n = Number(v); return isFinite(n) ? n : null; }
    case 'bool': return !!v;
    case 'time': return typeof v === 'number' ? v : /^\d{1,2}:\d{2}$/.test(v) ? (+v.split(':')[0]) * 3600 + (+v.split(':')[1]) * 60 : null;
    case 'when': return typeof v === 'number' ? v : Date.parse(v);
    case 'ref': return Number(v);
    default: return String(v);
  }
}
