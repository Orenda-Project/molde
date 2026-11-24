import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function tokenCounts(list) {
  const r = spawnSync('python3', [fileURLToPath(new URL('./tok.py', import.meta.url))], { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('tok.py failed: ' + r.stderr.slice(0, 300));
  return JSON.parse(r.stdout);
}
