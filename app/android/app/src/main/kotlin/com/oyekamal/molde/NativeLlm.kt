package com.oyekamal.molde

/** JNI surface of libmolde_llm.so (see src/main/cpp/molde_jni.cpp). */
class NativeLlm {
    companion object {
        init { System.loadLibrary("molde_llm") }
    }
    external fun nativeLoad(path: String, libDir: String, nCtx: Int, nThreads: Int, useMmap: Boolean): String
    external fun nativeMeta(key: String): String
    external fun nativeUnload()
    external fun nativeCancel()
    external fun nativeReset()
    external fun nativeDebugHang(ms: Int)
    external fun nativeAbandon()
    external fun nativeIdleMs(): Long
    external fun nativeComplete(prompt: ByteArray, grammar: ByteArray, nPredict: Int, temp: Float, seed: Int, stopNl: Boolean, draft: ByteArray): ByteArray
}
