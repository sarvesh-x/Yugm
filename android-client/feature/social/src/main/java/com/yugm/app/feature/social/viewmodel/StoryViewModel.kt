package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.StoryGroup
import com.yugm.app.core.model.StoryHighlight
import com.yugm.app.core.model.StoryItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class StoryViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var stories by mutableStateOf<List<StoryGroup>>(emptyList())
        private set

    var userStories by mutableStateOf<List<StoryItem>>(emptyList())
        private set

    var highlights by mutableStateOf<List<StoryHighlight>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun loadFeed(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                stories = withContext(Dispatchers.IO) { yugmApi.storyFeed(token) }
            }.onFailure {
                error = it.message ?: "Failed to load stories"
            }
            isLoading = false
        }
    }

    fun loadUserStories(token: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                userStories = withContext(Dispatchers.IO) { yugmApi.userStories(token, userId) }
            }.onFailure {
                error = it.message ?: "Failed to load user stories"
            }
            isLoading = false
        }
    }

    fun createStory(token: String, mediaUrl: String, mediaType: String, caption: String?, backgroundColor: String?, textColor: String?, font: String?, sticker: String?, linkUrl: String?) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.createStory(token, mediaUrl, mediaType, caption, backgroundColor, textColor, font, sticker, linkUrl) }
            }.onFailure {
                error = it.message ?: "Failed to create story"
            }
            isLoading = false
        }
    }

    fun viewStory(token: String, storyId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.viewStory(token, storyId) }
            }.onFailure {
                error = it.message ?: "Failed to view story"
            }
            isLoading = false
        }
    }

    fun likeStory(token: String, storyId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.likeStory(token, storyId) }
            }.onFailure {
                error = it.message ?: "Failed to like story"
            }
            isLoading = false
        }
    }

    fun deleteStory(token: String, storyId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteStory(token, storyId) }
            }.onFailure {
                error = it.message ?: "Failed to delete story"
            }
            isLoading = false
        }
    }

    fun loadHighlights(token: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                highlights = withContext(Dispatchers.IO) { yugmApi.userHighlights(token, userId) }
            }.onFailure {
                error = it.message ?: "Failed to load highlights"
            }
            isLoading = false
        }
    }

    fun createHighlight(token: String, title: String, storyIds: List<String>) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.createHighlight(token, title, storyIds) }
            }.onFailure {
                error = it.message ?: "Failed to create highlight"
            }
            isLoading = false
        }
    }

    fun deleteHighlight(token: String, highlightId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteHighlight(token, highlightId) }
            }.onFailure {
                error = it.message ?: "Failed to delete highlight"
            }
            isLoading = false
        }
    }
}
