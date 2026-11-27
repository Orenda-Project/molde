// JNI surface over molde_core.h (all the model logic lives there, shared with the host test server).
#include <jni.h>
#include "molde_core.h"

#include <atomic>
#include <chrono>
#include <mutex>
#include <thread>

namespace {
// The current core. A native call that hangs (seen in the failure hunt: 3 in 1,400 calls, 100% CPU, no token, cancel flag never
// read) cannot be interrupted, so the Kotlin side abandons it: nativeAbandon() installs a fresh core and the stuck call keeps its
// old one until it returns by itself, then frees it.
std::atomic<molde::Core *> g_core_p{new molde::Core()};
std::mutex g_mu;
std::atomic<long> g_hang_ms{0};   // test hook: the next complete() blocks this long and ignores cancel (developer menu)
#define g_core (*g_core_p.load())

std::string jstr(JNIEnv * env, jbyteArray a) {
  if (!a) return {};
  jsize n = env->GetArrayLength(a);
  std::string s(n, '\0');
  if (n) env->GetByteArrayRegion(a, 0, n, reinterpret_cast<jbyte *>(&s[0]));
  return s;
}
jbyteArray tobytes(JNIEnv * env, const std::string & s) {
  jbyteArray a = env->NewByteArray((jsize) s.size());
  env->SetByteArrayRegion(a, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
  return a;
}
}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL Java_com_oyekamal_molde_NativeLlm_nativeLoad(JNIEnv * env, jobject, jstring jpath, jstring jlibdir, jint n_ctx, jint n_threads, jboolean use_mmap) {
  const char * path = env->GetStringUTFChars(jpath, nullptr);
  const char * libdir = env->GetStringUTFChars(jlibdir, nullptr);
  std::string p = path, ld = libdir;
  env->ReleaseStringUTFChars(jpath, path); env->ReleaseStringUTFChars(jlibdir, libdir);
  return env->NewStringUTF(g_core.load(p, ld, n_ctx, n_threads, use_mmap).c_str());
}
JNIEXPORT jstring JNICALL Java_com_oyekamal_molde_NativeLlm_nativeMeta(JNIEnv * env, jobject, jstring jkey) {
  const char * k = env->GetStringUTFChars(jkey, nullptr);
  std::string key = k;
  env->ReleaseStringUTFChars(jkey, k);
  return env->NewStringUTF(g_core.meta(key).c_str());
}
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeUnload(JNIEnv *, jobject) { g_core.unload(); }
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeCancel(JNIEnv *, jobject) { g_core.cancel = true; }
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeReset(JNIEnv *, jobject) { g_core.reset(); }
JNIEXPORT jlong JNICALL Java_com_oyekamal_molde_NativeLlm_nativeIdleMs(JNIEnv *, jobject) { return (jlong) g_core.idle_ms(); }
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeDebugHang(JNIEnv *, jobject, jint ms) { g_hang_ms = ms; }
JNIEXPORT void JNICALL Java_com_oyekamal_molde_NativeLlm_nativeAbandon(JNIEnv *, jobject) {
  std::lock_guard<std::mutex> lk(g_mu);
  molde::Core * old = g_core_p.load();
  molde::Core * fresh = new molde::Core();
  fresh->backends_loaded = old->backends_loaded;
  old->cancel = true;
  g_core_p = fresh;
}

// Returns JSON bytes: {stop: eos|stop|limit|cancel|error, text, n_prompt, n_cache, n_gen, ms_prompt, ms_gen, n_draft_try, n_draft_ok, ...}
JNIEXPORT jbyteArray JNICALL Java_com_oyekamal_molde_NativeLlm_nativeComplete(JNIEnv * env, jobject, jbyteArray jprompt, jbyteArray jgrammar,
                                                                              jint n_predict, jfloat temp, jint seed, jboolean stop_nl, jbyteArray jdraft) {
  molde::Core * c = g_core_p.load();
  std::string prompt = jstr(env, jprompt), grammar = jstr(env, jgrammar), draft = jstr(env, jdraft);
  long hang = g_hang_ms.exchange(0);
  if (hang > 0) { c->in_call = true; c->tick(); std::this_thread::sleep_for(std::chrono::milliseconds(hang)); c->in_call = false; }   // simulated stuck call: cancel is ignored, no progress
  molde::Result r;
  bool abandoned;
  { std::lock_guard<std::mutex> lk(g_mu); abandoned = c != g_core_p.load(); }
  if (abandoned) r.stop = "cancel";
  else r = c->complete(prompt, grammar, n_predict, temp, seed, stop_nl, draft);
  { std::lock_guard<std::mutex> lk(g_mu); abandoned = c != g_core_p.load(); }
  if (abandoned) { c->unload(); delete c; }   // the caller already answered "hung"; this old core is not used any more
  return tobytes(env, molde::to_json(r));
}

}  // extern "C"
