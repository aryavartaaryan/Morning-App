package com.solrize

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Receives the AlarmManager broadcast for habit/quick alarms.
 * Reads the stored alarm params and starts HabitAlarmSoundService
 * — identical pattern to AlarmBroadcastReceiver for the morning alarm.
 */
class HabitAlarmBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId    = intent.getStringExtra("alarm_id") ?: ""
        val alarmIdInt = intent.getIntExtra("alarm_id_int", alarmId.hashCode())
        Log.d("AriseAlarm", "HabitAlarmBroadcastReceiver fired (id=$alarmId)")

        val prefs = context.getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        val habitKey   = prefs.getString("params_${alarmIdInt}_habitKey",   "") ?: ""
        val habitEmoji = prefs.getString("params_${alarmIdInt}_habitEmoji", "🌿") ?: "🌿"
        val label      = prefs.getString("params_${alarmIdInt}_label",      "Habit Alarm") ?: "Habit Alarm"
        val alarmType  = prefs.getString("params_${alarmIdInt}_alarmType",  "habit") ?: "habit"
        val mantraPath = prefs.getString("params_${alarmIdInt}_mantraPath", "") ?: ""

        val serviceIntent = Intent(context, HabitAlarmSoundService::class.java).apply {
            putExtra("habit_key",    habitKey)
            putExtra("habit_emoji",  habitEmoji)
            putExtra("habit_label",  label)
            putExtra("alarm_type",   alarmType)
            putExtra("mantra_path",  mantraPath)
            putExtra("alarm_id_int", alarmIdInt)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d("AriseAlarm", "HabitAlarmSoundService start sent ✅")
        } catch (e: Exception) {
            Log.e("AriseAlarm", "Failed to start HabitAlarmSoundService", e)
        }
    }
}
