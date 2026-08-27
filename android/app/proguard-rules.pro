# RedsRacing — R8 / ProGuard
#
# Play requires meaningful coverage across shrinking, optimization, and
# obfuscation (target ≥25%). Keep rules stay narrow so R8 can still minify
# most of our code and dependencies. Do NOT add:
#   -dontobfuscate / -dontoptimize / -dontshrink
#   -keep class com.redsracing.app.** { *; }

# Crash / Play vitals stack traces
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# WebView JS bridges — reflection only needs @JavascriptInterface methods.
# Do not keep entire bridge classes; R8 still obfuscates everything else.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Optional / shaded networking (okhttp via Firebase / Play services)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# EncryptedSharedPreferences / Tink (security-crypto)
-dontwarn com.google.crypto.tink.**
