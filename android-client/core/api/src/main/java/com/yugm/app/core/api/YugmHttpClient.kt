package com.yugm.app.core.api

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.Cache
import okhttp3.ConnectionPool
import okhttp3.Dispatcher
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import timber.log.Timber

class ApiHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
class ApiProtocolException(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)

internal fun isSafeRetryMethod(method: String): Boolean = method.equals("GET", ignoreCase = true)

object YugmHttpClient {
    @Volatile var isOnline = true
        set(value) {
            val restored = value && !field
            field = value
            if (restored) AppSync.invalidate(SyncTopic.ALL)
        }
    var onUnauthorized: ((rejectedToken: String, reason: String) -> Unit)? = null
    /** Supplies the persisted session token when a navigation callback captured an empty token. */
    var authTokenProvider: (() -> String)? = null
    var refreshAccessToken: (suspend (rejectedToken: String) -> String?)? = null
    var appCheckTokenProvider: (suspend () -> String?)? = null
    private const val TAG = "YugmHttp"
    private val json = "application/json; charset=utf-8".toMediaType()

    @Volatile private var cacheDirectory: File? = null

    /**
     * Installs a disk cache. Screens repeat identical GETs on navigation; when the
     * API sends validators this lets OkHttp revalidate with a 304 instead of
     * re-downloading the payload.
     */
    fun install(context: Context) {
        val directory = File(context.cacheDir, "http-cache")
        if (cacheDirectory?.absolutePath == directory.absolutePath) return
        cacheDirectory = directory
        client = buildClient(directory)
    }

    private fun buildClient(cacheDir: File?): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            // The production API may need time to wake its hosting instance before
            // completing Firebase token verification and the first database query.
            .readTimeout(25, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            // Screens fan out 10+ independent reads. OkHttp's default of 5 per host
            // silently serializes them into several waves.
            .dispatcher(Dispatcher().apply {
                maxRequests = 64
                maxRequestsPerHost = 12
            })
            .connectionPool(ConnectionPool(8, 5, TimeUnit.MINUTES))
            .retryOnConnectionFailure(true)
            .apply {
                if (cacheDir != null) cache(Cache(cacheDir, 50L * 1024 * 1024))
            }
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

    @Volatile private var client: OkHttpClient = buildClient(null)
    val baseCandidates: List<String>
        get() = buildList {
            val configuredBase = ApiConfig.apiBaseUrl.trim().trimEnd('/')
            if (configuredBase.isNotBlank()) add(configuredBase)
            if (ApiConfig.isDebug) {
                add("http://10.0.2.2:4000/api")
                add("http://127.0.0.1:4000/api")
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
        val expectedAccount = tokenAccount(auth?.takeIf(String::isNotBlank) ?: authTokenProvider?.invoke())
        fun checkAccount(requestToken: String? = authTokenProvider?.invoke()) {
            // Authentication can legitimately fetch /auth/me with new credentials
            // before the account has been persisted to the session manager.
            if (authTokenProvider != null && !path.startsWith("/auth/")) ensureRequestAccount(expectedAccount, requestToken)
        }
        if (!isOnline) throw IllegalStateException("No internet connection")
        val canRetry = isSafeRetryMethod(method)
        val preferredBase = workingBaseUrl ?: baseCandidates.firstOrNull()
        val bases = buildList {
            if (workingBaseUrl != null) add(workingBaseUrl!!)
            baseCandidates.forEach { if (it != workingBaseUrl) add(it) }
        }
        if (bases.isEmpty()) throw IllegalStateException("API_BASE_URL is not configured for this build")
        var lastError: IOException? = null
        // Auth POSTs can issue/rotate sessions and are not idempotent once received.
        // But connect failures (ECONNREFUSED/no route/unreachable host) happen before
        // the request reaches the server, so trying alternate configured bases is safe.
        val attempts = if (canRetry) bases else listOfNotNull(preferredBase)
        for ((attempt, base) in attempts.withIndex()) {
            currentCoroutineContext().ensureActive()
            checkAccount()
            var requestAuth: String? = null
            try {
                if (attempt > 0) kotlinx.coroutines.delay(1000L * attempt)
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
                checkAccount(requestAuth)
                if (requestAuth != null) builder.header("Authorization", "Bearer $requestAuth")
                val appCheckRequired = path.startsWith("/auth/") || path.startsWith("/notifications/device-token")
                if (appCheckRequired && ApiConfig.appCheckRequired) {
                    val token = try {
                        appCheckTokenProvider?.invoke()?.takeIf(String::isNotBlank)
                    } catch (e: Exception) {
                        Timber.tag(TAG).w(e, "Could not acquire App Check token")
                        null
                    }
                    if (token != null) {
                        builder.header("X-Firebase-AppCheck", token)
                    }
                }
                val requestBody = body?.toString()?.toRequestBody(json)
                when (method) {
                    "POST" -> builder.post(requestBody ?: "{}".toRequestBody(json))
                    "PUT" -> builder.put(requestBody ?: "{}".toRequestBody(json))
                    "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(json))
                    "DELETE" -> builder.delete()
                    else -> builder.get()
                }
                client.newCall(builder.build()).apply {
                    if (path == "/auth/me") timeout().timeout(8, TimeUnit.SECONDS)
                }.execute().use { response ->
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

// Show full error context: status code, request ID, and server message
// This helps debugging when server returns inconsistent errors (e.g., 422 with "Unexpected server error")
val errorContext = when {
    response.code >= 500 && requestId != null -> "$errMsg (reference: $requestId)"
    response.code == 422 && requestId != null -> "Validation error (reference: $requestId)"
    response.code >= 500 -> "$errMsg"
    else -> errMsg
}
throw ApiHttpException(response.code, errorContext)
                    }
                    val payload = try {
                        JSONObject(raw)
                    } catch (error: Exception) {
                        throw ApiProtocolException("Invalid JSON response", error)
                    }
                    workingBaseUrl = base
                    currentCoroutineContext().ensureActive()
                    checkAccount()
                    if (requestAuth == authTokenProvider?.invoke()) AppSync.onMutation(method, path)
                    return@withContext payload
                }
            } catch (error: ApiHttpException) {
                checkAccount()
                val mayRefresh = !path.startsWith("/auth/") || path == "/auth/me"
                val isAppCheckFailure = error.message.orEmpty().contains("app verification", ignoreCase = true)
                if (error.statusCode == 401 && requestAuth != null && allowRefresh && mayRefresh && !isAppCheckFailure) {
                    // A network failure during refresh is not evidence that the session
                    // is invalid. Let the request fail offline while retaining cached auth.
                    var unauthorizedReason = error.message ?: "Your session is no longer valid"
                    val renewed = try {
                        refreshAccessToken?.invoke(requestAuth)
                    } catch (refreshError: IOException) {
                        throw refreshError
                    } catch (refreshError: ApiHttpException) {
                        if (refreshError.statusCode == 401 || refreshError.statusCode == 403) {
                            unauthorizedReason = refreshError.message ?: unauthorizedReason
                            null
                        } else {
                            throw refreshError
                        }
                    } catch (_: Exception) {
                        null
                    }
                    checkAccount()
                    if (!renewed.isNullOrBlank() && renewed != requestAuth) {
                        checkAccount(renewed)
                        return@withContext request(method, path, renewed, body, allowRefresh = false)
                    }
                    onUnauthorized?.let { callback ->
                        withContext(Dispatchers.Main) { callback(requestAuth, unauthorizedReason) }
                    }
                } else if (error.statusCode == 401 && requestAuth != null && mayRefresh && !isAppCheckFailure) {
                    onUnauthorized?.let { callback ->
                        withContext(Dispatchers.Main) { callback(requestAuth, error.message ?: "Your session is no longer valid") }
                    }
                }
                throw error
            } catch (error: ApiProtocolException) {
                throw error
            } catch (error: IOException) {
                Timber.tag(TAG).e(error, "Request failed for $base$path")
                lastError = error
                if (workingBaseUrl == base) workingBaseUrl = null
                val canFailoverToNextBase = attempt < bases.lastIndex && (
                    canRetry || error is java.net.ConnectException || error is java.net.NoRouteToHostException ||
                        error is java.net.UnknownHostException || error is java.net.PortUnreachableException
                )
                if (!canFailoverToNextBase) throw error
                continue
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
        val bases = buildList {
            workingBaseUrl?.let(::add)
            baseCandidates.forEach { if (it != workingBaseUrl) add(it) }
        }
        if (bases.isEmpty()) throw IllegalStateException("API_BASE_URL is not configured for this build")
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .apply(buildBody)
            .build()

        // Profile routes can hold an older token snapshot after a refresh. Use the
        // persisted current token and apply the same single-refresh retry as JSON APIs.
        val expectedAccount = tokenAccount(token)
        fun checkUploadAccount() {
            if (authTokenProvider != null) ensureRequestAccount(expectedAccount, authTokenProvider?.invoke())
        }
        checkUploadAccount()
        val requestToken = authTokenProvider?.invoke()?.takeIf(String::isNotBlank) ?: token
        var lastIoError: IOException? = null
        for (base in bases) {
            currentCoroutineContext().ensureActive()
            fun executeUpload(authToken: String): JSONObject {
                checkUploadAccount()
                ensureRequestAccount(expectedAccount, authToken)
                val request = Request.Builder()
                    .url("$base$path")
                    .header("Authorization", "Bearer $authToken")
                    .post(body)
                    .build()
                return client.newCall(request).execute().use { response ->
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
                    checkUploadAccount()
                    AppSync.onMutation("POST", path)
                    payload
                }
            }

            try {
                return@withContext executeUpload(requestToken)
            } catch (error: ApiHttpException) {
                if (error.statusCode != 401) throw error
                val renewed = try {
                    refreshAccessToken?.invoke(requestToken)
                } catch (refreshError: IOException) {
                    throw refreshError
                } catch (refreshError: ApiHttpException) {
                    if (refreshError.statusCode == 401 || refreshError.statusCode == 403) null else throw refreshError
                } catch (_: Exception) {
                    null
                }
                if (!renewed.isNullOrBlank() && renewed != requestToken) {
                    return@withContext executeUpload(renewed)
                } else {
                    withContext(Dispatchers.Main) { onUnauthorized?.invoke(requestToken, error.message ?: "Your session is no longer valid") }
                    throw error
                }
            } catch (error: IOException) {
                lastIoError = error
                if (workingBaseUrl == base) workingBaseUrl = null
                val canFailover = error is java.net.ConnectException || error is java.net.NoRouteToHostException ||
                    error is java.net.UnknownHostException || error is java.net.PortUnreachableException
                if (!canFailover) throw error
            }
        }
        throw lastIoError ?: IllegalStateException("API unavailable")
    }
}
