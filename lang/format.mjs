// Canonical formatter: two spaces per indentation level, single spaces between tokens with
// fixed exceptions (see lex.mjs join), no blank lines, comments kept, one final newline.
// The output is exactly the text the GBNF accepts, and format(format(x)) === format(x).
import { splitLines } from './parse.mjs';
import { lex, join } from './lex.mjs';

export function format(src) {
  const { lines } = splitLines(src);
  const out = [];
  for (const ln of lines) {
    if (ln.comment) { out.push(ln.comment); continue; }
    let body;
    try { body = join(lex(ln.body)); } catch { body = ln.body; }
    out.push('  '.repeat(ln.depth) + body);
  }
  return out.join('\n') + '\n';
}
