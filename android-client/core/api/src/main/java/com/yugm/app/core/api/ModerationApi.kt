package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.*
import org.json.JSONObject

object ModerationApi {

    suspend fun checkText(token: String, request: ModerationCheckTextRequest): ModerationCheckTextResponse {
        val body = JSONObject().apply {
            put("text", request.text)
            put("context", request.context)
        }
        val data = YugmHttpClient.post("/v1/moderation/check-text", token, body).getJSONObject("data")
        return data.toModerationCheckTextResponse()
    }

    suspend fun report(token: String, request: ModerationReportRequest): ModerationReportResponse {
        val body = JSONObject().apply {
            request.targetUserId?.let { put("targetUserId", it) }
            request.roomId?.let { put("roomId", it) }
            request.messageId?.let { put("messageId", it) }
            put("category", request.category)
            request.description?.let { put("description", it) }
        }
        val data = YugmHttpClient.post("/v1/moderation/report", token, body).getJSONObject("data")
        return ModerationReportResponse(
            reportId = data.getString("reportId"),
            queueId = data.getString("queueId"),
            status = data.getString("status"),
        )
    }

    suspend fun appeal(token: String, request: ModerationAppealRequest): ModerationAppealResponse {
        val body = JSONObject().apply {
            put("actionId", request.actionId)
            put("reason", request.reason)
        }
        val data = YugmHttpClient.post("/v1/moderation/appeal", token, body).getJSONObject("data")
        return ModerationAppealResponse(
            appealId = data.getString("appealId"),
            status = data.getString("status"),
        )
    }

    suspend fun getStatus(token: String): ModerationStatusResponse {
        val data = YugmHttpClient.get("/v1/moderation/status", token).getJSONObject("data")
        return data.toModerationStatusResponse()
    }
}
