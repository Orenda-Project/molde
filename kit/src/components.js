/* Molde kit: a small standard library. Four generic components (m-stat, m-chart bar|line|pie, m-list, m-form) plus boot and the toast host.
 * App-specific visuals are NOT here: the model writes them in app.html with Alpine, the SDK and the generic classes in kit.css.
 * Attributes are the API. A `:name="expr"` attribute is evaluated in the page's Alpine scope and re-evaluated when its
 * data changes; plain `name="text"` is a string. Rendering is plain DOM (textContent only, no innerHTML of data).
 * Only store, ui and app go on window (the 16 calls). Kit-only helpers stay in sdk.internal; window.moldeHost is read once
 * at boot and deleted, so page code cannot reach the adapter or the bridge. */
(function () {
  'use strict';
  var A = window.Alpine, S = window.MoldeSDK;
  var host = window.moldeHost || {};
  try { delete window.moldeHost; } catch (e) { window.moldeHost = undefined; }
  var manifest = host.manifest;
  if (!manifest) { var mEl = document.getElementById('molde-manifest'); manifest = mEl ? JSON.parse(mEl.textContent) : { tables: {} }; }
  var seed = host.seed;
  if (!seed) { var sEl = document.getElementById('molde-seed'); seed = sEl ? JSON.parse(sEl.textContent) : null; }
  var sdk = S.createSDK({ adapter: host.adapter || S.memoryAdapter(seed), manifest: manifest, reactive: A.reactive, locale: host.locale, host: host.bridge });
  var I = sdk.internal, ui = sdk.ui, app = sdk.app;
  window.store = sdk.store; window.ui = ui; window.app = app;
  var locale = I.locale;
  var MAXN = 1e12, hasOwn = Object.prototype.hasOwnProperty;
  var nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  var nfc = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  function san(v) { v = Number(v); if (v !== v) return 0; return Math.max(-MAXN, Math.min(MAXN, v)); }
  function num(n) { n = san(n); return Math.abs(n) >= 1e9 ? nfc.format(n) : nf.format(n); }
  function sgn(n) { return n < 0 ? '−' + num(-n) : num(n); }
  var meta = function (t) { return t[S.META](); };
  var scale = function () { return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16; };

  /* ---- tiny DOM helper ---- */
  function setStyle(e, v) { for (var k in v) { if (k.charAt(0) === '-') e.style.setProperty(k, v[k]); else e.style[k] = v[k]; } }
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else if (k === 'style') setStyle(e, v); else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  var bdi = function (text, cls) { return h('bdi', { class: cls, text: text }); }; /* numbers and units keep their order under dir=rtl */
  var SVG = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) { if (k === 'style') setStyle(e, attrs[k]); else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var ICON = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>', trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    
  };
  function icon(name) {
    var e = s('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    e.innerHTML = ICON[name];
    return e;
  }
  /* human() is for COLUMN NAMES and schema option ids only. User text (titles, group keys, chart keys) is never rewritten. */
  var human = function (c) { c = String(c).replace(/_/g, ' '); return c.charAt(0).toUpperCase() + c.slice(1); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var ymd = S.ymd;
  var dk = function (ts) { return ymd(new Date(ts)); };
  function keepFocus(el, fn) {
    var a = document.activeElement, path = null;
    if (a && a !== el && el.contains(a)) { path = []; for (var n = a; n !== el; n = n.parentNode) path.unshift(Array.prototype.indexOf.call(n.parentNode.children, n)); }
    fn();
    if (path) { var q = el; for (var i = 0; i < path.length && q; i++) q = q.children[path[i]]; if (q && q !== document.activeElement && q.focus) q.focus({ preventScroll: true }); }
  }
  function tpl(spec, row, defs) {
    return bdi(String(spec).replace(/\{(\w+)\}/g, function (m, c) { return hasOwn.call(defs, c) && defs[c] === 'num' ? num(row[c]) : String(row[c] == null ? '' : row[c]); }));
  }
  /* ---- m-stat: flat lead number. label :value :of unit ---- */
  function mStat(el, p) {
    var v = san(p.value), of = p.of != null && p.of !== '' ? san(p.of) : 0, u = p.unit || '';
    var pct = of > 0 ? Math.max(0, Math.min(100, Math.round(v / of * 100))) : 0;
    var tail = of > 0 ? '/ ' + num(of) + (u ? ' ' + u : '') : u;
    var kids = [h('small', { class: 'muted', text: p.label || '' }), h('div', { class: 'm-num' }, bdi(num(v), 'stat'), tail ? bdi(tail, 'muted') : null)];
    if (of > 0) {
      kids.push(h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': of, 'aria-valuenow': Math.min(v, of), 'aria-label': p.label || 'Progress' }, h('i', { style: { width: pct + '%' } })));
      kids.push(h('small', { class: v >= of ? 'ok' : 'muted' }, v >= of ? 'Goal reached' : bdi(pct + '% of goal')));
    }
    el.replaceChildren(h.apply(null, ['div', { class: 'm-stat' }].concat(kids)));
  }

  /* ---- m-chart: type bar (default) | line | pie. :data=[{k,v}] (a series or group result) ---- */
  function wlabel(d, n, by) { return new Intl.DateTimeFormat(locale, by === 'week' || n > 14 ? { day: 'numeric', month: 'short' } : { weekday: n > 8 || /^(ur|ar|fa|ps|sd)/.test(locale) ? 'narrow' : 'short' }).format(d); }
  function label(k, by, n) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return wlabel(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8), 12), n, by);
    if (/^\d{4}-\d{2}$/.test(k)) return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(+k.slice(0, 4), +k.slice(5) - 1, 1, 12));
    return String(k);
  }
  function clean(raw) { return arr(raw).slice(0, 366).map(function (d) { return { k: d && d.k != null ? String(d.k) : '', v: san(d && d.v) }; }); }
  function percents(vals, total) {
    var raw = vals.map(function (v) { return v / total * 100; }), fl = raw.map(Math.floor), left = 100 - fl.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - fl[i], i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, left).forEach(function (x) { fl[x[1]]++; });
    return fl;
  }
  function slices(data, keep, useAbs) {
    var pos = data.filter(function (d) { return useAbs ? d.v !== 0 : d.v > 0; }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
    if (pos.length > keep) { var rest = pos.slice(keep - 1).reduce(function (a, d) { return a + d.v; }, 0); pos = pos.slice(0, keep - 1).concat([{ k: 'Other', v: rest, other: true }]); }
    return pos;
  }
  function mChart(el, p) {
    var type = p.type || 'bar';
    var data = clean(p.data);
    var w = Math.max(160, Math.floor(el.clientWidth || 340));
    var by = data.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(data[0].k) && (new Date(data[1].k) - new Date(data[0].k)) > 864e5 * 2 ? 'week' : 'day';
    var kids = [];
    if (p.label) kids.push(h('small', { class: 'muted', text: p.label }));
    var empty = h('div', { class: 'empty', text: 'No data yet' });
    var root = function () { el.replaceChildren(h.apply(null, ['div', { class: 'm-chart' }].concat(kids))); };
    if (type === 'pie') {
      var sl = slices(data, 5, false), total = sl.reduce(function (a, d) { return a + d.v; }, 0);
      if (!sl.length) { kids.push(empty); return root(); }
      var pc = percents(sl.map(function (d) { return d.v; }), total);
      var cls = function (d, i) { return 'm-c' + (d.other ? 0 : (i % 5) + 1); };
      var nm = function (d) { return d.other ? 'Other' : label(d.k, by, 9); };
      var r = 50, C = 2 * Math.PI * r, off = 0, legend = h('ul', { class: 'm-legend' });
      var svg = s('svg', { viewBox: '0 0 128 128', class: 'm-pie', role: 'img', 'aria-label': sl.map(function (d, i) { return nm(d) + ' ' + pc[i] + '%'; }).join(', ') });
      svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring' }));
      sl.forEach(function (d, i) {
        var frac = d.v / total;
        svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring ' + cls(d, i), 'stroke-dasharray': Math.max(0.5, frac * C - 2) + ' ' + C, 'stroke-dashoffset': -off * C, transform: 'rotate(-90 64 64)' }));
        off += frac;
        legend.appendChild(h('li', { class: cls(d, i) }, h('span', { class: 'm-sw' }), h('span', { class: 'm-n', dir: 'auto', text: nm(d) }), bdi(num(d.v) + ' · ' + pc[i] + '%', 'm-v muted')));
      });
      kids.push(h('div', { class: 'm-pierow' }, svg, legend)); return root();
    }
    var fs = 14 * scale(), H = Math.round(112 + fs), top = 20, bot = Math.round(fs + 10), n = data.length;
    if (!n) { kids.push(empty); return root(); }
    var vals = data.map(function (d) { return d.v; });
    var mn = Math.min.apply(null, vals.concat([0])), mxv = Math.max.apply(null, vals.concat([0]));
    if (mxv === mn) mxv = mn + 1;
    var sc = (H - top - bot) / (mxv - mn), zero = top + mxv * sc;
    var gap = n > 24 ? 2 : 8; if (w / n < gap + 1.5) gap = 0; var bw = Math.max(0.3, Math.min(28, (w - gap * (n - 1)) / n)), x0 = Math.max(0, (w - (bw * n + gap * (n - 1))) / 2);
    var hiIdx = 0; vals.forEach(function (v, i) { if (Math.abs(v) > Math.abs(vals[hiIdx])) hiIdx = i; });
    var loIdx = -1; if (mn < 0) vals.forEach(function (v, i) { if (v === mn && loIdx < 0) loIdx = i; });
    var labs = data.map(function (d) { return label(d.k, by, n); }), maxLen = Math.max.apply(null, labs.map(function (x) { return x.length; }));
    var step = Math.max(1, Math.ceil((maxLen * 0.62 * fs + 8) / Math.max(0.3, bw + gap)));
    var summary = n > 14 ? n + ' values, largest ' + sgn(vals[hiIdx]) + ', latest ' + sgn(vals[n - 1]) : data.map(function (d, i) { return labs[i] + ' ' + sgn(d.v); }).join(', ');
    var sv = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': summary });
    sv.appendChild(s('line', { x1: 0, x2: w, y1: zero + .5, y2: zero + .5, class: 'm-base' }));
    var pts = [];
    data.forEach(function (d, i) {
      var x = x0 + i * (bw + gap), cx = x + bw / 2, bh = Math.max(d.v !== 0 ? 3 : 2, Math.abs(d.v) * sc), y = d.v >= 0 ? zero - bh : zero;
      if (type === 'line') pts.push([cx, d.v >= 0 ? zero - Math.abs(d.v) * sc : zero + Math.abs(d.v) * sc]);
      else sv.appendChild(s('rect', { x: x, y: y, width: bw, height: bh, rx: Math.min(4, bw / 2), class: i === n - 1 || i === hiIdx ? 'm-b on' : 'm-b' }));
      if (d.v !== 0 && (i === n - 1 || i === hiIdx || i === loIdx)) sv.appendChild(s('text', { x: Math.min(w - 12, Math.max(12, cx)), y: d.v >= 0 ? (type === 'line' ? pts[i][1] : y) - 6 : y + bh + fs, 'text-anchor': 'middle', class: 'm-hi' }, sgn(d.v)));
      if ((n - 1 - i) % step === 0) sv.appendChild(s('text', { x: Math.min(w - 10, Math.max(10, cx)), y: H - 6, 'text-anchor': 'middle', class: 'm-xl' }, labs[i]));
    });
    if (type === 'line') {
      sv.insertBefore(s('polyline', { points: pts.map(function (q) { return q.join(','); }).join(' '), class: 'm-line' }), sv.children[1]);
      var lp = pts[pts.length - 1]; sv.appendChild(s('circle', { cx: lp[0], cy: lp[1], r: 4, class: 'm-b on' }));
    }
    kids.push(sv); root();
  }

  /* ---- shared field helpers for m-form and the inline editors ---- */
  function err(form, input, msg) {
    var e = form.querySelector('.m-err');
    if (!e) { e = h('small', { class: 'warn m-err', role: 'alert' }); form.appendChild(e); }
    e.textContent = msg; if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }
  function clearErr(form) { var e = form.querySelector('.m-err'); if (e) e.remove(); Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); }); }
  /* validate + collect. firstText is required; every number is required and within min/max; dates required. Returns row or null (after showing a visible message). */
  function collect(form, cols, defs, p, requireAllText) {
    var row = {}, firstText = true;
    clearErr(form);
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i], d = defs[c], el = form.elements[c];
      if (!el) continue;
      if (d === 'bool') { row[c] = !!el.checked; continue; }
      if (d.indexOf('pick:') === 0) { var chosen = form.querySelector('[name="' + c + '"]:checked'); var v = el.tagName === 'SELECT' ? el.value : chosen && chosen.value; if (!v) { err(form, el.length ? el[0] : el, 'Choose ' + human(c).toLowerCase()); return null; } row[c] = v; continue; }
      var val = el.value;
      if (d === 'text' || d === 'long') {
        var isReq = firstText || requireAllText; firstText = false;
        if (isReq && !val.trim()) { err(form, el, 'Enter some text in ' + human(c).toLowerCase()); return null; }
        row[c] = val.trim();
      } else if (d === 'num') {
        var n = val === '' ? NaN : Number(val);
        if (!isFinite(n)) { err(form, el, 'Enter a number for ' + human(c).toLowerCase()); return null; }
        var mn = p.min != null && p.min !== '' ? Number(p.min) : null, mx = p.max != null && p.max !== '' ? Number(p.max) : null;
        if ((mn != null && n < mn) || (mx != null && n > mx)) { err(form, el, 'Enter a number ' + (mn != null && mx != null ? 'from ' + num(mn) + ' to ' + num(mx) : mn != null ? 'of at least ' + num(mn) : 'of at most ' + num(mx))); return null; }
        row[c] = n;
      } else { if (!val) { err(form, el, 'Pick a ' + human(c).toLowerCase()); return null; } row[c] = val; }
    }
    return row;
  }
  /* a small "n / max" counter appears once the text is within 20% of the limit (the input also has a maxlength) */
  function counter(input, max, wrap) {
    var c = h('small', { class: 'muted m-count', 'aria-live': 'polite' }); c.hidden = true; wrap.appendChild(c);
    input.addEventListener('input', function () { var n = input.value.length; c.hidden = n < max * 0.8; c.textContent = n + ' / ' + max; });
  }
  function inputFor(c, d, ph, value, p) {
    var attrs = { name: c, autocomplete: 'off', 'aria-label': human(c) };
    if (d === 'long') { var ta = h('textarea', Object.assign(attrs, { rows: 3, maxlength: S.LIMITS.long, placeholder: ph })); ta.value = value == null ? '' : value; return ta; }
    if (d === 'num') { var ni = h('input', Object.assign(attrs, { type: 'number', inputmode: 'decimal', step: 'any', placeholder: ph })); if (p.min != null) ni.min = p.min; if (p.max != null) ni.max = p.max; if (value != null) ni.value = value; return ni; }
    if (d === 'date') return h('input', Object.assign(attrs, { type: 'date', value: value || app.today() }));
    var ti = h('input', Object.assign(attrs, { type: 'text', maxlength: S.LIMITS.text, enterkeyhint: 'done', placeholder: ph, dir: 'auto' })); if (value != null) ti.value = value; return ti;
  }

  /* ---- m-list: rows of a table. attrs :table, :rows (optional array to show instead of all rows), title, sub, unit, meta, order, max (page size), edit ---- */
  function cell(def, v, unit) {
    if (def === 'pick') return h('span', { class: 'chip', text: human(String(v)) });
    if (def === 'num') return h('span', { class: 'm-val' }, bdi(sgn(v) + (unit ? ' ' + unit : '')));
    if (def === 'bool') return h('span', { class: 'm-val', text: v ? 'Yes' : 'No' });
    return h('span', { class: 'm-val', text: String(v) });
  }
  function removeBtn(t, r) { return h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Remove', onclick: function () { t.remove(r.id); } }, icon('trash')); }

  /* inline editor for one row: inputs for every column, Save (t.set) / Cancel */
  function editor(el, t, r, defs, p) {
    var cols = Object.keys(defs).filter(function (c) { return defs[c] !== 'date'; });
    var form = h('form', { class: 'm-edit', novalidate: true }), grid = h('div', { class: 'm-fields' });
    cols.forEach(function (c) {
      var d = defs[c], f;
      if (d.indexOf('pick:') === 0) { f = h('select', { name: c, 'aria-label': human(c) }); d.slice(5).split('|').forEach(function (o) { var op = h('option', { value: o, text: human(o) }); if (r[c] === o) op.selected = true; f.appendChild(op); }); f = h('label', { class: 'm-wide' }, f); }
      else if (d === 'bool') { var cb = h('input', { type: 'checkbox', name: c }); cb.checked = !!r[c]; f = h('label', { class: 'check m-wide' }, cb, h('span', { text: human(c) })); }
      else f = h('label', { class: d === 'num' ? '' : 'm-wide' }, inputFor(c, d, human(c), r[c], p));
      grid.appendChild(f);
    });
    var bar = h('div', { class: 'm-editbar' }, h('button', { class: 'btn ghost', type: 'button', text: 'Cancel', onclick: function () { el._m.editing = null; render(el); } }), h('button', { class: 'btn', type: 'submit', text: 'Save' }));
    form.appendChild(grid); form.appendChild(bar);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var row = collect(form, cols, defs, p, true); if (!row) return;
      try { t.set(r.id, row); } catch (x) { err(form, null, x.message); return; }
      el._m.editing = null; ui.toast('Saved'); render(el);
    });
    setTimeout(function () { var f = form.querySelector('input,textarea,select'); if (f) f.focus(); }, 0);
    return form;
  }

  function dayKey(r) { return r.at != null && isFinite(r.at) ? ymd(new Date(r.at)) : ''; }
  function mList(el, p) {
    var t = p.table; if (!t) return;
    var defs = meta(t).schema, rows = Array.prototype.slice.call(Array.isArray(p.rows) ? p.rows : t.rows);
    if (p.order !== 'old') rows.reverse();
    var step = Math.max(1, Math.min(200, Number(p.max) || 30)), shown = Math.min(rows.length, step * (1 + (el._m.pages || 0)));
    var meta_ = p.meta ? String(p.meta).split(',') : null, edit = 'edit' in p, byDay = p.by === 'day', sums = {};
    if (byDay && p.sub && defs[p.sub] === 'num') rows.forEach(function (r) { var k = dayKey(r); sums[k] = (sums[k] || 0) + (Number(r[p.sub]) || 0); });
    var box = h('div', { class: 'list' }), last = null;
    if (!rows.length) box.appendChild(h('div', { class: 'empty', text: 'Nothing here yet.' }));
    rows.slice(0, shown).forEach(function (r) {
      try {
        if (byDay) { var k = dayKey(r); if (k !== last) { last = k; box.appendChild(h('div', { class: 'm-dh' }, h('b', { class: 'grow' + (k === app.today() ? ' hi' : ''), text: k ? app.fmt(k, 'rel') : 'No date' }), k in sums ? bdi(sgn(sums[k]) + (p.unit ? ' ' + p.unit : ''), 'muted') : null)); } }
        if (edit && el._m.editing === r.id) { box.appendChild(editor(el, t, r, defs, p)); return; }
        var when = r.at != null && isFinite(r.at) ? (byDay ? app.fmt(r.at, 'time') : app.fmt(r.at, 'rel')) : '', sub = when ? [when] : [];
        if (meta_) sub = meta_.map(function (c) { return String(r[c]); }).concat(sub);
        var tv = r[p.title], titleNode = typeof tv === 'number' ? bdi(num(tv) + (p.unit && !p.sub ? ' ' + p.unit : '')) : String(tv == null ? '' : tv);
        var body = h('div', { class: 'grow' }, h('div', { class: 'm-title', dir: 'auto' }, titleNode), h('small', { class: 'muted', dir: 'auto', text: sub.join(' \u00b7 ') }));
        var main = edit ? h('button', { class: 'm-body grow', type: 'button', 'aria-label': 'Edit ' + String(tv).slice(0, 40), onclick: function () { el._m.editing = r.id; render(el); } }, body) : body;
        box.appendChild(h('div', { class: 'item' }, main, p.sub ? cell(String(defs[p.sub]).indexOf('pick:') === 0 ? 'pick' : defs[p.sub], r[p.sub], p.unit) : null, removeBtn(t, r)));
      } catch (x) { box.appendChild(h('div', { class: 'item' }, h('small', { class: 'muted', text: 'This row could not be shown.' }))); }
    });
    if (shown < rows.length) box.appendChild(h('button', { class: 'btn ghost m-more', type: 'button', text: 'Show ' + Math.min(step, rows.length - shown) + ' more (' + (rows.length - shown) + ' left)', onclick: function () { el._m.pages = (el._m.pages || 0) + 1; render(el); } }));
    el.replaceChildren(box);
  }

  /* ---- m-form: placeholders, not labels. attrs :table, fields, submit, min, max, seg (pick fields as a segmented control). A single text or number column becomes one inline row. ---- */
  function mForm(el, p) {
    var t = p.table; if (!t) return;
    var defs = meta(t).schema, cols = (p.fields ? String(p.fields).split(',').map(function (x) { return x.trim(); }) : Object.keys(defs)).filter(function (c) { return hasOwn.call(defs, c); });
    var inline = cols.length === 1 && (defs[cols[0]] === 'text' || defs[cols[0]] === 'num');
    var form = h('form', { class: 'm-form' + (inline ? ' m-inline' : '') + (p.look ? ' m-' + p.look : ''), novalidate: true }), grid = h('div', { class: 'm-fields' });
    var firstInput = null;
    cols.forEach(function (c) {
      var d = defs[c], f;
      if (d.indexOf('pick:') === 0) {
        f = h('fieldset', { class: ('seg' in p ? 'seg' : 'm-pick') + ' m-wide' }, h('legend', { class: 'm-sr', text: human(c) }));
        d.slice(5).split('|').forEach(function (o, i) { f.appendChild(h('label', { class: 'seg' in p ? '' : 'm-opt' }, h('input', { type: 'radio', name: c, value: o, checked: i === 0 }), h('span', { text: human(o) }))); });
        grid.appendChild(f); return;
      }
      if (d === 'bool') f = h('label', { class: 'check m-wide' }, h('input', { type: 'checkbox', name: c }), h('span', { text: human(c) }));
      else {
        var input = inputFor(c, d, human(c), null, p);
        input.addEventListener('input', function () { clearErr(form); });
        if (!firstInput && d !== 'date') firstInput = input;
        f = d === 'date' ? h('label', { class: 'm-datef' }, h('span', { text: human(c) }), input) : h('label', { class: d === 'long' || d === 'text' ? 'm-wide' : '' }, input);
        if (d === 'text' || d === 'long') counter(input, S.LIMITS[d], f);
      }
      grid.appendChild(f);
    });
    grid.appendChild(inline ? h('button', { class: 'btn m-go', type: 'submit', 'aria-label': p.submit || 'Add' }, icon('plus')) : h('span', { class: 'm-wide m-end' }, h('button', { class: 'btn', type: 'submit', text: p.submit || 'Add' })));
    form.appendChild(grid);
    var last = 0;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (performance.now() - last < 500) return; /* double-click guard */
      var row = collect(form, cols, defs, p, false); if (!row) return;
      var id; try { id = t.add(row); } catch (x) { err(form, null, x.message); return; }
      last = performance.now();
      form.reset();
      var dt = form.querySelector('input[type=date]'); if (dt) dt.value = app.today();
      ui.toast('Added', function () { t.remove(id); });
      if (firstInput) firstInput.focus();
    });
    el.replaceChildren(form);
  }

  /* x-edit: editable text. x-edit="[table, row, 'col']" saves with t.set; x-edit="[box, 'v']" writes a store.kv box (numbers stay numbers).
   * Enter commits (single line, no <div> is ever inserted), Escape cancels, blur commits, an empty or invalid value reverts. The element gets class tbtn (>= 44 px). */
  A.directive('edit', function (el, d, u) {
    el.setAttribute('contenteditable', 'true'); el.setAttribute('role', 'textbox'); el.dir = 'auto'; el.classList.add('tbtn');
    var cancel = false;
    var cur = function () { var a = u.evaluate(d.expression); return a.length === 2 ? a[0][a[1]] : a[1][a[2]]; };
    u.effect(function () { var v = cur(); if (document.activeElement !== el) el.textContent = String(v); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } else if (e.key === 'Escape') { cancel = true; el.blur(); } });
    el.addEventListener('beforeinput', function (e) { if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault(); });
    el.addEventListener('paste', function (e) { e.preventDefault(); var tx = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '); document.execCommand('insertText', false, tx); });
    el.addEventListener('blur', function () {
      var a = u.evaluate(d.expression), v = el.textContent.trim(), old = cur(), c = cancel; cancel = false;
      if (!c && v && v !== String(old)) {
        try {
          if (a.length === 2) { var n = Number(v.replace(/[,\s]/g, '')); if (typeof old === 'number') { if (!isFinite(n) || n < 0) throw new Error('Enter a number'); a[0][a[1]] = n; } else a[0][a[1]] = v; }
          else { var o = {}; o[a[2]] = v; a[0].set(a[1].id, o); }
        } catch (x) { ui.toast(x.message); }
      }
      el.textContent = String(cur());
    });
  });
  /* x-remove="[table, row]", [table, row, beforeFn] or [table, row, childTable, 'col'] (cascade): a 44 px icon button that removes the row (Undo toast included). */
  A.directive('remove', function (el, d, u) {
    el.setAttribute('type', 'button'); el.setAttribute('aria-label', 'Remove'); el.classList.add('ibtn'); el.appendChild(icon('trash'));
    el.addEventListener('click', function () {
      var a = u.evaluate(d.expression), c = a[2];
      if (typeof c === 'function') c(); /* [table, row, fn]: run fn first */
      else if (c && c.rows) Array.prototype.slice.call(c.rows).filter(function (r) { return String(r[a[3]]) === String(a[1].id); }).forEach(function (r) { c.remove(r.id); }); /* [table, row, child, col]: also remove the child rows that point at it */
      a[0].remove(a[1].id);
    });
  });
  /* $day(n): the date n days from today as YYYY-MM-DD (reactive across midnight, no time zone surprises). */
  A.magic('day', function () { return function (n) { var q = app.today().split('-'); return ymd(new Date(+q[0], +q[1] - 1, +q[2] + (n || 0), 12)); }; });

  var COMP = { 'm-stat': mStat, 'm-chart': mChart, 'm-list': mList, 'm-form': mForm };

  /* ---- mounting: read attributes, strip :bindings so Alpine does not also set them, evaluate in scope ---- */
  function render(el) { el._m.tick.n++; }
  A.interceptInit(function (el) {
    var comp = el.localName && COMP[el.localName];
    if (!comp || el._m) return;
    var stat = {}, dyn = {};
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name.charAt(0) === ':') { dyn[a.name.slice(1)] = a.value; el.removeAttribute(a.name); }
      else if (a.name !== 'class' && a.name !== 'id') stat[a.name] = a.value;
    });
    el.removeAttribute('title');
    el._m = { tick: A.reactive({ n: 0 }) };
    queueMicrotask(function () {
      var ro = null, first = true;
      var props = function () { var o = Object.assign({}, stat); for (var k in dyn) o[k] = A.evaluate(el, dyn[k]); return o; };
      el._m.run = function () { keepFocus(el, function () { comp(el, props()); }); };
      var runner = A.effect(function () { void el._m.tick.n; el._m.run(); });
      el._x_cleanups = (el._x_cleanups || []).concat([function () { A.release(runner); if (ro) ro.disconnect(); }]);
      if (comp === mChart && window.ResizeObserver) {
        var w0 = el.clientWidth;
        ro = new ResizeObserver(function () { if (first) { first = false; return; } if (el.clientWidth !== w0) { w0 = el.clientWidth; el._m.run(); } });
        ro.observe(el);
      }
    });
  });

  /* today() follows the clock past midnight: check on visibility change, on a slow timer, and on every table action (in the SDK) */
  document.addEventListener('visibilitychange', I.refresh);
  setInterval(I.refresh, 30000);

  /* ---- toast host (kit-owned) ---- */
  function toastHost() {
    var box = h('div', { class: 'm-toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
    A.effect(function () {
      box.replaceChildren.apply(box, I.toasts().map(function (t) {
        return h('div', { class: 'm-toast' }, h('span', { text: t.msg }), t.undo ? h('button', { type: 'button', text: 'Undo', onclick: function () { t.undo(); I.dismiss(t.id); } }) : null);
      }));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toastHost); else toastHost();
})();
