// parse hand/*.txt. Records separated by a line "===".
//   @create style=detailed domain=pizza
//   request text (one line)
//   ---
//   program
// edits:  @edit ... / request / --- before / program / --- after / program
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { canon, diff, load } from './lib.mjs';
const DIR = process.env.HAND_DIR || new URL('../hand/', import.meta.url).pathname;
export function readHand(opts = {}) {
  const out = [], fails = [], byDomain = {};
  if (!existsSync(DIR)) return { out, fails };
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.txt') && (!opts.only || opts.only.endsWith(f) || !opts.only.endsWith('.txt') && true)).sort()) {
    const recs = readFileSync(DIR + f, 'utf8').split(/^===\s*$/m).map(x => x.trim()).filter(Boolean);
    recs.forEach((rec, n) => {
      const lines = rec.split('\n');
      const m = lines[0].match(/^@(create|edit|ask|oos)\s*(.*)$/);
      if (!m) { fails.push({ f, n, why: 'no header' }); return; }
      const meta = Object.fromEntries([...m[2].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
      const request = lines[1].trim();
      const rest = lines.slice(2).join('\n');
      const parts = rest.split(/^---.*$/m).map(x => x.trim()).filter(Boolean);
      const id = `${f}#${n}`;
      if (m[1] === 'edit') {
        let bsrc, asrc;
        if (meta.ref) {
          bsrc = byDomain[meta.ref];
          if (!bsrc) { fails.push({ id, why: 'unknown ref ' + meta.ref }); return; }
          let t = bsrc;
          for (const pl of (parts[0] || '').split('\n').filter(Boolean)) {
            if (pl.startsWith('+after ')) { const [ln, nw] = pl.slice(7).split(' :: '); const L = t.replace(/\n$/, '').split('\n'); const i = L.indexOf(ln); if (i < 0) { fails.push({ id, why: 'patch anchor not found: ' + ln }); return; } L.splice(i + 1, 0, ...nw.split('\\n')); t = L.join('\n') + '\n'; }
            else if (pl.startsWith('+ ')) t = t.replace(/\n$/, '') + '\n' + pl.slice(2).split('\\n').join('\n') + '\n';
            else if (pl.startsWith('- ')) { const L = t.replace(/\n$/, '').split('\n'); const i = L.indexOf(pl.slice(2)); if (i < 0) { fails.push({ id, why: 'patch delete not found: ' + pl }); return; } L.splice(i, 1); t = L.join('\n') + '\n'; }
            else if (pl.startsWith('~ ')) { const [o0, nw0] = pl.slice(2).split(' => '); const o = o0.split('\\n').join('\n'), nw = nw0.split('\\n').join('\n'); if (!t.includes(o)) { fails.push({ id, why: 'patch replace not found: ' + o }); return; } t = t.replace(o, nw); }
          }
          asrc = t;
        } else {
          if (parts.length < 2) { fails.push({ id, why: 'edit needs before and after' }); return; }
          bsrc = parts[0]; asrc = parts[1];
        }
        const b = canon(bsrc.endsWith('\n') ? bsrc : bsrc + '\n'), a = canon(asrc.endsWith('\n') ? asrc : asrc + '\n');
        if (!b.ok || !a.ok) { fails.push({ id, request, why: (b.errors || a.errors).slice(0, 2).join(' | ') }); return; }
        const v = diff([b.text], a.text);
        if (v.verdict === 'refused') { fails.push({ id, request, why: 'diff refused: ' + JSON.stringify(v.changes || '').slice(0, 150) }); return; }
        out.push({ task: 'edit', request, before: b.text, program: a.text, style: meta.style || 'plain', domain: meta.domain || 'hand', method: 'hand-edit', verdict: v.verdict, id });
      } else {
        const c = canon(parts[0] + '\n');
        if (!c.ok) { fails.push({ id, request, why: c.errors.slice(0, 2).join(' | ') }); return; }
        if (meta.domain) byDomain[meta.domain] = c.text;
        out.push({ task: 'create', request, program: c.text, style: meta.style || 'detailed', domain: meta.domain || 'hand', method: m[1] === 'oos' ? 'hand-oos' : m[1] === 'ask' ? 'hand-ask' : 'hand', id, oos: meta.oos });
      }
    });
  }
  return { out, fails };
}
