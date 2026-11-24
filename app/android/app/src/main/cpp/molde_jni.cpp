// Molde on-device model: a thin JNI layer over llama.cpp (b12144).
// What the Flutter plugin llama_flutter_android 0.2.6 cannot do and this does:
//   1. a GBNF grammar per call (the grammar changes every program line),
//   2. stop at the first newline,
//   3. KV-cache reuse across calls (only tokens after the common prefix are evaluated),
//   4. real special-token ids in the prompt (turn markers) via <|tok:ID|> segments,
//   5. a cancel flag checked after every token.
#include <jni.h>
#include <android/log.h>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>
#include "llama.h"
#include "ggml-backend.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "molde-llm", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "molde-llm", __VA_ARGS__)

namespace {
llama_model * g_model = nullptr;
llama_context * g_ctx = nullptr;
const llama_vocab * g_vocab = nullptr;
std::vector<llama_token> g_cached;   // tokens whose K/V are in the cache
int g_n_ctx = 0, g_n_batch = 512;
std::atomic<bool> g_cancel{false};
bool g_backends_loaded = false;

using clk = std::chrono::steady_clock;
double ms_since(clk::time_point t) { return std::chrono::duration<double, std::milli>(clk::now() - t).count(); }

std::string jstr(JNIEnv * env, jbyteArray a) {
  if (!a) return {};
  jsize n = env->GetArrayLength(a);
  std::string s(n, '\0');
  env->GetByteArrayRegion(a, 0, n, reinterpret_cast<jbyte *>(&s[0]));
  return s;
}
jbyteArray tobytes(JNIEnv * env, const std::string & s) {
  jbyteArray a = env->NewByteArray((jsize) s.size());
  env->SetByteArrayRegion(a, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
  return a;
}
std::string jesc(const std::string & s) {
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
std::string result(const char * stop, const std::string & text, int n_prompt, int n_cache, int n_gen, double ms_p, double ms_g, const std::string & err = "") {
  char b[256];
  snprintf(b, sizeof b, "\",\"n_prompt\":%d,\"n_cache\":%d,\"n_gen\":%d,\"ms_prompt\":%.1f,\"ms_gen\":%.1f", n_prompt, n_cache, n_gen, ms_p, ms_g);
  return std::string("{\"stop\":\"") + stop + "\",\"text\":\"" + jesc(text) + b + (err.empty() ? "" : ",\"error\":\"" + jesc(err) + "\"") + "}";
}

// Prompt = text with <|tok:ID|> markers for special tokens. Text pieces are tokenised without special parsing.
bool build_tokens(const std::string & prompt, std::vector<llama_token> & out) {
  size_t i = 0;
  while (i < prompt.size()) {
    size_t m = prompt.find("<|tok:", i);
    size_t end = (m == std::string::npos) ? prompt.size() : m;
    if (end > i) {
      std::string seg = prompt.substr(i, end - i);
      std::vector<llama_token> t(seg.size() + 8);
      int n = llama_tokenize(g_vocab, seg.c_str(), (int) seg.size(), t.data(), (int) t.size(), false, false);
      if (n < 0) { t.resize(-n); n = llama_tokenize(g_vocab, seg.c_str(), (int) seg.size(), t.data(), (int) t.size(), false, false); }
      if (n < 0) return false;
      out.insert(out.end(), t.begin(), t.begin() + n);
    }
    if (m == std::string::npos) break;
    size_t close = prompt.find("|>", m);
    if (close == std::string::npos) return false;
    out.push_back((llama_token) atoi(prompt.substr(m + 6, close - m - 6).c_str()));
    i = close + 2;
  }
  return true;
}

bool eval_tokens(const std::vector<llama_token> & toks, size_t from) {
  size_t i = from;
  while (i < toks.size()) {
    size_t n = std::min((size_t) g_n_batch, toks.size() - i);
    llama_batch b = llama_batch_get_one(const_cast<llama_token *>(toks.data() + i), (int32_t) n);
    if (llama_decode(g_ctx, b) != 0) return false;
    i += n;
  }
  return true;
}
}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL Java_com_oyekamal_molde_NativeLlm_nativeLoad(JNIEnv * env, jobject, jstring jpath, jstring jlibdir, jint n_ctx, jint n_threads) {
  const char * path = env->GetStringUTFChars(jpath, nullptr);
  const char * libdir = env->GetStringUTFChars(jlibdir, nullptr);
  std::string p = path, ld = libdir;
  env->ReleaseStringUTFChars(jpath, path); env->ReleaseStringUTFChars(jlibdir, libdir);
  if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
  if (g_model) { llama_model_free(g_model); g_model = nullptr; }
  g_cached.clear();
  if (!g_backends_loaded) {
    llama_log_set([](ggml_log_level lvl, const char * text, void *) { if (lvl >= GGML_LOG_LEVEL_WARN) LOGE("%s", text); }, nullptr);
    ggml_backend_load_all_from_path(ld.c_str());
    llama_backend_init();
    g_backends_loaded = true;
  }
  llama_model_params mp = llama_model_default_params();
  g_model = llama_model_load_from_file(p.c_str(), mp);
  if (!g_model) return env->NewStringUTF("could not load the model file (not a GGUF this build can read, or out of memory)");
  g_vocab = llama_model_get_vocab(g_model);
  llama_context_params cp = llama_context_default_params();
  cp.n_ctx = n_ctx; cp.n_batch = g_n_batch; cp.n_ubatch = g_n_batch;
  cp.n_threads = n_threads; cp.n_threads_batch = n_threads;
  cp.swa_full = true;            // cheap rollback of the cache at a line boundary
  g_ctx = llama_init_from_model(g_model, cp);
  if (!g_ctx) { llama_model_free(g_model); g_model = nullptr; return env->NewStringUTF("could not create the model context (out of memory?)"); }
  g_n_ctx = (int) llama_n_ctx(g_ctx);
  LOGI("loaded %s n_ctx=%d threads=%d vocab=%d", p.c_str(), g_n_ctx, n_threads, llama_vocab_n_tokens(g_vocab));
  return env->NewStringUTF("");
}

JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeUnload(JNIEnv *, jobject) {
  if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
  if (g_model) { llama_model_free(g_model); g_model = nullptr; }
  g_cached.clear();
}
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeCancel(JNIEnv *, jobject) { g_cancel = true; }
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeReset(JNIEnv *, jobject) {
  if (g_ctx) llama_memory_clear(llama_get_memory(g_ctx), true);
  g_cached.clear();
}

// Returns JSON bytes: {stop: eos|stop|limit|cancel|error, text, n_prompt, n_cache, n_gen, ms_prompt, ms_gen}
JNIEXPORT jbyteArray JNICALL Java_com_oyekamal_molde_NativeLlm_nativeComplete(JNIEnv * env, jobject, jbyteArray jprompt, jbyteArray jgrammar,
                                                                              jint n_predict, jfloat temp, jint seed, jboolean stop_nl) {
  g_cancel = false;
  if (!g_ctx) return tobytes(env, result("error", "", 0, 0, 0, 0, 0, "no model loaded"));
  std::string prompt = jstr(env, jprompt), grammar = jstr(env, jgrammar);
  std::vector<llama_token> toks;
  if (!build_tokens(prompt, toks) || toks.empty()) return tobytes(env, result("error", "", 0, 0, 0, 0, 0, "tokenization failed"));
  if ((int) toks.size() + 8 >= g_n_ctx) return tobytes(env, result("error", "", (int) toks.size(), 0, 0, 0, 0, "prompt too long for the context"));

  auto t0 = clk::now();
  // common prefix with the cache; keep at least the last prompt token to evaluate (we need its logits)
  size_t common = 0;
  while (common < toks.size() && common < g_cached.size() && toks[common] == g_cached[common]) common++;
  if (common >= toks.size()) common = toks.size() - 1;
  llama_memory_t mem = llama_get_memory(g_ctx);
  if (common < g_cached.size()) {
    if (!llama_memory_seq_rm(mem, 0, (llama_pos) common, -1)) { llama_memory_clear(mem, true); common = 0; }
    g_cached.resize(common);
  }
  if (!eval_tokens(toks, common)) { g_cached.clear(); llama_memory_clear(mem, true); return tobytes(env, result("error", "", (int) toks.size(), 0, 0, 0, 0, "decode failed (prompt)")); }
  g_cached = toks;
  int n_prompt_eval = (int) (toks.size() - common);
  double ms_p = ms_since(t0);

  // samplers: the chain is applied first (cheap); the grammar only filters the sampled token, and
  // only when that token is invalid is the whole vocabulary filtered (same as llama.cpp's server)
  llama_sampler_chain_params sp = llama_sampler_chain_default_params();
  llama_sampler * chain = llama_sampler_chain_init(sp);
  if (temp > 0.f) {
    llama_sampler_chain_add(chain, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(chain, llama_sampler_init_top_p(0.95f, 1));
    llama_sampler_chain_add(chain, llama_sampler_init_temp(temp));
    llama_sampler_chain_add(chain, llama_sampler_init_dist((uint32_t) seed));
  } else {
    llama_sampler_chain_add(chain, llama_sampler_init_greedy());
  }
  llama_sampler * gram = grammar.empty() ? nullptr : llama_sampler_init_grammar(g_vocab, grammar.c_str(), "root");
  if (!grammar.empty() && !gram) { llama_sampler_free(chain); return tobytes(env, result("error", "", 0, 0, 0, 0, 0, "grammar did not parse")); }

  const int n_vocab = llama_vocab_n_tokens(g_vocab);
  std::vector<llama_token_data> cand(n_vocab);
  std::string text;      // raw bytes generated so far
  std::string stop = "limit";
  int n_gen = 0;
  auto t1 = clk::now();
  for (int i = 0; i < n_predict; i++) {
    if (g_cancel) { stop = "cancel"; break; }
    llama_token id = llama_sampler_sample(chain, g_ctx, -1);
    if (gram) {
      llama_token_data one = { id, 1.0f, 0.0f };
      llama_token_data_array arr = { &one, 1, -1, false };
      llama_sampler_apply(gram, &arr);
      if (one.logit == -INFINITY) {               // grammar rejects it: filter the full distribution
        const float * logits = llama_get_logits_ith(g_ctx, -1);
        for (int k = 0; k < n_vocab; k++) cand[k] = { k, logits[k], 0.0f };
        llama_token_data_array full = { cand.data(), (size_t) n_vocab, -1, false };
        llama_sampler_apply(gram, &full);
        llama_sampler_apply(chain, &full);
        id = full.selected >= 0 ? full.data[full.selected].id : full.data[0].id;
      }
      llama_sampler_accept(gram, id);
    }
    if (llama_vocab_is_eog(g_vocab, id)) { stop = "eos"; break; }
    char buf[256];
    int n = llama_token_to_piece(g_vocab, id, buf, sizeof buf, 0, false);
    if (n > 0) text.append(buf, n);
    n_gen++;
    if (stop_nl) {
      size_t nl = text.find('\n');
      if (nl != std::string::npos) { text.resize(nl); stop = "stop"; break; }  // the newline token is not evaluated; the next call starts from the common prefix
    }
    llama_batch b = llama_batch_get_one(&id, 1);
    if (llama_decode(g_ctx, b) != 0) { stop = "error"; break; }
    g_cached.push_back(id);
    if ((int) g_cached.size() + 4 >= g_n_ctx) { stop = "limit"; break; }
  }
  double ms_g = ms_since(t1);
  if (gram) llama_sampler_free(gram);
  llama_sampler_free(chain);
  if (stop == "error") { g_cached.clear(); llama_memory_clear(mem, true); }
  return tobytes(env, result(stop.c_str(), text, n_prompt_eval, (int) common, n_gen, ms_p, ms_g));
}

}  // extern "C"
