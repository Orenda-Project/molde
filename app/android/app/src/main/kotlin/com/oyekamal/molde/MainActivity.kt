package com.oyekamal.molde

import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors

/**
 * Channel "molde/llm": load / complete / cancel / reset / unload / info.
 * Model work runs on one worker thread; cancel only sets a flag and may be called at any time.
 */
class MainActivity : FlutterActivity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var llm: NativeLlm? = null

    private fun engine(): NativeLlm {
        var l = llm
        if (l == null) { l = NativeLlm(); llm = l }
        return l
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "molde/llm").setMethodCallHandler { call, result -> handle(call, result) }
    }

    private fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "info" -> result.success(mapOf(
                "libDir" to applicationInfo.nativeLibraryDir,
                "abi" to android.os.Build.SUPPORTED_ABIS.toList(),
                "cores" to Runtime.getRuntime().availableProcessors(),
                "externalFiles" to (getExternalFilesDir(null)?.absolutePath ?: ""),
            ))
            "cancel" -> { llm?.nativeCancel(); result.success(null) }
            "load" -> {
                val path = call.argument<String>("path")!!
                val nCtx = call.argument<Int>("nCtx") ?: 2048
                val threads = call.argument<Int>("threads") ?: 4
                worker.execute {
                    val out = try { engine().nativeLoad(path, applicationInfo.nativeLibraryDir, nCtx, threads) }
                    catch (e: Throwable) { "native library failed: ${e.message}" }
                    main.post { result.success(out) }
                }
            }
            "complete" -> {
                val prompt = (call.argument<String>("prompt") ?: "").toByteArray(Charsets.UTF_8)
                val grammar = (call.argument<String>("grammar") ?: "").toByteArray(Charsets.UTF_8)
                val nPredict = call.argument<Int>("nPredict") ?: 200
                val temp = (call.argument<Double>("temp") ?: 0.0).toFloat()
                val seed = call.argument<Int>("seed") ?: 1
                val stopNl = call.argument<Boolean>("stopNl") ?: true
                worker.execute {
                    val out = try { String(engine().nativeComplete(prompt, grammar, nPredict, temp, seed, stopNl), Charsets.UTF_8) }
                    catch (e: Throwable) { "{\"stop\":\"error\",\"text\":\"\",\"error\":\"${e.message?.replace("\"", "'")}\"}" }
                    main.post { result.success(out) }
                }
            }
            "reset" -> worker.execute { try { engine().nativeReset() } catch (_: Throwable) {}; main.post { result.success(null) } }
            "unload" -> worker.execute { try { engine().nativeUnload() } catch (_: Throwable) {}; main.post { result.success(null) } }
            else -> result.notImplemented()
        }
    }

    override fun onDestroy() { llm?.nativeCancel(); super.onDestroy() }
}
