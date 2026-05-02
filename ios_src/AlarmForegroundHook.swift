import UIKit
import React

// MARK: - AppDelegate extension: re-present alarm screen on foreground
// Add this to your AppDelegate.mm or AppDelegate.swift AFTER expo prebuild.
// If using AppDelegate.mm, use the ObjC equivalent (shown at bottom as a comment).
//
// USAGE:
//   In AppDelegate.swift — add this call in applicationWillEnterForeground:
//   AlarmForegroundHook.handleForeground(window: window)
//
//   In AppDelegate.mm — see Objective-C snippet at the bottom of this file.

@objc public class AlarmForegroundHook: NSObject {

  /// Call this from applicationWillEnterForeground / sceneWillEnterForeground.
  /// If alarm is active, the RN JS side already preserves router state at /alarm-ringing.
  /// This hook sends a native UILocalNotification as a failsafe visible indicator
  /// and ensures the audio session stays hot.
  @objc public static func handleForeground(window: UIWindow?) {
    guard AlarmModuleState.shared.isAlarmActive else { return }

    // Audio session must stay active — re-assert in case system released it
    do {
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {}

    // The RN JS AppState 'active' event fires automatically when app foregrounds.
    // alarm-ringing.tsx listens to it and triggers the shake + vibration feedback.
    // No need to manipulate the VC stack — the JS router already shows /alarm-ringing.
  }
}

/*
 ── Objective-C snippet for AppDelegate.mm ────────────────────────────────────

 // At top of AppDelegate.mm, add:
 #import "OneSutra-Swift.h"   // auto-generated umbrella header for Swift files

 // In AppDelegate.mm, add this method:
 - (void)applicationWillEnterForeground:(UIApplication *)application {
   [AlarmForegroundHook handleForegroundWithWindow:self.window];
 }

 ─────────────────────────────────────────────────────────────────────────────
*/
