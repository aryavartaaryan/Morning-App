package com.solrize

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
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
        const val PREFS_NAME    = "habit_alarm_prefs"
        const val KEY_ACTIVE    = "habit_alarm_active"
        /** StringSet of all currently-scheduled alarm int IDs — read by BootReceiver on reboot. */
        const val KEY_ACTIVE_IDS = "active_habit_alarm_ids"
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
            // Persist params so the broadcast receiver can read them when alarm fires.
            // Also persist the timestamp and add the id to the active set so BootReceiver
            // can reschedule every habit alarm after a device reboot or package replace.
            val ts    = timestamp.toLong()
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val activeIds = prefs.getStringSet(KEY_ACTIVE_IDS, emptySet())?.toMutableSet()
                ?: mutableSetOf()
            activeIds.add(id.toString())
            prefs.edit()
                .putString("params_${id}_habitKey",   habitKey)
                .putString("params_${id}_habitEmoji", habitEmoji)
                .putString("params_${id}_label",      label)
                .putString("params_${id}_alarmType",  alarmType)
                .putString("params_${id}_mantraPath", mantraPath)
                .putString("params_${id}_alarmId",    alarmId)
                .putLong  ("params_${id}_timestamp",  ts)
                .putStringSet(KEY_ACTIVE_IDS, activeIds)
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
            // Remove from active set so BootReceiver doesn't try to reschedule a cancelled alarm.
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val activeIds = prefs.getStringSet(KEY_ACTIVE_IDS, emptySet())?.toMutableSet()
                ?: mutableSetOf()
            activeIds.remove(id.toString())
            prefs.edit().putStringSet(KEY_ACTIVE_IDS, activeIds).apply()
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
            // Write alarm_stopping=true FIRST (synchronous .commit()) so that:
            // 1. onTaskRemoved() sees it and does NOT schedule a 1-second AlarmManager restart.
            // 2. The 200ms bringToFrontRunnable in AlarmSoundServiceBase sees it and
            //    stops re-posting itself — preventing it from fighting router navigation.
            //
            // CRITICAL: We do NOT clear alarm_stopping=false here any more.
            // stopService() is ASYNCHRONOUS — clearing it here left a window where
            // watchdogs could fire before onDestroy() ran, causing the freeze.
            // alarm_stopping is cleared in AlarmSoundServiceBase.onDestroy().
            reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("alarm_stopping", true)
                .putBoolean(KEY_ACTIVE, false)
                .commit()
            reactContext.stopService(Intent(reactContext, HabitAlarmSoundService::class.java))
            promise.resolve("Habit alarm sound stopped")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }


    /**
     * Stop the vibration running inside HabitAlarmSoundService without stopping
     * the full service. Sends ACTION_STOP_VIBRATION to HabitAlarmSoundService.
     *
     * Note: stopAlarmVibration() in nativeAlarm.ts targets AlarmSoundService
     * (the wake alarm service) — it has NO effect on habit alarm vibration.
     * This method is the correct way to stop habit/quick alarm vibration from JS.
     */
    @ReactMethod
    fun stopHabitAlarmVibration(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, HabitAlarmSoundService::class.java).apply {
                    action = AlarmSoundServiceBase.ACTION_STOP_VIBRATION
                }
            )
            promise.resolve("Habit alarm vibration stopped")
        } catch (e: Exception) {
            // Non-fatal — if service is already stopped, vibration is already gone
            promise.resolve("Habit alarm vibration stop (service not running)")
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
     * Remove the TYPE_APPLICATION_OVERLAY window drawn by HabitAlarmSoundService.
     * Called from habit-alarm-ringing.tsx as soon as the RN screen has fully mounted,
     * so the native overlay placeholder is replaced by the proper React UI.
     */
    @ReactMethod
    fun dismissHabitAlarmOverlay(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, HabitAlarmSoundService::class.java).apply {
                    action = AlarmSoundServiceBase.ACTION_DISMISS_OVERLAY
                }
            )
            promise.resolve("Habit overlay dismissed")
        } catch (e: Exception) {
            promise.reject("OVERLAY_ERROR", e.message, e)
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

    /**
     * Returns the active habit alarm params (alarmType, habitKey, habitEmoji, habitLabel,
     * mantraPath) written by HabitAlarmSoundService.onLoadParams() when the alarm fires.
     *
     * Returns null when no habit alarm is active (KEY_ACTIVE = false).
     *
     * JS uses this as a belt-and-suspenders fallback: if the deep-link from
     * HabitAlarmSoundService.launchApp() was not processed by Expo Router before
     * AuthGuard ran (race condition), _layout.tsx reads these prefs directly and
     * re-routes to the correct alarm screen — critical for soundbath alarms which
     * have no onesutra_pending_soundbath_v1 AsyncStorage key on the native path.
     */
    @ReactMethod
    fun getActiveHabitAlarmParams(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_ACTIVE, false)) {
                promise.resolve(null)
                return
            }
            val map = Arguments.createMap()
            map.putString("alarmType",  prefs.getString("active_alarm_type",  "habit") ?: "habit")
            map.putString("habitKey",   prefs.getString("active_habit_key",   "") ?: "")
            map.putString("habitEmoji", prefs.getString("active_habit_emoji", "\uD83C\uDF3F") ?: "\uD83C\uDF3F")
            map.putString("habitLabel", prefs.getString("active_habit_label", "Alarm") ?: "Alarm")
            map.putString("mantraPath", prefs.getString("active_mantra_path", "") ?: "")
            promise.resolve(map)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
