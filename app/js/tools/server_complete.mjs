// The app's `complete(req)` over llama-server's /completion (same grammar, stop at newline, cache_prompt), for
// measuring the app's real generation loop on a laptop. Prompt `<|tok:ID|>` markers become token ids.
export function makeComplete(port = 8341) {
  return async function complete(req) {
    const parts = req.prompt.split(/<\|tok:(\d+)\|>/);
    const prompt = [];
    parts.forEach((p, i) => { if (i % 2) prompt.push(+p); else if (p) prompt.push(p); });
    const body = { prompt, grammar: req.grammar, temperature: req.temp, seed: req.seed, n_predict: req.nPredict, cache_prompt: true };
    if (req.stopNl) body.stop = ['\n'];
    if (req.temp > 0) { body.top_k = 40; body.top_p = 0.95; }
    const r = await fetch(`http://127.0.0.1:${port}/completion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return { stop: 'error', text: '', error: `server ${r.status}` };
    const d = await r.json(); const t = d.timings || {};
    const stop = d.truncated || d.stop_type === 'limit' ? 'limit' : d.stop_type === 'eos' ? 'eos' : 'stop';
    return { stop, text: d.content || '', n_gen: t.predicted_n ?? d.tokens_predicted, ms_gen: t.predicted_ms || 0, n_prompt: t.prompt_n || 0, ms_prompt: t.prompt_ms || 0, n_cache: t.cache_n || 0 };
  };
}
