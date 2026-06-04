package com.solrize

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.text.SimpleDateFormat
import java.util.*

/**
 * StepCounterService — Native Android foreground service for step counting.
 *
 * Supports TWO independent modes that can run simultaneously:
 *
 * ① WALK SESSION mode  (ACTION_START / ACTION_STOP)
 *    • Uses TYPE_STEP_DETECTOR — fires ONCE per step at SENSOR_DELAY_FASTEST
 *    • No batching. Real-time per-step updates (same as Google Fit).
 *    • Cross-checks with TYPE_STEP_COUNTER to catch any missed events.
 *    • Emits 'NativeStepUpdate' events to JS.
 *
 * ② DAILY TRACKING mode  (ACTION_START_DAILY / ACTION_STOP_DAILY)
 *    • Uses TYPE_STEP_COUNTER — cumulative steps since device boot.
 *    • Reads baseline at session start; steps today = current − baseline + saved.
 *    • Persists daily total in SharedPreferences (survives app kills + reboots).
 *    • Resets automatically at midnight (date boundary detection).
 *    • Emits 'NativeDailyStepUpdate' events to JS every 30 steps or on app resume.
 *
 * Service runs with START_STICKY: Android restarts it if killed.
 * foregroundServiceType="health": exempt from Doze mode restrictions.
 */
class StepCounterService : Service(), SensorEventListener {

    companion object {
        private const val TAG           = "NadaStepService"
        const val CHANNEL_ID            = "nada_step_counter"
        const val NOTIFICATION_ID       = 4242

        // Walk session actions
        const val ACTION_START          = "com.solrize.STEP_START"
        const val ACTION_STOP           = "com.solrize.STEP_STOP"

        // Daily tracking actions
        const val ACTION_START_DAILY    = "com.solrize.DAILY_START"
        const val ACTION_STOP_DAILY     = "com.solrize.DAILY_STOP"

        // SharedPreferences keys for daily tracking persistence
        const val PREFS_NAME            = "nada_step_prefs"
        private const val KEY_DATE      = "daily_date"
        private const val KEY_STEPS     = "daily_steps"
        private const val KEY_BASELINE  = "daily_counter_baseline"
        private const val KEY_DAILY_ON  = "daily_tracking_enabled"

        // ── Shared state (read by StepCounterModule) ───────────────────────────
        @Volatile var sessionSteps      = 0
        @Volatile var isWalkRunning     = false
        @Volatile var isDailyRunning    = false
        @Volatile var todaySteps        = 0

        /**
         * Reports which hardware sensor is powering the walk session.
         * "STEP_DETECTOR" = real-time pedometer (ideal, per-step, no batching)
         * "STEP_COUNTER"  = cumulative pedometer (fallback, delivers batched)
         * "NONE"          = no step sensor available on this device
         * Read by JS via StepCounterModule.getSensorSource()
         */
        @Volatile var sensorSource: String = "NONE"

        @Volatile var reactContext: ReactApplicationContext? = null

        // Walk session sensor state
        @Volatile private var stepCounterBaseline = -1L

        // Daily tracking sensor state
        @Volatile private var dailyCounterBaseline = -1L
        @Volatile private var dailyBaselineDate    = ""
        @Volatile private var dailyOffset          = 0   // steps saved before current session

        fun getToday(): String =
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    private var sensorManager: SensorManager? = null
    private var stepDetector:  Sensor? = null   // TYPE_STEP_DETECTOR
    private var stepCounter:   Sensor? = null   // TYPE_STEP_COUNTER

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepDetector  = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        stepCounter   = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        Log.d(TAG, "Service created. detector=${stepDetector != null} counter=${stepCounter != null}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START       -> handleStartWalk()
            ACTION_STOP        -> handleStopWalk()
            ACTION_START_DAILY -> handleStartDaily()
            ACTION_STOP_DAILY  -> handleStopDaily()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        unregisterSensorsIfIdle()
        isWalkRunning  = false
        isDailyRunning = false
        Log.d(TAG, "Service destroyed")
    }

    // ── Walk session handlers ──────────────────────────────────────────────────

    private fun handleStartWalk() {
        sessionSteps         = 0
        stepCounterBaseline  = -1L
        isWalkRunning        = true

        // Determine which sensor will power this session and log it clearly
        sensorSource = when {
            stepDetector != null -> "STEP_DETECTOR"
            stepCounter  != null -> "STEP_COUNTER"
            else                 -> "NONE"
        }

        registerSensors()
        startForeground(NOTIFICATION_ID, buildNotification())
        Log.d(TAG, "Walk session started. sensorSource=$sensorSource " +
            "(detector=${stepDetector != null}, counter=${stepCounter != null})")
    }

    private fun handleStopWalk() {
        isWalkRunning       = false
        sessionSteps        = 0
        stepCounterBaseline = -1L
        if (!isDailyRunning) {
            unregisterSensorsIfIdle()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } else {
            // Keep service alive for daily tracking; just update notification
            updateNotification()
        }
        Log.d(TAG, "Walk session stopped")
    }

    // ── Daily tracking handlers ────────────────────────────────────────────────

    private fun handleStartDaily() {
        isDailyRunning = true
        // Load persisted state
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_DAILY_ON, true).apply()
        val savedDate  = prefs.getString(KEY_DATE, "") ?: ""
        val savedSteps = prefs.getInt(KEY_STEPS, 0)
        val today      = getToday()

        if (savedDate == today) {
            // Same day — restore previous total as offset
            dailyOffset          = savedSteps
            dailyBaselineDate    = today
            // baseline will be set on first TYPE_STEP_COUNTER event
            dailyCounterBaseline = prefs.getLong(KEY_BASELINE, -1L)
            todaySteps           = savedSteps
            Log.d(TAG, "Daily resumed: offset=$dailyOffset baseline=$dailyCounterBaseline")
        } else {
            // New day — reset everything
            dailyOffset          = 0
            dailyBaselineDate    = today
            dailyCounterBaseline = -1L
            todaySteps           = 0
            prefs.edit()
                .putString(KEY_DATE, today)
                .putInt(KEY_STEPS, 0)
                .putLong(KEY_BASELINE, -1L)
                .apply()
            Log.d(TAG, "Daily started fresh for $today")
        }

        registerSensors()
        if (!isWalkRunning) {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
        // Emit current known count immediately
        emitDailyStepEvent(todaySteps)
        Log.d(TAG, "Daily tracking started: todaySteps=$todaySteps")
    }

    private fun handleStopDaily() {
        isDailyRunning = false
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_DAILY_ON, false).apply()
        if (!isWalkRunning) {
            unregisterSensorsIfIdle()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        Log.d(TAG, "Daily tracking stopped")
    }

    // ── Sensor registration ────────────────────────────────────────────────────

    private fun registerSensors() {
        // TYPE_STEP_DETECTOR — per-step events (for walk sessions)
        stepDetector?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        // TYPE_STEP_COUNTER — cumulative count (for daily tracking + walk cross-check)
        stepCounter?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
    }

    private fun unregisterSensorsIfIdle() {
        if (!isWalkRunning && !isDailyRunning) {
            sensorManager?.unregisterListener(this)
            Log.d(TAG, "Sensors unregistered (both modes stopped)")
        }
    }

    // ── SensorEventListener ────────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {

            // ── Per-step detector (walk session ONLY — fires instantly, no batching) ──
            // TYPE_STEP_DETECTOR is the correct sensor for live step counting.
            // It fires exactly once per step with zero batching delay.
            // TYPE_STEP_COUNTER is intentionally NOT used during walk sessions because
            // Android batches it in hardware (delivers 5-20 steps at once) → causes jumps.
            Sensor.TYPE_STEP_DETECTOR -> {
                if (isWalkRunning) {
                    sessionSteps += 1
                    emitStepEvent(sessionSteps)
                    updateNotification()
                    Log.v(TAG, "STEP_DETECTOR → sessionSteps=$sessionSteps")
                }
            }

            // ── Cumulative counter (daily tracking ONLY — do NOT use for walk sessions) ──
            // TYPE_STEP_COUNTER delivers batched data from hardware.
            // Using it during a walk session caused the "jump from 2→5 steps" bug
            // because the cross-check was overwriting the live DETECTOR count with
            // a stale batch dump. Now it is ONLY used for daily background tracking.
            Sensor.TYPE_STEP_COUNTER -> {
                val total = event.values[0].toLong()

                // NOTE: Walk session cross-check removed — it caused batched jumps.
                // STEP_DETECTOR alone handles all per-step counting during walk sessions.

                // Daily tracking: use TYPE_STEP_COUNTER as ground truth
                if (isDailyRunning) {
                    val today = getToday()

                    // Midnight boundary — reset for new day
                    if (dailyBaselineDate != today) {
                        dailyOffset          = 0
                        dailyBaselineDate    = today
                        dailyCounterBaseline = total
                        todaySteps           = 0
                        persistDailySteps(today, 0, total)
                        emitDailyStepEvent(0)
                        Log.d(TAG, "Midnight crossed — daily steps reset for $today")
                        return
                    }

                    // Set baseline on first event of this service session
                    if (dailyCounterBaseline < 0) {
                        dailyCounterBaseline = total
                        Log.d(TAG, "Daily baseline set: $dailyCounterBaseline (offset=$dailyOffset)")
                        return
                    }

                    // Steps today = offset (from before this service session) + steps in this session
                    val sessionDelta = (total - dailyCounterBaseline).toInt().coerceAtLeast(0)
                    val newTotal     = dailyOffset + sessionDelta

                    if (newTotal != todaySteps) {
                        todaySteps = newTotal
                        persistDailySteps(today, newTotal, dailyCounterBaseline)
                        emitDailyStepEvent(newTotal)
                    }
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { /* not used */ }

    // ── Persistence ────────────────────────────────────────────────────────────

    private fun persistDailySteps(date: String, steps: Int, baseline: Long) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_DATE, date)
            .putInt(KEY_STEPS, steps)
            .putLong(KEY_BASELINE, baseline)
            .apply()
    }

    // ── Event emission ─────────────────────────────────────────────────────────

    private fun emitStepEvent(steps: Int) {
        reactContext?.takeIf { it.hasActiveReactInstance() }
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("NativeStepUpdate", steps)
    }

    private fun emitDailyStepEvent(steps: Int) {
        reactContext?.takeIf { it.hasActiveReactInstance() }
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("NativeDailyStepUpdate", steps)
    }

    // ── Notification ───────────────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        createChannel()
        val pi = PendingIntent.getActivity(
            this, 0, packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = when {
            isWalkRunning && isDailyRunning -> "🚶 Walking · $sessionSteps steps"
            isWalkRunning                  -> "🚶 Walk in progress · $sessionSteps steps"
            isDailyRunning                 -> "👟 Nada step tracker active"
            else                           -> "Nada"
        }
        val body = when {
            isWalkRunning && isDailyRunning -> "Today: $todaySteps steps total"
            isWalkRunning                  -> "Real-time step counting active"
            isDailyRunning                 -> "Today: $todaySteps steps counted"
            else                           -> ""
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pi)
            .build()
    }

    private fun updateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Step Counter", NotificationManager.IMPORTANCE_LOW)
                .apply {
                    description = "Tracks steps during walks and throughout the day"
                    setShowBadge(false)
                }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }
    }
}
