// See UPSTREAM_PROVENANCE.md in this package for Multiavatar integration provenance/licensing status.
package com.yugm.app.core.ui.avatar

import kotlin.random.Random

class MultiavatarEngine : AvatarEngine {
    override fun generateRandom(): AvatarDescriptor =
        AvatarDescriptor(parts = AvatarParts(
            background = Random.nextInt(48),
            clothes = Random.nextInt(48),
            head = Random.nextInt(48),
            mouth = Random.nextInt(48),
            eyes = Random.nextInt(48),
            top = Random.nextInt(48)
        ))

    override fun randomizePart(avatar: AvatarDescriptor, category: AvatarCategory): AvatarDescriptor {
        val current = partValue(avatar.parts, category)
        var next = current
        var attempts = 0
        while (next == current && attempts < 10) {
            next = Random.nextInt(48)
            attempts++
        }
        if (next == current) next = (current + 1) % 48
        return avatar.copy(parts = setPart(avatar.parts, category, next))
    }

    override fun renderSvg(avatar: AvatarDescriptor): ByteArray {
        val data = AvatarData(
            background = AvatarDataPart.getOrThrow(avatar.parts.background),
            clothes = AvatarDataPart.getOrThrow(avatar.parts.clothes),
            head = AvatarDataPart.getOrThrow(avatar.parts.head),
            mouth = AvatarDataPart.getOrThrow(avatar.parts.mouth),
            eyes = AvatarDataPart.getOrThrow(avatar.parts.eyes),
            top = AvatarDataPart.getOrThrow(avatar.parts.top)
        )
        return MultiAvatar.getAvatarSvgBytes(data)
    }

    override fun validate(avatar: AvatarDescriptor): Boolean =
        avatar.provider == "MULTIAVATAR" &&
            avatar.version == 1 &&
            listOf(
                avatar.parts.background, avatar.parts.clothes, avatar.parts.head,
                avatar.parts.mouth, avatar.parts.eyes, avatar.parts.top
            ).all { it in 0..47 }

    private fun partValue(parts: AvatarParts, category: AvatarCategory): Int = when (category) {
        AvatarCategory.BACKGROUND -> parts.background
        AvatarCategory.CLOTHES -> parts.clothes
        AvatarCategory.HEAD -> parts.head
        AvatarCategory.MOUTH -> parts.mouth
        AvatarCategory.EYES -> parts.eyes
        AvatarCategory.TOP -> parts.top
    }

    private fun setPart(parts: AvatarParts, category: AvatarCategory, value: Int): AvatarParts = when (category) {
        AvatarCategory.BACKGROUND -> parts.copy(background = value)
        AvatarCategory.CLOTHES -> parts.copy(clothes = value)
        AvatarCategory.HEAD -> parts.copy(head = value)
        AvatarCategory.MOUTH -> parts.copy(mouth = value)
        AvatarCategory.EYES -> parts.copy(eyes = value)
        AvatarCategory.TOP -> parts.copy(top = value)
    }
}
