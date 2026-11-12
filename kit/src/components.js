/* Molde kit components: m-stat, m-chart, m-list, m-form, m-timer, plus boot and the toast host.
 * Attributes are the API. A `:name="expr"` attribute is evaluated in the page's Alpine scope and re-evaluated when its
 * data changes; plain `name="text"` is a string. Rendering is plain DOM (textContent only, no innerHTML of data). */
(function () {
  'use strict';
  var A = window.Alpine, S = window.MoldeSDK;
  var host = window.moldeHost || {};
  var manifest = host.manifest;
  if (!manifest) {
    var mEl = document.getElementById('molde-manifest');
    manifest = mEl ? JSON.parse(mEl.textContent) : { tables: {} };
  }
  var seed = host.seed;
  if (!seed) { var sEl = document.getElementById('molde-seed'); seed = sEl ? JSON.parse(sEl.textContent) : null; }
  var sdk = S.createSDK({ adapter: host.adapter || S.memoryAdapter(seed), manifest: manifest, reactive: A.reactive, locale: host.locale, host: host.bridge });
  var store = sdk.store, ui = sdk.ui, app = sdk.app;
  window.store = store; window.ui = ui; window.app = app;
  var locale = host.locale || manifest.locale || document.documentElement.lang || navigator.language || 'en';
  var nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  var num = function (n) { return nf.format(n); };

  /* ---- tiny DOM helper ---- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else if (k === 'style') Object.assign(e.style, v); else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  var SVG = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) { if (k === 'style') Object.assign(e.style, attrs[k]); else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  var ICON = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>',
  };
  function icon(name) {
    var e = s('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    e.innerHTML = ICON[name];
    return e;
  }
  var human = function (c) { c = c.replace(/_/g, ' '); return c.charAt(0).toUpperCase() + c.slice(1); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };

  /* ---- m-stat ---- */
  function mStat(el, p) {
    var v = Number(p.value) || 0, of = p.of != null && p.of !== '' ? Number(p.of) : 0, u = p.unit || '';
    var pct = of > 0 ? Math.min(100, Math.round(v / of * 100)) : 0;
    var num_ = h('span', { class: 'stat', text: num(v) });
    var tail = of > 0 ? h('span', { class: 'muted', text: '/ ' + num(of) + (u ? ' ' + u : '') }) : (u ? h('span', { class: 'muted', text: u }) : null);
    var kids = [h('small', { class: 'muted', text: p.label || '' }), h('div', { class: 'm-num' }, num_, tail)];
    if (of > 0) {
      kids.push(h('div', { class: 'm-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': of, 'aria-valuenow': v, 'aria-label': p.label || 'Progress' }, h('i', { style: { transform: 'scaleX(' + pct / 100 + ')' } })));
      kids.push(h('small', { class: v >= of ? 'ok' : 'muted', text: v >= of ? 'Goal reached' : pct + '% of goal' }));
    }
    el.replaceChildren(h.apply(null, ['div', { class: 'm-stat card' }].concat(kids)));
  }

  /* ---- m-chart ---- */
  function dots(data) {
    var wd = data.length * 15 - 5;
    var svg = s('svg', { width: wd, height: 10, viewBox: '0 0 ' + wd + ' 10', role: 'img', 'aria-label': 'Last ' + data.length + ' days: ' + data.filter(function (d) { return d.v > 0; }).length + ' done' });
    data.forEach(function (d, i) { svg.appendChild(s('circle', { cx: i * 15 + 5, cy: 5, r: d.v > 0 ? 5 : 4, class: d.v > 0 ? 'm-dot on' : 'm-dot' })); });
    return h('span', { class: 'm-dots' }, svg);
  }
  var PIE_MIX = [100, 68, 46, 30, 18];
  function label(k, by, n) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      var d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8), 12);
      return new Intl.DateTimeFormat(locale, by === 'week' ? { day: 'numeric', month: 'short' } : { weekday: n > 8 ? 'narrow' : 'short' }).format(d);
    }
    if (/^\d{4}-\d{2}$/.test(k)) return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(+k.slice(0, 4), +k.slice(5) - 1, 1, 12));
    return String(k);
  }
  function mChart(el, p) {
    var data = arr(p.data || (p.table ? p.table.series(p.col || null, { by: p.by, last: p.last ? +p.last : undefined, op: p.op }) : []));
    var type = p.type || 'bar';
    var w = Math.max(160, Math.floor((el.clientWidth || 340) - 34)); /* 34 = card padding + border, see kit.css .card */
    var by = data.length && /^\d{4}-\d{2}-\d{2}$/.test(data[0].k) && data.length > 1 && (new Date(data[1].k) - new Date(data[0].k)) > 864e5 * 2 ? 'week' : 'day';
    var total = data.reduce(function (a, d) { return a + d.v; }, 0);
    var kids = [];
    if (p.label) kids.push(h('small', { class: 'muted', text: p.label }));
    var summary = data.map(function (d) { return label(d.k, by, data.length) + ' ' + num(d.v); }).join(', ');
    var svg;
    if (type === 'dots') { el.replaceChildren(dots(data)); return; }
    if (type === 'pie') {
      var size = 128, r = 50, sw = 22, C = 2 * Math.PI * r;
      svg = s('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'img', 'aria-label': summary, class: 'm-pie' });
      svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring' }));
      var off = 0, legend = h('ul', { class: 'm-legend' });
      data.slice(0, 5).forEach(function (d, i) {
        var frac = total > 0 ? d.v / total : 0, col = 'color-mix(in srgb, var(--accent) ' + PIE_MIX[i] + '%, var(--card))';
        if (frac > 0) svg.appendChild(s('circle', { cx: 64, cy: 64, r: r, class: 'm-ring', style: { stroke: col }, 'stroke-dasharray': Math.max(0, frac * C - 2) + ' ' + C, 'stroke-dashoffset': -off * C, transform: 'rotate(-90 64 64)' }));
        off += frac;
        legend.appendChild(h('li', null, h('i', { style: { background: col } }), h('span', { class: 'grow', text: human(label(d.k, by, 9)) }), h('span', { class: 'muted', text: num(d.v) + (total ? ' · ' + Math.round(frac * 100) + '%' : '') })));
      });
      kids.push(h('div', { class: 'row' }, svg, legend));
      legend.classList.add('grow');
      el.replaceChildren(h.apply(null, ['div', { class: 'm-chart card' }].concat(data.length ? kids : [h('div', { class: 'empty', text: 'No data yet' })])));
      return;
    }
    var H = 136, top = 20, bot = 24, base = H - bot, ch = base - top;
    svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': summary });
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
    var n = data.length || 1, gap = 8, bw = Math.min(40, (w - gap * (n - 1)) / n), x0 = (w - (bw * n + gap * (n - 1))) / 2;
    svg.appendChild(s('line', { x1: 0, x2: w, y1: base + .5, y2: base + .5, class: 'm-base' }));
    var pts = [];
    var hiIdx = data.reduce(function (b, d, i) { return d.v > data[b].v ? i : b; }, 0);
    data.forEach(function (d, i) {
      var bh = d.v > 0 ? Math.max(4, d.v / max * ch) : 2, x = x0 + i * (bw + gap), last = i === data.length - 1;
      if (type === 'line') {
        var cx = x + bw / 2, cy = base - (d.v / max) * ch; pts.push([cx, cy]);
      } else {
        svg.appendChild(s('rect', { x: x, y: base - bh, width: bw, height: bh, rx: Math.min(6, bw / 2), class: last ? 'm-b on' : 'm-b' }));
      }
      if (d.v > 0 && (last || i === hiIdx)) svg.appendChild(s('text', { x: x + bw / 2, y: (type === 'line' ? pts[i][1] : base - bh) - 6, 'text-anchor': 'middle', class: 'm-hi' }, num(d.v)));
      svg.appendChild(s('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle' }, label(d.k, by, n)));
    });
    if (type === 'line' && pts.length) {
      svg.insertBefore(s('polyline', { points: pts.map(function (q) { return q.join(','); }).join(' '), class: 'm-line' }), svg.children[1]);
      var lp = pts[pts.length - 1]; svg.appendChild(s('circle', { cx: lp[0], cy: lp[1], r: 4, class: 'm-b on' }));
    }
    kids.push(svg);
    el.replaceChildren(h.apply(null, ['div', { class: 'm-chart card' }].concat(kids)));
  }

  /* ---- m-list ---- */
  function cell(def, v, unit) {
    if (def === 'pick') return h('span', { class: 'chip', text: human(String(v)) });
    if (def === 'num') return h('span', { class: 'm-val', text: num(v) + (unit ? ' ' + unit : '') });
    if (def === 'bool') return h('span', { class: 'm-val', text: v ? 'Yes' : 'No' });
    return h('span', { class: 'm-val', text: String(v) });
  }
  function mList(el, p) {
    var t = p.table; if (!t) return;
    var defs = t._schema(), rows = t.rows.slice();
    if (p.order !== 'old' && !p.log) rows.reverse();
    var max = Number(p.max) || 30, shown = el._m.more ? rows.length : Math.min(rows.length, max);
    var meta = p.meta ? String(p.meta).split(',') : null;
    var typeOf = function (c) { var d = defs[c]; return d && d.indexOf('pick:') === 0 ? 'pick' : d; };
    var box = h('div', { class: 'm-list card' }), log = p.log;
    var key = log ? (p.key || log.cols.filter(function (c) { return log._schema()[c] === 'text'; })[0]) : null;
    if (!rows.length) { box.appendChild(h('div', { class: 'empty', text: 'Nothing here yet. Add the first one above.' })); }
    rows.slice(0, shown).forEach(function (r) {
      if (log) {
        var k = {}; k[key] = r[p.title];
        var run = log.streak(k), on = log.has(k);
        box.appendChild(h('div', { class: 'm-row' },
          h('button', { class: 'check', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': String(r[p.title]), onclick: function () { log.toggle(k); } }),
          h('div', { class: 'grow' }, h('div', { class: 'm-title', text: String(r[p.title]) }), h('small', { class: 'muted', text: run ? run + (run === 1 ? ' day' : ' days') + ' in a row' : 'No streak yet' })),
          dots(log.series(null, { last: 7, where: k })),
          h('button', { class: 'm-x', type: 'button', 'aria-label': 'Remove', onclick: function () { t.remove(r.id); } }, icon('x'))));
        return;
      }
      var sub = [app.fmt(r.at, 'rel')];
      if (meta) sub = meta.map(function (c) { return human(String(r[c])); }).concat(sub);
      box.appendChild(h('div', { class: 'm-row' },
        h('div', { class: 'grow' }, h('div', { class: 'm-title', text: String(r[p.title] == null ? '' : r[p.title]) }), h('small', { class: 'muted', text: sub.join(' · ') })),
        p.sub ? cell(typeOf(p.sub), r[p.sub], p.unit) : null,
        h('button', { class: 'm-x', type: 'button', 'aria-label': 'Remove', onclick: function () { t.remove(r.id); } }, icon('x'))));
    });
    if (shown < rows.length) box.appendChild(h('button', { class: 'btn ghost m-more', type: 'button', text: 'Show all ' + rows.length, onclick: function () { el._m.more = true; render(el); } }));
    el.replaceChildren(box);
  }

  /* ---- m-form ---- */
  function mForm(el, p) {
    var t = p.table; if (!t) return;
    var defs = t._schema(), cols = p.fields ? String(p.fields).split(',').map(function (x) { return x.trim(); }) : Object.keys(defs);
    var form = h('form', { class: 'm-form', novalidate: false }), grid = h('div', { class: 'm-fields' }), first = true, firstInput = null;
    cols.forEach(function (c) {
      var d = defs[c]; if (!d) return;
      var f, input;
      if (d.indexOf('pick:') === 0) {
        f = h('fieldset', { class: 'm-pick m-wide' }, h('legend', { text: human(c) }));
        d.slice(5).split('|').forEach(function (o, i) { f.appendChild(h('label', { class: 'm-opt' }, h('input', { type: 'radio', name: c, value: o, checked: i === 0 }), h('span', { text: human(o) }))); });
      } else if (d === 'bool') {
        f = h('label', { class: 'check m-wide' }, h('input', { type: 'checkbox', name: c }), h('span', { text: human(c) }));
      } else {
        var attrs = { name: c, autocomplete: 'off' };
        if (d === 'long') input = h('textarea', Object.assign(attrs, { rows: 3, maxlength: 2000 }));
        else if (d === 'num') input = h('input', Object.assign(attrs, { type: 'number', inputmode: 'decimal', step: 'any' }));
        else if (d === 'date') input = h('input', Object.assign(attrs, { type: 'date', value: app.today() }));
        else input = h('input', Object.assign(attrs, { type: 'text', maxlength: 200, enterkeyhint: 'done' }));
        if (first && (d === 'text' || d === 'long')) { input.required = true; }
        first = false;
        f = h('label', { class: 'field' + (d === 'long' || d === 'text' ? ' m-wide' : '') }, h('span', { text: human(c) }), input);
        if (!firstInput) firstInput = input;
      }
      grid.appendChild(f);
    });
    if (p.quick) {
      var nc = cols.filter(function (c) { return defs[c] === 'num'; })[0];
      form.appendChild(h.apply(null, ['div', { class: 'grid2' }].concat(String(p.quick).split(',').map(function (q) {
        return h('button', { class: 'btn ghost', type: 'button', text: '+' + q.trim(), onclick: function () { var row = {}; row[nc] = Number(q); var id = t.add(row); ui.toast('Added ' + q.trim(), function () { t.remove(id); }); } });
      }))));
    }
    form.appendChild(grid);
    form.appendChild(h('button', { class: 'btn', type: 'submit', text: p.submit || 'Add' }));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form), row = {};
      cols.forEach(function (c) { if (defs[c] === 'bool') row[c] = fd.has(c); else if (fd.has(c)) row[c] = fd.get(c); });
      t.add(row);
      form.reset();
      var dt = form.querySelector('input[type=date]'); if (dt) dt.value = app.today();
      ui.toast('Added');
      if (firstInput) firstInput.focus();
    });
    el.replaceChildren(form);
  }

  /* ---- m-timer ---- */
  function mTimer(el, p) {
    var sec = Number(p.sec) || 60;
    var st = el._m.t || (el._m.t = ui.timer(sec, function () { ui.toast('Time is up'); if (navigator.vibrate) navigator.vibrate(200); }));
    var fmt = function (s_) { return Math.floor(s_ / 60) + ':' + String(s_ % 60).padStart(2, '0'); };
    var run = st.running;
    el.replaceChildren(h('div', { class: 'm-time card' },
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
      var ro = null;
      var props = function () { var o = Object.assign({}, stat); for (var k in dyn) o[k] = A.evaluate(el, dyn[k]); return o; };
      var first = true;
      el._m.run = function () { comp(el, props()); };
      var runner = A.effect(function () { el._m.tick.n; el._m.run(); });
      el._x_cleanups = (el._x_cleanups || []).concat([function () { A.release(runner); if (ro) ro.disconnect(); }]);
      if (comp === mChart && window.ResizeObserver) {
        var w0 = el.clientWidth;
        ro = new ResizeObserver(function () { if (first) { first = false; return; } if (el.clientWidth !== w0) { w0 = el.clientWidth; el._m.run(); } });
        ro.observe(el);
      }
    });
  });

  /* ---- toast host (kit-owned, reads ui.toasts) ---- */
  function toastHost() {
    var box = h('div', { class: 'm-toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
    A.effect(function () {
      box.replaceChildren.apply(box, ui.toasts.map(function (t) {
        return h('div', { class: 'm-toast' }, h('span', { text: t.msg }), t.undo ? h('button', { type: 'button', text: 'Undo', onclick: function () { t.undo(); ui._dismiss(t.id); } }) : null);
      }));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toastHost); else toastHost();
})();
