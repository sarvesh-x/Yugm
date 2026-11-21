package com.yugm.app.core.navigation

/** The five main application tabs, in stable tab order, as tab identifiers. */
enum class MainTabDestination { GAME_ZONE, PARTY, DISCOVER, CHAT, PROFILE }

/**
 * Centralized definition of the five main application tabs and their routes.
 *
 * The bottom navigation dock is owned by the main-tabs host (`MainTabsScreen`). It is visible
 * only while the current destination is one of these routes; this object is the single source
 * of truth for the whitelist so visibility, tab normalization, and tab-switch requests all use
 * the same set of destinations instead of ad-hoc per-screen state.
 */
object MainTabsRoutes {
    const val GAME_ZONE = "game_zone"
    const val PARTY = "party"
    const val DISCOVER = "discover"
    const val CHAT = "chat"
    const val PROFILE = "profile"

    /** The five main root destinations: Arcade (GAME_ZONE), Party, Discover, Chat, Profile. */
    val ALL: Set<String> = setOf(GAME_ZONE, PARTY, DISCOVER, CHAT, PROFILE)

    /** True when the back stack entry is the main tabs host itself (the whitelist destination). */
    fun isMainTabs(route: String?): Boolean = route == Screen.MainTabs.route

    /**
     * The deterministic bottom-navigation visibility contract.
     *
     * The dock is visible only while the main-tabs host itself is the current destination and
     * the active page is not the Chat tab's clan-chat subtab. Exact destination matching is
     * intentional: secondary/profile/chat-detail/room/settings destinations are never main
     * roots, so newly added screens hide the dock by default.
     */
    fun isDockVisible(currentRoute: String?, chatTabActive: Boolean, clanChatActive: Boolean): Boolean =
        isMainTabs(currentRoute) && !(chatTabActive && clanChatActive)

    /**
     * Normalizes a tab identifier (nav arg, legacy route, or user input) to the closest main
     * tab destination. Unknown or missing values resolve to [MainTabDestination.DISCOVER] so an
     * invalid tab can never leave the user stranded off the authenticated root.
     */
    fun normalizeTab(tab: String): MainTabDestination = when (tab.lowercase()) {
        "game", "games", "game_zone", "gamezone" -> MainTabDestination.GAME_ZONE
        "party", "live", "voice_rooms", "voicerooms" -> MainTabDestination.PARTY
        "chat", "chats", "chat_list", "chatlist" -> MainTabDestination.CHAT
        "profile", "mine" -> MainTabDestination.PROFILE
        else -> MainTabDestination.DISCOVER
    }
}
