package com.example.yugm.api

import com.example.yugm.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
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
    var onUnauthorized: (() -> Unit)? = null
    private const val TAG = "YugmHttp"
    private val json = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    val baseCandidates = buildList {
        val configuredBase = BuildConfig.API_BASE_URL.trim().trimEnd('/')
        if (configuredBase.isNotBlank()) add(configuredBase)
        if (BuildConfig.DEBUG) {
            add("http://10.0.2.2:4000/api")
            add("http://10.0.3.2:4000/api")
            if (BuildConfig.LAN_API_BASE_URL.isNotBlank()) add(BuildConfig.LAN_API_BASE_URL.trim().trimEnd('/'))
            add("http://127.0.0.1:4000/api")
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

    private suspend fun request(method: String, path: String, auth: String?, body: JSONObject?): JSONObject = withContext(Dispatchers.IO) {
        if (!isOnline) throw IllegalStateException("No internet connection")
        val canRetry = isSafeRetryMethod(method)
        val preferredBase = workingBaseUrl ?: baseCandidates.firstOrNull()
        val bases = if (canRetry) {
            listOfNotNull(workingBaseUrl) + baseCandidates.filter { it != workingBaseUrl }
        } else {
            listOfNotNull(preferredBase)
        }
        if (bases.isEmpty()) throw IllegalStateException("API_BASE_URL is not configured for this build")
        var lastError: IOException? = null
        for ((attempt, base) in bases.withIndex()) {
            currentCoroutineContext().ensureActive()
            try {
                if (attempt > 0) kotlinx.coroutines.delay(1000L * attempt)
                val builder = Request.Builder().url("$base$path")
                if (auth != null) builder.header("Authorization", "Bearer $auth")
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
                        val errMsg = try {
                            JSONObject(raw).optJSONObject("error")?.optString("message")
                        } catch (e: Exception) {
                            Timber.tag(TAG).e(e, "Error parsing error response")
                            null
                        }
                        throw ApiHttpException(response.code, errMsg ?: "API ${response.code}")
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
                if (error.statusCode == 401) {
                    onUnauthorized?.let { callback ->
                        withContext(Dispatchers.Main) { callback() }
                    }
                }
                throw error
            } catch (error: ApiProtocolException) {
                throw error
            } catch (error: IOException) {
                Timber.tag(TAG).e(error, "Request failed for $base$path")
                lastError = error
                if (!canRetry) throw error
            }
        }
        throw lastError ?: IllegalStateException("API unavailable")
    }
}
