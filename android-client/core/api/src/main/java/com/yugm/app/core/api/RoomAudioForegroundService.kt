package com.yugm.app.core.api

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import timber.log.Timber

/** Keeps the active room's audio session process alive when the app is backgrounded. */
class RoomAudioForegroundService : Service() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Active room", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shown while you are connected to a live room"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    @Suppress("DEPRECATION")
    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID)
            else Notification.Builder(this)
        return builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Yugm room is active")
            .setContentText("Your room audio can continue while Yugm is in the background.")
            .setCategory(Notification.CATEGORY_CALL)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "yugm_active_room"
        private const val NOTIFICATION_ID = 4102

        fun start(context: Context) {
            val intent = Intent(context, RoomAudioForegroundService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
                else context.startService(intent)
            } catch (error: RuntimeException) {
                // Android may reject background starts; the LiveKit connection should still proceed.
                Timber.tag("RoomAudioService").w(error, "Could not start the room audio foreground service")
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RoomAudioForegroundService::class.java))
        }
    }
}
