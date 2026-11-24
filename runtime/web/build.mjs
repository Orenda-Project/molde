// Builds runtime/web/dist/molde-demo.html: one self-contained file (all JS, CSS and program
// sources inlined; no network requests, no external fonts). Usage: node runtime/web/build.mjs
//
// The bundler is deliberately tiny: it handles the module forms this repo uses (named imports
// on one line, `export const|let|function|class`, `export { a, b }`). Each module becomes a
// function scope; modules are emitted in dependency order. No eval, no new Function.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const WEB = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(WEB, '../..');
const DEMO = join(WEB, 'demo');

const mods = new Map();   // abs path -> { name, code, deps }
let n = 0;
function addModule(file) {
  if (mods.has(file)) return mods.get(file);
  const src = readFileSync(file, 'utf8');
  const m = { name: `__m${n++}`, file, deps: [], code: '' };
  mods.set(file, m);
  const exportsList = [];
  let body = src.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm, (all, names, spec) => {
    const dep = addModule(resolve(dirname(file), spec));
    m.deps.push(dep);
    const binds = names.split(',').map(s => s.trim()).filter(Boolean).map(s => { const [a, b] = s.split(/\s+as\s+/); return b ? `${a}: ${b}` : a; });
    return `const { ${binds.join(', ')} } = ${dep.name};`;
  });
  if (/^\s*import\s/m.test(body)) throw new Error(`unsupported import form in ${relative(ROOT, file)}`);
  body = body.replace(/^export\s+\{([^}]*)\};?[ \t]*$/gm, (all, names) => { for (const s of names.split(',').map(x => x.trim()).filter(Boolean)) { const [a, b] = s.split(/\s+as\s+/); exportsList.push(b ? `${b}: ${a}` : a); } return ''; });
  body = body.replace(/^export\s+(async\s+function\*?|function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (all, kw, name) => { exportsList.push(name); return `${kw} ${name}`; });
  if (/^\s*export\s/m.test(body)) throw new Error(`unsupported export form in ${relative(ROOT, file)}`);
  m.code = `// ${relative(ROOT, file)}\nconst ${m.name} = (() => {\n${body}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
  return m;
}
const entry = addModule(join(DEMO, 'main.mjs'));
const order = []; const seen = new Set();
(function visit(m) { if (seen.has(m)) return; seen.add(m); m.deps.forEach(visit); order.push(m); })(entry);

// program sources, edit pairs
const { CATALOG } = await import(join(DEMO, 'catalog.mjs'));
const { EDIT_FILES } = await import(join(DEMO, 'requests.mjs'));
const sources = {};
// PROGRAMS=dir builds the same demo over other copies of the programs (same file names), e.g. lang/examples/demo15
for (const c of CATALOG) sources[c.id] = readFileSync(process.env.PROGRAMS ? join(ROOT, process.env.PROGRAMS, c.src.replace('programs/', '')) : resolve(DEMO, c.src), 'utf8');
for (const e of EDIT_FILES) for (const [k, f] of [['before', 'before.mo'], ['after', 'after.mo'], ['request', 'request.txt']]) sources[`edit:${e}:${k}`] = readFileSync(join(ROOT, 'lang/examples/edits', e, f), 'utf8');

const js = order.map(m => m.code).join('\n') +
  `\nconst SOURCES = ${JSON.stringify(sources)};\n${entry.name}.start(document.getElementById('demo'), SOURCES);\n`;
const script = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const css = readFileSync(join(WEB, 'molde.css'), 'utf8') + '\n' + readFileSync(join(DEMO, 'demo.css'), 'utf8');
const sha = s => "'sha256-" + createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const csp = `default-src 'none'; script-src ${sha(script)}; style-src ${sha(css)}; img-src data:; base-uri 'none'; form-action 'none'`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Molde live demo</title>
<link rel="icon" href="data:,">
<style>${css}</style>
</head>
<body>
<div id="demo"></div>
<script type="module">${script}</script>
</body>
</html>
`;
mkdirSync(join(WEB, 'dist'), { recursive: true });
const out = join(WEB, 'dist', process.env.OUT || 'molde-demo.html');
writeFileSync(out, html);
console.log(`${relative(ROOT, out)}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, ${order.length} modules, ${CATALOG.length} programs, ${EDIT_FILES.length} edit pairs`);
