package com.solrize

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Use BaseReactPackage so the legacy ReactContextBaseJavaModule (AlarmModule)
 * is correctly exposed to JS under both Old and New (TurboModule) architectures.
 * Without this, NativeModules.AlarmModule is undefined when newArchEnabled=true.
 */
class AlarmPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            "AlarmModule"       -> AlarmModule(reactContext)
            "HabitAlarmModule"  -> HabitAlarmModule(reactContext)
            "StepCounterModule" -> StepCounterModule(reactContext)
            else                -> null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                "AlarmModule" to ReactModuleInfo(
                    "AlarmModule",
                    "com.solrize.AlarmModule",
                    false, false, false, false
                ),
                "HabitAlarmModule" to ReactModuleInfo(
                    "HabitAlarmModule",
                    "com.solrize.HabitAlarmModule",
                    false, false, false, false
                ),
                "StepCounterModule" to ReactModuleInfo(
                    "StepCounterModule",
                    "com.solrize.StepCounterModule",
                    false, false, false, false
                )
            )
        }
    }
}
