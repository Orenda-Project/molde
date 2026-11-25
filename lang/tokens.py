#!/usr/bin/env python3
"""Token counts for MoldeScript programs, two ways.

(a) stock: the Qwen3.5-2B tokenizer as is (tokenizer.json from the Hugging Face cache,
    or $QWEN_TOKENIZER_DIR), the same file the v1 kit tests use.
(b) keyword: the planned tokenizer, measured for real: a copy of the same tokenizer with the
    MoldeScript tokens added (every keyword, function word such as `sum(`, std component name
    and newline+indentation that the stock tokenizer would split). Everything else (names,
    labels, numbers, texts) is cut by the stock BPE exactly as the model would see it.

Usage: python3 lang/tokens.py [--json] [--md] [files...]   (default: lang/examples/*.mo)
"""
import glob, json, os, re, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def find_tokenizer():
    d = os.environ.get('QWEN_TOKENIZER_DIR')
    if d and os.path.exists(os.path.join(d, 'tokenizer.json')):
        return os.path.join(d, 'tokenizer.json')
    hits = glob.glob(os.path.expanduser('~/.cache/huggingface/hub/models--Qwen--Qwen3.5-2B/snapshots/*/tokenizer.json'))
    if not hits:
        sys.exit('Qwen3.5-2B tokenizer.json not found (set QWEN_TOKENIZER_DIR)')
    return hits[0]


from tokenizers import Tokenizer, AddedToken  # noqa: E402

TOK_PATH = find_tokenizer()
TOK = Tokenizer.from_file(TOK_PATH)
ADDED = json.load(open(os.path.join(HERE, 'grammar', 'added-tokens.json')))


def stock(text):
    return len(TOK.encode(text, add_special_tokens=False).ids)


def planned_additions():
    """Tokens we would add: every grammar literal or std name that the stock tokenizer splits
    (with or without a leading space), plus newline+indentation for each depth. Literals that
    are already one token (table, text, ' each', '=', ...) are left to BPE: adding them would
    only break merges such as '.ml'."""
    add = []
    for lit in ADDED['literals'] + ADDED['std']:
        for form in (' ' + lit, lit):
            if stock(form) > 1:
                add.append(form)
    for ind in ADDED['indents']:
        add.append('\n' + ind)
    return sorted(set(add), key=lambda x: (-len(x), x))


PLANNED = Tokenizer.from_file(TOK_PATH)
PLANNED_ADDS = planned_additions()
PLANNED.add_tokens([AddedToken(t, normalized=False) for t in PLANNED_ADDS])


def keyword_count(text):
    """Count with the planned tokenizer (stock Qwen3.5 + the added MoldeScript tokens)."""
    return len(PLANNED.encode(text, add_special_tokens=False).ids)


def pct(xs, p):
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def v1_fixture_tokens():
    """app.html + app.json token counts of the v1 kit fixtures (PR #33 branch task-02-kit)."""
    out = {}
    roots = [os.environ.get('MOLDE_V1_FIXTURES', ''), '/tmp/molde-t02j/kit/fixtures']
    root = next((r for r in roots if r and os.path.isdir(r)), None)
    for name in ['water', 'habits', 'exercise', 'budget', 'journal']:
        txt = None
        if root:
            try:
                txt = open(os.path.join(root, name, 'app.html')).read() + open(os.path.join(root, name, 'app.json')).read()
            except OSError:
                txt = None
        if txt is None:
            import subprocess
            try:
                git = lambda p: subprocess.run(['git', '-C', HERE, 'show', 'origin/task-02-kit:kit/fixtures/%s/%s' % (name, p)], capture_output=True, text=True, check=True).stdout
                txt = git('app.html') + git('app.json')
            except Exception:
                txt = None
        if txt is not None:
            out[name] = stock(txt)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    files = args or sorted(glob.glob(os.path.join(HERE, 'examples', '*.mo')))
    index = {}
    ip = os.path.join(HERE, 'examples', 'INDEX.json')
    if os.path.exists(ip):
        index = {e['file']: e for e in json.load(open(ip))}
    rows = []
    for f in files:
        text = open(f, encoding='utf-8').read()
        base = os.path.basename(f)
        rows.append({'file': base, 'style': index.get(base, {}).get('style', '?'), 'fixture': index.get(base, {}).get('fixture'),
                     'lines': len([l for l in text.split('\n') if l.strip()]), 'stock': stock(text), 'keyword': keyword_count(text)})
    v1 = v1_fixture_tokens()

    def stats(rs, key):
        xs = [r[key] for r in rs]
        if not xs:
            return None
        return {'n': len(xs), 'median': statistics.median(xs), 'p90': round(pct(xs, 0.9), 1), 'max': max(xs)}

    summary = {}
    for label, rs in [('all', rows), ('std', [r for r in rows if r['style'] == 'std']), ('custom', [r for r in rows if r['style'] == 'custom'])]:
        summary[label] = {'keyword': stats(rs, 'keyword'), 'stock': stats(rs, 'stock')}
    ratios = []
    for r in rows:
        if r['fixture'] and r['fixture'] in v1:
            ratios.append({'app': r['fixture'], 'v1_html_json_stock': v1[r['fixture']], 'mo_stock': r['stock'], 'mo_keyword': r['keyword'],
                           'ratio_stock': round(v1[r['fixture']] / r['stock'], 2), 'ratio_keyword': round(v1[r['fixture']] / r['keyword'], 2)})
    result = {'rows': rows, 'summary': summary, 'v1': ratios}
    if '--json' in sys.argv:
        print(json.dumps(result, indent=1))
        return
    print('Planned added tokens (%d): %s' % (len(PLANNED_ADDS), ' '.join(repr(t) for t in PLANNED_ADDS)))
    print()
    print('| program | style | lines | stock Qwen3.5 | planned (keywords as 1 token) |')
    print('|---|---|---:|---:|---:|')
    for r in rows:
        print('| %s | %s | %d | %d | %d |' % (r['file'], r['style'], r['lines'], r['stock'], r['keyword']))
    print()
    print('| set | count | keyword median | p90 | max | stock median | p90 | max |')
    print('|---|---:|---:|---:|---:|---:|---:|---:|')
    for label, s in summary.items():
        if s['keyword']:
            k, st = s['keyword'], s['stock']
            print('| %s | %d | %g | %g | %d | %g | %g | %d |' % (label, k['n'], k['median'], k['p90'], k['max'], st['median'], st['p90'], st['max']))
    if ratios:
        print()
        print('| v1 fixture | v1 app.html+app.json (stock) | MoldeScript stock | MoldeScript keyword | ratio stock | ratio keyword |')
        print('|---|---:|---:|---:|---:|---:|')
        for x in ratios:
            print('| %s | %d | %d | %d | %.2fx | %.2fx |' % (x['app'], x['v1_html_json_stock'], x['mo_stock'], x['mo_keyword'], x['ratio_stock'], x['ratio_keyword']))
        tv = sum(x['v1_html_json_stock'] for x in ratios)
        ts = sum(x['mo_stock'] for x in ratios)
        tk = sum(x['mo_keyword'] for x in ratios)
        print('| **total** | %d | %d | %d | %.2fx | %.2fx |' % (tv, ts, tk, tv / ts, tv / tk))


if __name__ == '__main__':
    main()
