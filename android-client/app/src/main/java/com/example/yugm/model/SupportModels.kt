package com.example.yugm.model

data class SupportTicket(
    val _id: String = "",
    val userId: String = "",
    val subject: String = "",
    val message: String = "",
    val status: String = "OPEN",
    val priority: String = "MEDIUM",
    val category: String = "General",
    val messages: List<TicketMessage> = emptyList(),
    val assignedTo: String? = null,
    val resolvedAt: String? = null,
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class TicketMessage(
    val senderId: String = "",
    val senderRole: String = "",
    val message: String = "",
    val createdAt: String = ""
)
