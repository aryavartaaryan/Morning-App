package com.solrize

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.*
import androidx.core.app.NotificationCompat
import java.io.File

/**
 * Exact counterpart of AlarmSoundService for habit/quick alarms.
 *
 * Differences from AlarmSoundService:
 *  - Uses HabitAlarmModule.PREFS_NAME / KEY_ACTIVE instead of alarm_fired_pending
 *  - Deep-links to solrize://habit-alarm-ringing?habitKey=…&habitEmoji=…&label=…&alarmType=…
 *  - Reads habit params from intent extras supplied by HabitAlarmBroadcastReceiver
 */
class HabitAlarmSoundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var habitKey   = ""
    private var habitEmoji = "🌿"
    private var habitLabel = "Habit Alarm"
    private var alarmType  = "habit"
    private var mantraPath = ""

    // True after the FIRST launchApp() so subsequent bringToFront calls skip the deep-link
    // and use a plain MainActivity intent — prevents Expo Router from re-mounting the screen.
    private var alarmScreenLaunched = false

    // ── Primary watchdog: ActivityLifecycleCallbacks ─────────────────────────
    private val lifecycleWatchdog = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityPaused(activity: Activity) {
            if (activity is MainActivity && isHabitAlarmActive()) {
                try {
                    activity.startActivity(
                        Intent(activity, MainActivity::class.java).apply {
                            addFlags(
                                Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                Intent.FLAG_ACTIVITY_NO_ANIMATION
                            )
                        }
                    )
                } catch (_: Exception) {}
            }
        }
        override fun onActivityCreated(a: Activity, b: Bundle?) {}
        override fun onActivityStarted(a: Activity) {}
        override fun onActivityResumed(a: Activity) {}
        override fun onActivityStopped(a: Activity) {}
        override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
        override fun onActivityDestroyed(a: Activity) {}
    }

    // ── Secondary watchdog: 500 ms polling ───────────────────────────────────
    private val bringToFrontHandler = Handler(Looper.getMainLooper())
    private val bringToFrontRunnable = object : Runnable {
        override fun run() {
            if (isHabitAlarmActive() && !isAppInForeground()) {
                launchApp()
            }
            bringToFrontHandler.postDelayed(this, 500)
        }
    }

    private fun isAppInForeground(): Boolean {
        return try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val procs = am.runningAppProcesses ?: return false
            procs.any {
                it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
                it.pkgList.contains(packageName)
            }
        } catch (_: Exception) { false }
    }

    private fun isHabitAlarmActive(): Boolean =
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(HabitAlarmModule.KEY_ACTIVE, false)

    companion object {
        const val CHANNEL_ID         = "arise_habit_alarm_service_v1"
        const val NOTIF_ID           = 1002
        const val ACTION_SET_VOLUME  = "com.solrize.SET_HABIT_ALARM_VOLUME"
        const val EXTRA_VOLUME       = "volume"
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Volume duck without restarting service (mirrors AlarmSoundService pattern)
        if (intent?.action == ACTION_SET_VOLUME) {
            val vol = intent.getFloatExtra(EXTRA_VOLUME, 1f)
            mediaPlayer?.setVolume(vol, vol)
            return START_STICKY
        }

        // Read params from intent extras (supplied by HabitAlarmBroadcastReceiver)
        habitKey   = intent?.getStringExtra("habit_key")   ?: habitKey
        habitEmoji = intent?.getStringExtra("habit_emoji") ?: habitEmoji
        habitLabel = intent?.getStringExtra("habit_label") ?: habitLabel
        alarmType  = intent?.getStringExtra("alarm_type")  ?: alarmType
        mantraPath = intent?.getStringExtra("mantra_path") ?: mantraPath

        // Acquire wake lock — CPU stays alive while alarm plays
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "arise:habitAlarmWakeLock"
        ).also { it.acquire(10 * 60 * 1000L) }

        // Mark habit alarm as active BEFORE launching app
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(HabitAlarmModule.KEY_ACTIVE, true).apply()

        alarmScreenLaunched = false
        startForeground(NOTIF_ID, buildNotification())
        playAlarm()
        launchApp()

        // Register both watchdogs (same as morning alarm)
        (application as Application).registerActivityLifecycleCallbacks(lifecycleWatchdog)
        bringToFrontHandler.postDelayed(bringToFrontRunnable, 500)

        return START_STICKY
    }

    private fun buildAudioAttrs(): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setLegacyStreamType(AudioManager.STREAM_ALARM)
            .build()

    private fun playAlarm() {
        // Priority 1: Locally downloaded mantra passed from JS
        if (mantraPath.isNotEmpty()) {
            val file = File(mantraPath)
            if (file.exists()) {
                try {
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(buildAudioAttrs())
                        setDataSource(mantraPath)
                        isLooping = true
                        prepare()
                        start()
                    }
                    return
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        // Priority 2: Bundled mantra_alarm.wav
        playFromRaw()
    }

    private fun playFromRaw() {
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(buildAudioAttrs())
                val afd = resources.openRawResourceFd(R.raw.mantra_alarm)
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildDeepLinkUri(): Uri {
        val hk = Uri.encode(habitKey)
        val he = Uri.encode(habitEmoji)
        val hl = Uri.encode(habitLabel)
        val at = Uri.encode(alarmType)
        return Uri.parse("solrize://habit-alarm-ringing?habitKey=$hk&habitEmoji=$he&label=$hl&alarmType=$at")
    }

    private fun launchApp() {
        try {
            getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean(HabitAlarmModule.KEY_ACTIVE, true).apply()

            val launch = if (!alarmScreenLaunched) {
                // FIRST call: deep-link so Expo Router navigates to /habit-alarm-ringing
                alarmScreenLaunched = true
                Intent(Intent.ACTION_VIEW, buildDeepLinkUri()).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
            } else {
                // SUBSEQUENT calls: bring MainActivity to front WITHOUT deep-link URI
                // so Expo Router does NOT re-mount the habit-alarm-ringing screen.
                Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_NO_ANIMATION
                    )
                }
            }
            startActivity(launch)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildFullScreenPendingIntent(): PendingIntent {
        val launch = Intent(Intent.ACTION_VIEW, buildDeepLinkUri()).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        return PendingIntent.getActivity(
            this, NOTIF_ID, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildNotification(): Notification {
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

    private fun createChannel() {
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

    override fun onDestroy() {
        (application as Application).unregisterActivityLifecycleCallbacks(lifecycleWatchdog)
        bringToFrontHandler.removeCallbacks(bringToFrontRunnable)
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
