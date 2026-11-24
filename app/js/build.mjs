// Bundles entry.mjs (+ vendored lang/, render/, decode/) into ../assets/web/molde.js (one classic script) and copies the CSS.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V = join(HERE, 'vendor');
const OUT = resolve(HERE, '../assets/web');
mkdirSync(OUT, { recursive: true });
const gbnf = join(V, 'lang/moldescript.gbnf');
if (!existsSync(gbnf)) throw new Error('vendor/ is empty: run app/tool/sync-js.sh first');

// the decoder was written for Node (readFileSync of the grammar); in the WebView the grammar text is embedded
const nodeShim = {
  name: 'node-shim',
  setup(b) {
    b.onResolve({ filter: /^node:fs$/ }, () => ({ path: 'node:fs', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
      contents: `import gbnf from ${JSON.stringify(gbnf)};
export function readFileSync(p) { if (String(p).endsWith('moldescript.gbnf')) return gbnf; throw new Error('no file access in the WebView: ' + p); }`,
      loader: 'js', resolveDir: HERE,
    }));
  },
};
const r = await build({
  entryPoints: [join(HERE, 'src/entry.mjs')],
  bundle: true, format: 'iife', target: ['chrome80'], platform: 'browser',
  outfile: join(OUT, 'molde.js'), minify: true, legalComments: 'none',
  loader: { '.gbnf': 'text' },
  define: { 'import.meta.url': '"file:///molde/decode/linegram.mjs"' },
  plugins: [nodeShim], logLevel: 'warning', metafile: true,
});
copyFileSync(join(V, 'render/molde.css'), join(OUT, 'molde.css'));
copyFileSync(join(HERE, 'VERSIONS.txt'), join(OUT, 'VERSIONS.txt'));
// the 15 example programs of the web demo (loaded from the developer menu, no model needed)
const ex = join(OUT, '../examples'); mkdirSync(ex, { recursive: true });
const progs = join(V, 'render/demo/programs');
const names = [];
for (const f of readdirSync(progs).filter(f => f.endsWith('.mo')).sort()) { copyFileSync(join(progs, f), join(ex, f)); names.push(f); }
// the renderer branch's programs follow an older spelling than the language head: rewrite them (idempotent)
for (const f of names) execFileSync('node', [join(V, 'lang/mo.mjs'), 'migrate', join(ex, f), '--write'], { stdio: 'pipe' });
for (const f of names) { const out = execFileSync('node', [join(V, 'lang/mo.mjs'), 'check', join(ex, f)], { stdio: 'pipe' }).toString(); if (!/^OK/.test(out)) throw new Error('example ' + f + ' does not pass the checker: ' + out); }
writeFileSync(join(ex, 'INDEX.json'), JSON.stringify(names, null, 1));
const kb = Math.round(readFileSync(join(OUT, 'molde.js')).length / 1024);
console.log(`bundle: assets/web/molde.js ${kb} KB, ${names.length} example programs`);
