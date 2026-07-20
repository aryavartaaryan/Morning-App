package com.solrize

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Foreground service for the Brahma Muhurta wake-up alarm.
 *
 * All shared alarm logic — FULL_WAKE_LOCK (Phase 2), ActivityLifecycleCallbacks
 * and 500 ms polling watchdogs, audio playback, HOME-button protection,
 * onTaskRemoved self-restart — lives in AlarmSoundServiceBase.
 *
 * This subclass only supplies wake-alarm-specific configuration:
 * the /wake-alarm-ringing deep-link URI, SharedPreferences key (alarm_fired_pending),
 * notification content, and sound path.
 */
class AlarmSoundService : AlarmSoundServiceBase() {

    companion object {
        const val CHANNEL_ID        = "arise_alarm_service_v1"
        const val NOTIF_ID          = 1001
        const val ACTION_SET_VOLUME = "com.solrize.SET_ALARM_VOLUME"
        const val EXTRA_VOLUME      = "volume"
    }

    // ── AlarmSoundServiceBase contract ────────────────────────────────────────

    override fun isAlarmActive(): Boolean =
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("alarm_fired_pending", false)

    override fun buildDeepLinkUri(): Uri =
        Uri.parse("solrize://wake-alarm-ringing")

    override fun getActionSetVolume(): String = ACTION_SET_VOLUME
    override fun getExtraVolumeKey(): String  = EXTRA_VOLUME
    override fun getNotifId(): Int            = NOTIF_ID

    /**
     * Request code 99 — must differ from HabitAlarmSoundService (100) so
     * the two onTaskRemoved PendingIntents never overwrite each other.
     */
    override fun getRestartRequestCode(): Int = 99

    override fun getOverlayTitle(): String = "⏰  Arise Wake Alarm"
    override fun getOverlayBody(): String  = "Time to rise and begin your day"

    /**
     * Wake alarm carries no intent extras — the selected mantra path is
     * always read from SharedPreferences in getSoundPath() below.
     */
    override fun onLoadParams(intent: Intent?) { /* no extras for wake alarm */ }

    override fun getSoundPath(): String? =
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(AlarmModule.KEY_SOUND_PATH, null)

    override fun markAlarmActive() {
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean("alarm_fired_pending", true).apply()
    }

    // ── Notification channel ──────────────────────────────────────────────────

    override fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Arise Alarm",
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
            .setContentTitle("⏰ Arise Wake Alarm")
            .setContentText("Wake Alarm — Time to rise and begin your day. 🙏")
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
