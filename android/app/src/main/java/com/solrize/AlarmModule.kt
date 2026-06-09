package com.solrize

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val REQUEST_CODE = 9001
        const val PREFS_NAME = "alarm_prefs"
        const val KEY_SOUND = "alarm_sound"
        const val KEY_SOUND_PATH = "alarm_sound_path"
    }

    override fun getName(): String = "AlarmModule"

    // ── Schedule exact alarm via AlarmManager.setAlarmClock() ────────────────
    // setAlarmClock() is Doze-exempt and shows alarm clock icon in the status bar.
    // Falls back to setWindow() if SCHEDULE_EXACT_ALARM permission is missing.
    @ReactMethod
    fun scheduleAlarm(timestamp: Double, promise: Promise) {
        try {
            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = buildPendingIntent()
            val ts = timestamp.toLong()

            // Persist hour/minute so AlarmBroadcastReceiver can reschedule the
            // alarm for the next day after it fires (daily-repeat without JS).
            val cal = java.util.Calendar.getInstance().apply { timeInMillis = ts }
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putInt("alarm_hour", cal.get(java.util.Calendar.HOUR_OF_DAY))
                .putInt("alarm_minute", cal.get(java.util.Calendar.MINUTE))
                .apply()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setWindow(AlarmManager.RTC_WAKEUP, ts, 60_000L, pi)
                promise.resolve("Alarm scheduled (inexact fallback) at $ts")
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(ts, pi), pi)
                promise.resolve("Alarm scheduled (exact) at $ts")
            }
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(promise: Promise) {
        try {
            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.cancel(buildPendingIntent())
            promise.resolve("Alarm cancelled")
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopAlarmSound(promise: Promise) {
        try {
            // Use .commit() (synchronous) not .apply() (async) so that isAlarmActive()
            // in MainActivity reads false IMMEDIATELY — before onWindowFocusChanged or
            // any watchdog fires. .apply() was causing a race where the flag was still
            // true after the alarm was dismissed, making the app re-open itself.
            // Also clear service_intentionally_stopped so future alarms start clean.
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("alarm_fired_pending", false)
                .putBoolean("service_intentionally_stopped", false)
                .commit()
            reactContext.stopService(Intent(reactContext, AlarmSoundService::class.java))
            promise.resolve("Sound stopped")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAlarmVolume(volume: Double, promise: Promise) {
        try {
            val intent = Intent(reactContext, AlarmSoundService::class.java).apply {
                action = AlarmSoundService.ACTION_SET_VOLUME
                putExtra(AlarmSoundService.EXTRA_VOLUME, volume.toFloat())
            }
            reactContext.startService(intent)
            promise.resolve("Volume set to $volume")
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", e.message, e)
        }
    }

    /**
     * Remove the TYPE_APPLICATION_OVERLAY window drawn by AlarmSoundService.
     * Called from alarm-ringing.tsx as soon as the RN screen has fully mounted,
     * so the native overlay placeholder is replaced by the proper React UI.
     */
    @ReactMethod
    fun dismissAlarmOverlay(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, AlarmSoundService::class.java).apply {
                    action = AlarmSoundServiceBase.ACTION_DISMISS_OVERLAY
                }
            )
            promise.resolve("Overlay dismissed")
        } catch (e: Exception) {
            promise.reject("OVERLAY_ERROR", e.message, e)
        }
    }

    /**
     * Stop AlarmSoundService WITHOUT clearing alarm_fired_pending.
     *
     * Called from alarm-ringing.tsx when the user taps "Begin Your Day" and
     * transitions to the mission screen. Stopping the service kills the
     * bringToFrontRunnable + lifecycleWatchdog (fixes the post-mission crash loop)
     * while keeping alarm_fired_pending=true so that:
     *   • isAlarmActive() returns true on the mission screen
     *   • startLockTask() stays active (screen remains pinned)
     *   • onUserLeaveHint() continues to block the Home button
     *
     * We also write service_intentionally_stopped=true so that Android's
     * START_STICKY mechanism cannot re-arm the watchdogs via a null-intent restart
     * while alarm_fired_pending is still true during the mission. Without this flag
     * Android would restart the service, markAlarmActive() would run, and the
     * lifecycle watchdog + bringToFrontRunnable would re-register — causing the app
     * to auto-reopen every time the user presses Home after completing the alarm.
     *
     * The full flag clear + lock task exit happens in mission.tsx handleComplete()
     * via stopAlarmSound() + stopLockTask() once the user finishes the mission.
     */
    @ReactMethod
    fun stopAlarmServiceOnly(promise: Promise) {
        try {
            // Mark the service as intentionally stopped so onStartCommand() null-intent
            // guard returns START_NOT_STICKY even though alarm_fired_pending is still true.
            // Cleared by stopAlarmSound() when the mission completes.
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("service_intentionally_stopped", true).commit()
            reactContext.stopService(Intent(reactContext, AlarmSoundService::class.java))
            promise.resolve("Service stopped (alarm_fired_pending preserved)")
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    /**
     * Exit Lock Task (screen pinning) mode.
     * Called from mission.tsx handleComplete() immediately after stopping the alarm
     * so the user is never trapped inside the app after mission completion.
     */
    @ReactMethod
    fun stopLockTask(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity != null) {
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    try { activity.stopLockTask() } catch (_: Exception) {}
                }
            }
            promise.resolve("OK")
        } catch (e: Exception) {
            promise.reject("LOCK_TASK_ERROR", e.message, e)
        }
    }

    /**
     * Start the native alarm vibration pattern from JS.
     * Used when snooze ends and the alarm must resume vibrating.
     * Sends ACTION_START_VIBRATION to the running AlarmSoundService.
     */
    @ReactMethod
    fun startAlarmVibration(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, AlarmSoundService::class.java).apply {
                    action = AlarmSoundServiceBase.ACTION_START_VIBRATION
                }
            )
            promise.resolve("Vibration started")
        } catch (e: Exception) {
            promise.reject("VIBRATION_ERROR", e.message, e)
        }
    }

    /**
     * Stop the native alarm vibration pattern from JS.
     * Used when snooze starts — audio is ducked and vibration must pause too.
     * Sends ACTION_STOP_VIBRATION to the running AlarmSoundService.
     */
    @ReactMethod
    fun stopAlarmVibration(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, AlarmSoundService::class.java).apply {
                    action = AlarmSoundServiceBase.ACTION_STOP_VIBRATION
                }
            )
            promise.resolve("Vibration stopped")
        } catch (e: Exception) {
            promise.reject("VIBRATION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAlarmSound(mantraId: String, promise: Promise) {
        try {
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_SOUND, mantraId).apply()
            promise.resolve("Sound set: $mantraId")
        } catch (e: Exception) {
            promise.reject("SOUND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAlarmSoundPath(path: String, promise: Promise) {
        try {
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_SOUND_PATH, path).apply()
            promise.resolve("Sound path set: $path")
        } catch (e: Exception) {
            promise.reject("SOUND_PATH_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isAlarmSoundPlaying(promise: Promise) {
        try {
            @Suppress("DEPRECATION")
            val running = (reactContext.getSystemService(Context.ACTIVITY_SERVICE)
                    as android.app.ActivityManager)
                .getRunningServices(Int.MAX_VALUE)
                .any { it.service.className == AlarmSoundService::class.java.name }
            promise.resolve(running)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isBatteryOptimizationIgnored(promise: Promise) {
        try {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        try {
            reactContext.startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
            promise.resolve("Settings opened")
        } catch (e: Exception) {
            promise.reject("BATTERY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                promise.resolve(am.canScheduleExactAlarms())
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactContext.startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            promise.resolve("Settings opened")
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message, e)
        }
    }

    // ── Signal that a system image-picker (camera / gallery) is active ───────
    // While picker_active=true the AlarmSoundService lifecycle watchdog will NOT
    // call startActivity() when MainActivity is paused — otherwise it immediately
    // brings the app back to front and dismisses the camera/gallery overlay.
    @ReactMethod
    fun setPickerActive(active: Boolean, promise: Promise) {
        try {
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("picker_active", active).apply()
            promise.resolve("OK")
        } catch (e: Exception) {
            promise.reject("PICKER_ERROR", e.message, e)
        }
    }

    // ── Called by JS on every app launch to check if we woke up from alarm ──
    // NON-DESTRUCTIVE read — we intentionally do NOT clear the flag here.
    // Only stopAlarmSound() clears it, which is the single source of truth
    // for "user completed mission / alarm stopped".
    @ReactMethod
    fun wasAlarmFired(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val fired = prefs.getBoolean("alarm_fired_pending", false)
            // Do NOT clear here — stopAlarmSound() handles clearing
            promise.resolve(fired)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ── Full-screen intent permission (Android 14+) ───────────────────────
    @ReactMethod
    @Suppress("NewApi")
    fun checkFullScreenIntentPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                promise.resolve(nm.canUseFullScreenIntent())
            } else {
                promise.resolve(true) // Granted by default before Android 14
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    @Suppress("NewApi")
    fun openFullScreenIntentSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                reactContext.startActivity(
                    Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT").apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            promise.resolve("Settings opened")
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message, e)
        }
    }

    // ── "Appear on top of other apps" (SYSTEM_ALERT_WINDOW) ─────────────────
    // Required on Android 6+ for overlay windows. Granted at install on older versions.
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactContext))
            } else {
                promise.resolve(true) // granted at install on pre-M
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                reactContext.startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            promise.resolve("OK")
        } catch (e: Exception) {
            promise.reject("OVERLAY_ERROR", e.message, e)
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────
    private fun buildPendingIntent(): PendingIntent =
        PendingIntent.getBroadcast(
            reactContext,
            REQUEST_CODE,
            Intent(reactContext, AlarmBroadcastReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
}
