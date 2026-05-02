package com.ariseapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import java.util.Calendar

class AlarmBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("OneSutraAlarm", "AlarmBroadcastReceiver fired at ${System.currentTimeMillis()}")
        showToast(context, "[DBG 1/3] Alarm broadcast received ✅")

        // 1. Start the foreground service that plays the alarm and shows full-screen UI.
        val serviceIntent = Intent(context, AlarmSoundService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            showToast(context, "[DBG 2/3] AlarmSoundService start sent ✅")
        } catch (e: Exception) {
            Log.e("OneSutraAlarm", "Failed to start AlarmSoundService", e)
            showToast(context, "[DBG] Service start FAILED ❌: ${e.message}")
        }

        // 2. Reschedule for tomorrow at the same wall-clock time so this alarm
        //    keeps repeating daily even if the JS bundle is never opened again.
        try {
            val prefs = context.getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            val hour = prefs.getInt("alarm_hour", -1)
            val minute = prefs.getInt("alarm_minute", -1)
            if (hour < 0 || minute < 0) return

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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setWindow(AlarmManager.RTC_WAKEUP, next.timeInMillis, 60_000L, pi)
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(next.timeInMillis, pi), pi)
            }
            Log.d("OneSutraAlarm", "Rescheduled next alarm for ${next.time}")
            showToast(context, "[DBG 3/3] Next alarm set for ${next.time} ✅")
        } catch (e: Exception) {
            Log.e("OneSutraAlarm", "Failed to reschedule alarm", e)
            showToast(context, "[DBG] Reschedule FAILED ❌: ${e.message}")
        }
    }

    private fun showToast(context: Context, msg: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
        }
    }
}
