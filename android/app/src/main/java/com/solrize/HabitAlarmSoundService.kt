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

    // Accurate foreground flag tracked by lifecycle watchdog (same pattern as AlarmSoundService).
    @Volatile private var mainActivityResumed = false

    // ── Primary watchdog: ActivityLifecycleCallbacks ─────────────────────────────
    private val lifecycleWatchdog = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(a: Activity) {
            if (a is MainActivity) mainActivityResumed = true
        }
        override fun onActivityPaused(activity: Activity) {
            if (activity is MainActivity) {
                mainActivityResumed = false
                if (isHabitAlarmActive() && !isPickerActive()) {
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
        }
        override fun onActivityCreated(a: Activity, b: Bundle?) {}
        override fun onActivityStarted(a: Activity) {}
        override fun onActivityStopped(a: Activity) {}
        override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
        override fun onActivityDestroyed(a: Activity) {}
    }

    // ── Secondary watchdog: 500 ms polling ────────────────────────────────────
    private val bringToFrontHandler = Handler(Looper.getMainLooper())
    private val bringToFrontRunnable = object : Runnable {
        override fun run() {
            if (isHabitAlarmActive() && !isAppInForeground() && !isPickerActive()) {
                launchApp()
            }
            bringToFrontHandler.postDelayed(this, 500)
        }
    }

    // Lifecycle-based check — replaces deprecated getRunningAppProcesses() (broken on Android 11+).
    private fun isAppInForeground(): Boolean = mainActivityResumed

    private fun isHabitAlarmActive(): Boolean =
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(HabitAlarmModule.KEY_ACTIVE, false)

    // Reads picker_active from the wake-alarm prefs (set by AlarmModule.setPickerActive).
    private fun isPickerActive(): Boolean =
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("picker_active", false)

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

        // Read params from intent extras (supplied by HabitAlarmBroadcastReceiver).
        // On START_STICKY restart intent is null — restore from SharedPreferences so the
        // correct habit screen is shown instead of defaulting to the wake-up alarm route.
        val paramPrefs = getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        if (intent != null) {
            habitKey   = intent.getStringExtra("habit_key")   ?: habitKey
            habitEmoji = intent.getStringExtra("habit_emoji") ?: habitEmoji
            habitLabel = intent.getStringExtra("habit_label") ?: habitLabel
            alarmType  = intent.getStringExtra("alarm_type")  ?: alarmType
            mantraPath = intent.getStringExtra("mantra_path") ?: mantraPath
            // Persist active params so a START_STICKY null-intent restart can restore them
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

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (isHabitAlarmActive()) {
            // App swiped from recents while habit alarm is active.
            // Schedule AlarmManager self-restart in 1s as backup for ROMs that ignore START_STICKY.
            // Note: with android:stopWithTask="false" this is belt-and-suspenders only.
            try {
                val restart = PendingIntent.getService(
                    applicationContext, 100,
                    Intent(applicationContext, HabitAlarmSoundService::class.java),
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
                (getSystemService(Context.ALARM_SERVICE) as AlarmManager)
                    .set(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        android.os.SystemClock.elapsedRealtime() + 1_000L, restart)
            } catch (_: Exception) {}
        }
        super.onTaskRemoved(rootIntent)
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
