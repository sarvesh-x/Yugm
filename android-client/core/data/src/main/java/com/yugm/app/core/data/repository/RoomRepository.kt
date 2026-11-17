package com.yugm.app.core.data.repository

import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.data.local.RoomDao
import com.yugm.app.core.data.local.RoomEntity
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.Host
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RoomRepository @Inject constructor(
    private val yugmApi: IYugmApi,
    private val roomDao: RoomDao
) {
    suspend fun getRooms(type: RoomType?): List<Room> {
        val rooms = yugmApi.rooms(type)
        cacheRooms(rooms)
        return rooms
    }

    suspend fun getTrendingRooms(): List<Room> {
        val rooms = yugmApi.trendingRooms()
        cacheRooms(rooms)
        return rooms
    }

    suspend fun getRoomDetail(token: String, roomId: String) = yugmApi.roomDetail(token, roomId)

    fun observeLiveRooms(): Flow<List<Room>> = flow {
        val now = System.currentTimeMillis()
        val cached = roomDao.getLiveRooms().filter { now - it.timestamp in 0 until 300_000L }.map { it.toRoom() }
        emit(cached)
        val fresh = try { yugmApi.trendingRooms() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (cached.isEmpty()) throw failure else return@flow }
        cacheRooms(fresh)
        emit(fresh)
    }

    suspend fun searchRooms(query: String): List<Room> = yugmApi.searchRooms(query)

    suspend fun cacheRooms(rooms: List<Room>) {
        roomDao.deleteStale(System.currentTimeMillis() - 300_000L)
        val entities = rooms.map { it.toEntity() }
        roomDao.insertAll(entities)
    }

    private fun Room.toEntity() = RoomEntity(
        id = id,
        title = title,
        description = description,
        type = type.name,
        status = status,
        scheduledFor = scheduledFor,
        hostId = host?.id ?: "",
        hostName = host?.name ?: "",
        hostAvatar = host?.avatar ?: "",
        category = category,
        language = language,
        tags = tags.joinToString(","),
        participants = participants,
        maxSpeakers = maxSpeakers,
        theme = theme,
        badge = badge
    )

    private fun RoomEntity.toRoom() = Room(
        id = id,
        title = title,
        description = description,
        host = hostId.takeIf { it.isNotBlank() }?.let { Host(id = it, name = hostName, avatar = hostAvatar.takeIf(String::isNotBlank)) },
        type = if (type == "Video") RoomType.Video else RoomType.Voice,
        status = status,
        scheduledFor = scheduledFor,
        category = category,
        language = language,
        tags = if (tags.isNotBlank()) tags.split(",") else emptyList(),
        participants = participants,
        maxSpeakers = maxSpeakers,
        theme = theme,
        badge = badge
    )
}
