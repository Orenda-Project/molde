// JNI surface over molde_core.h (all the model logic lives there, shared with the host test server).
#include <jni.h>
#include "molde_core.h"

namespace {
molde::Core g_core;

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

// Returns JSON bytes: {stop: eos|stop|limit|cancel|error, text, n_prompt, n_cache, n_gen, ms_prompt, ms_gen, n_draft_try, n_draft_ok, ...}
JNIEXPORT jbyteArray JNICALL Java_com_oyekamal_molde_NativeLlm_nativeComplete(JNIEnv * env, jobject, jbyteArray jprompt, jbyteArray jgrammar,
                                                                              jint n_predict, jfloat temp, jint seed, jboolean stop_nl, jbyteArray jdraft) {
  molde::Result r = g_core.complete(jstr(env, jprompt), jstr(env, jgrammar), n_predict, temp, seed, stop_nl, jstr(env, jdraft));
  return tobytes(env, molde::to_json(r));
}

}  // extern "C"
