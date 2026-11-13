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
  var sdk = S.createSDK({ adapter: host.adapter || S.memoryAdapter(seed), manifest: manifest, reactive: A.reactive, unwrap: A.raw, locale: host.locale, host: host.bridge });
  var I = sdk.internal, ui = sdk.ui, app = sdk.app;
  window.store = sdk.store; window.ui = ui; window.app = app;
  var locale = I.locale;
  var MAXN = 1e12, hasOwn = Object.prototype.hasOwnProperty;
  var nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  var nfc = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  function san(v) { v = Number(v); if (v !== v) return 0; return Math.max(-MAXN, Math.min(MAXN, v)); }
  function num(n) { n = san(n); return Math.abs(n) >= 1e9 ? nfc.format(n) : nf.format(n); }
  function sgn(n) { return n < 0 ? '−' + num(-n) : num(n); }
  var meta = function (t) { return I.meta(t); };
  /* say(error): the message a person reads. No E_ARG codes; a long text says how long and how much is allowed. */
  function say(x) {
    var m = x && x.message ? String(x.message) : 'Something went wrong', q = /text is (\d+) characters; the limit for a \w+ column is (\d+)/.exec(m);
    if (q) return 'That is too long: ' + num(q[1]) + ' characters, the most is ' + num(q[2]);
    m = m.replace(/^E_\w+: /, ''); return m.charAt(0).toUpperCase() + m.slice(1);
  }
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
    x: '<path d="M6 6l12 12M18 6L6 18"/>', trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>', more: '<g fill="currentColor" stroke="none"><circle cx="12" cy="5.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/></g>', plus: '<path d="M12 5v14M5 12h14"/>',
    
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
  function clean(raw) { return arr(raw).filter(function (d) { return !(d && d.v == null); }).slice(0, 366).map(function (d) { return { k: d && d.k != null ? String(d.k) : '', v: san(d && d.v) }; }); }
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
    var data = clean(p.x || p.y ? arr(p.data).map(function (d) { return { k: d && d[p.x || 'k'], v: d && d[p.y || 'v'] }; }) : p.data); /* x="day" y="top": read the key and value from other fields */
    var w = Math.max(160, Math.floor(el.clientWidth || 340));
    var by = data.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(data[0].k) && (new Date(data[1].k) - new Date(data[0].k)) > 864e5 * 2 ? 'week' : 'day';
    var kids = [];
    if (p.label) kids.push(h('small', { class: 'muted', text: p.label }));
    var empty = h('div', { class: 'empty', text: 'No data yet' });
    var root = function () { el.replaceChildren(h.apply(null, ['div', { class: 'm-chart' }].concat(kids))); };
    if (type === 'hbar') { /* labelled horizontal bars: name, amount, share; the largest in the accent, the rest quiet */
      var hp = data.filter(function (d) { return d.v > 0; }), ht = hp.reduce(function (a, d) { return a + d.v; }, 0), hm = hp.reduce(function (a, d) { return Math.max(a, d.v); }, 0);
      if (!hp.length) { kids.push(empty); return root(); }
      var ul = h('ul', { class: 'm-hbar' }); hp.forEach(function (d, i) { ul.appendChild(h('li', null, h('div', { class: 'row' }, h('span', { class: 'grow', dir: 'auto', text: d.k }), bdi(num(d.v)), bdi(Math.round(d.v / ht * 100) + '%', 'muted')), h('div', { class: 'bar' + (i ? ' soft' : '') }, h('i', { style: { width: Math.min(100, Math.max(0, d.v / hm * 100)).toFixed(1) + '%' } })))); });
      kids.push(ul); return root();
    }
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
    var fs = 15 * scale(), H = Math.round(112 + fs), top = 20, bot = Math.round(fs + 10), n = data.length;
    if (!n) { kids.push(empty); return root(); }
    var vals = data.map(function (d) { return d.v; });
    var mn = Math.min.apply(null, vals.concat([0])), mxv = Math.max.apply(null, vals.concat([0]));
    if (type === 'line' && vals.length > 1) { mn = Math.min.apply(null, vals); mxv = Math.max.apply(null, vals); var pad = (mxv - mn || Math.abs(mxv) || 1) * 0.2; mn -= pad; mxv += pad; } /* a line shows its own range, not zero to max */
    if (mxv === mn) mxv = mn + 1;
    var sc = (H - top - bot) / (mxv - mn), zero = top + mxv * sc;
    var gap = n > 24 ? 2 : 8; if (w / n < gap + 1.5) gap = 0; var bw = Math.max(0.3, Math.min(28, (w - gap * (n - 1)) / n)), x0 = Math.max(0, (w - (bw * n + gap * (n - 1))) / 2);
    var hiIdx = 0; vals.forEach(function (v, i) { if (Math.abs(v) > Math.abs(vals[hiIdx])) hiIdx = i; });
    var loIdx = -1; if (mn < 0) vals.forEach(function (v, i) { if (v === mn && loIdx < 0) loIdx = i; });
    var labs = data.map(function (d) { return label(d.k, by, n); }), maxLen = Math.max.apply(null, labs.map(function (x) { return x.length; }));
    var step = Math.max(1, Math.ceil((maxLen * 0.62 * fs + 8) / Math.max(0.3, bw + gap)));
    var summary = n > 14 ? n + ' values, largest ' + sgn(vals[hiIdx]) + ', latest ' + sgn(vals[n - 1]) : data.map(function (d, i) { return labs[i] + ' ' + sgn(d.v); }).join(', ');
    var sv = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': summary });
    var by0 = type === 'line' && mn > 0 ? H - bot : zero; sv.appendChild(s('line', { x1: 0, x2: w, y1: by0 + .5, y2: by0 + .5, class: 'm-base' }));
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
        var mn = p.min != null && p.min !== '' ? Number(p.min) : null, mx = p.max != null && p.max !== '' ? Number(p.max) : null;
        if (!val.trim() && p.opt && p.opt.indexOf(c) >= 0) { row[c] = null; continue; } /* an optional number may stay empty */
        var n = I.parseNum(val, mx);
        if (!isFinite(n)) { err(form, el, 'Enter a number for ' + human(c).toLowerCase() + ', like 82.5'); return null; }
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
    if (d === 'num') { var ni = h('input', Object.assign(attrs, { type: 'text', inputmode: 'decimal', enterkeyhint: 'done', placeholder: ph })); if (value != null) ni.value = value.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 20 }); return ni; } /* text, not type=number: '82,5' and Arabic-Indic digits are read by I.parseNum */
    if (d === 'date') return h('input', Object.assign(attrs, { type: 'date', value: value || app.today() }));
    var ti = h('input', Object.assign(attrs, { type: 'text', maxlength: S.LIMITS.text, enterkeyhint: 'done', placeholder: ph, dir: 'auto' })); if (value != null) ti.value = value; return ti;
  }

  /* ---- m-list: rows of a table. attrs :table, :rows (optional array to show instead of all rows), title, sub, unit, meta, order, max (page size), edit ---- */
  function cell(def, v, unit) {
    if (def === 'pick') return h('span', { class: 'chip', text: human(String(v)) });
    if (def === 'num') return h('span', { class: 'm-val' }, v == null ? '\u2014' : bdi(sgn(v) + (unit ? ' ' + unit : '')));
    if (def === 'bool') return h('span', { class: 'm-val', text: v ? 'Yes' : 'No' });
    return h('span', { class: 'm-val', text: String(v) });
  }
  /* One quiet row action: a kebab (three dots). The first tap arms it ("Delete", for 4 s), the second tap does it. Undo comes with the toast. */
  var live = null; /* one polite-assertive region for things that happen without a visible change of focus */
  function announce(text) {
    if (!live) { live = h('div', { class: 'm-sr', role: 'status', 'aria-live': 'assertive' }); document.body.appendChild(live); }
    live.textContent = ''; setTimeout(function () { live.textContent = text; }, 30);
  }
  function kebab(el, del, nameFn) {
    var armed = false, tm = null, at = 0;
    var set = function (on) {
      var name = typeof nameFn === 'function' ? nameFn() : nameFn;
      armed = on; el.replaceChildren(on ? document.createTextNode('Delete') : icon('more')); el.setAttribute('aria-label', on ? 'Delete' + (name ? ' ' + name : '') : 'More actions' + (name ? ' for ' + name : '')); el.classList.toggle('arm', on);
      clearTimeout(tm); if (on) { at = performance.now(); tm = setTimeout(function () { set(false); }, 4000); announce('Delete ' + (name || 'this') + '? Tap Delete again to confirm.'); }
    };
    /* the second tap must be a separate tap: a double tap (two taps within 300 ms) only arms it */
    el.addEventListener('click', function (e) { if (!armed) set(true); else if (performance.now() - at >= 300) { var kb = e.detail === 0, from = el.closest('m-list') || el.closest('.list') || el.closest('main'); set(false); if (kb) kbDelete = from; del(); setTimeout(function () { kbDelete = null; }, 0); } }); /* detail 0 = keyboard: the Undo that appears takes focus */
    el.addEventListener('blur', function () { if (armed) set(false); });
    set(false);
  }
  function nameOf(r) { for (var k in r) if (typeof r[k] === 'string' && k !== 'id' && r[k].trim()) return r[k].trim().slice(0, 30); return ''; } /* the first text column names the row in toasts */
  function removeBtn(t, r) { var b = h('button', { class: 'ibtn', type: 'button' }); kebab(b, function () { t.remove(r.id); }, function () { return nameOf(r); }); return b; }

  /* inline editor for one row: inputs for every column, Save (t.set) / Cancel */
  function editor(el, t, r, defs, p) {
    p.opt = meta(t).opt;
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
      try { t.set(r.id, row); } catch (x) { err(form, null, say(x)); return; }
      el._m.editing = null; ui.toast('Saved'); render(el);
    });
    setTimeout(function () { var f = form.querySelector('input,textarea,select'); if (f) f.focus(); }, 0);
    return form;
  }

  /* :glyph="r => 'M9 9h.4...'" draws a 40 px outline icon from an SVG path (24 x 24 units) at the start of each row */
  function glyph(p, r) {
    if (typeof p.glyph !== 'function') return null;
    var d = p.glyph(r), g = s('svg', { viewBox: '0 0 24 24', width: 40, height: 40, class: 'ic m-glyph', 'aria-hidden': 'true' });
    g.appendChild(s('path', { d: String(d) })); return g;
  }
  function dayKey(r) { return r.at != null && isFinite(r.at) ? ymd(new Date(r.at)) : ''; }
  function mList(el, p) {
    var t = p.table; if (!t) return;
    var defs = meta(t).schema, rows = Array.prototype.slice.call(Array.isArray(p.rows) ? p.rows : t.rows);
    if (p.month != null && p.month !== '') { var q = app.today().split('-'), mk = ymd(new Date(+q[0], +q[1] - 1 + Number(p.month), 1, 12)).slice(0, 7); rows = rows.filter(function (r) { return dayKey(r).slice(0, 7) === mk; }); } /* month="0" this calendar month, -1 last month */
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
        box.appendChild(h('div', { class: 'item' }, glyph(p, r), main, p.sub ? cell(String(defs[p.sub]).indexOf('pick:') === 0 ? 'pick' : defs[p.sub], r[p.sub], p.unit) : null, removeBtn(t, r)));
      } catch (x) { box.appendChild(h('div', { class: 'item' }, h('small', { class: 'muted', text: 'This row could not be shown.' }))); }
    });
    if (shown < rows.length) box.appendChild(h('button', { class: 'btn ghost m-more', type: 'button', text: 'Show ' + Math.min(step, rows.length - shown) + ' more (' + (rows.length - shown) + ' left)', onclick: function () { el._m.pages = (el._m.pages || 0) + 1; render(el); } }));
    el.replaceChildren(box);
  }

  /* ---- m-form: placeholders, not labels. attrs :table, fields, submit, min, max, seg (pick fields as a segmented control), quick="250,500" (one-tap add buttons for the first number column). One filled input style kit-wide. A single text or number column becomes one inline row; text + number (+ picks) puts the Add button in the same row. ---- */
  var dlN = 0;
  function mForm(el, p) {
    var t = p.table; if (!t) return;
    p.opt = meta(t).opt;
    var defs = meta(t).schema, cols = (p.fields ? String(p.fields).split(',').map(function (x) { return x.trim(); }) : Object.keys(defs)).filter(function (c) { return hasOwn.call(defs, c); });
    var kinds = cols.map(function (c) { return defs[c].indexOf('pick:') === 0 ? 'pick' : defs[c]; });
    var inline = cols.length === 1 && (kinds[0] === 'text' || kinds[0] === 'num');
    var compact = !inline && kinds[0] === 'text' && kinds[1] === 'num' && kinds.slice(2).every(function (k) { return k === 'pick'; }); /* text + number (+ picks): one row with the Add button */
    var form = h('form', { class: 'm-form' + (inline ? ' m-inline' : '') + (compact ? ' m-compact' : ''), novalidate: true }), grid = h('div', { class: 'm-fields' }), rest = h('div', { class: 'm-rest' });
    var firstInput = null;
    cols.forEach(function (c, ci) {
      var d = defs[c], f;
      if (d.indexOf('pick:') === 0) {
        f = h('fieldset', { class: ('seg' in p ? 'seg' : 'm-pick') + ' m-wide' }, h('legend', { class: 'm-sr', text: human(c) }));
        d.slice(5).split('|').forEach(function (o, i) { f.appendChild(h('label', { class: 'seg' in p ? '' : 'm-opt' }, h('input', { type: 'radio', name: c, value: o, checked: i === 0 }), h('span', { text: human(o) }))); });
        (compact ? rest : grid).appendChild(f); return;
      }
      if (d === 'bool') f = h('label', { class: 'check m-wide' }, h('input', { type: 'checkbox', name: c }), h('span', { text: human(c) }));
      else {
        var input = inputFor(c, d, human(c) + (p.opt && p.opt.indexOf(c) >= 0 ? ' (optional)' : ''), null, p);
        input.addEventListener('input', function () { clearErr(form); });
        if (!firstInput && d !== 'date') firstInput = input;
        f = d === 'date' ? h('label', { class: 'm-datef' }, h('span', { text: human(c) }), input) : h('label', { class: compact ? (ci === 0 ? 'm-tx' : 'm-nm') : d === 'long' || d === 'text' ? 'm-wide' : '' }, input);
        if (d === 'text' || d === 'long') counter(input, S.LIMITS[d], f);
        if (d === 'text') { /* earlier values of this column are offered as suggestions (read when the field is focused, so typing never rebuilds the form) */
          var dl = h('datalist', { id: 'm-dl-' + (++dlN) }); input.setAttribute('list', dl.id); f.appendChild(dl);
          input.addEventListener('focus', function () { var seen = {}, rs = t.rows; dl.replaceChildren(); for (var i = rs.length - 1; i >= 0 && dl.children.length < 12; i--) { var v = rs[i][c]; if (v && !seen[v]) { seen[v] = 1; dl.appendChild(h('option', { value: v })); } } });
        }
      }
      grid.appendChild(f);
    });
    var qn = p.quick ? cols.filter(function (c) { return defs[c] === 'num'; })[0] : null, quickRow = null, last = 0;
    var undoAdd = function (id) { I.tx(t).del(id); }; /* Undo of an add is quiet: the row just goes away */
    if (qn) {
      quickRow = h.apply(null, ['div', { class: 'm-quick' }].concat(String(p.quick).split(',').map(function (q) {
        return h('button', { class: 'btn ghost', type: 'button', text: '+' + q.trim(), onclick: function () {
          if (performance.now() - last < 400) return; last = performance.now(); /* a double tap adds once */
          var row = {}; row[qn] = Number(q); var id; try { id = t.add(row); } catch (x) { ui.toast(say(x)); return; }
          ui.toast('Added ' + q.trim(), function () { undoAdd(id); }); el.dispatchEvent(new CustomEvent('added', { bubbles: true, detail: { id: id } }));
        } });
      })));
    }
    grid.appendChild(inline ? h('button', { class: 'btn m-go', type: 'submit', 'aria-label': p.submit || 'Add' }, icon('plus')) : compact ? h('button', { class: 'btn m-add', type: 'submit', text: p.submit || 'Add' }) : h('span', { class: 'm-wide m-end' }, h('button', { class: 'btn', type: 'submit', text: p.submit || 'Add' })));
    if (quickRow) form.appendChild(quickRow);
    form.appendChild(grid); if (compact) form.appendChild(rest);
    /* keep="name,qty": those fields keep their value after Add, and start from the last row when first focused (nothing retyped every set) */
    var keep = p.keep ? String(p.keep).split(',').map(function (x) { return x.trim(); }).filter(function (c) { return hasOwn.call(defs, c) && form.elements[c]; }) : [];
    if (keep.length) setTimeout(function () { /* once, outside any effect, so the form is never rebuilt by a row change */
      var rs = t.rows, lr = rs[rs.length - 1]; if (!lr) return;
      keep.forEach(function (c) { if (!form.elements[c].value && lr[c] != null) form.elements[c].value = String(lr[c]); });
    }, 0);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (performance.now() - last < 500) return; /* double-click guard */
      var row = collect(form, cols, defs, p, false); if (!row) return;
      var id; try { id = t.add(row); } catch (x) { err(form, null, say(x)); return; }
      last = performance.now();
      var kept = keep.map(function (c) { return form.elements[c].value; });
      form.reset();
      keep.forEach(function (c, i) { form.elements[c].value = kept[i]; });
      var dt = form.querySelector('input[type=date]'); if (dt) dt.value = app.today();
      ui.toast('Added', function () { undoAdd(id); });
      el.dispatchEvent(new CustomEvent('added', { bubbles: true, detail: { id: id } }));
      if (firstInput) firstInput.focus();
    });
    el.replaceChildren(form);
  }

  /* x-edit: editable text. x-edit="[table, row, 'col']" saves with t.set; x-edit="[box, 'v', min, max]" writes a store.kv box (a number stays a
   * number, shown with thousands separators; text that is not a number in min..max reverts with a toast).
   * Enter commits (single line, no <div> is ever inserted), Escape cancels, blur commits, an empty value reverts. role=textbox, aria-label = the field name, class tbtn (>= 44 px). */
  A.directive('edit', function (el, d, u) {
    el.setAttribute('contenteditable', 'true'); el.setAttribute('role', 'textbox'); el.dir = 'auto'; el.classList.add('tbtn');
    var cancel = false, isT = function (a) { return typeof a[0].set === 'function'; };
    var first = u.evaluate(d.expression), lab = isT(first) ? first[3] : first[4]; /* the label: the element's own aria-label, else a last string argument, else the field name */
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', typeof lab === 'string' && lab ? lab : human(isT(first) ? first[2] : first[1]));
    var cur = function () { var a = u.evaluate(d.expression); return isT(a) ? a[1][a[2]] : a[0][a[1]]; };
    var show = function () { var v = cur(); el.textContent = typeof v === 'number' ? v.toLocaleString(locale) : String(v); };
    u.effect(function () { cur(); if (document.activeElement !== el) show(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } else if (e.key === 'Escape') { cancel = true; el.blur(); } });
    el.addEventListener('beforeinput', function (e) { if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault(); });
    el.addEventListener('paste', function (e) { e.preventDefault(); var tx = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '); document.execCommand('insertText', false, tx); });
    el.addEventListener('blur', function () {
      var a = u.evaluate(d.expression), v = el.textContent.trim(), old = cur(), c = cancel; cancel = false;
      if (!c && v && v !== (typeof old === 'number' ? old.toLocaleString(locale) : String(old))) {
        try {
          if (!isT(a)) {
            if (typeof old === 'number') {
              var n = I.parseNum(v, a[3] == null ? MAXN : a[3]), lo = a[2] == null ? 0 : a[2], hi = a[3] == null ? MAXN : a[3];
              if (!isFinite(n) || n < lo || n > hi) throw new Error('Enter a number from ' + num(lo) + ' to ' + num(hi));
              a[0][a[1]] = n;
            } else a[0][a[1]] = v;
          } else { var o = {}; o[a[2]] = v; a[0].set(a[1].id, o); }
        } catch (x) { ui.toast(say(x)); }
      }
      show();
    });
  });
  /* x-remove="[table, row]" or [table, row, beforeFn] or [table, row, childTable, 'col'] (cascade): one quiet kebab; the second tap removes the row
   * (and, for a cascade, every child row that points at it) as ONE undoable step: one toast, one Undo that restores all of it. */
  A.directive('remove', function (el, d, u) {
    el.setAttribute('type', 'button'); el.classList.add('ibtn');
    kebab(el, function () {
      var a = u.evaluate(d.expression), c = a[2];
      if (typeof c === 'function') { c(); a[0].remove(a[1].id); }
      else if (c && c.rows) I.removeGroup([[c, I.tx(c).ids(a[3], a[1].id)], [a[0], [a[1].id]]], 'Removed ' + nameOf(a[1]));
      else a[0].remove(a[1].id);
    }, function () { return nameOf(u.evaluate(d.expression)[1]); });
  });
  /* $day(n): the date n days from today as YYYY-MM-DD (reactive across midnight, no time zone surprises). */
  var dayAt = function (n) { var q = app.today().split('-'); return ymd(new Date(+q[0], +q[1] - 1, +q[2] + (n || 0), 12)); };
  A.magic('day', function () { return dayAt; });
  /* $month(n): the first day of the month n months from this one (YYYY-MM-01), for app.fmt(d, 'month') */
  A.magic('month', function () { return function (n) { var q = app.today().split('-'); return ymd(new Date(+q[0], +q[1] - 1 + (n || 0), 1, 12)); }; });
  /* $days(n): the last n dates, today first (YYYY-MM-DD) */
  A.magic('days', function () { return function (n) { var o = []; for (var i = 0; i < Math.min(366, n); i++) o.push(dayAt(-i)); return o; }; });

  var shift = function (day, n) { var q = day.split('-'); return ymd(new Date(+q[0], +q[1] - 1, +q[2] + n, 12)); };
  /* $group(rows, 'day' | col, ...): rows grouped by the given keys ('day' = the local day of `at`), in first-seen order: [{day, <col>, rows}] */
  A.magic('group', function () { return function (rows) { var ks = [].slice.call(arguments, 1), seen = {}, out = []; arr(rows).forEach(function (r) { var kv = ks.map(function (k) { return k === 'day' ? dk(r.at) : r[k]; }), id = kv.join('\u0001'), g = seen[id]; if (!g) { g = seen[id] = { rows: [] }; ks.forEach(function (k, i) { g[k] = kv[i]; }); out.push(g); } g.rows.push(r); }); return out; }; });
  /* $streaks(table, col): { value of col: current streak in days } for every value, from the table's date column (today or yesterday counts as the start, like t.streak) */
  A.magic('streaks', function () { return function (t, col) { var dc = meta(t).dateCol, td = app.today(), by = {}, out = {}; t.rows.forEach(function (r) { (by[r[col]] = by[r[col]] || {})[r[dc]] = 1; }); var best = 0; Object.keys(by).forEach(function (k) { var d = by[k][td] ? td : shift(td, -1), n = 0; while (by[k][d]) { n++; d = shift(d, -1); } out[k] = n; best = Math.max(best, n); }); Object.defineProperty(out, 'max', { value: best }); return out; }; }); /* out.max is the longest of them */
  /* $hue(n): the colour-identity class c1..c5 for any number, so each item keeps its own colour */
  A.magic('hue', function () { return function (n) { return 'c' + (Math.abs(Math.floor(Number(n) || 0)) % 5 + 1); }; });
  /* $ema(series, a, scale): an exponentially smoothed copy of a {k, v} series (each point keeps 1 - a of the running value and adds a * scale * v), rounded: a score that decays */
  A.magic('ema', function () { return function (series, a, scale) { var run = 0; return arr(series).map(function (d) { run = run * (1 - a) + a * (scale == null ? 1 : scale) * d.v; return { k: d.k, v: Math.round(run) }; }); }; });
  /* $aria(text, day, on, words): "Text, Sat, Nov 21, done" for a button that toggles a date (words: ['done', 'not done']) */
  A.magic('aria', function () { return function (text, day, on, words) { var w = words || ['done', 'not done']; return text + ', ' + app.fmt(day, 'dm') + ', ' + (on ? w[0] : w[1]); }; });
  /* $clock(sec): 1:30 */
  A.magic('clock', function () { return function (sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }; });
  /* $fit(px): how many columns of at least px fit the parent's width, reactive to the window size (so no clipped, still-focusable columns exist) */
  var vw = A.reactive({ w: window.innerWidth }); window.addEventListener('resize', function () { vw.w = window.innerWidth; });
  A.magic('fit', function (el) { return function (px) { void vw.w; var p = el.parentElement; if (!p) return 1; var c = getComputedStyle(p), w = p.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight); return Math.max(1, Math.floor((w + 4) / (px + 4))); }; });
  /* x-toggle="[table, key, day, label]": a button that toggles the row {...key, day} of a table (t.toggle / t.has): role=checkbox, aria-checked, and a name like "Label, Sat, Nov 21, done" */
  A.directive('toggle', function (el, d, u) {
    el.setAttribute('role', 'checkbox'); if (!el.getAttribute('type')) el.setAttribute('type', 'button');
    var args = function () { var a = u.evaluate(d.expression); a.k = Object.assign({}, a[1], { day: a[2] }); return a; };
    u.effect(function () { var a = args(), on = a[0].has(a.k); el.setAttribute('aria-checked', on ? 'true' : 'false'); el.setAttribute('aria-label', a[3] + ', ' + app.fmt(a[2], 'dm') + ', ' + (on ? 'done' : 'not done')); });
    el.addEventListener('click', function () { var a = args(); a[0].toggle(a.k); });
  });
  /* x-roving: one tab stop for a group of buttons; arrows move (Up/Down by the number given, else by one), Home/End jump. x-roving or x-roving="7" for a calendar. */
  A.directive('roving', function (el, d, u) {
    var step = d.expression ? Number(u.evaluate(d.expression)) || 1 : 1, cur = null;
    var items = function () { return Array.prototype.slice.call(el.querySelectorAll('button,[role=checkbox],[role=radio]')).filter(function (x) { return !x.disabled; }); };
    var apply = function () { var it = items(); if (!it.length) return; if (!cur || !el.contains(cur)) cur = it.filter(function (x) { return x.getAttribute('aria-checked') === 'true'; })[0] || it[0]; it.forEach(function (x) { x.tabIndex = x === cur ? 0 : -1; }); };
    new MutationObserver(apply).observe(el, { childList: true, subtree: true }); setTimeout(apply, 0);
    el.addEventListener('focusin', function (e) { if (items().indexOf(e.target) >= 0) { cur = e.target; apply(); } });
    el.addEventListener('keydown', function (e) {
      var it = items(), i = it.indexOf(document.activeElement), rtl = getComputedStyle(el).direction === 'rtl', to = null;
      if (i < 0) return;
      if (e.key === 'ArrowRight') to = i + (rtl ? -1 : 1); else if (e.key === 'ArrowLeft') to = i + (rtl ? 1 : -1); else if (e.key === 'ArrowDown') to = i + step; else if (e.key === 'ArrowUp') to = i - step; else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = it.length - 1; else return;
      e.preventDefault(); if (to >= 0 && to < it.length) { cur = it[to]; apply(); cur.focus(); }
    });
  });

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
      var props = function () { var o = Object.assign({}, stat); for (var k in dyn) o[k] = A.evaluate(el, k === 'glyph' ? '() => (' + dyn[k] + ')' : dyn[k]); /* Alpine calls a function result, so a function-valued prop is returned from a wrapper */ return o; };
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
  setInterval(I.refresh, 5000); /* the day header is right within 5 s of midnight */

  /* ---- toast host (kit-owned). Rows are patched by id, never rebuilt, so focus and screen-reader position survive every change; only a NEW row is announced.
   * Pending Undos live in one list (a tray with "Undo all" from three up). A keyboard delete moves focus to the new Undo; Escape drops a toast; hover or focus on an
   * Undo pauses its expiry. ---- */
  var kbDelete = null; /* set by a keyboard-driven delete: the list to give focus back to */
  function toastHost() {
    var rows = {}, back = null;
    var count = h('b'), head = h('div', { class: 'm-tray-h', 'aria-live': 'off' }, count, h('button', { type: 'button', text: 'Undo all', onclick: function () { I.toasts().filter(function (t) { return t.undo; }).reverse().forEach(function (t) { t.undo(); I.dismiss(t.id); }); giveBack(); } }));
    var plain = h('div', { class: 'm-plain' }), list = h('div', { class: 'm-tray-l' }), tray = h('div', { class: 'm-tray' }, head, list);
    var box = h('div', { class: 'm-toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' }, plain, tray);
    document.body.appendChild(box);
    function giveBack() { var c = back; back = null; if (c && c.isConnected) { var f = c.querySelector('button,[tabindex]'); if (f) f.focus(); } }
    function make(t) {
      var el = h('div', { class: 'm-toast' }, h('span', { text: t.msg }));
      if (t.undo) {
        var ub = h('button', { type: 'button', text: 'Undo', 'aria-label': 'Undo: ' + t.msg, onclick: function () { t.undo(); I.dismiss(t.id); giveBack(); } });
        el.appendChild(ub);
        el.addEventListener('mouseenter', function () { I.hold(t.id, true); }); el.addEventListener('mouseleave', function () { if (!el.contains(document.activeElement)) I.hold(t.id, false); });
        el.addEventListener('focusin', function () { I.hold(t.id, true); }); el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget) && !el.matches(':hover')) I.hold(t.id, false); });
      }
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape') { I.dismiss(t.id); giveBack(); } });
      return el;
    }
    A.effect(function () {
      var all = I.toasts().slice(), ids = {}, undos = 0;
      all.forEach(function (t) { ids[t.id] = 1; if (t.undo) undos++; });
      Object.keys(rows).forEach(function (id) { if (!ids[id]) { rows[id].remove(); delete rows[id]; } });
      tray.hidden = !undos; tray.toggleAttribute('data-many', undos >= 3); head.hidden = undos < 3; count.textContent = undos + ' undos'; /* before any focus() below: a hidden tray cannot take focus */
      all.forEach(function (t) {
        if (rows[t.id]) return;
        var el = rows[t.id] = make(t);
        if (t.undo) { list.insertBefore(el, list.firstChild); if (kbDelete) { back = kbDelete; kbDelete = null; el.querySelector('button').focus(); } } else plain.appendChild(el);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toastHost); else toastHost();
})();
