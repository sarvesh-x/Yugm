package com.yugm.app.core.ui.avatar

interface AvatarEngine {
    fun generateRandom(): AvatarDescriptor
    fun randomizePart(avatar: AvatarDescriptor, category: AvatarCategory): AvatarDescriptor
    fun renderSvg(avatar: AvatarDescriptor): ByteArray
    fun validate(avatar: AvatarDescriptor): Boolean
}
