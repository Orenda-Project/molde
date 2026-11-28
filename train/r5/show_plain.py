import json,sys
for l in open(sys.argv[1]):
    d=json.loads(l)
    if 'chain' not in d or 'forced' not in d or 'chg' not in d: print(d['label'].ljust(15),'(not all sets finished)', [k for k in ('chg','chain','forced') if k in d]); continue
    c=d['chain']['bylen']
    print(d['label'].ljust(15),'chg',d['chg']['good'],'/40 | chain',d['chain']['right'],'/321 (short',c['short'][0],'/',c['short'][1],'long',c['long'][0],'/',c['long'][1],') | forced',d['forced']['right'],'/296')
