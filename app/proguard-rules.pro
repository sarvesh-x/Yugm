# Keep data classes for JSON parsing
-keep class com.example.yugm.model.** { *; }

# Keep Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Keep Firebase
-keep class com.google.firebase.** { *; }

# Keep OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Keep Socket.IO
-keep class io.socket.** { *; }
