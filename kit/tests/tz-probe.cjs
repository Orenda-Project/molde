// run as a child process with TZ set: prints JSON of date behaviour so the test can assert per timezone
const { createSDK } = require('../src/sdk.cjs');
const now = new Date(2026, 10, 12, 23, 30).getTime();
const { app } = createSDK({ manifest: { tables: {} }, now: () => now, locale: 'en-US' });
const m = { tables: { x: { n: 'num' } } }; const at2 = (y, mo, d, h = 12) => new Date(y, mo, d, h).getTime();
const b = createSDK({ manifest: m, now: () => new Date(2026, 2, 1, 0, 30).getTime() }); const x = b.store.t('x');
x.add({ n: 100, at: at2(2026, 1, 20) }); x.add({ n: 1, at: at2(2026, 1, 28, 23) }); x.add({ n: 10, at: new Date(2026, 2, 1, 0, 10).getTime() });
const boundary = { month: x.sum('n', { since: 'month' }), week: x.sum('n', { since: 'week' }), last7: x.sum('n', { since: 'last7' }), series: x.series('n', { by: 'month', last: 2 }).map((r) => r.k + ':' + r.v), today: b.app.today() };
console.log(JSON.stringify({ boundary,
  dateOnly: app.fmt('2026-11-12', 'date'), jan1: app.fmt('2026-01-01', 'date'), prevYear: app.fmt('2025-12-31', 'date'),
  rel: app.fmt('2026-11-11', 'rel'), today: app.today(), tz: process.env.TZ,
}));
