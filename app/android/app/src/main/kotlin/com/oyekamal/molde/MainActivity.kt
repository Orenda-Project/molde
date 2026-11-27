package com.oyekamal.molde

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Handler
import android.os.StatFs
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
    private var worker = Executors.newSingleThreadExecutor()
    // the model call in flight, so a hung native call can be abandoned (see NativeLlm.nativeAbandon)
    @Volatile private var inflightId = 0L
    private var inflightReply: java.util.concurrent.atomic.AtomicBoolean? = null
    private var inflightResult: MethodChannel.Result? = null
    private var callCounter = 0L
    // measured milliseconds per generated token on this device (moving average); a call with no progress for 40 tokens' time is stuck
    private var msPerToken = 1500.0
    private fun idleAllowanceMs(): Long = (msPerToken * 40).toLong().coerceIn(90_000L, 180_000L)
    private fun learnSpeed(json: String) {
        val n = Regex("\"n_gen\":\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toDoubleOrNull() ?: return
        val ms = Regex("\"ms_gen\":\\s*([0-9.]+)").find(json)?.groupValues?.get(1)?.toDoubleOrNull() ?: return
        if (n >= 3 && ms > 0) msPerToken = 0.7 * msPerToken + 0.3 * (ms / n)
    }
    private val hangJson = "{\"stop\":\"cancel\",\"text\":\"\",\"hung\":true}"

    /** The call stopped answering: answer it now, give the engine a fresh core and a fresh worker thread; the old thread frees its core when (if) it returns. */
    private fun abandon(id: Long) {
        if (inflightId != id) return
        val replied = inflightReply ?: return
        val res = inflightResult ?: return
        if (!replied.compareAndSet(false, true)) return
        inflightId = 0L
        try { engine().nativeAbandon() } catch (_: Throwable) {}
        val old = worker
        worker = Executors.newSingleThreadExecutor()
        old.shutdown()
        res.success(hangJson)
    }
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
            "dlNotify" -> {
                val i = Intent(this, DownloadService::class.java)
                    .putExtra("title", call.argument<String>("title") ?: "Molde")
                    .putExtra("text", call.argument<String>("text") ?: "")
                    .putExtra("pct", call.argument<Number>("pct")?.toInt() ?: -1)
                try { if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i); result.success(true) }
                catch (e: Throwable) { result.success(false) }
            }
            "dlStop" -> { stopService(Intent(this, DownloadService::class.java)); result.success(null) }
            "freeSpace" -> {
                val path = call.argument<String>("path") ?: filesDir.absolutePath
                try { val f = java.io.File(path); f.mkdirs(); result.success(StatFs(f.absolutePath).availableBytes) }
                catch (e: Throwable) { result.success(StatFs(filesDir.absolutePath).availableBytes) }
            }
            "networkType" -> {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val caps = cm.getNetworkCapabilities(cm.activeNetwork)
                result.success(when {
                    caps == null -> "none"
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "wifi"
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
                    else -> "other"
                })
            }
            "requestNotifications" -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                    requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 77)
                result.success(null)
            }
            "openUrl" -> {
                try { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(call.argument<String>("url") ?: "")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); result.success(true) }
                catch (e: Throwable) { result.success(false) }
            }
            "meta" -> {
                val key = call.argument<String>("key") ?: ""
                result.success(try { engine().nativeMeta(key) } catch (e: Throwable) { "" })
            }
            "progress" -> result.success(try { engine().nativeProgress() } catch (e: Throwable) { "idle,0,0,0" })
            "cancel" -> {
                llm?.nativeCancel()
                val id = inflightId
                // a native call that still has not returned 20 s after a cancel is stuck: abandon it
                if (id != 0L) main.postDelayed({ abandon(id) }, 20000)
                result.success(null)
            }
            "debugHang" -> { engine().nativeDebugHang(call.argument<Number>("ms")?.toInt() ?: 120000); result.success(null) }
            "load" -> {
                val path = call.argument<String>("path")!!
                val nCtx = call.argument<Number>("nCtx")?.toInt() ?: 2048
                val threads = call.argument<Number>("threads")?.toInt() ?: 4
                worker.execute {
                    val out = try { engine().nativeLoad(path, applicationInfo.nativeLibraryDir, nCtx, threads, call.argument<Boolean>("mmap") ?: false) }
                    catch (e: Throwable) { "native library failed: ${e.message}" }
                    main.post { result.success(out) }
                }
            }
            "complete" -> {
                val prompt = (call.argument<String>("prompt") ?: "").toByteArray(Charsets.UTF_8)
                val grammar = (call.argument<String>("grammar") ?: "").toByteArray(Charsets.UTF_8)
                val nPredict = call.argument<Number>("nPredict")?.toInt() ?: 200
                val temp = (call.argument<Number>("temp")?.toFloat() ?: 0f)
                val seed = call.argument<Number>("seed")?.toInt() ?: 1
                val stopNl = call.argument<Boolean>("stopNl") ?: true
                val draft = (call.argument<String>("draft") ?: "").toByteArray(Charsets.UTF_8)
                val id = ++callCounter
                val replied = java.util.concurrent.atomic.AtomicBoolean(false)
                inflightId = id; inflightReply = replied; inflightResult = result
                // no call may run longer than 6 minutes, and none may go without progress (a token or a prompt chunk) for longer than
                // 40 tokens' worth of this device's measured speed (90 to 180 s): that is a hang, not a slow line
                // an edit written as one operations answer (format ops) is a single call: the page passes a longer cap and a longer idle
                // allowance for it (a slow phone reads the whole app before the first token)
                val capMs = (call.argument<Number>("capMs")?.toLong() ?: (6 * 60 * 1000L)).coerceIn(60_000L, 20 * 60 * 1000L)
                val idleMin = (call.argument<Number>("idleMs")?.toLong() ?: 0L).coerceIn(0L, 20 * 60 * 1000L)
                main.postDelayed({ abandon(id) }, capMs)
                val watch = object : Runnable {
                    override fun run() {
                        if (inflightId != id) return
                        val idle = try { engine().nativeIdleMs() } catch (_: Throwable) { -1L }
                        if (idle > maxOf(idleAllowanceMs(), idleMin)) abandon(id) else main.postDelayed(this, 3000)
                    }
                }
                main.postDelayed(watch, 3000)
                worker.execute {
                    val out = try { String(engine().nativeComplete(prompt, grammar, nPredict, temp, seed, stopNl, draft), Charsets.UTF_8) }
                    catch (e: Throwable) { "{\"stop\":\"error\",\"text\":\"\",\"error\":\"${e.message?.replace("\"", "'")}\"}" }
                    main.post { learnSpeed(out); if (replied.compareAndSet(false, true)) { if (inflightId == id) inflightId = 0L; result.success(out) } }
                }
            }
            "reset" -> worker.execute { try { engine().nativeReset() } catch (_: Throwable) {}; main.post { result.success(null) } }
            "unload" -> worker.execute { try { engine().nativeUnload() } catch (_: Throwable) {}; main.post { result.success(null) } }
            else -> result.notImplemented()
        }
    }

    override fun onDestroy() { llm?.nativeCancel(); super.onDestroy() }
}
