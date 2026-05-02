import Foundation
import AVFoundation
import UIKit
import React

// MARK: - Shared state accessible from AppDelegate
@objc public class AlarmModuleState: NSObject {
  @objc public static let shared = AlarmModuleState()
  @objc public var isAlarmActive: Bool = false
  private override init() {}
}

@objc(AlarmModule)
class AlarmModule: RCTEventEmitter {

  private var hasListeners = false

  // MARK: - RCTEventEmitter boilerplate

  override static func requiresMainQueueSetup() -> Bool { return false }

  @objc override func supportedEvents() -> [String] {
    return ["onAlarmFired", "onAlarmForeground"]
  }

  override func startObserving() {
    hasListeners = true
    registerForegroundObserver()
  }

  override func stopObserving() {
    hasListeners = false
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: - Foreground observer
  // When the user presses Home then returns to the app, iOS fires
  // UIApplication.willEnterForegroundNotification. We send a JS event so
  // alarm-ringing.tsx can re-assert itself (trigger shake, vibration, etc.)

  private func registerForegroundObserver() {
    NotificationCenter.default.removeObserver(self)

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appWillEnterForeground),
      name: UIApplication.willEnterForegroundNotification,
      object: nil
    )

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )
  }

  @objc private func appWillEnterForeground() {
    guard AlarmModuleState.shared.isAlarmActive else { return }
    if hasListeners {
      sendEvent(withName: "onAlarmForeground", body: ["returned": true])
    }
  }

  @objc private func appDidEnterBackground() {
    guard AlarmModuleState.shared.isAlarmActive else { return }
    // Ensure audio session stays active when backgrounded by Home press.
    // AVAudioSession.playback category + staysActiveInBackground (set by expo-av)
    // is enough — audio keeps playing. We just make sure it's activated here.
    activateAudioSession()
  }

  // MARK: - AVAudioSession setup
  // Must be called BEFORE alarm fires so audio survives the Home button.
  // Category .playback keeps audio alive in background without the app showing.

  private func activateAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(
        .playback,
        mode: .default,
        options: [.mixWithOthers, .duckOthers]
      )
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      print("[AlarmModule] AVAudioSession activate failed: \(error)")
    }
  }

  // MARK: - JS-callable methods

  @objc func scheduleAlarm(_ config: NSDictionary,
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    activateAudioSession()
    AlarmModuleState.shared.isAlarmActive = false
    resolve("Alarm scheduled (iOS — managed by expo-notifications)")
  }

  @objc func cancelAlarm(_ alarmId: String,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    AlarmModuleState.shared.isAlarmActive = false
    resolve("Alarm cancelled")
  }

  @objc func dismissAlarm(_ alarmId: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    AlarmModuleState.shared.isAlarmActive = false
    // Deactivate session so other apps (music etc.) resume normally
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
    resolve("Alarm dismissed")
  }

  // Called by JS alarm-ringing.tsx bootstrap to mark alarm as active
  @objc func markAlarmActive(_ resolver resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    activateAudioSession()
    AlarmModuleState.shared.isAlarmActive = true
    resolve(true)
  }
}
