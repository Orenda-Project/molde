// Molde on-device model core: llama.cpp (b12144) with a per-call GBNF grammar, stop at newline, KV-cache reuse across
// calls, real special-token ids (<|tok:ID|> markers), a cancel flag, and DRAFT VERIFICATION for edits.
//
// Draft verification (prompt-lookup speculation, lossless for greedy decoding): an edit mostly re-emits the old program.
// The caller passes the old line it expects next as `draft`. After the prompt, the first sampled token is compared with
// the draft's first token; if equal, the whole draft line is evaluated in ONE batch (prompt-eval speed instead of one
// token per step) and each position is checked against what the grammar-constrained sampler would have produced. The
// line is accepted up to the first mismatch; the rest of the cache is rolled back and normal sampling continues from the
// token the sampler chose there. The result is the same text as without a draft (up to float noise between batch and
// single-token evaluation); only the time changes.
//
// No JNI in here: the same header is used by the Android library (molde_jni.cpp) and the host test server.
#pragma once
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include "llama.h"
#include "ggml-backend.h"

#ifdef __ANDROID__
#include <android/log.h>
#define MOLDE_LOGI(...) __android_log_print(ANDROID_LOG_INFO, "molde-llm", __VA_ARGS__)
#define MOLDE_LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "molde-llm", __VA_ARGS__)
#else
#define MOLDE_LOGI(...) do { fprintf(stderr, __VA_ARGS__); fprintf(stderr, "\n"); } while (0)
#define MOLDE_LOGE(...) do { fprintf(stderr, __VA_ARGS__); fprintf(stderr, "\n"); } while (0)
#endif

namespace molde {

struct Result {
  std::string stop = "limit", text, error;
  int n_prompt = 0, n_cache = 0, n_gen = 0, n_draft_try = 0, n_draft_ok = 0, n_full = 0;
  double ms_prompt = 0, ms_gen = 0, ms_full = 0;
};

inline std::string json_escape(const std::string & s) {
  std::string o; o.reserve(s.size() + 8);
  for (unsigned char c : s) {
    switch (c) {
      case '"': o += "\\\""; break; case '\\': o += "\\\\"; break;
      case '\n': o += "\\n"; break; case '\r': o += "\\r"; break; case '\t': o += "\\t"; break;
      default: if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; } else o += (char) c;
    }
  }
  return o;
}

inline std::string to_json(const Result & r) {
  char b[360];
  snprintf(b, sizeof b, "\",\"n_prompt\":%d,\"n_cache\":%d,\"n_gen\":%d,\"ms_prompt\":%.1f,\"ms_gen\":%.1f,\"n_full\":%d,\"ms_full\":%.1f,\"n_draft_try\":%d,\"n_draft_ok\":%d",
           r.n_prompt, r.n_cache, r.n_gen, r.ms_prompt, r.ms_gen, r.n_full, r.ms_full, r.n_draft_try, r.n_draft_ok);
  return "{\"stop\":\"" + r.stop + "\",\"text\":\"" + json_escape(r.text) + b + (r.error.empty() ? "" : ",\"error\":\"" + json_escape(r.error) + "\"") + "}";
}

using clk = std::chrono::steady_clock;
inline double ms_since(clk::time_point t) { return std::chrono::duration<double, std::milli>(clk::now() - t).count(); }

struct Core {
  llama_model * model = nullptr;
  llama_context * ctx = nullptr;
  const llama_vocab * vocab = nullptr;
  std::vector<llama_token> cached;     // tokens whose K/V are in the cache
  int n_ctx = 0, n_batch = 512;
  std::atomic<bool> cancel{false};
  bool backends_loaded = false;

  std::string load(const std::string & path, const std::string & libdir, int nctx, int threads, bool use_mmap) {
    unload();
    if (!backends_loaded) {
      llama_log_set([](ggml_log_level lvl, const char * text, void *) { if (lvl >= GGML_LOG_LEVEL_WARN) MOLDE_LOGE("%s", text); }, nullptr);
      ggml_backend_load_all_from_path(libdir.c_str());
      llama_backend_init();
      backends_loaded = true;
    }
    llama_model_params mp = llama_model_default_params();
    // anonymous memory instead of mmap: on a phone short of RAM, file-backed model pages are dropped and re-read from flash on every token
    mp.load_mode = use_mmap ? LLAMA_LOAD_MODE_MMAP : LLAMA_LOAD_MODE_NONE;
    model = llama_model_load_from_file(path.c_str(), mp);
    if (!model) return "could not load the model file (not a GGUF this build can read, or out of memory)";
    vocab = llama_model_get_vocab(model);
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = nctx; cp.n_batch = n_batch; cp.n_ubatch = n_batch;
    cp.n_threads = threads; cp.n_threads_batch = threads;
    cp.swa_full = true;            // cheap rollback of the cache at a line boundary
    ctx = llama_init_from_model(model, cp);
    if (!ctx) { llama_model_free(model); model = nullptr; return "could not create the model context (out of memory?)"; }
    n_ctx = (int) llama_n_ctx(ctx);
    MOLDE_LOGI("loaded %s n_ctx=%d threads=%d vocab=%d", path.c_str(), n_ctx, threads, llama_vocab_n_tokens(vocab));
    return "";
  }
  void unload() {
    if (ctx) { llama_free(ctx); ctx = nullptr; }
    if (model) { llama_model_free(model); model = nullptr; }
    cached.clear();
  }
  void reset() { if (ctx) llama_memory_clear(llama_get_memory(ctx), true); cached.clear(); }

  bool tokenize_text(const std::string & seg, std::vector<llama_token> & out) {
    std::vector<llama_token> t(seg.size() + 8);
    int n = llama_tokenize(vocab, seg.c_str(), (int) seg.size(), t.data(), (int) t.size(), false, false);
    if (n < 0) { t.resize(-n); n = llama_tokenize(vocab, seg.c_str(), (int) seg.size(), t.data(), (int) t.size(), false, false); }
    if (n < 0) return false;
    out.insert(out.end(), t.begin(), t.begin() + n);
    return true;
  }
  // Prompt = text with <|tok:ID|> markers for special tokens. Text pieces are tokenised without special parsing.
  bool build_tokens(const std::string & prompt, std::vector<llama_token> & out) {
    size_t i = 0;
    while (i < prompt.size()) {
      size_t m = prompt.find("<|tok:", i);
      size_t end = (m == std::string::npos) ? prompt.size() : m;
      if (end > i && !tokenize_text(prompt.substr(i, end - i), out)) return false;
      if (m == std::string::npos) break;
      size_t close = prompt.find("|>", m);
      if (close == std::string::npos) return false;
      out.push_back((llama_token) atoi(prompt.substr(m + 6, close - m - 6).c_str()));
      i = close + 2;
    }
    return true;
  }

  // Evaluates toks[from..] in chunks of 32 and records each chunk in `cached`, so a Cancel is seen within a chunk and
  // the cache always matches what was decoded. 0 = done, 1 = decode error, 2 = cancelled.
  int eval_tokens(const std::vector<llama_token> & toks, size_t from) {
    size_t i = from;
    while (i < toks.size()) {
      if (cancel) return 2;
      size_t n = std::min((size_t) 32, toks.size() - i);
      llama_batch b = llama_batch_get_one(const_cast<llama_token *>(toks.data() + i), (int32_t) n);
      if (llama_decode(ctx, b) != 0) return 1;
      cached.insert(cached.end(), toks.begin() + i, toks.begin() + i + n);
      i += n;
    }
    return 0;
  }

  // Decodes `dt` in one batch with logits at every position. The tokens are NOT added to `cached` here.
  bool eval_draft(const std::vector<llama_token> & dt) {
    llama_batch b = llama_batch_init((int32_t) dt.size(), 0, 1);
    for (size_t i = 0; i < dt.size(); i++) {
      b.token[i] = dt[i]; b.pos[i] = (llama_pos) (cached.size() + i);
      b.n_seq_id[i] = 1; b.seq_id[i][0] = 0; b.logits[i] = true;
    }
    b.n_tokens = (int32_t) dt.size();
    int rc = llama_decode(ctx, b);
    llama_batch_free(b);
    return rc == 0;
  }

  Result complete(const std::string & prompt, const std::string & grammar, int n_predict, float temp, int seed, bool stop_nl, const std::string & draft = "") {
    Result R;
    cancel = false;
    if (!ctx) { R.stop = "error"; R.error = "no model loaded"; return R; }
    std::vector<llama_token> toks;
    if (!build_tokens(prompt, toks) || toks.empty()) { R.stop = "error"; R.error = "tokenization failed"; return R; }
    if ((int) toks.size() + 8 >= n_ctx) { R.stop = "error"; R.error = "prompt too long for the context"; R.n_prompt = (int) toks.size(); return R; }

    auto t0 = clk::now();
    // common prefix with the cache; keep at least the last prompt token to evaluate (we need its logits)
    size_t common = 0;
    while (common < toks.size() && common < cached.size() && toks[common] == cached[common]) common++;
    if (common >= toks.size()) common = toks.size() - 1;
    llama_memory_t mem = llama_get_memory(ctx);
    if (common < cached.size()) {
      if (!llama_memory_seq_rm(mem, 0, (llama_pos) common, -1)) { llama_memory_clear(mem, true); common = 0; }
      cached.resize(common);
    }
    int rc = eval_tokens(toks, common);
    R.n_cache = (int) common;
    if (rc == 2) { R.stop = "cancel"; R.n_prompt = (int) (cached.size() - common); R.ms_prompt = ms_since(t0); return R; }
    if (rc != 0) { cached.clear(); llama_memory_clear(mem, true); R.stop = "error"; R.error = "decode failed (prompt)"; return R; }
    R.n_prompt = (int) (toks.size() - common);
    R.ms_prompt = ms_since(t0);

    // samplers: the chain is applied first (cheap); the grammar only filters the sampled token, and
    // only when that token is invalid is the whole vocabulary filtered (same as llama.cpp's server)
    llama_sampler * chain = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (temp > 0.f) {
      llama_sampler_chain_add(chain, llama_sampler_init_top_k(40));
      llama_sampler_chain_add(chain, llama_sampler_init_top_p(0.95f, 1));
      llama_sampler_chain_add(chain, llama_sampler_init_temp(temp));
      llama_sampler_chain_add(chain, llama_sampler_init_dist((uint32_t) seed));
    } else {
      llama_sampler_chain_add(chain, llama_sampler_init_greedy());
    }
    llama_sampler * gram = grammar.empty() ? nullptr : llama_sampler_init_grammar(vocab, grammar.c_str(), "root");
    if (!grammar.empty() && !gram) { llama_sampler_free(chain); R.stop = "error"; R.error = "grammar did not parse"; return R; }

    const int n_vocab = llama_vocab_n_tokens(vocab);
    std::vector<llama_token_data> cand(n_vocab);
    // the token the sampler picks from the logits at output `idx` (grammar-valid), not yet accepted by the grammar
    auto sample_tok = [&](int idx) -> llama_token {
      llama_token id = llama_sampler_sample(chain, ctx, idx);
      if (gram) {
        llama_token_data one = { id, 1.0f, 0.0f };
        llama_token_data_array arr = { &one, 1, -1, false };
        llama_sampler_apply(gram, &arr);
        if (one.logit == -INFINITY) {               // grammar rejects it: filter the full distribution
          auto tf = clk::now();
          const float * logits = llama_get_logits_ith(ctx, idx);
          for (int k = 0; k < n_vocab; k++) cand[k] = { k, logits[k], 0.0f };
          llama_token_data_array full = { cand.data(), (size_t) n_vocab, -1, false };
          llama_sampler_apply(gram, &full);
          llama_sampler_apply(chain, &full);
          id = full.selected >= 0 ? full.data[full.selected].id : full.data[0].id;
          R.n_full++; R.ms_full += ms_since(tf);
        }
      }
      return id;
    };
    auto accept = [&](llama_token id) { if (gram) llama_sampler_accept(gram, id); };
    auto piece_of = [&](llama_token id) { char buf[256]; int n = llama_token_to_piece(vocab, id, buf, sizeof buf, 0, false); return n > 0 ? std::string(buf, n) : std::string(); };

    // the draft: tokens of the expected line plus its newline (greedy only)
    std::vector<llama_token> dt;
    if (!draft.empty() && temp <= 0.f && stop_nl) {
      tokenize_text(draft + "\n", dt);
      if (dt.size() < 2 || (int) (cached.size() + dt.size()) + 8 >= n_ctx) dt.clear();
    }

    std::string & text = R.text;
    bool have_pending = false; llama_token pending = 0;
    bool draft_tried = dt.empty();
    auto t1 = clk::now();
    for (int i = 0; i < n_predict; ) {
      if (cancel) { R.stop = "cancel"; break; }
      llama_token id;
      if (have_pending) { id = pending; have_pending = false; } else id = sample_tok(-1);
      accept(id);
      if (llama_vocab_is_eog(vocab, id)) { R.stop = "eos"; break; }
      text += piece_of(id);
      R.n_gen++; i++;
      if (stop_nl) {
        size_t nl = text.find('\n');
        if (nl != std::string::npos) { text.resize(nl); R.stop = "stop"; break; }   // the newline token is not evaluated; the next call starts from the common prefix
      }
      // draft verification: the first generated token matches the draft's first token -> evaluate the whole line at once
      if (!draft_tried) {
        draft_tried = true;
        if (id == dt[0]) {
          R.n_draft_try++;
          const size_t base = cached.size();
          if (!eval_draft(dt)) { R.stop = "error"; R.error = "decode failed (draft)"; break; }
          size_t kept = dt.size();                 // tokens of the draft that stay in the cache
          bool stopped = false, mismatch = false;
          for (size_t j = 1; j < dt.size(); j++) {
            if (cancel) { R.stop = "cancel"; stopped = true; kept = j; break; }
            llama_token t = sample_tok((int) j - 1);
            if (t == dt[j]) {
              accept(t);
              if (llama_vocab_is_eog(vocab, t)) { R.stop = "eos"; stopped = true; kept = j; break; }
              text += piece_of(t); R.n_gen++; i++; R.n_draft_ok++;
              size_t nl = text.find('\n');
              if (nl != std::string::npos) { text.resize(nl); R.stop = "stop"; stopped = true; kept = dt.size(); break; }
            } else {                               // the model wants something else here: keep the first j draft tokens, go on from `t`
              pending = t; have_pending = true; kept = j; mismatch = true; break;
            }
          }
          // cache: the draft tokens up to `kept` are in; the others are rolled back
          if (kept < dt.size()) {
            if (llama_memory_seq_rm(mem, 0, (llama_pos) (base + kept), -1)) {
              cached.insert(cached.end(), dt.begin(), dt.begin() + kept);
            } else {                               // cannot roll back partially: rebuild the cache up to the kept tokens
              std::vector<llama_token> full = toks; full.insert(full.end(), dt.begin(), dt.begin() + kept);
              llama_memory_clear(mem, true); cached.clear();
              if (eval_tokens(full, 0) != 0) { R.stop = "error"; R.error = "decode failed (rebuild)"; break; }
            }
          } else {
            cached.insert(cached.end(), dt.begin(), dt.end());
          }
          if (stopped) break;
          if (mismatch) continue;                 // pending token processed at the top of the loop
          continue;
        }
      }
      llama_batch b = llama_batch_get_one(&id, 1);
      if (llama_decode(ctx, b) != 0) { R.stop = "error"; break; }
      cached.push_back(id);
      if ((int) cached.size() + 4 >= n_ctx) { R.stop = "limit"; break; }
    }
    R.ms_gen = ms_since(t1);
    if (gram) llama_sampler_free(gram);
    llama_sampler_free(chain);
    if (R.stop == "error") { cached.clear(); llama_memory_clear(mem, true); }
    MOLDE_LOGI("complete: stop=%s prompt_eval=%d cached=%d gen=%d draft=%d/%d ms_prompt=%.0f ms_gen=%.0f full_vocab_filters=%d (%.0f ms)", R.stop.c_str(), R.n_prompt, R.n_cache, R.n_gen, R.n_draft_ok, R.n_draft_try, R.ms_prompt, R.ms_gen, R.n_full, R.ms_full);
    return R;
  }
};

}  // namespace molde
