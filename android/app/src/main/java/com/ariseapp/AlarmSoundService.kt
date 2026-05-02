package com.ariseapp

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.*
import android.widget.Toast
import androidx.core.app.NotificationCompat
import java.io.File

class AlarmSoundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null

    // True after the FIRST launchApp() call so subsequent bringToFront calls
    // use a direct MainActivity intent instead of a deep-link URI.
    // Deep-link URIs cause Expo Router to re-process the route, which re-mounts
    // the alarm-ringing component and plays the audio a second time.
    private var alarmScreenLaunched = false

    // ── Primary watchdog: ActivityLifecycleCallbacks ─────────────────────────
    // Fires the instant MainActivity.onPause() is called (e.g. HOME press).
    // Because we call startActivity() on the live Activity object, there are
    // ZERO BAL restrictions — this works on every Android version.
    private val lifecycleWatchdog = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityPaused(activity: Activity) {
            if (activity is MainActivity && isAlarmActive()) {
                try {
                    // FLAG_ACTIVITY_NEW_TASK is mandatory here: by the time onActivityPaused
                    // fires the Activity is mid-transition to background, and Android 10+
                    // will silently drop a startActivity without NEW_TASK in that state.
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

    // ── Secondary watchdog: 500 ms polling (belt-and-suspenders) ──────────────
    // Guards with isAppInForeground() to avoid relaunching when already visible
    // (unnecessary relaunches trigger onNewIntent on MainActivity and could
    // cause Expo Router to re-process the current route).
    private val bringToFrontHandler = Handler(Looper.getMainLooper())
    private val bringToFrontRunnable = object : Runnable {
        override fun run() {
            if (isAlarmActive() && !isAppInForeground()) {
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

    private fun isAlarmActive(): Boolean =
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("alarm_fired_pending", false)

    companion object {
        const val CHANNEL_ID = "arise_alarm_service_v1"
        const val NOTIF_ID = 1001
        const val PREFS_NAME = "alarm_prefs"
        const val KEY_SOUND = "alarm_sound"
        const val ACTION_SET_VOLUME = "com.ariseapp.SET_ALARM_VOLUME"
        const val EXTRA_VOLUME = "volume"
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Handle volume adjustment without restarting the service.
        // This lets JS duck audio for TTS or snooze while keeping the
        // foreground service (and its Home-button watchdogs) alive.
        if (intent?.action == ACTION_SET_VOLUME) {
            val vol = intent.getFloatExtra(EXTRA_VOLUME, 1f)
            mediaPlayer?.setVolume(vol, vol)
            return START_STICKY
        }

        // Acquire wake lock so CPU stays on while alarm plays
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "arise:alarmwakelock"
        ).also { it.acquire(10 * 60 * 1000L) } // max 10 min

        // Mark alarm as active in SharedPreferences BEFORE launching app
        // so MainActivity.isAlarmActive() returns true immediately.
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean("alarm_fired_pending", true).apply()

        // Reset flag so the first call always uses the deep-link path
        alarmScreenLaunched = false
        startForeground(NOTIF_ID, buildNotification())
        showToast("[DBG] AlarmSoundService started ✅ — playing sound...")
        playAlarm()
        launchApp()

        // Register primary watchdog (lifecycle-based, fires on actual pause)
        (application as Application).registerActivityLifecycleCallbacks(lifecycleWatchdog)
        // Register secondary watchdog (polling, fires if lifecycle misses anything)
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
        val prefs = getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        val soundPath = prefs.getString(AlarmModule.KEY_SOUND_PATH, null)

        // Priority 1: Locally downloaded mantra MP3 (user-selected mantra)
        if (!soundPath.isNullOrEmpty()) {
            val file = File(soundPath)
            if (file.exists()) {
                try {
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(buildAudioAttrs())
                        setDataSource(soundPath)
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

        // Priority 2: Bundled mantra_alarm.wav (always present in APK)
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
            showToast("[DBG] Alarm audio failed: ${e.message}")
        }
    }

    private fun launchApp() {
        try {
            // Write flag so JS can detect alarm fired even when notification didn't fire
            getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("alarm_fired_pending", true).apply()

            val launch = if (!alarmScreenLaunched) {
                // FIRST call: deep-link so Expo Router navigates to /alarm-ringing
                alarmScreenLaunched = true
                Intent(Intent.ACTION_VIEW, android.net.Uri.parse("ariseapp://alarm-ringing")).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
            } else {
                // SUBSEQUENT calls (bringToFront loop): bring MainActivity to front without
                // a URI, so Expo Router does NOT re-process the route and does NOT re-mount
                // the alarm-ringing component. SINGLE_TOP ensures no new Activity instance.
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
        // Deep link → Expo Router routes directly to /alarm-ringing, bypassing home screen
        val uri = android.net.Uri.parse("ariseapp://alarm-ringing")
        val launch = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        return PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildNotification(): Notification {
        val pi = buildFullScreenPendingIntent()
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("⏰ Arise Wake Alarm")
            .setContentText("Brahma Muhurta — Rise and begin your sacred day. 🙏")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pi)
            // setFullScreenIntent(highPriority=true) is what makes the screen turn
            // on and the activity launch over the lock screen on Android 10+.
            // Requires USE_FULL_SCREEN_INTENT permission (declared) and on
            // Android 14+ requires user grant via Settings.
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
                "Arise Alarm",
                NotificationManager.IMPORTANCE_MAX  // MAX = urgent, triggers fullScreenIntent reliably
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
        // Stop both watchdogs
        (application as Application).unregisterActivityLifecycleCallbacks(lifecycleWatchdog)
        bringToFrontHandler.removeCallbacks(bringToFrontRunnable)

        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    private fun showToast(msg: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(applicationContext, msg, Toast.LENGTH_LONG).show()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
