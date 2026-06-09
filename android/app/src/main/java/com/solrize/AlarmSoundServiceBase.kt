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
        /** Intent action: start the hardware vibration pattern from the running service. */
        const val ACTION_START_VIBRATION = "com.solrize.START_ALARM_VIBRATION"
        /** Intent action: stop the hardware vibration pattern from the running service. */
        const val ACTION_STOP_VIBRATION  = "com.solrize.STOP_ALARM_VIBRATION"
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
                if (isAlarmActive() && !isPickerActive()) {
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
            if (isAlarmActive() && !isAppInForeground() && !isPickerActive()) {
                launchApp()
            }
            // Layer 2: 200ms polling — shrinks escape window below human perception threshold
            bringToFrontHandler.postDelayed(this, 200)
        }
    }


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

    // ── Audio ─────────────────────────────────────────────────────────────────

    protected fun buildAudioAttrs(): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setLegacyStreamType(AudioManager.STREAM_ALARM)
            .build()

    /**
     * Start looping alarm audio.
     * Priority 1 — path returned by getSoundPath() (locally downloaded mantra).
     * Priority 2 — bundled mantra_alarm.wav raw resource (always present in APK).
     */
    protected fun playAlarm() {
        val soundPath = getSoundPath()
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
     * FIRST call  → deep-link Intent so Expo Router navigates to the correct
     *               alarm screen (e.g. /alarm-ringing or /habit-alarm-ringing).
     * SUBSEQUENT  → plain MainActivity Intent with REORDER_TO_FRONT so the OS
     *               does NOT re-process the deep-link and re-mount the screen.
     */
    protected fun launchApp() {
        try {
            markAlarmActive()
            val launch = if (!alarmScreenLaunched) {
                alarmScreenLaunched = true
                Intent(Intent.ACTION_VIEW, buildDeepLinkUri()).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
            } else {
                Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_NO_ANIMATION
                    )
                }
            }
            startActivity(launch)
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

                val flags =
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED   or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON     or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON     or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD   or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE       or
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

        // ── Simple smooth continuous vibration pattern ──
        // Gentle, continuous vibration that feels smooth and natural.
        // No harsh pulses — just a steady, pleasant vibration.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Amplitude-aware waveform: smooth continuous vibration
            // 500ms on, 500ms off, repeating — at medium-high amplitude
            val timings = longArrayOf(
                0,    // start delay
                500,  // vibrate for 500ms
                500   // pause for 500ms before repeat
            )
            val amplitudes = intArrayOf(
                0,    // start delay (off)
                200,  // smooth vibration at amplitude 200/255
                0     // pause (off)
            )
            val effect = VibrationEffect.createWaveform(timings, amplitudes, 0)
            val attrs  = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()
            vibrator?.vibrate(effect, attrs)
        } else {
            // API < 26: no amplitude support — use simple on/off pattern
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 500, 500), 0)
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
        // ── Vibration control without restarting the service ────────────────
        // JS calls AlarmModule.startAlarmVibration() / stopAlarmVibration()
        // to control vibration during snooze without stopping the FGS.
        if (intent?.action == ACTION_START_VIBRATION) { startAlarmVibration(); return START_STICKY }
        if (intent?.action == ACTION_STOP_VIBRATION)  { stopAlarmVibration();  return START_STICKY }
        // RN alarm screen has mounted — remove the native overlay placeholder.
        if (intent?.action == ACTION_DISMISS_OVERLAY)  { removeOverlay();       return START_STICKY }

        // ── Volume duck without restarting the service ──────────────────────
        // Lets JS lower MediaPlayer volume for TTS / snooze while keeping the
        // FGS (and both watchdogs) alive and the alarm flag set.
        if (intent?.action == getActionSetVolume()) {
            val vol = intent.getFloatExtra(getExtraVolumeKey(), 1f)
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

        // ── Guard: reject START_STICKY restart when service was INTENTIONALLY stopped ──
        // stopAlarmServiceOnly() sets service_intentionally_stopped=true and calls
        // stopService(). Android START_STICKY may restart the service with intent=null
        // even though alarm_fired_pending is still true (mission is in progress).
        // Without this guard, onStartCommand() would call markAlarmActive() and
        // re-register BOTH watchdogs (lifecycleWatchdog + bringToFrontRunnable),
        // causing the app to auto-reopen every time the user presses Home after
        // completing the alarm. This flag is cleared by stopAlarmSound() in
        // mission.tsx handleComplete() so future fresh alarm starts are not blocked.
        val intentionallyStopped = try {
            getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("service_intentionally_stopped", false)
        } catch (_: Exception) { false }
        if (intent == null && intentionallyStopped) {
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
        @Suppress("DEPRECATION")
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "arise:alarmwakelock"
        ).also { it.acquire(10 * 60 * 1000L) } // 10-minute safety cap

        markAlarmActive()
        alarmScreenLaunched = false
        startForeground(getNotifId(), buildNotification())
        playAlarm()
        startAlarmVibration() // Phase 3: vibration owned by native — survives JS thread issues
        addOverlay()          // Phase 4: cover screen immediately, before RN has mounted
        launchApp()

        // Register primary watchdog (lifecycle-based, fires on actual pause).
        (application as Application).registerActivityLifecycleCallbacks(lifecycleWatchdog)
        // Register secondary watchdog (200ms polling — Layer 2).
        bringToFrontHandler.postDelayed(bringToFrontRunnable, 200)

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (isAlarmActive()) {
            // User swiped the app from recents while alarm is active.
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
        (application as Application).unregisterActivityLifecycleCallbacks(lifecycleWatchdog)
        bringToFrontHandler.removeCallbacks(bringToFrontRunnable)
        stopAlarmVibration()
        removeOverlay() // safety net: removes overlay if RN never called dismissAlarmOverlay
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
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
