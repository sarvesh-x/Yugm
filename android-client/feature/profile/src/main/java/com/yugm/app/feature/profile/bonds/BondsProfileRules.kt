package com.yugm.app.feature.profile.bonds

/** A single rendered slot in the profile's unified Bonds circle. */
internal sealed interface ProfileBondSlot {
    data class Active(val bond: BondCard) : ProfileBondSlot
    data class Pending(val request: BondInvitation) : ProfileBondSlot
    data object Empty : ProfileBondSlot
}

private fun ProfileBondSlot.partnerId(): String = when (this) {
    is ProfileBondSlot.Active -> bond.partner.id
    is ProfileBondSlot.Pending -> request.partner.id
    is ProfileBondSlot.Empty -> ""
}

/**
 * Maps server bond state onto the fixed slot row shown on the profile. Active
 * bonds and outgoing requests keep their server slot; incoming requests take the
 * next free display slot because accepting one allocates a recipient slot.
 */
internal fun profileBondSlots(
    active: List<BondCard>,
    requests: List<BondInvitation>,
    capacity: Int
): List<ProfileBondSlot> {
    val slots = MutableList<ProfileBondSlot?>(capacity.coerceAtLeast(0)) { null }
    val partners = mutableSetOf<String>()

    fun place(preferredSlot: Int, value: ProfileBondSlot) {
        val partner = value.partnerId()
        if (partner.isBlank() || !partners.add(partner)) return
        val preferredIndex = preferredSlot - 1
        val index = if (preferredIndex in slots.indices && slots[preferredIndex] == null) {
            preferredIndex
        } else {
            slots.indexOfFirst { it == null }
        }
        if (index >= 0) slots[index] = value
    }

    active.forEach { place(it.slot, ProfileBondSlot.Active(it)) }
    requests.filter { !it.incoming }.forEach { place(it.slot, ProfileBondSlot.Pending(it)) }
    requests.filter { it.incoming }.forEach { place(0, ProfileBondSlot.Pending(it)) }
    return slots.map { it ?: ProfileBondSlot.Empty }
}

internal fun activeBondCount(slots: List<ProfileBondSlot>): Int =
    slots.count { it is ProfileBondSlot.Active }
