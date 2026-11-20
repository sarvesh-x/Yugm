package com.yugm.app.core.ui.avatar

import java.util.LinkedHashMap

class AvatarCache(private val maxSize: Int = 64) {
    private val map = object : LinkedHashMap<String, ByteArray>(maxSize, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, ByteArray>?): Boolean =
            size > maxSize
    }

    @Synchronized
    fun get(key: String): ByteArray? = map[key]

    @Synchronized
    fun put(key: String, value: ByteArray) {
        map[key] = value
    }

    fun key(descriptor: AvatarDescriptor): String =
        "multiavatar:v${descriptor.version}:${descriptor.parts.background}|${descriptor.parts.clothes}|${descriptor.parts.head}|${descriptor.parts.mouth}|${descriptor.parts.eyes}|${descriptor.parts.top}"
}
