package com.solrize

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native bridge for habit/quick alarms.
 * Mirrors AlarmModule but targets HabitAlarmBroadcastReceiver + HabitAlarmSoundService.
 *
 * JS usage:
 *   NativeModules.HabitAlarmModule.scheduleHabitAlarm(ts, key, emoji, label, type, path, id)
 *   NativeModules.HabitAlarmModule.cancelHabitAlarm(id)
 *   NativeModules.HabitAlarmModule.stopHabitAlarmSound()
 *   NativeModules.HabitAlarmModule.setHabitAlarmVolume(0)  // mute native; JS takes over
 *   NativeModules.HabitAlarmModule.wasHabitAlarmFired()
 */
class HabitAlarmModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val PREFS_NAME = "habit_alarm_prefs"
        const val KEY_ACTIVE = "habit_alarm_active"
    }

    override fun getName(): String = "HabitAlarmModule"

    /**
     * Schedule a habit/quick alarm at [timestamp] ms epoch.
     * Alarm params are persisted in SharedPreferences so HabitAlarmBroadcastReceiver
     * can read them when the alarm fires (even if the JS bundle is not running).
     */
    @ReactMethod
    fun scheduleHabitAlarm(
        timestamp: Double,
        habitKey:  String,
        habitEmoji: String,
        label:     String,
        alarmType: String,
        mantraPath: String,
        alarmId:   String,
        promise:   Promise
    ) {
        try {
            val id = alarmId.hashCode()
            // Persist params so the broadcast receiver can read them when alarm fires
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putString("params_${id}_habitKey",   habitKey)
                .putString("params_${id}_habitEmoji", habitEmoji)
                .putString("params_${id}_label",      label)
                .putString("params_${id}_alarmType",  alarmType)
                .putString("params_${id}_mantraPath", mantraPath)
                .putString("params_${id}_alarmId",    alarmId)
                .apply()

            val intent = Intent(reactContext, HabitAlarmBroadcastReceiver::class.java).apply {
                putExtra("alarm_id",     alarmId)
                putExtra("alarm_id_int", id)
            }
            val pi = PendingIntent.getBroadcast(
                reactContext, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val ts = timestamp.toLong()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setWindow(AlarmManager.RTC_WAKEUP, ts, 60_000L, pi)
                promise.resolve("Habit alarm scheduled (inexact) at $ts")
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(ts, pi), pi)
                promise.resolve("Habit alarm scheduled (exact) at $ts")
            }
        } catch (e: Exception) {
            promise.reject("HABIT_ALARM_ERROR", e.message, e)
        }
    }

    /**
     * Cancel a previously scheduled habit alarm by its JS alarm ID.
     */
    @ReactMethod
    fun cancelHabitAlarm(alarmId: String, promise: Promise) {
        try {
            val id = alarmId.hashCode()
            val intent = Intent(reactContext, HabitAlarmBroadcastReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                reactContext, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            (reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi)
            pi.cancel()
            // Clean up stored params
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .remove("params_${id}_habitKey")
                .remove("params_${id}_habitEmoji")
                .remove("params_${id}_label")
                .remove("params_${id}_alarmType")
                .remove("params_${id}_mantraPath")
                .remove("params_${id}_alarmId")
                .apply()
            promise.resolve("Habit alarm cancelled")
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    /**
     * Clear active flag and stop HabitAlarmSoundService.
     * Called by JS when user dismisses the habit/quick alarm screen.
     */
    @ReactMethod
    fun stopHabitAlarmSound(promise: Promise) {
        try {
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ACTIVE, false).apply()
            reactContext.stopService(Intent(reactContext, HabitAlarmSoundService::class.java))
            promise.resolve("Habit alarm sound stopped")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    /**
     * Duck the native MediaPlayer volume without stopping the service.
     * Call with volume=0 as soon as habit-alarm-ringing.tsx mounts so the
     * JS expo-av audio takes over cleanly (same pattern as morning alarm).
     */
    @ReactMethod
    fun setHabitAlarmVolume(volume: Double, promise: Promise) {
        try {
            val intent = Intent(reactContext, HabitAlarmSoundService::class.java).apply {
                action = HabitAlarmSoundService.ACTION_SET_VOLUME
                putExtra(HabitAlarmSoundService.EXTRA_VOLUME, volume.toFloat())
            }
            reactContext.startService(intent)
            promise.resolve("Habit alarm volume set to $volume")
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", e.message, e)
        }
    }

    /**
     * Non-destructive check — true if HabitAlarmSoundService fired and is active.
     * Used by MainActivity.isAlarmActive() and optionally by JS.
     */
    @ReactMethod
    fun wasHabitAlarmFired(promise: Promise) {
        try {
            promise.resolve(
                reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getBoolean(KEY_ACTIVE, false)
            )
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
