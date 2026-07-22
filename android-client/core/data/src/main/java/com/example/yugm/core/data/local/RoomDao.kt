package com.example.yugm.core.data.local

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RoomDao {
    @Query("SELECT * FROM rooms ORDER BY participants DESC")
    fun pagingSource(): PagingSource<Int, RoomEntity>

    @Query("SELECT * FROM rooms WHERE id = :id")
    suspend fun getById(id: String): RoomEntity?

    @Query("SELECT * FROM rooms WHERE type = :type ORDER BY participants DESC")
    fun getByType(type: String): PagingSource<Int, RoomEntity>

    @Query("SELECT * FROM rooms WHERE status = 'LIVE' ORDER BY participants DESC LIMIT :limit")
    suspend fun getLiveRooms(limit: Int = 50): List<RoomEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(rooms: List<RoomEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(room: RoomEntity)

    @Query("DELETE FROM rooms WHERE id NOT IN (:keepIds)")
    suspend fun deleteExcept(keepIds: List<String>)

    @Query("DELETE FROM rooms WHERE timestamp < :cutoffTime")
    suspend fun deleteStale(cutoffTime: Long)

    @Query("DELETE FROM rooms")
    suspend fun clearAll()
}
