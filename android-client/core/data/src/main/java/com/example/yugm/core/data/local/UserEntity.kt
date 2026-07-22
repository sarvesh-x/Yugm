package com.example.yugm.core.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val username: String,
    val avatar: String,
    val bio: String,
    val city: String,
    val gender: String,
    val age: Int,
    val level: Int,
    val levelTitle: String,
    val followers: Int,
    val followingCount: Int,
    val vibeScore: Int,
    val isVip: Boolean,
    val isOnline: Boolean,
    val languages: String,
    val interests: String,
    val timestamp: Long = System.currentTimeMillis()
)
