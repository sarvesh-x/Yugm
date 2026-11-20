package com.yugm.app.core.navigation

import com.yugm.app.core.model.NotificationItem

sealed class NotificationTarget {
    data class Room(val roomId: String) : NotificationTarget()
    data class Chat(val partnerId: String) : NotificationTarget()
    data class Profile(val userId: String) : NotificationTarget()
    object Wallet : NotificationTarget()
    object Safety : NotificationTarget()
    object Growth : NotificationTarget()
    object Home : NotificationTarget()
}

fun notificationTarget(item: NotificationItem): NotificationTarget {
    val type = item.type.uppercase()
    return when {
        type == "MESSAGE" && item.partnerId.isNotBlank() -> NotificationTarget.Chat(item.partnerId)
        type == "PK_INVITE" && item.roomId.isNotBlank() -> NotificationTarget.Room(item.roomId)
        type == "ROOM_INVITE" && item.roomId.isNotBlank() -> NotificationTarget.Room(item.roomId)
        type == "HOST_GOING_LIVE" && item.roomId.isNotBlank() -> NotificationTarget.Room(item.roomId)
        type == "GIFT" -> if (item.roomId.isNotBlank()) NotificationTarget.Room(item.roomId) else NotificationTarget.Wallet
        type == "WALLET" -> NotificationTarget.Wallet
        type == "SAFETY" || type == "REPORT" || type == "SYSTEM" -> NotificationTarget.Safety
        type == "FOLLOW" && item.actorId.isNotBlank() -> NotificationTarget.Profile(item.actorId)
        item.roomId.isNotBlank() -> NotificationTarget.Room(item.roomId)
        item.partnerId.isNotBlank() -> NotificationTarget.Chat(item.partnerId)
        item.actorId.isNotBlank() -> NotificationTarget.Profile(item.actorId)
        else -> NotificationTarget.Home
    }
}
