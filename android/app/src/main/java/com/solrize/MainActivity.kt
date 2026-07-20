package com.solrize
import expo.modules.splashscreen.SplashScreenManager

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.KeyEvent
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  // Debounce handler for onWindowFocusChanged focus-loss — prevents the
  // bring-to-front from firing during the brief gap between alarm dismissal
  // and the SharedPreferences .commit() becoming visible on the UI thread.
  private val focusLossHandler  = android.os.Handler(android.os.Looper.getMainLooper())
  private var focusLossRunnable: Runnable? = null
  private var lockTaskStartedForAlarm = false
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    
    // Intercept intent BEFORE super.onCreate so React Native sees the modified intent on boot
    interceptLauncherIntentIfNeeded(intent)
    super.onCreate(null)

    // Always show over lock screen — required for alarm fullScreenIntent on all Android versions
    // Only apply these flags if an alarm is active. Otherwise, allow normal app launch behaviour.
    if (isAlarmActive()) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
        setTurnScreenOn(true)
      } else {
        @Suppress("DEPRECATION")
        window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
      }
      // KEEP_SCREEN_ON must be set when alarm is active
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  override fun onNewIntent(intent: Intent) {
    interceptLauncherIntentIfNeeded(intent)
    super.onNewIntent(intent)
    setIntent(intent)
    // Re-apply keep-screen-on every time the alarm service brings us back to front
    if (isAlarmActive()) {
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      // FIX: Start lock task here too — covers the case where the alarm fires
      // while the app is ALREADY OPEN (onResume is not called again in that case).
      // This handles wake alarm, habit alarm, and quick alarm equally since
      // isAlarmActive() checks ALL alarm types from SharedPreferences.
      startAlarmLockTaskOnce()
    }
  }

  override fun onResume() {
    super.onResume()
    if (!isAlarmActive()) {
      // Alarm stopped (or normal usage) — clear flags to restore normal Android screen lock behaviour
      window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(false)
        setTurnScreenOn(false)
      } else {
        @Suppress("DEPRECATION")
        window.clearFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
      }
      
      // Alarm stopped — cancel any pending focus-loss debounce so the
      // bring-to-front never fires after the user has dismissed the alarm.
      focusLossRunnable?.let { focusLossHandler.removeCallbacks(it) }
      focusLossRunnable = null

      // If we're returning from alarm navigation and Lock Task is still active,
      // ensure it is stopped. Safe to call even if not in lock task mode.
      try { stopLockTask() } catch (_: Exception) {}

      return
    }
    // Re-apply all alarm display flags every time the screen comes back
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      // Dismiss the keyguard so the alarm shows directly, not behind the PIN/pattern screen
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }
    // Layer 3 — Screen Pinning (Lock Task Mode).
    // Pins this task so Android's OS itself blocks Home, Back, and Recent Apps.
    // This is the same mechanism Alarmy uses for unescapable alarms.
    // On first use the system shows a one-time "Screen pinned" toast — silent thereafter.
    startAlarmLockTaskOnce()
  }

  /**
   * Layer 1 — onWindowFocusChanged fires the INSTANT the window loses focus,
   * which is BEFORE onPause() and BEFORE onUserLeaveHint().
   *
   * hasFocus=true  → alarm screen is in front — pin it immediately (covers
   *                   the "app already open" scenario where onResume doesn't fire).
   * hasFocus=false → window losing focus — start a 350 ms debounce before
   *                   calling startActivity(). The debounce re-checks isAlarmActive()
   *                   so we NEVER bring the app to front after the alarm is dismissed
   *                   (fixes the "app auto-opens after alarm" bug caused by the
   *                   .apply() async race, now also guarded by .commit()).
   *
   * Covers wake alarm, habit alarm, and quick alarm — isAlarmActive() checks all.
   */
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // Cancel any pending bring-to-front debounce — we're already in focus.
      focusLossRunnable?.let { focusLossHandler.removeCallbacks(it) }
      focusLossRunnable = null
      // Pin the screen if alarm is active AND NOT stopping.
      val alarmStopping = try {
        getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getBoolean("alarm_stopping", false) ||
        getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getBoolean("alarm_stopping", false)
      } catch (_: Exception) { false }

      // Also check ALARM_FORCE_STOP (instant AtomicBoolean kill switch)
      if (isAlarmActive() && !alarmStopping && !AlarmSoundServiceBase.ALARM_FORCE_STOP.get()) {
        // Call startAlarmLockTaskOnce() — one-shot guard.
        // The one-shot guard is critical for the OS exploit to work.
        startAlarmLockTaskOnce()
      }
    } else {
      // Window lost focus — debounce before reacting so we don't fire
      // startActivity() during the normal alarm-dismissal navigation flow.
      focusLossRunnable?.let { focusLossHandler.removeCallbacks(it) }
      val r = Runnable {
        val alarmStopping = try {
          getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("alarm_stopping", false) ||
          getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("alarm_stopping", false)
        } catch (_: Exception) { false }

        // The absolute kill switch: ALARM_FORCE_STOP.get() is checked instantly.
        // If true, we abort immediately. No freezes, even after 10+ minutes ringing.
        if (!alarmStopping && isAlarmActive() && !AlarmSoundServiceBase.ALARM_FORCE_STOP.get()) {
          try {
            startActivity(Intent(this, MainActivity::class.java).apply {
              addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_NO_ANIMATION
              )
            })
          } catch (_: Exception) {}
        }
      }
      focusLossRunnable = r
      // 350ms loop: Violently hijacks focus back if the pinning dialog is open or
      // if the user swipes home. Creates an unbreakable state even if OK is not clicked.
      focusLossHandler.postDelayed(r, 350)
    }
  }


  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
   * Check if the AlarmSoundService is currently running.
   * When it is, Back and Home must be completely swallowed.
   */
  private fun isAlarmActive(): Boolean {
    return try {
      if (getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
              .getBoolean("alarm_fired_pending", false)) return true
      getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getBoolean(HabitAlarmModule.KEY_ACTIVE, false)
    } catch (e: Exception) {
      false
    }
  }

  /**
   * Returns true when the currently active alarm is a Sound Bath session.
   * Sound Bath alarms skip Android's startLockTask() because that API
   * triggers a mandatory system dialog ("Okay to pin?") when the phone
   * is already unlocked. Protection is still enforced by the native
   * watchdogs: onUserLeaveHint, dispatchKeyEvent and onBackPressed all
   * intercept Home/Back at the native layer without any OS prompt.
   */
  private fun isSoundBathAlarmActive(): Boolean {
    return try {
      val prefs = getSharedPreferences(HabitAlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
      if (prefs.getBoolean(HabitAlarmModule.KEY_ACTIVE, false)) {
        prefs.getString("active_alarm_type", "") == "soundbath"
      } else {
        false
      }
    } catch (_: Exception) { false }
  }

  private fun startAlarmLockTaskOnce() {
    if (lockTaskStartedForAlarm) return
    lockTaskStartedForAlarm = true
    try { startLockTask() } catch (_: Exception) {}
  }

  fun resetAlarmLockTaskState() {
    lockTaskStartedForAlarm = false
  }

  /**
   * HOME button interceptor.
   * Called BEFORE the Activity goes to background — Activity is still RUNNING here,
   * so startActivity() on `this` is always allowed (no BAL restrictions, any API level).
   * FLAG_ACTIVITY_NEW_TASK is critical: without it Android 10+ silently drops the call
   * once the Activity has started transitioning to background.
   * Always call super so the system processes the home event; we fight back immediately.
   */
  override fun onUserLeaveHint() {
    if (isAlarmActive()) {
      try {
        // FLAG_ACTIVITY_NEW_TASK is required so Android does not silently drop the
        // startActivity call once the Activity has started its transition to background.
        // Without it, on Android 10+ the call can be a no-op after onPause begins.
        startActivity(Intent(this, MainActivity::class.java).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_NO_ANIMATION
          )
        })
      } catch (_: Exception) {}
    }
    super.onUserLeaveHint()
  }

  /**
   * Lowest-level key event intercept.
   * Catches KEYCODE_BACK before React Native, before Android 13+ predictive-back
   * gesture system, and before onBackPressed/invokeDefaultOnBackPressed.
   * This is the real unbreakable lock — Alarmy-grade.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (isAlarmActive() && event.keyCode == KeyEvent.KEYCODE_BACK) {
      return true // consume both ACTION_DOWN and ACTION_UP — no animation, no navigation
    }
    return super.dispatchKeyEvent(event)
  }

  /**
   * Pre-Android-12 back press: swallow completely when alarm is active.
   */
  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    if (isAlarmActive()) {
      // Alarm is ringing — eat the back press entirely. Do NOT call super,
      // do NOT call moveTaskToBack. The JS BackHandler also returns true,
      // but this native override is the real last line of defence.
      return
    }
    super.onBackPressed()
  }

  /**
   * Android 12+ back press override. Same logic — swallow when alarm is active.
   * ReactActivity calls this instead of onBackPressed() on API 31+.
   * On all API levels: move app to background instead of finishing the Activity,
   * so the user is never ejected from the app by pressing back at the root screen.
   */
  override fun invokeDefaultOnBackPressed() {
    if (isAlarmActive()) {
      // Alarm is ringing — completely block the back gesture at the native level.
      return
    }
    // moveTaskToBack(false) sends the app to background on all API levels.
    // Fall back to super only if the OS refuses to move the task (extremely rare).
    if (!moveTaskToBack(false)) {
      super.invokeDefaultOnBackPressed()
    }
  }

  /**
   * If the user forcefully closes the alarm UI (e.g. killing the app) and opens it again,
   * rewrite the intent to a deep-link URI so Expo Router automatically routes them back
   * to the active alarm screen. We enforce this regardless of the launch intent category.
   */
  private fun interceptLauncherIntentIfNeeded(intent: Intent?) {
    if (intent == null) return
    val isWakeAlarm = try {
      getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
        .getBoolean("alarm_fired_pending", false)
    } catch (_: Exception) { false }

    if (isWakeAlarm) {
      intent.action = Intent.ACTION_VIEW
      intent.data = android.net.Uri.parse("solrize://wake-alarm-ringing")
    }
  }
}
