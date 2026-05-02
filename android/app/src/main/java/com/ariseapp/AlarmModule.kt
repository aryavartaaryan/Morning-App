package com.ariseapp

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
            // Clear the alarm-active flag FIRST so that back/home button is unblocked
            // immediately, before the service has a chance to re-launch the screen.
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("alarm_fired_pending", false).apply()
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
