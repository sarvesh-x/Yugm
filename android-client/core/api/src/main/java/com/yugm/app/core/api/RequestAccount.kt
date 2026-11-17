package com.yugm.app.core.api

import kotlinx.coroutines.CancellationException
import okio.ByteString.Companion.decodeBase64
import org.json.JSONObject

/** Used only to cancel stale work, never to authorize a request. */
internal fun tokenAccount(token: String?): String? = runCatching {
    token?.split('.')?.getOrNull(1)?.decodeBase64()?.utf8()?.let { JSONObject(it).optString("sub").takeIf(String::isNotBlank) }
}.getOrNull()

internal fun ensureRequestAccount(expected: String?, currentToken: String?) {
    if (expected != null && tokenAccount(currentToken) != expected) throw CancellationException("The account changed during synchronization")
}
