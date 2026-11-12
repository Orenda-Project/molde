// Canonical formatter for mini-app body fragments (contract section 2): 2-space indent, block elements on their own lines,
// attributes unchanged (only the whitespace BETWEEN attributes is normalised, never inside one).
// Whitespace is meaning: a line break is only ever put where whitespace already existed, and inline content that touches
// ("$<b>5</b>kg") stays joined. Idempotent: format(format(x)) === format(x). Malformed input (an unterminated tag, quote,
// comment or raw element, a stray or mismatched closing tag, an unclosed element) throws a FormatError with a line number instead
// of being repaired into something else.
export class FormatError extends Error { constructor(msg, line) { super(msg + (line ? ' (line ' + line + ')' : '')); this.name = 'FormatError'; this.code = 'E_FORMAT'; this.line = line; } }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'pre']);
const VERBATIM = new Set(['textarea', 'pre']);
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data', 'del', 'em', 'i', 'img', 'input', 'ins', 'kbd', 'label', 'mark', 'output', 'q', 's', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'textarea', 'time', 'u', 'var', 'wbr']);
const isMarkup = (src, i) => /^(?:[A-Za-z]|\/[A-Za-z]|!--)/.test(src.slice(i + 1, i + 4));
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

function tokenize(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    if (src[i] === '<' && isMarkup(src, i)) {
      if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); if (e < 0) throw new FormatError('unterminated comment', lineOf(src, i)); toks.push({ t: 'comment', raw: src.slice(i, e + 3) }); i = e + 3; continue; }
      let j = i + 1, q = null;
      while (j < src.length) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
      if (j >= src.length) throw new FormatError(q ? 'unterminated quote in a tag' : 'unterminated tag', lineOf(src, i));
      const body = src.slice(i + 1, j);
      if (body[0] === '/') {
        const cn = body.slice(1).trim().toLowerCase();
        if (!/^[a-z][a-z0-9:-]*$/.test(cn)) throw new FormatError('invalid closing tag </' + cn.slice(0, 20) + '>', lineOf(src, i));
        toks.push({ t: 'close', name: cn, line: lineOf(src, i) });
      }
      else {
        const m = body.match(/^([A-Za-z][^\s/>]*)([\s\S]*?)\s*(\/?)$/);
        const name = m[1].toLowerCase();
        if (!/^[a-z][a-z0-9:-]*$/.test(name)) throw new FormatError('invalid tag name <' + name.slice(0, 20) + '>', lineOf(src, i));
        toks.push({ t: 'open', name, attrs: attrList(m[2], lineOf(src, i)), selfClose: m[3] === '/' || VOID.has(name), slash: m[3] === '/', line: lineOf(src, i) });
      }
      const open = i; i = j + 1;
      const last = toks[toks.length - 1];
      if (last.t === 'open' && RAW.has(last.name) && !last.selfClose) {
        const m2 = src.slice(i).match(new RegExp('</' + last.name + '\\s*>', 'i'));
        if (!m2) throw new FormatError('unterminated <' + last.name + '>', lineOf(src, open));
        toks.push({ t: 'raw', raw: src.slice(i, i + m2.index) }); i += m2.index;
      }
    } else {
      let j = i + 1; while (j < src.length && !(src[j] === '<' && isMarkup(src, j))) j++;
      toks.push({ t: 'text', raw: src.slice(i, j) }); i = j;
    }
  }
  return toks;
}
function attrList(s, line) {
  const out = []; const re = /([^\s=/"'>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g; let m;
  while ((m = re.exec(s))) out.push(m[0]);
  const left = s.replace(re, '').replace(/[\s/]+/g, '');
  if (left) throw new FormatError('malformed attribute near ' + JSON.stringify(left.slice(0, 12)), line);
  return out;
}
const openTag = (n) => '<' + n.name + (n.attrs.length ? ' ' + n.attrs.join(' ') : '') + '>';

function parse(toks) {
  const root = { kids: [] }, stack = [root];
  for (const t of toks) {
    const top = stack[stack.length - 1];
    if (t.t === 'open') { const n = { name: t.name, attrs: t.attrs, kids: [], raw: null, line: t.line }; top.kids.push(n); if (!t.selfClose) stack.push(n); else n.void = true; if (t.slash) n.slash = true; }
    else if (t.t === 'close') {
      const open = stack[stack.length - 1];
      if (stack.length > 1 && open.name === t.name) stack.pop();
      else if (stack.some((n, k) => k > 0 && n.name === t.name)) throw new FormatError('mismatched closing tag </' + t.name + '>: <' + open.name + '> (line ' + open.line + ') is still open', t.line);
      else throw new FormatError('stray closing tag </' + t.name + '> with no opening tag', t.line);
    }
    else if (t.t === 'raw') top.raw = t.raw;
    else if (t.t === 'comment') top.kids.push({ comment: t.raw });
    else {
      const body = t.raw.replace(/\s+/g, ' ').trim(), prev = top.kids[top.kids.length - 1];
      if (!body) { if (prev && prev.text !== undefined) prev.trail = true; else if (!prev || !prev.ws) top.kids.push({ ws: true }); }
      else if (prev && prev.text !== undefined) { prev.text += (prev.trail || /^\s/.test(t.raw) ? ' ' : '') + body; prev.trail = /\s$/.test(t.raw); } /* text split by a dropped tag is one text */
      else top.kids.push({ text: body, lead: /^\s/.test(t.raw) || !!(prev && prev.ws), trail: /\s$/.test(t.raw) });
    }
  }
  if (stack.length > 1) throw new FormatError('unclosed <' + stack[stack.length - 1].name + '>', stack[stack.length - 1].line);
  return root;
}
const isInline = (n) => n.text !== undefined || n.ws || (n.name && INLINE.has(n.name) && n.kids.every(isInline));
const voidTag = (n) => (n.slash ? openTag(n).slice(0, -1) + ' />' : openTag(n));

/** An inline element on one line. Spaces appear only where the source had whitespace. */
function inl(n) {
  if (n.void) return voidTag(n);
  if (n.raw !== null && n.raw !== undefined) return openTag(n) + n.raw + '</' + n.name + '>';
  let s = '';
  for (const k of n.kids) {
    if (k.ws) { if (!s.endsWith(' ')) s += ' '; }
    else if (k.text !== undefined) { if (k.lead && !s.endsWith(' ')) s += ' '; s += k.text; if (k.trail) s += ' '; }
    else if (k.comment) s += k.comment;
    else s += inl(k);
  }
  return openTag(n) + s + '</' + n.name + '>';
}

function emitKids(kids, depth, out) {
  const pad = '  '.repeat(depth); let cur = '', gap = false;
  const flush = () => { if (cur) out.push(pad + cur); cur = ''; };
  const add = (s) => { if (cur && gap) flush(); cur += s; gap = false; };
  for (const k of kids) {
    if (k.ws) { gap = true; continue; }
    if (k.text !== undefined) { if (k.lead) gap = true; add(k.text); if (k.trail) gap = true; continue; }
    if (k.comment) { flush(); out.push(pad + k.comment); gap = false; continue; }
    if (isInline(k)) { add(inl(k)); continue; }
    flush(); emit(k, depth, out); gap = false;
  }
  flush();
}
function emit(n, depth, out) {
  const pad = '  '.repeat(depth), close = '</' + n.name + '>';
  if (n.void) { out.push(pad + voidTag(n)); return; }
  if (n.raw !== null && n.raw !== undefined && VERBATIM.has(n.name)) { out.push(pad + openTag(n) + n.raw + close); return; }
  if (n.raw !== null && n.raw !== undefined) {
    const lines = n.raw.replace(/\s+$/, '').replace(/^\s*\n/, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length), Infinity);
    const body = lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0).replace(/\s+$/, ''));
    if (!body.join('').trim()) { out.push(pad + openTag(n) + close); return; }
    out.push(pad + openTag(n)); body.forEach((l) => out.push(l ? pad + '  ' + l : '')); out.push(pad + close); return;
  }
  const kids = n.kids.filter((k, i, a) => !(k.ws && (i === 0 || i === a.length - 1)));
  if (!kids.length) { out.push(pad + openTag(n) + close); return; }
  if (kids.length === 1 && kids[0].text !== undefined) { out.push(pad + openTag(n) + kids[0].text + close); return; }
  out.push(pad + openTag(n)); emitKids(kids, depth + 1, out); out.push(pad + close);
}
export function format(src) {
  const root = parse(tokenize(String(src)));
  const out = []; emitKids(root.kids, 0, out);
  return out.join('\n') + '\n';
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const { readFileSync } = await import('node:fs');
  try { process.stdout.write(format(readFileSync(process.argv[2] || 0, 'utf8'))); } catch (e) { if (e instanceof FormatError) { process.stderr.write(e.message + '\n'); process.exit(1); } throw e; }
}
