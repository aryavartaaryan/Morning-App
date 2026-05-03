package com.solrize
import expo.modules.splashscreen.SplashScreenManager

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // Always show over lock screen — required for alarm fullScreenIntent on all Android versions
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
    // KEEP_SCREEN_ON must always be set regardless of API level
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    // Re-apply keep-screen-on every time the alarm service brings us back to front
    if (isAlarmActive()) {
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  override fun onResume() {
    super.onResume()
    if (!isAlarmActive()) return
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
      val prefs = getSharedPreferences(AlarmModule.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.getBoolean("alarm_fired_pending", false)
    } catch (e: Exception) {
      false
    }
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
}
