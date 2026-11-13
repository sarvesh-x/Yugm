package com.yugm.app.core.api

import com.yugm.app.core.model.SupportTicket
import org.json.JSONArray
import org.json.JSONObject

object SupportApi {

    suspend fun createTicket(token: String, subject: String, message: String, category: String = "General", priority: String = "MEDIUM"): SupportTicket {
        val body = JSONObject().apply {
            put("subject", subject)
            put("message", message)
            put("category", category)
            put("priority", priority)
        }
        val json = YugmHttpClient.post("/api/support/tickets", token, body)
        val data = json.getJSONObject("data")
        return parseTicket(data.getJSONObject("ticket"))
    }

    suspend fun listTickets(token: String, status: String? = null, page: Int = 1, limit: Int = 20): Triple<List<SupportTicket>, Int, Int> {
        val params = mutableListOf("page=$page", "limit=$limit")
        if (status != null) params.add("status=$status")
        val json = YugmHttpClient.get("/api/support/tickets?${params.joinToString("&")}", token)
        val data = json.getJSONObject("data")
        val ticketsArray = data.getJSONArray("tickets")
        val tickets = mutableListOf<SupportTicket>()
        for (i in 0 until ticketsArray.length()) {
            tickets.add(parseTicket(ticketsArray.getJSONObject(i)))
        }
        val total = data.optInt("total", 0)
        val totalPages = data.optInt("totalPages", 1)
        return Triple(tickets, total, totalPages)
    }

    suspend fun getTicket(token: String, ticketId: String): SupportTicket {
        val json = YugmHttpClient.get("/api/support/tickets/$ticketId", token)
        val data = json.getJSONObject("data")
        return parseTicket(data.getJSONObject("ticket"))
    }

    suspend fun addMessage(token: String, ticketId: String, message: String): SupportTicket {
        val body = JSONObject().apply { put("message", message) }
        val json = YugmHttpClient.post("/api/support/tickets/$ticketId/messages", token, body)
        val data = json.getJSONObject("data")
        return parseTicket(data.getJSONObject("ticket"))
    }

    suspend fun closeTicket(token: String, ticketId: String): SupportTicket {
        val json = YugmHttpClient.post("/api/support/tickets/$ticketId/close", token, JSONObject())
        val data = json.getJSONObject("data")
        return parseTicket(data.getJSONObject("ticket"))
    }

    private fun parseTicket(obj: JSONObject): SupportTicket {
        val messagesArray = obj.optJSONArray("messages") ?: JSONArray()
        val messages = mutableListOf<com.yugm.app.core.model.TicketMessage>()
        for (i in 0 until messagesArray.length()) {
            val m = messagesArray.getJSONObject(i)
            messages.add(com.yugm.app.core.model.TicketMessage(
                senderId = m.optString("senderId", ""),
                senderRole = m.optString("senderRole", ""),
                message = m.optString("message", ""),
                createdAt = m.optString("createdAt", "")
            ))
        }
        return SupportTicket(
            _id = obj.optString("_id", ""),
            userId = obj.optString("userId", ""),
            subject = obj.optString("subject", ""),
            message = obj.optString("message", ""),
            status = obj.optString("status", "OPEN"),
            priority = obj.optString("priority", "MEDIUM"),
            category = obj.optString("category", "General"),
            messages = messages,
            assignedTo = obj.optString("assignedTo", "").ifEmpty { null },
            resolvedAt = obj.optString("resolvedAt", "").ifEmpty { null },
            createdAt = obj.optString("createdAt", ""),
            updatedAt = obj.optString("updatedAt", "")
        )
    }
}
