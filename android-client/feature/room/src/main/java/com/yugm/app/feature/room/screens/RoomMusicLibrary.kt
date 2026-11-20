package com.yugm.app.feature.room.screens

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.yugm.app.core.ui.components.YugmLoadingSpinner

internal data class RoomMusicLibraryTrack(
    val id: Long,
    val uri: Uri,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long
)

private val LibraryBackground = Color(0xFF100D1B)
private val LibraryPanel = Color(0xFF1D1829)
private val LibraryBorder = Color(0x28FFFFFF)
private val LibraryInk = Color(0xFFF7F3FC)
private val LibraryMuted = Color(0xFFA8A1B5)
private val LibraryPink = Color(0xFFE83E91)
private val LibraryPurple = Color(0xFF8D35F6)

@Composable
internal fun RoomMusicLibraryDialog(
    onDismiss: () -> Unit,
    onAddToQueue: (List<RoomMusicLibraryTrack>) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasPermission by remember { mutableStateOf(hasAudioPermission(context)) }
    var permissionDenied by remember { mutableStateOf(false) }
    var permissionRequested by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var tracks by remember { mutableStateOf<List<RoomMusicLibraryTrack>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var selectedIds by remember { mutableStateOf<Set<Long>>(emptySet()) }
    var scanVersion by remember { mutableStateOf(0) }
    DisposableEffect(context, hasPermission) {
        val observer = object : android.database.ContentObserver(android.os.Handler(android.os.Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { scanVersion++ }
        }
        if (hasPermission) context.contentResolver.registerContentObserver(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, true, observer)
        onDispose { context.contentResolver.unregisterContentObserver(observer) }
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermission = granted
        permissionDenied = !granted && permissionRequested && isPermissionPermanentlyDenied(context)
        if (granted) scanVersion++
    }

    DisposableEffect(lifecycleOwner, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && hasAudioPermission(context)) {
                hasPermission = true
                permissionDenied = false
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(Unit) {
        if (!hasPermission) {
            permissionRequested = true
            permissionLauncher.launch(audioPermission())
        }
    }
    LaunchedEffect(hasPermission, scanVersion) {
        if (!hasPermission) return@LaunchedEffect
        loading = true
        loadError = null
        try {
            tracks = withContext(Dispatchers.IO) { queryAudioLibrary(context) }
        } catch (error: SecurityException) {
            hasPermission = false
            permissionDenied = true
            loadError = "Allow audio access to browse tracks on this device."
        } catch (error: Exception) {
            loadError = error.message ?: "Could not scan audio files."
        } finally {
            loading = false
        }
    }

    val filteredTracks = remember(tracks, query) {
        val normalizedQuery = query.trim()
        if (normalizedQuery.isEmpty()) tracks else tracks.filter { track ->
            track.title.contains(normalizedQuery, ignoreCase = true) ||
                track.artist.contains(normalizedQuery, ignoreCase = true) ||
                track.album.contains(normalizedQuery, ignoreCase = true)
        }
    }
    val selectedTracks = remember(tracks, selectedIds) { tracks.filter { it.id in selectedIds } }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            Modifier.fillMaxSize().background(LibraryBackground)
                .statusBarsPadding().navigationBarsPadding()
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).background(LibraryPanel)
                        .border(1.dp, LibraryBorder, CircleShape)
                        .semantics { contentDescription = "Back to room music player" }
                        .clickable(role = Role.Button, onClickLabel = "Back to room music player", onClick = onDismiss),
                    contentAlignment = Alignment.Center
                ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = LibraryInk, modifier = Modifier.size(21.dp)) }
                Column(Modifier.weight(1f)) {
                    Text("Add music", color = LibraryInk, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text("Choose one or more tracks for the queue", color = LibraryMuted, fontSize = 11.sp)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(16.dp)).background(LibraryPanel)
                    .border(1.dp, LibraryBorder, RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(Icons.Filled.Search, null, tint = LibraryMuted, modifier = Modifier.size(20.dp))
                BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    textStyle = androidx.compose.ui.text.TextStyle(color = LibraryInk, fontSize = 14.sp),
                    decorationBox = { inner ->
                        Box {
                            if (query.isBlank()) Text("Search songs, artists or albums", color = LibraryMuted, fontSize = 13.sp)
                            inner()
                        }
                    }
                )
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(if (loading) "Scanning device…" else "${filteredTracks.size} audio files", color = LibraryMuted, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                if (selectedIds.isNotEmpty()) {
                    Text("${selectedIds.size} selected", color = Color(0xFFFFA8D2), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            when {
                !hasPermission -> Box(Modifier.weight(1f).fillMaxWidth()) {
                    AudioLibraryMessage(
                        icon = "♫",
                        title = "Audio access needed",
                        message = loadError ?: "Yugm only uses this access to list audio files so you can add them to the room queue.",
                        action = if (permissionDenied) "Open app settings" else "Allow audio access",
                        onAction = {
                            if (permissionDenied) {
                                context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.fromParts("package", context.packageName, null)
                                })
                            } else {
                                permissionRequested = true
                                permissionLauncher.launch(audioPermission())
                            }
                        }
                    )
                }
                loading -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    YugmLoadingSpinner(size = 40.dp)
                }
                loadError != null -> Box(Modifier.weight(1f).fillMaxWidth()) {
                    AudioLibraryMessage("!", "Couldn't scan audio", loadError!!, "Try again") { scanVersion++ }
                }
                tracks.isEmpty() -> Box(Modifier.weight(1f).fillMaxWidth()) {
                    AudioLibraryMessage("♫", "No audio files found", "Audio files stored on this device will appear here automatically.", null) { }
                }
                filteredTracks.isEmpty() -> Box(Modifier.weight(1f).fillMaxWidth()) {
                    AudioLibraryMessage("⌕", "No matching tracks", "Try another song, artist or album name.", "Clear search") { query = "" }
                }
                else -> LazyColumn(
                    Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredTracks, key = { it.id }) { track ->
                        val selected = track.id in selectedIds
                        AudioLibraryRow(track, selected) {
                            selectedIds = if (selected) selectedIds - track.id else selectedIds + track.id
                        }
                    }
                }
            }

            if (hasPermission) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (selectedIds.isNotEmpty()) Brush.horizontalGradient(listOf(LibraryPurple, LibraryPink)) else Brush.horizontalGradient(listOf(LibraryPanel, LibraryPanel)))
                        .then(if (selectedIds.isEmpty()) Modifier.border(1.dp, LibraryBorder, RoundedCornerShape(18.dp)) else Modifier)
                        .clickable(enabled = selectedTracks.isNotEmpty(), role = Role.Button, onClickLabel = "Add ${selectedTracks.size} tracks to queue") {
                            onAddToQueue(selectedTracks)
                        }
                        .padding(horizontal = 18.dp, vertical = 15.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Filled.Check, null, tint = if (selectedIds.isNotEmpty()) Color.White else LibraryMuted, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (selectedIds.isEmpty()) "Select tracks to add" else "Add ${selectedIds.size} to queue",
                        color = if (selectedIds.isNotEmpty()) Color.White else LibraryMuted,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun AudioLibraryRow(track: RoomMusicLibraryTrack, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(if (selected) Color(0x332E1C45) else LibraryPanel)
            .border(1.dp, if (selected) LibraryPink.copy(alpha = .5f) else LibraryBorder, RoundedCornerShape(16.dp))
            .clickable(role = Role.Checkbox, onClickLabel = if (selected) "Deselect ${track.title}" else "Select ${track.title}", onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            Modifier.size(46.dp).clip(RoundedCornerShape(13.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF533270), Color(0xFF2B203B)))),
            contentAlignment = Alignment.Center
        ) { Icon(Icons.Filled.MusicNote, null, tint = Color(0xFFFFA0CE), modifier = Modifier.size(22.dp)) }
        Column(Modifier.weight(1f)) {
            Text(track.title, color = LibraryInk, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                listOf(track.artist, track.album).filter(String::isNotBlank).joinToString(" · ").ifBlank { "On this device" },
                color = LibraryMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 3.dp)
            )
        }
        Text(formatAudioDuration(track.durationMs), color = LibraryMuted, fontSize = 10.sp)
        Box(
            Modifier.size(24.dp).clip(CircleShape)
                .background(if (selected) LibraryPink else Color.Transparent)
                .border(1.dp, if (selected) LibraryPink else Color(0xFF81798E), CircleShape),
            contentAlignment = Alignment.Center
        ) { if (selected) Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(15.dp)) }
    }
}

@Composable
private fun AudioLibraryMessage(icon: String, title: String, message: String, action: String?, onAction: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 30.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(Modifier.size(62.dp).clip(CircleShape).background(LibraryPanel), contentAlignment = Alignment.Center) {
            Text(icon, color = Color(0xFFFFA0CE), fontSize = 28.sp, fontWeight = FontWeight.Bold)
        }
        Text(title, color = LibraryInk, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 16.dp))
        Text(message, color = LibraryMuted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 7.dp))
        if (action != null) TextButton(onClick = onAction, modifier = Modifier.padding(top = 8.dp)) {
            Text(action, color = Color(0xFFFFA0CE), fontWeight = FontWeight.Bold)
        }
    }
}

private fun audioPermission(): String = if (Build.VERSION.SDK_INT >= 33) {
    Manifest.permission.READ_MEDIA_AUDIO
} else {
    Manifest.permission.READ_EXTERNAL_STORAGE
}

private fun hasAudioPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, audioPermission()) == PackageManager.PERMISSION_GRANTED

private fun isPermissionPermanentlyDenied(context: Context): Boolean =
    (context as? Activity)?.shouldShowRequestPermissionRationale(audioPermission()) == false

private fun queryAudioLibrary(context: Context): List<RoomMusicLibraryTrack> {
    val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }
    val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.MIME_TYPE
    )
    val result = mutableListOf<RoomMusicLibraryTrack>()
    context.contentResolver.query(
        collection,
        projection,
        "${MediaStore.Audio.Media.DURATION} > 0",
        null,
        "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"
    )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
        val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
        while (cursor.moveToNext()) {
            val id = cursor.getLong(idColumn)
            val title = cursor.getString(titleColumn).orEmpty().ifBlank { "Untitled audio" }
            result += RoomMusicLibraryTrack(
                id = id,
                uri = ContentUris.withAppendedId(collection, id),
                title = title,
                artist = cursor.getString(artistColumn).orEmpty().takeUnless { it.equals("<unknown>", true) }.orEmpty(),
                album = cursor.getString(albumColumn).orEmpty().takeUnless { it.equals("<unknown>", true) }.orEmpty(),
                durationMs = cursor.getLong(durationColumn)
            )
        }
    }
    return result
}

private fun formatAudioDuration(durationMs: Long): String {
    val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
    return "%d:%02d".format(totalSeconds / 60, totalSeconds % 60)
}
