package com.yugm.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.yugm.app.core.api.ApiConfig
import com.yugm.app.core.data.SessionManager
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Prepares the emulator for a host-driven process-death check. */
@RunWith(AndroidJUnit4::class)
class NavigationSessionFixture {
    @Test
    fun prepareLocalSession() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("navigationFixture") == "local")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        assertEquals("http://10.0.2.2:4000/api", ApiConfig.apiBaseUrl)
        assertEquals("http://10.0.2.2:4000", ApiConfig.socketBaseUrl)
        assertEquals("", ApiConfig.lanApiBaseUrl)
        val session = SessionManager(context)
        session.onboardingCompleted = true
        session.saveSession(
            token = "navigation-fixture-access",
            refresh = "",
            session = "navigation-fixture",
            expiresInSeconds = 3600,
            id = "000000000000000000000001",
            name = "Navigation Fixture",
            handle = "navigation_fixture",
            walletBalance = 0,
            emailVerified = true,
            profileCompleted = true,
        )
        instrumentation.waitForIdleSync()

        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = "navigation-fixture"
        manager.createNotificationChannel(NotificationChannel(channel, "Navigation fixture", NotificationManager.IMPORTANCE_DEFAULT))
        val notificationId = 7401
        val tap = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("chatPartnerId", "000000000000000000000002")
        }
        manager.notify(notificationId, NotificationCompat.Builder(context, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Open fixture conversation")
            .setContentText("Navigation check")
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(context, notificationId, tap, PendingIntent.FLAG_IMMUTABLE))
            .build())
    }
}
