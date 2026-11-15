package com.yugm.app.feature.room.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

@Composable
internal fun RoomPermissionDialog(
    permissionName: String?,
    onDismiss: () -> Unit
) {
    if (permissionName == null) return
    val context = LocalContext.current
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Permission required", color = Color.White) },
        text = {
            Text(
                "Allow $permissionName access in Settings to use this feature. You can return here and try again afterward.",
                color = Color(0xFFD2C9DC)
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    onDismiss()
                    val intent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", context.packageName, null)
                    )
                    context.startActivity(intent)
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B3DCE))
            ) { Text("Open settings", color = Color.White) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Not now", color = Color(0xFFD2C9DC)) }
        },
        containerColor = Color(0xFF211A2C)
    )
}
