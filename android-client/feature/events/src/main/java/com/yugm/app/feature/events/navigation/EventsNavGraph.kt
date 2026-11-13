package com.yugm.app.feature.events.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.events.screens.EventCreateScreen
import com.yugm.app.feature.events.screens.EventDetailScreen
import com.yugm.app.feature.events.screens.EventsScreen
import kotlinx.coroutines.launch

fun NavGraphBuilder.eventsNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String
) {
    composable(Screen.Events.route) {
        EventsScreen(
            token = authTokenProvider(),
            currentUserId = currentUserIdProvider(),
            onBack = { navController.popBackStack() },
            onCreateEvent = { navController.navigate(Screen.EventCreate.route) },
            onEventDetail = { eventId ->
                navController.navigate(Screen.EventDetail.createRoute(eventId))
            }
        )
    }

    composable(Screen.EventCreate.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var title by remember { mutableStateOf("") }
        var description by remember { mutableStateOf("") }
        var category by remember { mutableStateOf("SOCIAL") }
        var type by remember { mutableStateOf("PARTY") }
        var eventDate by remember { mutableStateOf("") }
        var festival by remember { mutableStateOf("none") }
        EventCreateScreen(
            title = title,
            onTitleChange = { title = it },
            description = description,
            onDescriptionChange = { description = it },
            category = category,
            onCategoryChange = { category = it },
            type = type,
            onTypeChange = { type = it },
            eventDate = eventDate,
            onEventDateChange = { eventDate = it },
            festival = festival,
            onFestivalChange = { festival = it },
            onBack = { navController.popBackStack() },
            onCreate = {
                scope.launch {
                    runCatching {
                        YugmApi.createEvent(
                            token = authTokenProvider(),
                            title = title,
                            description = description.ifBlank { null },
                            category = category,
                            type = type,
                            eventDate = eventDate,
                            festival = festival.ifBlank { null }
                        )
                    }.onSuccess {
                        android.widget.Toast.makeText(context, "Event created", android.widget.Toast.LENGTH_SHORT).show()
                        navController.popBackStack()
                    }.onFailure {
                        android.widget.Toast.makeText(context, it.message ?: "Failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    composable(
        route = Screen.EventDetail.route,
        arguments = listOf(navArgument("eventId") { type = NavType.StringType })
    ) { backStackEntry ->
        val eventId = backStackEntry.arguments?.getString("eventId") ?: ""
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var event by remember { mutableStateOf<com.yugm.app.core.model.YugmEvent?>(null) }
        var eventError by remember { mutableStateOf(false) }
        LaunchedEffect(eventId) {
            runCatching { YugmApi.eventDetail(eventId, authTokenProvider()) }
                .onSuccess { event = it }
                .onFailure { eventError = true; android.widget.Toast.makeText(context, it.message ?: "Failed to load event", android.widget.Toast.LENGTH_SHORT).show() }
        }
        if (eventError) {
            androidx.compose.material3.Text("Failed to load event", color = com.yugm.app.core.ui.theme.Danger)
        } else
        event?.let { ev ->
            EventDetailScreen(
                event = ev,
                token = authTokenProvider(),
                currentUserId = currentUserIdProvider(),
                onBack = { navController.popBackStack() },
                onJoin = {
                    scope.launch {
                        runCatching { YugmApi.joinEvent(authTokenProvider(), eventId) }
                            .onSuccess {
                                event = it
                                android.widget.Toast.makeText(context, "Joined event", android.widget.Toast.LENGTH_SHORT).show()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Failed", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onLeave = {
                    scope.launch {
                        runCatching { YugmApi.leaveEvent(authTokenProvider(), eventId) }
                            .onSuccess {
                                event = it
                                android.widget.Toast.makeText(context, "Left event", android.widget.Toast.LENGTH_SHORT).show()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Failed", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onCancel = {
                    scope.launch {
                        runCatching { YugmApi.cancelEvent(authTokenProvider(), eventId) }
                            .onSuccess {
                                event = it
                                android.widget.Toast.makeText(context, "Cancelled", android.widget.Toast.LENGTH_SHORT).show()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Failed", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            )
        } ?: com.yugm.app.core.ui.components.LoadingState("Loading event...")
    }
}
