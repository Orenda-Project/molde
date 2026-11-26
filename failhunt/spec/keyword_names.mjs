// A table named like a modifier word breaks `quick`. node spec/keyword_names.mjs   (APPJS=/path/to/app/js to override)
const { check } = await import((process.env.APPJS || '/tmp/molde-app/app/js') + '/vendor/lang/check.mjs');
const t = n => `app "P" car slate\ntable ${n} litres num 1..80, cost money = 0\nquick ${n}, litres, [10, 20, 40]\nform ${n}\n`;
for (const n of ['fuel','fill','color','stroke','width','height','radius','opacity','align','pad','tap','swipe','thick','sort','where','by','as','month','week','today','day','days','top','card','label','size','gap','grow','small','big','head','faint','line','text','icon','bold','empty','last','all','year','prev']) { const c = check(t(n)); console.log(n.padEnd(8), c.ok ? 'ok' : String(c.errors[0]).slice(0, 110)); }
