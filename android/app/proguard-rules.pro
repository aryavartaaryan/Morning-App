# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── React Native ─────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-dontwarn com.facebook.react.**

# ── React Native Reanimated ───────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# ── Expo Modules ──────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class expo.** { *; }
-dontwarn expo.**

# ── App Native Modules ────────────────────────────────────────────────────────
-keep class com.solrize.** { *; }

# ── Notifee ───────────────────────────────────────────────────────────────────
-keep class app.notifee.** { *; }
-keep class io.invertase.** { *; }
-dontwarn app.notifee.**

# ── Firebase ──────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.gms.internal.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Google Sign-In ────────────────────────────────────────────────────────────
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }

# ── Kotlin & Coroutines ───────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ── OkHttp / Okio (used by Firebase & Expo) ──────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── JSC / Hermes interop ──────────────────────────────────────────────────────
-keep class org.webkit.** { *; }
-dontwarn org.webkit.**

# ── Keep JavaScript interface bridge annotations ──────────────────────────────
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp *;
}

# ── Prevent stripping serialization classes ───────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── Suppress common warnings that don't affect functionality ──────────────────
-dontwarn javax.annotation.**
-dontwarn sun.misc.**
-dontwarn java.lang.invoke.**
-dontwarn org.conscrypt.**
