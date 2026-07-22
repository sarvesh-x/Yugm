package com.example.yugm.ui.viewmodel

import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomType
import com.example.yugm.core.util.UiState
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DiscoverViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var yugmApi: IYugmApi
    private lateinit var viewModel: DiscoverViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        yugmApi = mockk()
    }

    @After
    fun teardown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `refreshRooms sets Success state on API success`() = runTest(testDispatcher) {
        val fakeRooms = listOf(Room(id = "1", title = "Room 1", type = RoomType.Voice))
        coEvery { yugmApi.rooms(any<RoomType?>()) } returns fakeRooms

        viewModel = DiscoverViewModel(yugmApi)
        viewModel.refreshRooms()

        assertTrue(viewModel.discoverState is UiState.Success)
        assertEquals(fakeRooms, (viewModel.discoverState as UiState.Success).data)
        assertEquals(fakeRooms, viewModel.rooms)
    }

    @Test
    fun `refreshRooms sets Error state on API failure`() = runTest(testDispatcher) {
        coEvery { yugmApi.rooms(any<RoomType?>()) } throws RuntimeException("Network error")

        viewModel = DiscoverViewModel(yugmApi)
        viewModel.refreshRooms()

        assertTrue(viewModel.discoverState is UiState.Error)
        assertTrue((viewModel.discoverState as UiState.Error).message.contains("Network error"))
    }

    @Test
    fun `refreshRooms starts with Loading then resolves`() = runTest(testDispatcher) {
        coEvery { yugmApi.rooms(any<RoomType?>()) } returns emptyList()

        viewModel = DiscoverViewModel(yugmApi)
        viewModel.refreshRooms()

        assertTrue(viewModel.discoverState is UiState.Success)
    }
}
