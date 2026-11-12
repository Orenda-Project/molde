/* Molde kit components: m-stat, m-chart, m-list, m-form, m-timer, plus boot and the toast host.
 * Attributes are the API. A `:name="expr"` attribute is evaluated in the page's Alpine scope and re-evaluated when its
 * data changes; plain `name="text"` is a string. Rendering is plain DOM (textContent only, no innerHTML of data).
 * Only store, ui and app go on window (the 16 calls). Kit-only helpers stay in sdk.internal. */
(function () {
  'use strict';
  var A = window.Alpine, S = window.MoldeSDK;
  var host = window.moldeHost || {};
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
  var SVG = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) { if (k === 'style') setStyle(e, attrs[k]); else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var ICON = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', play: '<path d="M8 5.5v13l11-6.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>',
  };
  function icon(name) {
    var e = s('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    e.innerHTML = ICON[name];
    return e;
  }
  var MOUTH = { great: 'M7.5 13.5 Q12 19.5 16.5 13.5 Z', good: 'M8 14.5 Q12 18.5 16 14.5', okay: 'M8.5 16 H15.5', low: 'M8 17.5 Q12 13.5 16 17.5', awful: 'M7.5 18.5 Q12 12 16.5 18.5' };
  function face(name) {
    if (!hasOwn.call(MOUTH, name)) return null;
    var e = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    e.appendChild(s('circle', { cx: 8.8, cy: 9.5, r: 1.1, fill: 'currentColor', stroke: 'none' }));
    e.appendChild(s('circle', { cx: 15.2, cy: 9.5, r: 1.1, fill: 'currentColor', stroke: 'none' }));
    e.appendChild(s('path', { d: MOUTH[name], fill: name === 'great' ? 'currentColor' : 'none' }));
    return e;
  }
  var human = function (c) { c = String(c).replace(/_/g, ' '); return c.charAt(0).toUpperCase() + c.slice(1); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var ymd = S.ymd;
  function dayLabel(ts) {
    var d = new Date(ts), t = app.today().split('-'), k = ymd(d);
    if (k === app.today()) return 'Today';
    if (k === ymd(new Date(+t[0], +t[1] - 2 + 1, +t[2] - 1, 12))) return 'Yesterday';
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  }
  function keepFocus(el, fn) {
    var a = document.activeElement, path = null;
    if (a && a !== el && el.contains(a)) { path = []; for (var n = a; n !== el; n = n.parentNode) path.unshift(Array.prototype.indexOf.call(n.parentNode.children, n)); }
    fn();
    if (path) { var q = el; for (var i = 0; i < path.length && q; i++) q = q.children[path[i]]; if (q && q !== document.activeElement && q.focus) q.focus({ preventScroll: true }); }
  }
  function tpl(spec, row, defs) {
    return String(spec).replace(/\{(\w+)\}/g, function (m, c) { return hasOwn.call(defs, c) && defs[c] === 'num' ? num(row[c]) : String(row[c] == null ? '' : row[c]); });
  }

  /* ---- m-stat: flat lead number. Attributes: label :value :of unit, `left` (shows of - value), `glass` (fill-level glass) ---- */
  function glassSvg(pct) {
    var y = 100 - 90 * pct / 100, xl = 10 + (y - 6) * 8 / 94, xr = 62 - (y - 6) * 8 / 94;
    var svg = s('svg', { viewBox: '0 0 72 108', class: 'm-glass', 'aria-hidden': 'true' });
    if (pct > 0) svg.appendChild(s('polygon', { points: (xl + 1) + ',' + y + ' ' + (xr - 1) + ',' + y + ' 53,99 19,99', class: 'g-fill' }));
    svg.appendChild(s('path', { d: 'M10 6 H62 L54 100 H18 Z', class: 'g-edge' }));
    return svg;
  }
  function mStat(el, p) {
    var v = san(p.value), of = p.of != null && p.of !== '' ? san(p.of) : 0, u = p.unit || '', left = 'left' in p, glass = 'glass' in p;
    var pct = of > 0 ? Math.max(0, Math.min(100, Math.round(v / of * 100))) : 0;
    var big = left && of > 0 ? Math.abs(of - v) : v, over = left && of > 0 && v > of;
    var tail = left ? u : of > 0 ? '/ ' + num(of) + (u ? ' ' + u : '') : u;
    var kids = [h('small', { class: 'muted', text: p.label || '' }), h('div', { class: 'm-num' }, h('span', { class: 'stat', text: num(big) }), tail ? h('span', { class: 'muted', text: tail }) : null)];
    if (of > 0 && !glass) kids.push(h('div', { class: 'm-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': of, 'aria-valuenow': Math.min(v, of), 'aria-label': p.label || 'Progress' }, h('i', { style: { transform: 'scaleX(' + (left ? (over ? 1 : Math.max(0, 1 - pct / 100)) : pct / 100) + ')' } })));
    if (of > 0) kids.push(h('small', { class: over ? 'warn' : !left && v >= of ? 'ok' : 'muted', text: left ? (over ? 'Over budget' : 'of ' + num(of) + (u ? ' ' + u : '')) : v >= of ? 'Goal reached' : pct + '% of goal' }));
    el.replaceChildren(h('div', { class: 'm-stat' }, glass ? glassSvg(pct) : null, h.apply(null, ['div', { class: 'm-body' }].concat(kids))));
  }

  /* ---- m-chart: type bar (default) | line | pie | rows. :data=[{k,v}] or :table + col [by last op] ---- */
  function label(k, by, n) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      var d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8), 12);
      return new Intl.DateTimeFormat(locale, by === 'week' || n > 14 ? { day: 'numeric', month: 'short' } : { weekday: n > 8 ? 'narrow' : 'short' }).format(d);
    }
    if (/^\d{4}-\d{2}$/.test(k)) return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(+k.slice(0, 4), +k.slice(5) - 1, 1, 12));
    return String(k);
  }
  function clean(raw) { return arr(raw).slice(0, 366).map(function (d) { return { k: d && d.k != null ? String(d.k) : '', v: san(d && d.v) }; }); }
  function percents(vals, total) {
    var raw = vals.map(function (v) { return v / total * 100; }), fl = raw.map(Math.floor), left = 100 - fl.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - fl[i], i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, left).forEach(function (x) { fl[x[1]]++; });
    return fl;
  }
  function slices(data, keep) {
    var pos = data.filter(function (d) { return d.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    if (pos.length > keep) { var rest = pos.slice(keep - 1).reduce(function (a, d) { return a + d.v; }, 0); pos = pos.slice(0, keep - 1).concat([{ k: 'Other', v: rest, other: true }]); }
    return pos;
  }
  function mChart(el, p) {
    var type = p.type || 'bar';
    var data = clean(p.data || (p.table ? p.table.series(p.col || null, { by: p.by, last: p.last ? +p.last : undefined, op: p.op }) : []));
    var w = Math.max(160, Math.floor(el.clientWidth || 340));
    var by = data.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(data[0].k) && (new Date(data[1].k) - new Date(data[0].k)) > 864e5 * 2 ? 'week' : 'day';
    var kids = [];
    if (p.label) kids.push(h('small', { class: 'muted', text: p.label }));
    var empty = h('div', { class: 'empty', text: 'No data yet' });
    var root = function () { el.replaceChildren(h.apply(null, ['div', { class: 'm-chart' }].concat(kids))); };
    if (type === 'pie' || type === 'rows') {
      var keep = type === 'pie' ? 5 : 7, sl = slices(data, keep), total = sl.reduce(function (a, d) { return a + d.v; }, 0);
      if (!sl.length) { kids.push(empty); return root(); }
      var pc = percents(sl.map(function (d) { return d.v; }), total);
      var cls = function (d, i) { return 'm-c' + (d.other ? 0 : (i % 5) + 1); };
      var nm = function (d) { return d.other ? 'Other' : human(label(d.k, by, 9)); };
      if (type === 'rows') {
        var mx = sl[0].v, list = h('div', { class: 'm-rows' });
        sl.forEach(function (d, i) { list.appendChild(h('div', { class: 'm-rrow ' + cls(d, i) }, h('div', { class: 'm-rtop' }, h('span', { class: 'm-sw' }), h('span', { class: 'm-n', text: nm(d) }), h('span', { class: 'm-v', text: num(d.v) })), h('div', { class: 'm-rbar' }, h('i', { style: { width: Math.max(2, d.v / mx * 100) + '%' } })))); });
        kids.push(list); return root();
      }
      var size = 128, r = 50, C = 2 * Math.PI * r, off = 0, legend = h('ul', { class: 'm-legend' });
      var svg = s('svg', { viewBox: '0 0 128 128', class: 'm-pie', role: 'img', 'aria-label': sl.map(function (d, i) { return nm(d) + ' ' + pc[i] + '%'; }).join(', ') });
      svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring' }));
      sl.forEach(function (d, i) {
        var frac = d.v / total;
        svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring ' + cls(d, i), 'stroke-dasharray': Math.max(0.5, frac * C - 2) + ' ' + C, 'stroke-dashoffset': -off * C, transform: 'rotate(-90 64 64)' }));
        off += frac;
        legend.appendChild(h('li', { class: cls(d, i) }, h('span', { class: 'm-sw' }), h('span', { class: 'm-n', text: nm(d) }), h('span', { class: 'm-v muted', text: num(d.v) + ' · ' + pc[i] + '%' })));
      });
      kids.push(h('div', { class: 'm-pierow' }, svg, legend)); return root();
    }
    var H = 128, top = 20, bot = 24, n = data.length;
    if (!n) { kids.push(empty); return root(); }
    var vals = data.map(function (d) { return d.v; });
    var mn = Math.min.apply(null, vals.concat([0])), mxv = Math.max.apply(null, vals.concat([0]));
    if (mxv === mn) mxv = mn + 1;
    var scale = (H - top - bot) / (mxv - mn), zero = top + mxv * scale;
    var gap = n > 24 ? 2 : 8, bw = Math.max(1, Math.min(28, (w - gap * (n - 1)) / n)), x0 = Math.max(0, (w - (bw * n + gap * (n - 1))) / 2);
    var hiIdx = 0; vals.forEach(function (v, i) { if (Math.abs(v) > Math.abs(vals[hiIdx])) hiIdx = i; });
    var loIdx = -1; if (mn < 0) vals.forEach(function (v, i) { if (v === mn && loIdx < 0) loIdx = i; });
    var step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 36))));
    var summary = n > 14 ? n + ' values, largest ' + sgn(vals[hiIdx]) + ', latest ' + sgn(vals[n - 1]) : data.map(function (d) { return label(d.k, by, n) + ' ' + sgn(d.v); }).join(', ');
    var sv = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': summary });
    sv.appendChild(s('line', { x1: 0, x2: w, y1: zero + .5, y2: zero + .5, class: 'm-base' }));
    var pts = [];
    data.forEach(function (d, i) {
      var x = x0 + i * (bw + gap), cx = x + bw / 2, bh = Math.max(d.v !== 0 ? 3 : 2, Math.abs(d.v) * scale), y = d.v >= 0 ? zero - bh : zero;
      if (type === 'line') pts.push([cx, d.v >= 0 ? zero - Math.abs(d.v) * scale : zero + Math.abs(d.v) * scale]);
      else sv.appendChild(s('rect', { x: x, y: y, width: bw, height: bh, rx: Math.min(4, bw / 2), class: 'm-b' }));
      if (d.v !== 0 && (i === n - 1 || i === hiIdx || i === loIdx)) sv.appendChild(s('text', { x: Math.min(w - 12, Math.max(12, cx)), y: d.v >= 0 ? (type === 'line' ? pts[i][1] : y) - 6 : y + bh + 14, 'text-anchor': 'middle', class: 'm-hi' }, sgn(d.v)));
      if ((n - 1 - i) % step === 0) sv.appendChild(s('text', { x: Math.min(w - 10, Math.max(10, cx)), y: H - 6, 'text-anchor': 'middle' }, label(d.k, by, n)));
    });
    if (type === 'line') {
      sv.insertBefore(s('polyline', { points: pts.map(function (q) { return q.join(','); }).join(' '), class: 'm-line' }), sv.children[1]);
      var lp = pts[pts.length - 1]; sv.appendChild(s('circle', { cx: lp[0], cy: lp[1], r: 4, class: 'm-b' }));
    }
    kids.push(sv); root();
  }

  /* ---- m-list ---- */
  function cell(def, v, unit) {
    if (def === 'pick') return h('span', { class: 'chip', text: human(String(v)) });
    if (def === 'num') return h('span', { class: 'm-val', text: sgn(v) + (unit ? ' ' + unit : '') });
    if (def === 'bool') return h('span', { class: 'm-val', text: v ? 'Yes' : 'No' });
    return h('span', { class: 'm-val', text: String(v) });
  }
  function subOf(p, r, defs) { return !p.sub ? null : p.sub.indexOf('{') >= 0 ? h('span', { class: 'm-val', text: tpl(p.sub, r, defs) }) : cell(String(defs[p.sub]).indexOf('pick:') === 0 ? 'pick' : defs[p.sub], r[p.sub], p.unit); }
  function removeBtn(t, r) { return h('button', { class: 'm-x', type: 'button', 'aria-label': 'Remove', onclick: function () { t.remove(r.id); } }, icon('x')); }

  function habitGrid(el, p, t, rows) {
    var log = p.log, lm = meta(log), key = p.key || lm.cols.filter(function (c) { return lm.schema[c] === 'text'; })[0], dcol = lm.dateCol;
    var w = el.clientWidth || 340, N = Math.max(3, Math.min(7, Math.floor((w - 8 - 12 - 120) / 44)));
    var t0 = app.today().split('-'), days = [];
    for (var i = 0; i < N; i++) { var d = new Date(+t0[0], +t0[1] - 1, +t0[2] - i, 12); days.push({ k: ymd(d), d: d }); }
    var best = 0, done = 0;
    var body = rows.map(function (r, idx) {
      var name = r[p.title], k0 = {}; k0[key] = name;
      var run = log.streak(k0); best = Math.max(best, run);
      var kt = Object.assign({}, k0); kt[dcol] = days[0].k; if (log.has(kt)) done++;
      var cells = days.map(function (dd) {
        var k = Object.assign({}, k0); k[dcol] = dd.k;
        return h('button', { class: 'm-cell', type: 'button', 'aria-pressed': log.has(k) ? 'true' : 'false', 'aria-label': name + ', ' + new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dd.d), onclick: function () { log.toggle(k); } });
      });
      return h.apply(null, ['div', { class: 'm-hrow', style: { '--hc': 'var(--c' + (idx % 5 + 1) + ')' } }, h('div', { class: 'grow' }, h('div', { class: 'm-title', text: String(name) }), h('small', { class: 'muted', text: run ? run + (run === 1 ? ' day' : ' days') + ' in a row' : 'No streak yet' }))].concat(cells));
    });
    var head = h.apply(null, ['div', { class: 'm-hhead' }, h('div', { class: 'grow' })].concat(days.map(function (dd, i) {
      return h('div', { class: 'm-hd' + (i === 0 ? ' today' : '') }, new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dd.d), h('br'), String(dd.d.getDate()));
    })));
    var lead = h('div', { class: 'm-lead' }, h('span', { class: 'stat', text: num(best) }), h('span', { class: 'muted', text: best === 1 ? 'day streak' : 'day streak' }), h('small', { class: 'muted m-lsub', text: 'Done today: ' + done + ' of ' + rows.length }));
    var card = h.apply(null, ['div', { class: 'm-list card' }, head].concat(body.length ? body : [h('div', { class: 'empty', text: 'No habits yet. Add the first one below.' })]));
    el.replaceChildren(h('div', null, lead, card));
  }

  function groupList(el, p, t, rows, defs) {
    var by = new Map();
    rows.forEach(function (r) { var k = r[p.group]; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    var list = Array.from(by, function (e) { return { k: e[0], rs: e[1] }; }).sort(function (a, b) { return b.rs[b.rs.length - 1].at - a.rs[a.rs.length - 1].at; });
    var box = h('div', { class: 'm-list card' });
    if (!list.length) box.appendChild(h('div', { class: 'empty', text: 'Nothing here yet. Add the first one above.' }));
    list.forEach(function (g) {
      var dk = function (r) { return ymd(new Date(r.at)); }, days = [];
      g.rs.forEach(function (r) { if (days.indexOf(dk(r)) < 0) days.push(dk(r)); });
      var cur = days[days.length - 1], prev = days[days.length - 2];
      var curRows = g.rs.filter(function (r) { return dk(r) === cur; }), prevRows = prev ? g.rs.filter(function (r) { return dk(r) === prev; }) : [];
      var gh = h('div', { class: 'm-gh' }, h('b', { text: human(g.k) }));
      if (cur !== app.today()) gh.appendChild(h('small', { class: 'muted', text: dayLabel(curRows[0].at) }));
      if (prevRows.length) gh.appendChild(h('small', { class: 'muted', text: 'Last time ' + tpl(p.sub, prevRows[prevRows.length - 1], defs) + (prevRows.length > 1 ? ' · ' + prevRows.length + ' sets' : '') }));
      box.appendChild(gh);
      curRows.forEach(function (r, i) {
        box.appendChild(h('div', { class: 'm-row' }, h('div', { class: 'grow' }, h('div', { class: 'm-title', text: tpl(p.sub, r, defs) }), h('small', { class: 'muted', text: 'Set ' + (i + 1) + ' · ' + app.fmt(r.at, 'time') })), removeBtn(t, r)));
      });
    });
    el.replaceChildren(box);
  }

  function mList(el, p) {
    var t = p.table; if (!t) return;
    var defs = meta(t).schema, rows = Array.prototype.slice.call(t.rows);
    if (p.log) return habitGrid(el, p, t, rows);
    if (p.group && p.sub) return groupList(el, p, t, rows, defs);
    if (p.order !== 'old') rows.reverse();
    var step = Math.max(1, Math.min(200, Number(p.max) || 30)), shown = Math.min(rows.length, step * (1 + (el._m.pages || 0)));
    var meta_ = p.meta ? String(p.meta).split(',') : null, faces = !!p.face;
    var box = h('div', { class: 'm-list card' + (faces ? ' m-tl' : '') });
    if (!rows.length) box.appendChild(h('div', { class: 'empty', text: 'Nothing here yet. Add the first one above.' }));
    var lastDay = null;
    rows.slice(0, shown).forEach(function (r) {
      if (p.by === 'day') { var dk = ymd(new Date(r.at)); if (dk !== lastDay) { box.appendChild(h('div', { class: 'm-dh', text: dayLabel(r.at) })); lastDay = dk; } }
      var sub = [p.by === 'day' ? app.fmt(r.at, 'time') : app.fmt(r.at, 'rel')];
      if (meta_) sub = meta_.map(function (c) { return human(String(r[c])); }).concat(sub);
      var fc = null;
      if (faces) { var fs = face(r[p.face]); fc = h('span', { class: 'm-fcs m-m' + (Object.keys(MOUTH).indexOf(r[p.face]) + 1) }, fs || h('span', { class: 'chip', text: human(String(r[p.face])) })); }
      var tv = r[p.title];
      box.appendChild(h('div', { class: 'm-row' }, fc,
        h('div', { class: 'grow' }, h('div', { class: 'm-title', text: typeof tv === 'number' ? num(tv) : String(tv == null ? '' : tv) }), h('small', { class: 'muted', text: sub.join(' · ') })),
        subOf(p, r, defs), removeBtn(t, r)));
    });
    if (shown < rows.length) box.appendChild(h('button', { class: 'btn ghost m-more', type: 'button', text: 'Show ' + Math.min(step, rows.length - shown) + ' more (' + (rows.length - shown) + ' left)', onclick: function () { el._m.pages = (el._m.pages || 0) + 1; render(el); } }));
    el.replaceChildren(box);
  }

  /* ---- m-form: placeholders, not labels. attrs :table fields submit hint quick faces ---- */
  function mForm(el, p) {
    var t = p.table; if (!t) return;
    var defs = meta(t).schema, cols = (p.fields ? String(p.fields).split(',').map(function (x) { return x.trim(); }) : Object.keys(defs)).filter(function (c) { return hasOwn.call(defs, c); });
    var inline = cols.length === 1 && defs[cols[0]] === 'text';
    var form = h('form', { class: 'm-form' + (inline ? ' m-inline' : '') }), grid = h('div', { class: 'm-fields' });
    var textInput = null, firstText = true, firstPick = true;
    cols.forEach(function (c) {
      var d = defs[c], f, input;
      if (d.indexOf('pick:') === 0) {
        var opts = d.slice(5).split('|'), asFaces = 'faces' in p && firstPick && opts.every(function (o) { return hasOwn.call(MOUTH, o); });
        f = h('fieldset', { class: (asFaces ? 'm-faces' : 'm-pick') + ' m-wide' }, h('legend', { class: 'm-sr', text: human(c) }));
        opts.forEach(function (o, i) {
          var r = h('input', { type: 'radio', name: c, value: o, checked: !asFaces && i === 0, required: asFaces && i === 0 });
          f.appendChild(asFaces ? h('label', { class: 'm-face' }, r, h('span', { class: 'm-fc m-m' + (Object.keys(MOUTH).indexOf(o) + 1) }, face(o)), human(o)) : h('label', { class: 'm-opt' }, r, h('span', { text: human(o) })));
        });
        if (asFaces) firstPick = false;
        if (!asFaces) firstPick = false;
      } else if (d === 'bool') {
        f = h('label', { class: 'check m-wide' }, h('input', { type: 'checkbox', name: c }), h('span', { text: human(c) }));
      } else {
        var attrs = { name: c, autocomplete: 'off', 'aria-label': human(c) };
        var ph = firstText && (d === 'text' || d === 'long') && p.hint ? p.hint : human(c);
        if (d === 'long') input = h('textarea', Object.assign(attrs, { rows: 3, maxlength: 2000, placeholder: ph }));
        else if (d === 'num') input = h('input', Object.assign(attrs, { type: 'number', inputmode: 'decimal', step: 'any', placeholder: ph, required: true }));
        else if (d === 'date') input = h('input', Object.assign(attrs, { type: 'date', value: app.today(), required: true }));
        else input = h('input', Object.assign(attrs, { type: 'text', maxlength: 200, enterkeyhint: 'done', placeholder: ph }));
        if (firstText && (d === 'text' || d === 'long')) { input.required = true; textInput = input; firstText = false; input.addEventListener('input', function () { input.setCustomValidity(''); }); }
        f = d === 'date' ? h('label', { class: 'm-datef' }, h('span', { text: human(c) }), input) : h('label', { class: d === 'long' || d === 'text' ? 'm-wide' : '' }, input);
      }
      grid.appendChild(f);
    });
    if (p.quick) {
      var nc = cols.filter(function (c) { return defs[c] === 'num'; })[0];
      if (nc) form.appendChild(h.apply(null, ['div', { class: 'm-quick' }].concat(String(p.quick).split(',').map(function (q) {
        return h('button', { class: 'btn ghost', type: 'button', text: '+' + q.trim(), onclick: function () { var row = {}; row[nc] = Number(q); var id = t.add(row); ui.toast('Added ' + q.trim(), function () { t.remove(id); }); } });
      }))));
    }
    grid.appendChild(inline ? h('button', { class: 'btn', type: 'submit', 'aria-label': p.submit || 'Add' }, icon('plus')) : h('button', { class: 'btn', type: 'submit', text: p.submit || 'Add' }));
    form.appendChild(grid);
    var last = 0;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (Date.now() - last < 500) return; /* double-click guard */
      if (textInput && !textInput.value.trim()) { textInput.setCustomValidity('Enter some text'); textInput.reportValidity(); return; }
      var fd = new FormData(form), row = {};
      cols.forEach(function (c) {
        if (defs[c] === 'bool') row[c] = fd.has(c);
        else if (!fd.has(c)) return;
        else if (defs[c] === 'num') row[c] = Number(fd.get(c));
        else row[c] = defs[c] === 'text' || defs[c] === 'long' ? String(fd.get(c)).trim() : fd.get(c);
      });
      try { t.add(row); } catch (err) { ui.toast(err.message); return; }
      last = Date.now();
      form.reset();
      var dt = form.querySelector('input[type=date]'); if (dt) dt.value = app.today();
      ui.toast('Added');
      var fi = form.querySelector('input[type=text],input[type=number],textarea'); if (fi) fi.focus();
    });
    el.replaceChildren(form);
  }

  /* ---- m-timer ---- */
  function mTimer(el, p) {
    var sec = Number(p.sec) || 60;
    var st = el._m.t || (el._m.t = ui.timer(sec, function () { ui.toast('Time is up'); if (navigator.vibrate) navigator.vibrate(200); }));
    var fmt = function (s_) { return Math.floor(s_ / 60) + ':' + String(s_ % 60).padStart(2, '0'); };
    var run = st.running;
    el.replaceChildren(h('div', { class: 'm-time' },
      h('div', { class: 'grow' }, h('small', { class: 'muted', text: p.label || 'Timer' }), h('div', { class: 'm-clock', text: fmt(st.left) })),
      st.left !== sec && !run ? h('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Reset', onclick: function () { el._m.t = null; render(el); } }, icon('reset')) : null,
      h('button', { class: 'btn ghost', type: 'button', onclick: function () { run ? st.stop() : st.start(); } }, icon(run ? 'pause' : 'play'), run ? 'Pause' : 'Start')));
  }

  var COMP = { 'm-stat': mStat, 'm-chart': mChart, 'm-list': mList, 'm-form': mForm, 'm-timer': mTimer };

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
      if ((comp === mChart || comp === mList) && window.ResizeObserver) {
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
