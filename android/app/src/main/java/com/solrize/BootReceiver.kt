package com.solrize

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * Reschedules the native AlarmManager alarm after device reboot.
 *
 * The Notifee BootReceiver handles rescheduling for Notifee-managed alarms.
 * This receiver covers the AlarmModule.scheduleAlarm() path which uses a
 * raw AlarmManager.setAlarmClock() — those are cancelled by the OS on reboot.
 *
 * Reads alarm_hour / alarm_minute from SharedPreferences (written by
 * AlarmModule.scheduleAlarm and AlarmBroadcastReceiver) and re-schedules
 * for the next occurrence of that wall-clock time.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        Log.d("AriseAlarm", "BootReceiver fired (action=$action) — checking for saved alarm")

        val prefs = context.getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        val hour = prefs.getInt("alarm_hour", -1)
        val minute = prefs.getInt("alarm_minute", -1)
        if (hour < 0 || minute < 0) {
            Log.d("AriseAlarm", "BootReceiver: no saved alarm_hour/alarm_minute — skipping")
            return
        }

        val next = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.DAY_OF_MONTH, 1)
            }
        }

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(
            context,
            AlarmModule.REQUEST_CODE,
            Intent(context, AlarmBroadcastReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setWindow(AlarmManager.RTC_WAKEUP, next.timeInMillis, 60_000L, pi)
                Log.d("AriseAlarm", "BootReceiver: rescheduled (inexact) for ${next.time}")
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(next.timeInMillis, pi), pi)
                Log.d("AriseAlarm", "BootReceiver: rescheduled (exact) for ${next.time}")
            }
        } catch (e: Exception) {
            Log.e("AriseAlarm", "BootReceiver: failed to reschedule alarm", e)
        }
    }
}
