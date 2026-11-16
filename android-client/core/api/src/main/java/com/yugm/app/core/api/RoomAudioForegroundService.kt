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
        startForegroundForAudio(microphoneEnabled = false)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundForAudio(intent?.getBooleanExtra(EXTRA_MICROPHONE_ENABLED, false) == true)
        return START_NOT_STICKY
    }

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

    private fun startForegroundForAudio(microphoneEnabled: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val serviceTypes = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK or
                if (microphoneEnabled) android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
            try {
                startForeground(NOTIFICATION_ID, buildNotification(), serviceTypes)
            } catch (error: SecurityException) {
                if (!microphoneEnabled) throw error
                Timber.tag("RoomAudioService").w(error, "Microphone foreground mode is not currently allowed; keeping playback active")
                startForeground(NOTIFICATION_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            }
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
    }

    companion object {
        private const val CHANNEL_ID = "yugm_active_room"
        private const val NOTIFICATION_ID = 4102
        private const val EXTRA_MICROPHONE_ENABLED = "microphone_enabled"

        fun start(context: Context, microphoneEnabled: Boolean = false) {
            val intent = Intent(context, RoomAudioForegroundService::class.java)
                .putExtra(EXTRA_MICROPHONE_ENABLED, microphoneEnabled)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
                else context.startService(intent)
            } catch (error: RuntimeException) {
                // Android may reject background starts; the LiveKit connection should still proceed.
                Timber.tag("RoomAudioService").w(error, "Could not start the room audio foreground service")
            }
        }

        fun setMicrophoneEnabled(context: Context, enabled: Boolean) {
            val intent = Intent(context, RoomAudioForegroundService::class.java)
                .putExtra(EXTRA_MICROPHONE_ENABLED, enabled)
            try {
                context.startService(intent)
            } catch (error: RuntimeException) {
                Timber.tag("RoomAudioService").w(error, "Could not update room audio foreground type")
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RoomAudioForegroundService::class.java))
        }
    }
}