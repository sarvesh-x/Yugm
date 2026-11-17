package com.yugm.app.core.api

/** Replaces the server's recent window while retaining older pages and arrivals during the read. */
fun <T> reconcileRecentSnapshot(
    current: List<T>, incoming: List<T>, knownAtStart: Set<String>,
    id: (T) -> String, createdAt: (T) -> String, isPending: (T) -> Boolean = { false }
): List<T> {
    val oldest = incoming.map(createdAt).filter(String::isNotBlank).minOrNull()
    val retained = current.filter { item ->
        isPending(item) || id(item) !in knownAtStart ||
            (oldest != null && createdAt(item).isNotBlank() && createdAt(item) < oldest)
    }
    return (incoming + retained).distinctBy(id).sortedWith(compareBy(createdAt).thenBy(id))
}
