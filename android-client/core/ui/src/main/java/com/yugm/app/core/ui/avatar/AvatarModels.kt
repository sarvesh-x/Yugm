package com.yugm.app.core.ui.avatar

import java.io.Serializable

data class AvatarParts(
    val background: Int,
    val clothes: Int,
    val head: Int,
    val mouth: Int,
    val eyes: Int,
    val top: Int
) : Serializable

enum class AvatarCategory(val label: String) {
    TOP("Top"),
    HEAD("Head"),
    EYES("Eyes"),
    MOUTH("Mouth"),
    CLOTHES("Clothes"),
    BACKGROUND("Background")
}

data class AvatarDescriptor(
    val provider: String = "MULTIAVATAR",
    val version: Int = 1,
    val parts: AvatarParts
) : Serializable

sealed interface AvatarSource {
    data class Generated(val descriptor: AvatarDescriptor) : AvatarSource
    data class Uploaded(val imageUrl: String) : AvatarSource
    data object Default : AvatarSource
}
