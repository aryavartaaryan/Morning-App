package com.solrize

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.*
import android.widget.Toast
import java.io.File

// Vibration API
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

// WindowManager overlay (Phase 4)
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Shared abstract base for AlarmSoundService (wake-up alarm) and
 * HabitAlarmSoundService (habit / quick alarms).
 *
 * Centralises all duplicated logic so every fix — wake lock upgrade,
 * native vibration (Phase 3), WindowManager overlay (Phase 4) — only
 * needs to be applied here once and automatically benefits all three
 * alarm types.
 *
 * Subclasses implement the abstract contract below to supply
 * alarm-type-specific config (deep-link URI, prefs key, notification
 * content, sound path, etc.).
 */
abstract class AlarmSoundServiceBase : Service() {

    companion object {
        val ALARM_FORCE_STOP = java.util.concurrent.atomic.AtomicBoolean(false)
        /** Intent action: start the hardware vibration pattern from the running service. */
        const val ACTION_START_VIBRATION = "com.solrize.START_ALARM_VIBRATION"
        /** Intent action: stop the hardware vibration pattern from the running service. */
        const val ACTION_STOP_VIBRATION  = "com.solrize.STOP_ALARM_VIBRATION"
        /** Intent action: release the native MediaPlayer while keeping the alarm service alive. */
        const val ACTION_STOP_AUDIO = "com.solrize.STOP_ALARM_AUDIO"
        /**
         * Intent action: remove the TYPE_APPLICATION_OVERLAY window.
         * Sent from JS (AlarmModule / HabitAlarmModule) the moment the React Native
         * alarm screen has fully mounted, so the native overlay is no longer needed.
         */
        const val ACTION_DISMISS_OVERLAY = "com.solrize.DISMISS_ALARM_OVERLAY"
    }

    // ── Shared mutable state ──────────────────────────────────────────────────

    protected var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var vibrator: Vibrator? = null
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null

    /**
     * BUG 1 FIX: Guard flag that prevents the lifecycle watchdog and the
     * 200 ms bring-to-front runnable from being registered more than ONCE
     * per service instance lifetime.
     *
     * Without this guard, every onStartCommand() call (fresh alarm, START_STICKY
     * null-intent restart, or any action-intent delivery) re-registered both
     * watchdogs on top of the ones from the previous call. The bringToFrontRunnable
     * is a self-re-posting Runnable (fires every 200 ms) — with N accumulated
     * registrations it runs at N × frequency, all on the main/JS thread.
     * This caused the cumulative typing lag and timer stutter on 2nd+ alarms.
     *
     * Reset to false in onDestroy() so the next service instance starts clean.
     */
    @Volatile private var watchdogsRegistered = false

    /**
     * Large title shown on the native overlay, e.g. "⏰  Arise Wake Alarm" or "🌿  Yoga".
     * Called after onLoadParams() so habit params are already populated.
     */
    abstract fun getOverlayTitle(): String

    /**
     * Secondary line shown under the title, e.g. instructions or alarm label.
     */
    abstract fun getOverlayBody(): String

    /**
     * True after the FIRST launchApp() call so subsequent bringToFront
     * calls use a plain MainActivity intent instead of the deep-link URI.
     * Deep-link URIs cause Expo Router to re-process the route, re-mounting
     * the alarm screen and restarting audio playback.
     */
    protected var alarmScreenLaunched = false

    /**
     * Accurate foreground flag tracked by the ActivityLifecycleCallbacks
     * watchdog. Avoids the deprecated / restricted getRunningAppProcesses()
     * API (broken on Android 11+).
     */
    @Volatile protected var mainActivityResumed = false

    // ── Abstract contract — each subclass must implement these ────────────────

    /**
     * Returns true while this alarm is currently active.
     * Reads the alarm-type-specific SharedPreferences flag.
     */
    abstract fun isAlarmActive(): Boolean

    /**
     * Deep-link URI for the FIRST launchApp() call.
     * Expo Router uses this to navigate to the correct alarm screen
     * (e.g. "solrize://alarm-ringing" or
     *  "solrize://habit-alarm-ringing?habitKey=…").
     */
    abstract fun buildDeepLinkUri(): Uri

    /** FGS notification shown in the shade while the alarm is ringing. */
    abstract fun buildNotification(): Notification

    /** Intent action string for volume-duck requests (avoids service restart). */
    abstract fun getActionSetVolume(): String

    /** Float-extra key used together with getActionSetVolume(). */
    abstract fun getExtraVolumeKey(): String

    /** Notification ID passed to startForeground() — must be unique per subclass. */
    abstract fun getNotifId(): Int

    /**
     * PendingIntent request code for the onTaskRemoved AlarmManager self-restart.
     * Must differ between subclasses so PendingIntents don't overwrite each other.
     */
    abstract fun getRestartRequestCode(): Int

    /**
     * Load any subclass-specific data from the incoming Intent or from
     * SharedPreferences on a START_STICKY null-intent restart.
     * Called at the top of onStartCommand() before any other work.
     */
    abstract fun onLoadParams(intent: Intent?)

    /**
     * Return the absolute file-system path of the audio file to play,
     * or null to fall back to the bundled mantra_alarm.wav raw resource.
     */
    abstract fun getSoundPath(): String?

    /**
     * Write the alarm-active flag to SharedPreferences BEFORE launchApp()
     * fires, so MainActivity.isAlarmActive() returns true on the very first
     * onResume() call.
     */
    abstract fun markAlarmActive()

    /**
     * Create the NotificationChannel for this alarm type.
     * Called once from onCreate() — subclasses supply their own
     * channel ID, name and attributes.
     */
    abstract fun createNotificationChannel()

    // ── Primary watchdog: ActivityLifecycleCallbacks ──────────────────────────
    //
    // Fires the instant MainActivity.onPause() is called (HOME press, recent-
    // apps, incoming call, etc.). Calling startActivity() here is always
    // allowed — no Background Activity Launch (BAL) restrictions because the
    // Activity is still in the running state at the point onPause() fires.
    private val lifecycleWatchdog = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(a: Activity) {
            if (a is MainActivity) mainActivityResumed = true
        }
        override fun onActivityPaused(activity: Activity) {
            if (activity is MainActivity) {
                mainActivityResumed = false
                // ROOT CAUSE FIX: Return immediately when alarm is stopping.
                // Navigation transitions (router.replace) cause onActivityPaused
                // to fire. Without this early return, this watchdog races the
                // bringToFrontRunnable — both try to call launchApp() — making
                // the alarm screen appear frozen/unresponsive after long ringing.
                if (isAlarmStopping()) return
                // Guard: never bring-to-front if the alarm is being stopped —
                // this is the teardown window between stopAlarmSound() and onDestroy().
                if (isAlarmActive() && !isPickerActive()) {
                    val km = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
                    val isLocked = try { km.isKeyguardLocked } catch (_: Exception) { false }
                    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                    val isScreenOn = try { pm.isInteractive } catch (_: Exception) { true }

                    if (!isLocked && isScreenOn) {
                        try {
                            // FLAG_ACTIVITY_NEW_TASK is mandatory: by the time onActivityPaused
                            // fires the Activity is mid-transition to background; without NEW_TASK
                            // Android 10+ will silently drop startActivity().
                            activity.startActivity(
                                Intent(activity, MainActivity::class.java).apply {
                                    addFlags(
                                        Intent.FLAG_ACTIVITY_NEW_TASK or
                                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                        Intent.FLAG_ACTIVITY_NO_ANIMATION
                                    )
                                }
                            )
                        } catch (_: Exception) {}
                    }
                }
            }
        }
        override fun onActivityCreated(a: Activity, b: Bundle?) {}
        override fun onActivityStarted(a: Activity) {}
        override fun onActivityStopped(a: Activity) {}
        override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
        override fun onActivityDestroyed(a: Activity) {}
    }


    // ── Secondary watchdog: 500 ms polling (belt-and-suspenders) ─────────────
    //
    // Guards against edge cases the lifecycle watchdog may miss (process
    // restart, exotic OEM lifecycle overrides). Uses mainActivityResumed
    // tracked above to avoid unnecessary relaunches when already visible.
    private val bringToFrontHandler = Handler(Looper.getMainLooper())
    private val bringToFrontRunnable = object : Runnable {
        override fun run() {
            // ROOT CAUSE FIX: When the alarm is being stopped, do NOT re-post this
            // runnable. Previously the runnable always re-posted itself every 200ms
            // unconditionally, meaning it kept running DURING the entire async
            // teardown window between stopService() and onDestroy(). During that
            // window it would call launchApp() which fights router.replace() navigation
            // — making the alarm screen appear frozen/unresponsive after long ringing.
            //
            // By NOT re-posting when isAlarmStopping(), the runnable fully dies the
            // moment the user taps Stop. onDestroy() also calls removeCallbacks() as
            // its first action as a belt-and-suspenders guarantee.
            if (isAlarmStopping() || ALARM_FORCE_STOP.get()) {
                return // stop re-posting — runnable dies here
            }

            if (isAlarmActive() && !isAppInForeground() && !isPickerActive() && !ALARM_FORCE_STOP.get()) {
                val km = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
                val isLocked = try { km.isKeyguardLocked } catch (_: Exception) { false }
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                val isScreenOn = try { pm.isInteractive } catch (_: Exception) { true }

                if (!isLocked && isScreenOn) {
                    launchApp()
                }
            }
            // Re-post only when alarm is genuinely active and NOT stopping
            bringToFrontHandler.postDelayed(this, 200)
        }
    }

    // Safety-net unmute: retained for volume-duck control paths. Wake alarms
    // now use native MediaPlayer as the primary playback engine, so normal
    // alarm startup begins at full volume and does not wait for JS audio.
    private val unmuteRunnable = Runnable { mediaPlayer?.setVolume(1f, 1f) }

    private fun isAppInForeground(): Boolean = mainActivityResumed

    /**
     * Layer 4 — True while the system camera or gallery picker is open.
     * When picker_active=true the watchdogs must NOT bring the app back to
     * front — otherwise the camera/gallery overlay is immediately dismissed.
     *
     * FIX: Previously this only read AlarmModule.PREFS_NAME (wake alarm prefs).
     * Habit alarms write picker_active to HabitAlarmModule.PREFS_NAME, so the
     * watchdog never saw it. Now we check BOTH prefs files.
     */
    protected fun isPickerActive(): Boolean {
        val wakeActive = try {
            getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("picker_active", false)
        } catch (_: Exception) { false }
        val habitActive = try {
            getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("picker_active", false)
        } catch (_: Exception) { false }
        return wakeActive || habitActive
    }

    /**
     * Returns true if stopAlarmSound() / stopHabitAlarm() has been called but the
     * service teardown (onDestroy) has not yet completed.
     *
     * AlarmModule.stopAlarmSound() writes alarm_stopping=true BEFORE it calls
     * stopService() so this flag is visible to every watchdog — including
     * onTaskRemoved — for the entire duration of the teardown window.
     *
     * This prevents the onTaskRemoved AlarmManager restart from firing when
     * the user closes the app immediately after tapping "Stop Alarm", which
     * was the root cause of the app auto-opening after alarm dismissal.
     */
    protected fun isAlarmStopping(): Boolean {
        val wakeStopping = try {
            getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("alarm_stopping", false)
        } catch (_: Exception) { false }
        val habitStopping = try {
            getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("alarm_stopping", false)
        } catch (_: Exception) { false }
        return wakeStopping || habitStopping
    }

    // ── Audio ─────────────────────────────────────────────────────────────────

    private fun requestAudioFocus() {
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setAudioAttributes(buildAudioAttrs())
                    .setOnAudioFocusChangeListener { }
                    .build()
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    protected fun buildAudioAttrs(): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setLegacyStreamType(AudioManager.STREAM_ALARM)
            .build()

    /**
     * Start looping alarm audio.
     *
     * Priority 1 — path returned by getSoundPath() (expo-asset or downloaded path).
     * Priority 2 — permanent mantras/ document directory fallback.
     *              Handles the case where the expo-asset path goes stale after an
     *              app update (asset hash changes, old file deleted) — we try the
     *              user's downloaded MP3 before giving up.
     * Priority 3 — bundled mantra_alarm.wav raw resource (always present in APK).
     */
    protected fun playAlarm() {
        requestAudioFocus()
        val soundPath = getSoundPath()

        // Priority 1: stored path (expo-asset or explicit download)
        if (!soundPath.isNullOrEmpty()) {
            val file = File(soundPath)
            if (file.exists()) {
                try {
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(buildAudioAttrs())
                        setDataSource(soundPath)
                        isLooping = true
                        prepare()
                        setVolume(1f, 1f)
                        start()
                    }
                    return
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        // Priority 2: exhaustive search of ALL known permanent storage locations.
        // BUG 4 FIX: expo-asset caches files in a hash-named directory that is wiped
        // on APK updates. KEY_SOUND_PATH stores that cache path, which is stale after
        // any app update. We now search EVERY permanent location before giving up.
        // When we find a valid file we also update KEY_SOUND_PATH so the NEXT alarm
        // fires on Priority 1 without searching.
        try {
            val prefs = getSharedPreferences(AlarmModule.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val soundId = prefs.getString(AlarmModule.KEY_SOUND, null)
            if (!soundId.isNullOrEmpty()) {
                val exts = listOf(".mp3", ".m4a", ".wav", ".ogg")
                // Build all candidate directory roots
                val roots = buildList {
                    // Internal files dir: /data/user/0/<pkg>/files
                    add(filesDir.absolutePath)
                    // Parent of files dir (catches /data/user/0/<pkg>)
                    filesDir.parentFile?.absolutePath?.let { add(it + "/files") }
                    // External files dirs (SD card or emulated)
                    getExternalFilesDirs(null).filterNotNull().forEach { add(it.absolutePath) }
                    // Cache dirs — some expo-asset paths land here
                    add(cacheDir.absolutePath)
                    externalCacheDir?.absolutePath?.let { add(it) }
                }
                // Subdirectories to check within each root
                val subdirs = listOf("mantras", "mantra", "sounds", "alarm", "")

                for (root in roots) {
                    for (sub in subdirs) {
                        val dir = if (sub.isEmpty()) root else "$root/$sub"
                        for (ext in exts) {
                            val candidatePath = "$dir/$soundId$ext"
                            val candidateFile = File(candidatePath)
                            if (candidateFile.exists() && candidateFile.length() > 0) {
                                try {
                                    mediaPlayer?.release()
                                    mediaPlayer = MediaPlayer().apply {
                                        setAudioAttributes(buildAudioAttrs())
                                        setDataSource(candidatePath)
                                        isLooping = true
                                        prepare()
                                        setVolume(1f, 1f)
                                        start()
                                    }
                                    // Update stored path so next alarm uses Priority 1 directly
                                    prefs.edit().putString(AlarmModule.KEY_SOUND_PATH, candidatePath).apply()
                                    return
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Priority 3: bundled fallback raw resource (mantra_alarm.wav).
        // This only plays if ALL file-based lookups above failed — i.e. the user's
        // selected sound was never downloaded to this device. Log clearly so it's
        // obvious in logcat when investigating "beep instead of mantra" reports.
        android.util.Log.w("AlarmSound", "BUG4: All sound file lookups failed — falling back to bundled mantra_alarm.wav. soundPath=$soundPath soundId=${
            try { getSharedPreferences(AlarmModule.PREFS_NAME, android.content.Context.MODE_PRIVATE).getString(AlarmModule.KEY_SOUND, "null") } catch (_: Exception) { "error" }
        }")
        playFromRaw()
    }


    private fun playFromRaw() {
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(buildAudioAttrs())
                val afd = resources.openRawResourceFd(R.raw.mantra_alarm)
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = true
                prepare()
                setVolume(1f, 1f)
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // ── App launch ────────────────────────────────────────────────────────────

    /**
     * Bring the alarm screen to the foreground.
     *
     * FIRST call  → fires buildFullScreenPendingIntent() which deep-links to the
     *               alarm screen (wake-alarm-ringing / habit-alarm-ringing).
     * SUBSEQUENT  → fires a separate PendingIntent targeting MainActivity with
     *               REORDER_TO_FRONT — brings whatever screen is already on top
     *               back to front WITHOUT re-routing via the deep-link URI.
     *
     * The previous implementation sent buildFullScreenPendingIntent() on ALL
     * calls (the alarmScreenLaunched flag only changed the local `launch` var
     * but was immediately overridden by the outer `if (alarmScreenLaunched)` check).
     * This caused the watchdog to re-launch wake-alarm-ringing mid-navigation when
     * the user was transitioning to the mission screen — the root cause of "Begin
     * Your Day" being stuck on 2nd+ alarms and mission screen freezing.
     */
    protected fun launchApp() {
        try {
            markAlarmActive()
            if (!alarmScreenLaunched) {
                // First call: deep-link to the alarm screen
                alarmScreenLaunched = true
                buildFullScreenPendingIntent().send()
            } else {
                // Subsequent calls: just bring MainActivity to front without re-routing.
                // Using a direct PendingIntent to MainActivity bypasses the deep-link URI
                // so Expo Router does NOT navigate to wake-alarm-ringing again.
                // On Android 12+, startActivity() from a background service is blocked;
                // wrapping in PendingIntent.getActivity().send() bypasses BAL restrictions.
                val reorderIntent = Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_NO_ANIMATION
                    )
                }
                val pi = PendingIntent.getActivity(
                    applicationContext,
                    getNotifId() + 100,
                    reorderIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                try {
                    pi.send()
                } catch (e: Exception) {
                    // Fallback: direct startActivity (may be blocked on Android 12+ from bg)
                    try { startActivity(reorderIntent) } catch (_: Exception) { e.printStackTrace() }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Build a high-priority PendingIntent that targets buildDeepLinkUri().
     * Used by subclasses when constructing the FGS notification's
     * contentIntent and fullScreenIntent.
     */
    protected fun buildFullScreenPendingIntent(): PendingIntent {
        val launch = Intent(Intent.ACTION_VIEW, buildDeepLinkUri()).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        return PendingIntent.getActivity(
            this, getNotifId(), launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // ── WindowManager overlay (Phase 4) ───────────────────────────────────────────
    //
    // Drawn by the FGS immediately when the alarm fires — before React Native
    // has mounted a single component. Appears over the lock screen and over
    // ALL other apps (same mechanism Alarmy uses).
    //
    // Lifecycle:
    //   onStartCommand() → addOverlay()  ← overlay visible within ~50 ms
    //   RN mounts alarm screen → JS calls dismissAlarmOverlay() → ACTION_DISMISS_OVERLAY
    //   onStartCommand(ACTION_DISMISS_OVERLAY) → removeOverlay()
    //   onDestroy() → removeOverlay() (safety net)
    //
    // Requires SYSTEM_ALERT_WINDOW permission (declared in AndroidManifest).
    // If the user has NOT granted overlay permission, addOverlay() silently
    // skips — all other phases still work.

    private fun addOverlay() {
        if (!Settings.canDrawOverlays(this)) return
        Handler(Looper.getMainLooper()).post {
            try {
                windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

                // ── Root layout ────────────────────────────────────────────────
                val root = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity     = Gravity.CENTER
                    // 96% opaque black — covers screen completely without flickering
                    setBackgroundColor(0xF50A0A0A.toInt())
                    val pad = 64
                    setPadding(pad, pad, pad, pad)
                }

                // ── Alarm title (large, white, bold) ────────────────────────
                val titleView = TextView(this).apply {
                    text      = getOverlayTitle()
                    textSize  = 30f
                    setTextColor(Color.WHITE)
                    gravity   = Gravity.CENTER
                    typeface  = Typeface.DEFAULT_BOLD
                    val lp = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 32 }
                    layoutParams = lp
                }
                root.addView(titleView)

                // ── Accent divider ──────────────────────────────────────────
                val divider = View(this).apply {
                    setBackgroundColor(Color.parseColor("#FF6B35")) // saffron accent
                    val lp = LinearLayout.LayoutParams(120, 4).apply {
                        gravity      = Gravity.CENTER_HORIZONTAL
                        bottomMargin = 32
                    }
                    layoutParams = lp
                }
                root.addView(divider)

                // ── Body text (smaller, muted white) ─────────────────────────
                val bodyView = TextView(this).apply {
                    text     = getOverlayBody()
                    textSize = 17f
                    setTextColor(Color.parseColor("#BBBBBB"))
                    gravity  = Gravity.CENTER
                    val lp = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 48 }
                    layoutParams = lp
                }
                root.addView(bodyView)

                // ── "Tap anywhere" hint ────────────────────────────────────
                val hintView = TextView(this).apply {
                    text     = "Tap anywhere to open"
                    textSize = 13f
                    setTextColor(Color.parseColor("#666666"))
                    gravity  = Gravity.CENTER
                }
                root.addView(hintView)

                // ── Tap → launch alarm screen (deep-link on first tap) ─────────
                root.setOnClickListener { launchApp() }

                // ── Window parameters ───────────────────────────────────────
                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT

                // BUG 3 FIX: Do NOT include FLAG_NOT_FOCUSABLE.
                // That flag was blocking all touch input including the lock-screen
                // keyguard (fingerprint / PIN / pattern) — the user couldn't unlock.
                // FLAG_NOT_TOUCH_MODAL lets touches outside the overlay pass through
                // to the system keyguard while still keeping our overlay visible.
                val flags =
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED   or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON     or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON     or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD   or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL    or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    type,
                    flags,
                    PixelFormat.TRANSLUCENT
                )

                windowManager?.addView(root, params)
                overlayView = root
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Remove the overlay window. Safe to call multiple times — guarded by null check.
     * Must be called on the main thread (satisfied by all callers below).
     */
    fun removeOverlay() {
        Handler(Looper.getMainLooper()).post {
            try {
                overlayView?.let { windowManager?.removeView(it) }
            } catch (_: Exception) {}
            overlayView = null
            windowManager = null
        }
    }

    // ── Native vibration (Phase 3) ────────────────────────────────────────────
    //
    // Runs entirely in the JVM/native layer — cannot be paused or killed by the
    // JS thread, React Native bridge congestion, or GC pauses. The pattern is
    // identical to the old JS Vibration.vibrate() call so users notice no difference
    // except that it now survives every scenario where the JS thread was stalled.

    private fun getVibrator(): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
                ?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    fun startAlarmVibration() {
        vibrator?.cancel() // cancel any existing pattern before starting fresh
        vibrator = getVibrator() ?: return

        // ── Smooth, slow, gentle vibration pattern ──────────────────────────
        // Long on-time (1200ms) at moderate amplitude (140/255 ≈ 55%) with a
        // brief 400ms pause creates a slow "breathing" rhythm that feels calm
        // and smooth — not the jarring rapid pulses of the previous 500ms/200
        // pattern. The lower amplitude prevents the harsh mechanical feel.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(
                0,     // no start delay
                1200,  // vibrate for 1200ms — feels continuous, not choppy
                400    // brief pause before next cycle
            )
            val amplitudes = intArrayOf(
                0,     // no delay
                140,   // comfortable amplitude (≈55% of max) — smooth, not jarring
                0      // pause
            )
            val effect = VibrationEffect.createWaveform(timings, amplitudes, 0) // repeat from index 0
            val attrs  = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()
            vibrator?.vibrate(effect, attrs)
        } else {
            // API < 26: no amplitude support — use longer on/off pattern
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 1200, 400), 0)
        }
    }

    fun stopAlarmVibration() {
        vibrator?.cancel()
        vibrator = null
    }

    // ── Service lifecycle (template method pattern) ───────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ALARM_FORCE_STOP.set(false)
        // ── Vibration control without restarting the service ────────────────
        // JS calls AlarmModule.startAlarmVibration() / stopAlarmVibration()
        // to control vibration during snooze without stopping the FGS.
        if (intent?.action == ACTION_START_VIBRATION) { startAlarmVibration(); return START_STICKY }
        if (intent?.action == ACTION_STOP_VIBRATION)  { stopAlarmVibration();  return START_STICKY }
        if (intent?.action == ACTION_STOP_AUDIO) {
            bringToFrontHandler.removeCallbacks(unmuteRunnable)
            try {
                mediaPlayer?.stop()
            } catch (_: Exception) {}
            mediaPlayer?.release()
            mediaPlayer = null
            return START_STICKY
        }
        // RN alarm screen has mounted — remove the native overlay placeholder.
        if (intent?.action == ACTION_DISMISS_OVERLAY)  { removeOverlay();       return START_STICKY }

        // ── Volume duck without restarting the service ──────────────────────
        // Lets JS lower MediaPlayer volume for TTS / snooze while keeping the
        // FGS (and both watchdogs) alive and the alarm flag set.
        // IMPORTANT: removeCallbacks(unmuteRunnable) here is the KEY fix for
        // Bug 1 — when JS calls setNativeAlarmVolume(0) to mute the native
        // MediaPlayer, it signals that JS audio is alive. The safety-net
        // unmuteRunnable MUST be cancelled at this point so Gayatri never
        // bleeds through after JS has already taken over audio.
        if (intent?.action == getActionSetVolume()) {
            val vol = intent.getFloatExtra(getExtraVolumeKey(), 1f)
            bringToFrontHandler.removeCallbacks(unmuteRunnable)
            mediaPlayer?.setVolume(vol, vol)
            return START_STICKY
        }

        // ── Guard: reject phantom START_STICKY restarts after intentional stop ─
        // stopAlarmSound() clears alarm_fired_pending BEFORE calling stopService().
        // If Android then restarts this service with intent=null (START_STICKY),
        // isAlarmActive() returns false — we must NOT re-arm the alarm.
        // Self-stopping here is the single-line fix that prevents phantom
        // post-mission vibration without touching any other alarm path.
        if (intent == null && !isAlarmActive()) {
            stopSelf()
            return START_NOT_STICKY
        }

        // ── Load subclass-specific params ───────────────────────────────────
        // Wake alarm: reads sound path from SharedPreferences (no extras).
        // Habit/quick: reads habitKey, label, emoji, alarmType from intent or
        //              SharedPreferences (START_STICKY null-intent recovery).
        onLoadParams(intent)

        // ── Phase 2: FULL_WAKE_LOCK — physically turns screen on ────────────
        //
        // PARTIAL_WAKE_LOCK (previous) kept only the CPU running; the screen
        // stayed off, which meant fullScreenIntent had to be delivered before
        // the user saw anything. FULL_WAKE_LOCK + ACQUIRE_CAUSES_WAKEUP turns
        // the screen on directly from this service thread — no dependency on
        // notification delivery timing. ON_AFTER_RELEASE keeps the screen on
        // briefly after the lock is released so the alarm UI stays visible.
        //
        // FULL_WAKE_LOCK is deprecated at API 17 with a recommendation to use
        // FLAG_KEEP_SCREEN_ON on an Activity window instead — but that approach
        // requires the Activity to already be visible. For an alarm service that
        // must wake a sleeping device, FULL_WAKE_LOCK is still the correct tool
        // and is what Google Clock and every production alarm app uses.
        //
        // BUG 2 FIX: Release the existing WakeLock BEFORE acquiring a new one.
        // Previously, the old wakeLock reference was silently overwritten on every
        // onStartCommand() call, leaving the PowerManager holding an unreleased
        // FULL_WAKE_LOCK with no Kotlin reference to release it. The 10-minute
        // safety-cap timeout was the only way it ever got released. After alarm #N,
        // there were N orphaned FULL_WAKE_LOCK instances draining CPU throughout
        // the mission — directly degrading the JS thread's share.
        @Suppress("DEPRECATION")
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        // Release any previously held WakeLock before creating a new one.
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "arise:alarmwakelock"
        ).also { it.acquire(10 * 60 * 1000L) } // 10-minute safety cap

        markAlarmActive()
        startForeground(getNotifId(), buildNotification())

        // Distinguish fresh alarm start from START_STICKY mid-alarm restart.
        //
        // Only do the full startup sequence (reset flag + deep-link launch)
        // when intent is non-null (genuine AlarmBroadcastReceiver trigger).
        // For null-intent START_STICKY restarts (mid-alarm), just restore audio
        // and watchdogs without touching navigation.
        if (intent != null) {
            // Fresh alarm start — reset flag so deep-link fires exactly once
            alarmScreenLaunched = false
            playAlarm()
            startAlarmVibration() // Phase 3: vibration owned by native — survives JS thread issues
            addOverlay()          // Phase 4: cover screen immediately, before RN has mounted
            launchApp()
        } else {
            // START_STICKY mid-alarm restart — alarm is still active but service was killed.
            // Restore audio/vibration without resetting alarmScreenLaunched.
            // alarmScreenLaunched stays true → subsequent launchApp() calls use
            // REORDER_TO_FRONT instead of the deep-link, so navigation is not disrupted.
            playAlarm()
            startAlarmVibration()
            // Do NOT call launchApp() here — the user may be mid-mission.
            // The 200ms bringToFrontRunnable will call launchApp() if the app
            // is genuinely not in the foreground.
        }

        // BUG 1 FIX: Register watchdogs only ONCE per service instance.
        // Without this guard, every onStartCommand() call stacked another
        // bringToFrontRunnable (self-re-posting every 200 ms) and another
        // lifecycleWatchdog on top — multiplying main-thread CPU usage with
        // each successive alarm and causing the cumulative JS-thread starvation
        // that manifested as typing lag and timer stutter on 2nd+ alarms.
        if (!watchdogsRegistered) {
            watchdogsRegistered = true
            // Primary watchdog (lifecycle-based, fires on actual Activity pause).
            (application as Application).registerActivityLifecycleCallbacks(lifecycleWatchdog)
            // Secondary watchdog (200ms polling — belt-and-suspenders Layer 2).
            bringToFrontHandler.postDelayed(bringToFrontRunnable, 200)
        }

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // CRITICAL FIX: Only schedule the restart PendingIntent when the alarm is
        // genuinely active AND is NOT in the process of being stopped.
        //
        // The bug: stopAlarmSound() calls stopService() which triggers onTaskRemoved
        // if the user swipes the app from recents during the teardown window. At that
        // point isAlarmActive() could still return true for a few milliseconds before
        // the write fully propagates — causing a 1-second AlarmManager restart that
        // re-opened the app even though the alarm had already been dismissed.
        //
        // The fix: AlarmModule.stopAlarmSound() writes alarm_stopping=true BEFORE
        // clearing alarm_fired_pending. isAlarmStopping() reads that flag here so
        // we never schedule a restart during normal alarm dismissal.
        if (isAlarmActive() && !isAlarmStopping() && !ALARM_FORCE_STOP.get()) {
            // User swiped the app from recents while alarm is GENUINELY active.
            // START_STICKY alone is ignored by many OEM ROMs (MIUI, ColorOS, OneUI).
            // Belt-and-suspenders: schedule an AlarmManager restart in 1 s so audio
            // comes back even when the OS refuses to honour START_STICKY.
            //
            // this::class.java resolves to the concrete subclass at runtime, so the
            // correct service (AlarmSoundService or HabitAlarmSoundService) is restarted.
            try {
                val restart = PendingIntent.getService(
                    applicationContext,
                    getRestartRequestCode(),
                    Intent(applicationContext, this::class.java),
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
                (getSystemService(Context.ALARM_SERVICE) as AlarmManager)
                    .set(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        android.os.SystemClock.elapsedRealtime() + 1_000L,
                        restart
                    )
            } catch (_: Exception) {}
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        // ROOT CAUSE FIX: Remove ALL pending callbacks as the ABSOLUTE FIRST action.
        // This is critical — any further delay risks a queued bringToFrontRunnable
        // tick firing during the rest of teardown and calling launchApp(), which
        // would fight router navigation and make the alarm appear frozen.
        bringToFrontHandler.removeCallbacks(bringToFrontRunnable)
        bringToFrontHandler.removeCallbacks(unmuteRunnable)

        (application as Application).unregisterActivityLifecycleCallbacks(lifecycleWatchdog)

        // Reset the watchdogs guard so if the OS restarts this service via
        // START_STICKY the watchdogs will be re-registered exactly once.
        watchdogsRegistered = false

        // ── Remove foreground notification ──
        // On newer Android versions, stopping the service might leave the notification
        // hanging. Explicitly remove it to prevent "ghost" reappearances.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.cancel(getNotifId())

        stopAlarmVibration()
        removeOverlay() // safety net: removes overlay if RN never called dismissAlarmOverlay
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null

        // Clear the alarm_stopping flag now that the service has fully stopped.
        // This must happen in onDestroy() — NOT in AlarmModule.stopAlarmSound() —
        // because stopService() is asynchronous: clearing it there left a window
        // where watchdogs could fire before onDestroy() ran, causing the freeze.
        try {
            getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("alarm_stopping", false).apply()
        } catch (_: Exception) {}
        try {
            getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("alarm_stopping", false).apply()
        } catch (_: Exception) {}

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Debug helper ──────────────────────────────────────────────────────────

    protected fun showToast(msg: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(applicationContext, msg, Toast.LENGTH_LONG).show()
        }
    }
}
