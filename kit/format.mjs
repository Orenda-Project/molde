// Canonical formatter for mini-app body fragments (contract section 2): 2-space indent, one element per line,
// attributes unchanged (only the whitespace between them is normalised). Elements whose only content is text stay
// on one line. Idempotent: format(format(x)) === format(x). Pure function, no dependencies.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'pre']);
const VERBATIM = new Set(['textarea', 'pre']);

function tokenize(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    if (src[i] === '<' && /^(?:[A-Za-z]|\/[A-Za-z]|!--)/.test(src.slice(i + 1, i + 4))) {
      if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i); const end = e < 0 ? src.length : e + 3; toks.push({ t: 'comment', raw: src.slice(i, end) }); i = end; continue; }
      let j = i + 1, q = null;
      while (j < src.length) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
      const body = src.slice(i + 1, j);
      if (body[0] === '/') toks.push({ t: 'close', name: body.slice(1).trim().toLowerCase() });
      else {
        const m = body.match(/^([A-Za-z][^\s/>]*)([\s\S]*?)\s*(\/?)$/);
        const name = m[1].toLowerCase();
        toks.push({ t: 'open', name, attrs: attrList(m[2]), selfClose: m[3] === '/' || VOID.has(name), slash: m[3] === '/' });
      }
      i = j + 1;
      const last = toks[toks.length - 1];
      if (last.t === 'open' && RAW.has(last.name) && !last.selfClose) {
        const re = new RegExp('</' + last.name + '\\s*>', 'i'); const rest = src.slice(i); const m2 = rest.match(re);
        const idx = m2 ? m2.index : rest.length; toks.push({ t: 'raw', raw: rest.slice(0, idx) }); i += idx;
      }
    } else {
      let j = i + 1; while (j < src.length && !(src[j] === '<' && /^(?:[A-Za-z]|\/[A-Za-z]|!--)/.test(src.slice(j + 1, j + 4)))) j++;
      toks.push({ t: 'text', raw: src.slice(i, j) }); i = j;
    }
  }
  return toks;
}
function attrList(s) {
  const out = []; const re = /([^\s=/"'>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g; let m;
  while ((m = re.exec(s))) out.push(m[0]);
  return out;
}
const openTag = (n) => '<' + n.name + (n.attrs.length ? ' ' + n.attrs.join(' ') : '') + '>';

function parse(toks) {
  const root = { kids: [] }, stack = [root];
  for (const t of toks) {
    const top = stack[stack.length - 1];
    if (t.t === 'open') { const n = { name: t.name, attrs: t.attrs, kids: [], raw: null }; top.kids.push(n); if (!t.selfClose) stack.push(n); else n.void = true; if (t.slash) n.slash = true; }
    else if (t.t === 'close') { for (let k = stack.length - 1; k > 0; k--) if (stack[k].name === t.name) { stack.length = k; break; } }
    else if (t.t === 'raw') top.raw = t.raw;
    else if (t.t === 'comment') top.kids.push({ comment: t.raw });
    else { const txt = t.raw.replace(/\s+/g, ' ').trim(); if (txt) top.kids.push({ text: txt }); }
  }
  return root;
}
function emit(n, depth, out) {
  const pad = '  '.repeat(depth);
  if (n.comment) { out.push(pad + n.comment); return; }
  if (n.text !== undefined) { out.push(pad + n.text); return; }
  if (n.void) { out.push(pad + (n.slash ? openTag(n).slice(0, -1) + (n.attrs.length ? ' ' : ' ') + '/>' : openTag(n))); return; }
  const close = '</' + n.name + '>';
  if (n.raw !== null && n.raw !== undefined && VERBATIM.has(n.name)) { out.push(pad + openTag(n) + n.raw + close); return; }
  if (n.raw !== null && n.raw !== undefined) {
    const lines = n.raw.replace(/\s+$/, '').replace(/^\s*\n/, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length), Infinity);
    const body = lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0).replace(/\s+$/, ''));
    if (!body.join('').trim()) { out.push(pad + openTag(n) + close); return; }
    out.push(pad + openTag(n)); body.forEach((l) => out.push(l ? pad + '  ' + l : '')); out.push(pad + close); return;
  }
  if (!n.kids.length) { out.push(pad + openTag(n) + close); return; }
  if (n.kids.length === 1 && n.kids[0].text !== undefined) { out.push(pad + openTag(n) + n.kids[0].text + close); return; }
  out.push(pad + openTag(n)); n.kids.forEach((k) => emit(k, depth + 1, out)); out.push(pad + close);
}
export function format(src) {
  const root = parse(tokenize(String(src)));
  const out = []; root.kids.forEach((k) => emit(k, 0, out));
  return out.join('\n') + '\n';
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const { readFileSync } = await import('node:fs');
  process.stdout.write(format(readFileSync(process.argv[2] || 0, 'utf8')));
}
