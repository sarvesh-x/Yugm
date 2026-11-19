package com.yugm.app.core.api

object ApiConfig {
    var apiBaseUrl: String = "http://10.0.2.2:4000/api"
    var socketBaseUrl: String = "http://10.0.2.2:4000"
    var lanApiBaseUrl: String = ""
    var lanSocketBaseUrl: String = ""
    var isDebug: Boolean = false
    /** Defaults closed; YugmApplication disables App Check only for debug builds targeting loopback. */
    var appCheckRequired: Boolean = true
}

/** A local-only development bypass; never trust a remote host based on its build variant. */
fun shouldRequireAppCheck(apiBaseUrl: String, isDebugBuild: Boolean): Boolean {
    if (!isDebugBuild) return true
    val uri = runCatching { java.net.URI(apiBaseUrl.trim()) }.getOrNull() ?: return true
    val isLoopbackHost = uri.host?.lowercase() in setOf("localhost", "127.0.0.1", "::1", "10.0.2.2", "10.0.3.2")
    return !(uri.scheme.equals("http", ignoreCase = true) && isLoopbackHost)
}

/** Turns API-relative media paths (for example `/uploads/avatar.jpg`) into loadable URLs. */
fun resolveMediaUrl(url: String?): String? {
    val value = url?.trim()?.takeIf(String::isNotEmpty) ?: return null
    if (value.startsWith("//") || Regex("^[a-zA-Z][a-zA-Z0-9+.-]*:").containsMatchIn(value)) return value

    val apiBase = ApiConfig.apiBaseUrl.trim().trimEnd('/')
    val origin = runCatching {
        java.net.URI(apiBase).let { uri ->
            if (uri.scheme.isNullOrBlank() || uri.rawAuthority.isNullOrBlank()) null
            else "${uri.scheme}://${uri.rawAuthority}"
        }
    }.getOrNull() ?: return value

    return "$origin/${value.trimStart('/')}"
}
