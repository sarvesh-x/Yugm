package com.example.yugm.core.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import timber.log.Timber

class ApiHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
class ApiProtocolException(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)

internal fun isSafeRetryMethod(method: String): Boolean = method.equals("GET", ignoreCase = true)

object YugmHttpClient {
    var isOnline = true
    var onUnauthorized: ((rejectedToken: String) -> Unit)? = null
    /** Supplies the persisted session token when a navigation callback captured an empty token. */
    var authTokenProvider: (() -> String)? = null
    var refreshAccessToken: (suspend (rejectedToken: String) -> String?)? = null
    var appCheckTokenProvider: (suspend () -> String?)? = null
    private const val TAG = "YugmHttp"
    private val json = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        // The production API may need time to wake its hosting instance before
        // completing Firebase token verification and the first database query.
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .apply {
            if (ApiConfig.isDebug) {
                addInterceptor { chain ->
                    val request = chain.request()
                    Timber.tag(TAG).d("→ %s %s", request.method, request.url)
                    val response = chain.proceed(request)
                    Timber.tag(TAG).d("← %s %s (%d)", request.method, request.url, response.code)
                    response
                }
            }
        }
        .build()
    val baseCandidates = buildList {
        val configuredBase = ApiConfig.apiBaseUrl.trim().trimEnd('/')
        if (configuredBase.isNotBlank()) add(configuredBase)
        if (ApiConfig.isDebug) {
            add("http://10.0.2.2:4000/api")
            if (ApiConfig.lanApiBaseUrl.isNotBlank()) add(ApiConfig.lanApiBaseUrl.trim().trimEnd('/'))
        }
    }.distinct()
    var workingBaseUrl: String? = null

    fun endpoint(path: String): String {
        val base = workingBaseUrl ?: baseCandidates.firstOrNull()
            ?: throw IllegalStateException("API_BASE_URL is not configured for this build")
        return "$base$path"
    }

    fun contactPayload(identifier: String): JSONObject {
        return JSONObject().put(if (identifier.contains("@")) "email" else "phone", identifier)
    }

    suspend fun get(path: String, auth: String?): JSONObject = request("GET", path, auth, null)
    suspend fun post(path: String, auth: String?, body: JSONObject): JSONObject = request("POST", path, auth, body)
    suspend fun put(path: String, auth: String?, body: JSONObject): JSONObject = request("PUT", path, auth, body)
    suspend fun patch(path: String, auth: String?, body: JSONObject): JSONObject = request("PATCH", path, auth, body)
    suspend fun delete(path: String, auth: String?): JSONObject = request("DELETE", path, auth, null)

    private suspend fun request(method: String, path: String, auth: String?, body: JSONObject?, allowRefresh: Boolean = true): JSONObject = withContext(Dispatchers.IO) {
        if (!isOnline) throw IllegalStateException("No internet connection")
        val canRetry = isSafeRetryMethod(method)
        // Firebase auth has already created/authenticated the Firebase user by
        // the time these API calls run. The API exchange is idempotent by UID,
        // so retrying a transient network timeout won't create another account.
        val canRetryAuth = method.equals("POST", ignoreCase = true) &&
            (path == "/auth/google" || path == "/auth/phone")
        val preferredBase = workingBaseUrl ?: baseCandidates.firstOrNull()
        val bases = if (canRetry || canRetryAuth) {
            listOfNotNull(workingBaseUrl) + baseCandidates.filter { it != workingBaseUrl }
        } else {
            listOfNotNull(preferredBase)
        }
        if (bases.isEmpty()) throw IllegalStateException("API_BASE_URL is not configured for this build")
        var lastError: IOException? = null
        val attempts = when {
            canRetryAuth -> listOf(bases.first(), bases.first())
            canRetry -> bases
            else -> bases.take(1)
        }
        for ((attempt, base) in attempts.withIndex()) {
            currentCoroutineContext().ensureActive()
            var requestAuth: String? = null
            try {
                if (attempt > 0) kotlinx.coroutines.delay(if (canRetryAuth) 1500L else 1000L * attempt)
                val builder = Request.Builder().url("$base$path")
                // The session manager is the source of truth. Navigation destinations
                // can retain an older token snapshot, and a few public API wrappers pass
                // null even when the server endpoint requires an authenticated user.
                // Attach the current session to every non-auth API call when available.
                requestAuth = if (path.startsWith("/auth/")) {
                    auth?.takeIf(String::isNotBlank)
                } else {
                    authTokenProvider?.invoke()?.takeIf(String::isNotBlank)
                        ?: auth?.takeIf(String::isNotBlank)
                }
                if (requestAuth != null) builder.header("Authorization", "Bearer $requestAuth")
                val appCheckRequired = path.startsWith("/auth/") || path.startsWith("/notifications/device-token")
                val appCheck = if (appCheckRequired) appCheckTokenProvider?.invoke()?.takeIf(String::isNotBlank) else null
                if (appCheck != null) builder.header("X-Firebase-AppCheck", appCheck)
                val requestBody = body?.toString()?.toRequestBody(json)
                when (method) {
                    "POST" -> builder.post(requestBody ?: "{}".toRequestBody(json))
                    "PUT" -> builder.put(requestBody ?: "{}".toRequestBody(json))
                    "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(json))
                    "DELETE" -> builder.delete()
                    else -> builder.get()
                }
                client.newCall(builder.build()).execute().use { response ->
                    val raw = response.body?.string()
                    if (raw.isNullOrBlank()) throw ApiProtocolException("Empty response body")
                    if (!response.isSuccessful) {
                        val apiError = try {
                            JSONObject(raw).optJSONObject("error")
                        } catch (e: Exception) {
                            Timber.tag(TAG).e(e, "Error parsing error response")
                            null
                        }
                        val errMsg = apiError?.optString("message")?.takeIf { it.isNotBlank() }
                            ?: "API ${response.code}"
                        val requestId = apiError?.optString("requestId")?.takeIf { it.isNotBlank() && it != "null" }
                        val displayMessage = if (response.code >= 500 && requestId != null) {
                            "$errMsg (reference: $requestId)"
                        } else {
                            errMsg
                        }
                        throw ApiHttpException(response.code, displayMessage)
                    }
                    val payload = try {
                        JSONObject(raw)
                    } catch (error: Exception) {
                        throw ApiProtocolException("Invalid JSON response", error)
                    }
                    workingBaseUrl = base
                    return@withContext payload
                }
            } catch (error: ApiHttpException) {
                val mayRefresh = !path.startsWith("/auth/") || path == "/auth/me"
                if (error.statusCode == 401 && requestAuth != null && allowRefresh && mayRefresh) {
                    val renewed = runCatching { refreshAccessToken?.invoke(requestAuth) }.getOrNull()
                    if (!renewed.isNullOrBlank() && renewed != requestAuth) {
                        return@withContext request(method, path, renewed, body, allowRefresh = false)
                    }
                    withContext(Dispatchers.Main) { onUnauthorized?.invoke(requestAuth) }
                } else if (error.statusCode == 401 && requestAuth != null && mayRefresh) {
                    onUnauthorized?.let { callback ->
                        withContext(Dispatchers.Main) { callback(requestAuth) }
                    }
                }
                throw error
            } catch (error: ApiProtocolException) {
                throw error
            } catch (error: IOException) {
                Timber.tag(TAG).e(error, "Request failed for $base$path")
                lastError = error
                if (attempt == attempts.lastIndex || (!canRetry && !canRetryAuth)) throw error
            }
        }
        throw lastError ?: IllegalStateException("API unavailable")
    }

    suspend fun multipartUpload(
        path: String,
        token: String,
        buildBody: MultipartBody.Builder.() -> Unit
    ): JSONObject = withContext(Dispatchers.IO) {
        if (!isOnline) throw IllegalStateException("No internet connection")
        val base = workingBaseUrl ?: baseCandidates.firstOrNull()
            ?: throw IllegalStateException("API_BASE_URL is not configured for this build")
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .apply(buildBody)
            .build()
        val request = Request.Builder()
            .url("$base$path")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching { JSONObject(raw).optJSONObject("error")?.optString("message") }.getOrNull()
                throw ApiHttpException(response.code, message ?: "Upload failed")
            }
            val payload = try {
                JSONObject(raw)
            } catch (e: Exception) {
                throw ApiProtocolException("Invalid JSON upload response", e)
            }
            workingBaseUrl = base
            payload
        }
    }
}
