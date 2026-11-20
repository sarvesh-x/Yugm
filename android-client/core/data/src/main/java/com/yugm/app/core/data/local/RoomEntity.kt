package com.yugm.app.core.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "rooms")
data class RoomEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String,
    val type: String,
    val status: String,
    val scheduledFor: String,
    val hostId: String,
    val hostName: String,
    val hostAvatar: String,
    val category: String,
    val language: String,
    val tags: String,
    val participants: Int,
    val maxSpeakers: Int,
    val theme: String,
    val badge: String,
    val timestamp: Long = System.currentTimeMillis()
)
