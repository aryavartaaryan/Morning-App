package com.solrize

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar
import java.util.Date

/**
 * Reschedules ALL native AlarmManager alarms after device reboot or package replace.
 *
 * Covers two alarm tracks:
 *
 *  1. Wake alarm   — AlarmModule.scheduleAlarm() path.
 *                    Reads alarm_hour / alarm_minute from AlarmModule.PREFS_NAME and
 *                    re-schedules for the next occurrence of that wall-clock time (daily).
 *
 *  2. Habit alarms — HabitAlarmModule.scheduleHabitAlarm() path.
 *                    Iterates the active_habit_alarm_ids StringSet stored by HabitAlarmModule,
 *                    reads each alarm's persisted timestamp + params, and re-registers with
 *                    AlarmManager. If the saved timestamp is already in the past, the alarm
 *                    is rescheduled for the same hour:minute the NEXT day so recurring habit
 *                    alarms always survive reboots.
 *
 * The Notifee BootReceiver (registered separately in the manifest) handles Notifee-managed
 * trigger notifications — this receiver only covers the raw AlarmManager path.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        Log.d("AriseAlarm", "BootReceiver fired (action=$action)")

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // STALE STATE FIX: Clear alarm_fired_pending on reboot.
        // If the phone was restarted mid-mission (e.g., user restarted because
        // the keyboard was not working in gratitude mission), alarm_fired_pending
        // stays true. On next app launch, _layout.tsx routes to wake-alarm-ringing
        // even though no alarm is actually ringing — causing a stuck/broken state.
        // Clearing it on boot ensures the app opens normally. The rescheduled alarm
        // (below) will ring at the correct time and set the flag again properly.
        clearStaleAlarmState(context)

        rescheduleWakeAlarm(context, am)
        rescheduleHabitAlarms(context, am)
        restartDailyStepTracking(context)
    }

    private fun clearStaleAlarmState(context: Context) {
        context.getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("alarm_fired_pending", false)
            .apply()
            
        // STALE STATE FIX 2: Also clear HabitAlarm active flags.
        // Without this, if the phone is rebooted during a habit alarm or sound bath,
        // KEY_ACTIVE remains true forever. On next launch, MainActivity enters
        // LockTask mode (screen pinning) and aggressive bringToFront, which locks
        // the app up and causes crashes/ANRs when the user tries to navigate normally.
        context.getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(HabitAlarmModule.KEY_ACTIVE, false)
            .putString("active_alarm_type", "")
            .apply()
            
        Log.d("AriseAlarm", "BootReceiver: cleared all stale alarm states")
    }

    // ── Wake alarm ────────────────────────────────────────────────────────────

    private fun rescheduleWakeAlarm(context: Context, am: AlarmManager) {
        val prefs  = context.getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        val hour   = prefs.getInt("alarm_hour",   -1)
        val minute = prefs.getInt("alarm_minute", -1)

        if (hour < 0 || minute < 0) {
            Log.d("AriseAlarm", "BootReceiver: no wake alarm saved — skipping wake reschedule")
            return
        }

        val next = nextOccurrence(hour, minute)
        val pi   = PendingIntent.getBroadcast(
            context, AlarmModule.REQUEST_CODE,
            Intent(context, AlarmBroadcastReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        scheduleExact(am, next, pi)
        Log.d("AriseAlarm", "BootReceiver: wake alarm rescheduled for ${Date(next)}")
    }

    // ── Habit alarms ──────────────────────────────────────────────────────────

    private fun rescheduleHabitAlarms(context: Context, am: AlarmManager) {
        val prefs     = context.getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        val activeIds = prefs.getStringSet(HabitAlarmModule.KEY_ACTIVE_IDS, emptySet()) ?: emptySet()

        if (activeIds.isEmpty()) {
            Log.d("AriseAlarm", "BootReceiver: no habit alarms saved — skipping habit reschedule")
            return
        }

        val now = System.currentTimeMillis()

        for (idStr in activeIds) {
            val id        = idStr.toIntOrNull() ?: continue
            val savedTs   = prefs.getLong("params_${id}_timestamp", -1L)
            val alarmId   = prefs.getString("params_${id}_alarmId", "") ?: ""

            if (savedTs <= 0L) {
                Log.w("AriseAlarm", "BootReceiver: habit alarm id=$id has no timestamp — skipping")
                continue
            }

            // If the saved time is in the future, use it as-is.
            // If it already passed (e.g., phone was off for a day), keep the same
            // hour:minute but advance to the next future day — mirrors AlarmBroadcastReceiver.
            val alarmTime = if (savedTs > now) {
                savedTs
            } else {
                val cal = Calendar.getInstance().apply { timeInMillis = savedTs }
                nextOccurrence(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
            }

            val pi = PendingIntent.getBroadcast(
                context, id,
                Intent(context, HabitAlarmBroadcastReceiver::class.java).apply {
                    putExtra("alarm_id",     alarmId)
                    putExtra("alarm_id_int", id)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            scheduleExact(am, alarmTime, pi)
            Log.d("AriseAlarm", "BootReceiver: habit alarm id=$id rescheduled for ${Date(alarmTime)}")
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Returns the next epoch-ms for [hour]:[minute], advancing by 1 day if already past. */
    private fun nextOccurrence(hour: Int, minute: Int): Long =
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE,      minute)
            set(Calendar.SECOND,      0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_MONTH, 1)
        }.timeInMillis

    /** Schedules [pi] at [atMs] using setAlarmClock (exact) or setWindow (inexact fallback). */
    private fun scheduleExact(am: AlarmManager, atMs: Long, pi: PendingIntent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setWindow(AlarmManager.RTC_WAKEUP, atMs, 60_000L, pi)
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, pi), pi)
            }
        } catch (e: Exception) {
            Log.e("AriseAlarm", "BootReceiver: scheduleExact failed", e)
        }
    }

    /** Restarts daily step tracking after boot if it was enabled before shutdown. */
    private fun restartDailyStepTracking(context: Context) {
        val prefs   = context.getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("daily_tracking_enabled", false)
        if (!enabled) {
            Log.d("AriseAlarm", "BootReceiver: daily step tracking not enabled — skip")
            return
        }
        Log.d("AriseAlarm", "BootReceiver: restarting daily step tracking after boot")
        val intent = Intent(context, StepCounterService::class.java).apply {
            action = StepCounterService.ACTION_START_DAILY
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}

