package com.solrize

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import com.facebook.react.bridge.*

/**
 * StepCounterModule — React Native bridge for native step counting.
 *
 * ─── Walk session API ──────────────────────────────────────────────────────────
 *   NativeModules.StepCounterModule.isAvailable()         → Promise<boolean>
 *   NativeModules.StepCounterModule.startWalkSession()    → Promise<void>
 *   NativeModules.StepCounterModule.stopWalkSession()     → Promise<void>
 *   NativeModules.StepCounterModule.getSessionSteps()     → Promise<number>
 *   NativeModules.StepCounterModule.isRunning()           → Promise<boolean>
 *
 * ─── Daily (background) tracking API ──────────────────────────────────────────
 *   NativeModules.StepCounterModule.startDailyTracking()  → Promise<void>
 *   NativeModules.StepCounterModule.stopDailyTracking()   → Promise<void>
 *   NativeModules.StepCounterModule.getTodaySteps()       → Promise<number>
 *   NativeModules.StepCounterModule.isDailyRunning()      → Promise<boolean>
 *
 * ─── JS event listeners ────────────────────────────────────────────────────────
 *   DeviceEventEmitter.addListener('NativeStepUpdate', steps => {})
 *     → fired on every step during a walk session (real-time, no batching)
 *
 *   DeviceEventEmitter.addListener('NativeDailyStepUpdate', steps => {})
 *     → fired when today's total changes during background tracking
 */
class StepCounterModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "StepCounterModule"

    // ── Availability ──────────────────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            val sm = reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val ok = sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null
                  || sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
            promise.resolve(ok)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ── Walk session ──────────────────────────────────────────────────────────

    @ReactMethod
    fun startWalkSession(promise: Promise) {
        try {
            StepCounterService.reactContext = reactContext
            startService(StepCounterService.ACTION_START)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_WALK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopWalkSession(promise: Promise) {
        try {
            startService(StepCounterService.ACTION_STOP)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_WALK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getSessionSteps(promise: Promise) {
        promise.resolve(StepCounterService.sessionSteps)
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(StepCounterService.isWalkRunning)
    }

    /**
     * Returns the sensor source powering the current/last walk session:
     *   "STEP_DETECTOR" → real-time pedometer, 1 event per step (ideal)
     *   "STEP_COUNTER"  → batched cumulative counter (fallback)
     *   "NONE"          → no step sensor hardware found
     */
    @ReactMethod
    fun getSensorSource(promise: Promise) {
        promise.resolve(StepCounterService.sensorSource)
    }


    @ReactMethod
    fun startDailyTracking(promise: Promise) {
        try {
            StepCounterService.reactContext = reactContext
            startService(StepCounterService.ACTION_START_DAILY)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_DAILY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopDailyTracking(promise: Promise) {
        try {
            startService(StepCounterService.ACTION_STOP_DAILY)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_DAILY_ERROR", e.message, e)
        }
    }

    /**
     * Returns today's step total.
     * First checks live service state (if service is running),
     * then falls back to SharedPreferences (survives service restarts / app kills).
     */
    @ReactMethod
    fun getTodaySteps(promise: Promise) {
        if (StepCounterService.isDailyRunning) {
            promise.resolve(StepCounterService.todaySteps)
            return
        }
        // Service not running — read from SharedPreferences (persisted value)
        try {
            val prefs    = reactContext.getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            val savedDate = prefs.getString("daily_date", "") ?: ""
            val steps     = if (savedDate == StepCounterService.getToday()) {
                prefs.getInt("daily_steps", 0)
            } else {
                0  // new day
            }
            promise.resolve(steps)
        } catch (e: Exception) {
            promise.resolve(0)
        }
    }

    @ReactMethod
    fun isDailyRunning(promise: Promise) {
        promise.resolve(StepCounterService.isDailyRunning)
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private fun startService(action: String) {
        val intent = Intent(reactContext, StepCounterService::class.java).apply {
            this.action = action
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    // ── RN event emitter boilerplate ──────────────────────────────────────────

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
