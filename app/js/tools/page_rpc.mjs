// The page's check/evaluate for a host-side test: reads {"method","before","source"} from env MOLDE_RPC (or stdin), prints the reply as JSON.
// (The Dart harness test/app_path_measure_test.dart calls it for every page call, so the app's real Dart flow runs over the real checker.)
import { readFileSync } from 'node:fs';
import { load } from '../vendor/lang/eval.mjs';
import { check } from '../vendor/lang/check.mjs';
import { evaluateEdit } from '../src/evaluate.mjs';
const { method, before, source } = JSON.parse(process.env.MOLDE_RPC || readFileSync(0, 'utf8'));
let out;
if (method === 'check') { const c = check(source); out = { ok: c.ok, errors: c.errors.map(String) }; }
else if (method === 'evaluate') { const a = load(before, { now: Date.now(), currency: 'Rs', tz: 'local' }); out = evaluateEdit(a, source); }
else out = { error: 'unknown method ' + method };
process.stdout.write(JSON.stringify(out));
