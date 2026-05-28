package com.solrize

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Foreground service for habit and quick alarms.
 *
 * All shared alarm logic — FULL_WAKE_LOCK (Phase 2), ActivityLifecycleCallbacks
 * and 500 ms polling watchdogs, audio playback, HOME-button protection,
 * onTaskRemoved self-restart — lives in AlarmSoundServiceBase.
 *
 * This subclass only supplies habit/quick-alarm-specific configuration:
 * the /habit-alarm-ringing deep-link URI with encoded params,
 * SharedPreferences key (habit_alarm_active), notification content, and
 * habit params loaded from intent extras (or SharedPreferences on
 * START_STICKY null-intent restarts).
 */
class HabitAlarmSoundService : AlarmSoundServiceBase() {

    // Habit-specific params — populated in onLoadParams() before any other call.
    private var habitKey   = ""
    private var habitEmoji = "🌿"
    private var habitLabel = "Habit Alarm"
    private var alarmType  = "habit"
    private var mantraPath = ""

    companion object {
        const val CHANNEL_ID        = "arise_habit_alarm_service_v1"
        const val NOTIF_ID          = 1002
        const val ACTION_SET_VOLUME = "com.solrize.SET_HABIT_ALARM_VOLUME"
        const val EXTRA_VOLUME      = "volume"
    }

    // ── AlarmSoundServiceBase contract ────────────────────────────────────────

    override fun isAlarmActive(): Boolean =
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(HabitAlarmModule.KEY_ACTIVE, false)

    override fun buildDeepLinkUri(): Uri {
        if (alarmType == "soundbath") {
            // For soundbath alarms, habitKey holds the soundId (set by JS scheduler).
            val sid = Uri.encode(habitKey)
            val lbl = Uri.encode(habitLabel)
            return Uri.parse("solrize://soundbath-ringing?soundId=$sid&label=$lbl")
        }
        val hk = Uri.encode(habitKey)
        val he = Uri.encode(habitEmoji)
        val hl = Uri.encode(habitLabel)
        val at = Uri.encode(alarmType)
        return Uri.parse("solrize://habit-alarm-ringing?habitKey=$hk&habitEmoji=$he&label=$hl&alarmType=$at")
    }

    override fun getActionSetVolume(): String = ACTION_SET_VOLUME
    override fun getExtraVolumeKey(): String  = EXTRA_VOLUME
    override fun getNotifId(): Int            = NOTIF_ID

    /**
     * Request code 100 — must differ from AlarmSoundService (99) so
     * the two onTaskRemoved PendingIntents never overwrite each other.
     */
    override fun getRestartRequestCode(): Int = 100

    /**
     * Load habitKey / habitEmoji / habitLabel / alarmType / mantraPath from
     * the incoming Intent extras (supplied by HabitAlarmBroadcastReceiver).
     * On a START_STICKY null-intent restart, restore from SharedPreferences so
     * buildDeepLinkUri() produces the correct habit screen URI.
     */
    override fun onLoadParams(intent: Intent?) {
        val paramPrefs = getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        if (intent != null) {
            habitKey   = intent.getStringExtra("habit_key")   ?: habitKey
            habitEmoji = intent.getStringExtra("habit_emoji") ?: habitEmoji
            habitLabel = intent.getStringExtra("habit_label") ?: habitLabel
            alarmType  = intent.getStringExtra("alarm_type")  ?: alarmType
            mantraPath = intent.getStringExtra("mantra_path") ?: mantraPath
            // Persist so START_STICKY null-intent restart can recover the correct params.
            paramPrefs.edit()
                .putString("active_habit_key",   habitKey)
                .putString("active_habit_emoji", habitEmoji)
                .putString("active_habit_label", habitLabel)
                .putString("active_alarm_type",  alarmType)
                .putString("active_mantra_path", mantraPath)
                .apply()
        } else {
            habitKey   = paramPrefs.getString("active_habit_key",   "") ?: ""
            habitEmoji = paramPrefs.getString("active_habit_emoji", "🌿") ?: "🌿"
            habitLabel = paramPrefs.getString("active_habit_label", "Habit Alarm") ?: "Habit Alarm"
            alarmType  = paramPrefs.getString("active_alarm_type",  "habit") ?: "habit"
            mantraPath = paramPrefs.getString("active_mantra_path", "") ?: ""
        }
    }

    /** Return mantraPath if non-empty; null tells base class to use the bundled raw fallback. */
    override fun getSoundPath(): String? = mantraPath.ifEmpty { null }

    override fun getOverlayTitle(): String = "$habitEmoji  $habitLabel"
    override fun getOverlayBody(): String = when (alarmType) {
        "quick"     -> "Your alarm is ringing"
        "soundbath" -> "Your Sound Bath is ready 🎵"
        else        -> "Time for your daily habit"
    }

    override fun markAlarmActive() {
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(HabitAlarmModule.KEY_ACTIVE, true).apply()
    }

    // ── Notification channel ──────────────────────────────────────────────────

    override fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Arise Habit Alarm",
                NotificationManager.IMPORTANCE_MAX
            ).apply {
                setSound(null, null)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 300, 500)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }
    }

    // ── FGS notification ──────────────────────────────────────────────────────

    override fun buildNotification(): Notification {
        val pi = buildFullScreenPendingIntent()
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("$habitEmoji  $habitLabel")
            .setContentText(
                if (alarmType == "quick") "Your alarm is ringing! ⏰"
                else "Time for your habit! 🙏"
            )
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }
}
