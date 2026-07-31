package com.example.yugm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.data.SessionManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class YugmFirebaseMessagingService : FirebaseMessagingService() {
    @Inject lateinit var sessionManager: SessionManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val authToken = sessionManager.authToken
        if (authToken.isNotBlank()) {
            scope.launch {
                withContext(Dispatchers.IO) {
                    try {
                        val json = "application/json; charset=utf-8".toMediaType()
                        val body = JSONObject().put("token", token).put("platform", "android").toString()
                            .toRequestBody(json)
                        val request = Request.Builder()
                            .url(YugmApi.endpoint("/notifications/device-token"))
                            .header("Authorization", "Bearer $authToken")
                            .post(body)
                            .build()
                        httpClient.newCall(request).execute()
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Failed to register FCM token")
                    }
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: "Yugm"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        if (body.isBlank()) return
        showNotification(title, body, message.data)
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            data.forEach { (key, value) -> putExtra(key, value) }
        }
        val pendingIntent = PendingIntent.getActivity(
            this, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notifId++, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Yugm",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Live rooms, gifts, and invites"
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    companion object {
        private const val TAG = "YugmFCM"
        private const val CHANNEL_ID = "yugm_default"
        private var notifId = 0
    }
}
