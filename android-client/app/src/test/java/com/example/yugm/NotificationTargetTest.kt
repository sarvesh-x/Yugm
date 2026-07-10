package com.example.yugm

import com.example.yugm.model.NotificationItem
import com.example.yugm.navigation.NotificationTarget
import com.example.yugm.navigation.notificationTarget
import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationTargetTest {
    @Test
    fun routesMessagesToChat() {
        val item = NotificationItem(id = "1", type = "MESSAGE", message = "", actorName = "", partnerId = "user-2")
        assertEquals(NotificationTarget.Chat("user-2"), notificationTarget(item))
    }

    @Test
    fun routesRoomInvitesToLobby() {
        val item = NotificationItem(id = "1", type = "ROOM_INVITE", message = "", actorName = "", roomId = "room-1")
        assertEquals(NotificationTarget.Room("room-1"), notificationTarget(item))
    }

    @Test
    fun routesPkInvitesToRoom() {
        val item = NotificationItem(id = "1", type = "PK_INVITE", message = "", actorName = "", roomId = "room-1")
        assertEquals(NotificationTarget.Room("room-1"), notificationTarget(item))
    }

    @Test
    fun routesSafetyToSafetyCenter() {
        val item = NotificationItem(id = "1", type = "SAFETY", message = "", actorName = "")
        assertEquals(NotificationTarget.Safety, notificationTarget(item))
    }

    @Test
    fun routesFollowsToProfile() {
        val item = NotificationItem(id = "1", type = "FOLLOW", message = "", actorName = "", actorId = "user-1")
        assertEquals(NotificationTarget.Profile("user-1"), notificationTarget(item))
    }
}
