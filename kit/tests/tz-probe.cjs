// run as a child process with TZ set: prints JSON of date behaviour so the test can assert per timezone
const { createSDK } = require('../src/sdk.cjs');
const now = new Date(2026, 10, 12, 23, 30).getTime();
const { app } = createSDK({ manifest: { tables: {} }, now: () => now, locale: 'en-US' });
console.log(JSON.stringify({
  dateOnly: app.fmt('2026-11-12', 'date'), jan1: app.fmt('2026-01-01', 'date'), prevYear: app.fmt('2025-12-31', 'date'),
  rel: app.fmt('2026-11-11', 'rel'), today: app.today(), tz: process.env.TZ,
}));
