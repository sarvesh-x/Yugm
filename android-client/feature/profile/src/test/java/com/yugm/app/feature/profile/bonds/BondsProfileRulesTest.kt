package com.yugm.app.feature.profile.bonds

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BondsProfileRulesTest {
    private fun person(id: String) = BondPerson(id, "Name $id", "@$id", avatar = "")

    private fun bond(id: String, slot: Int) = BondCard(
        id = id, kind = "BESTIE", kindName = "Bestie", partner = person(id), slot = slot,
        status = "ACTIVE", days = 7, points = 30, level = 1, levelName = "Seed",
        levelStart = 0, nextThreshold = 100, activatedAt = "", endedAt = "",
        milestones = emptyList(), nextAnniversaryAt = ""
    )

    private fun request(id: String, slot: Int, incoming: Boolean) = BondInvitation(
        id = id, kind = "BESTIE", partner = person(id), slot = slot, incoming = incoming,
        typeChange = false, message = "", gift = "", giftIcon = "", price = 0, expiresAt = ""
    )

    @Test
    fun fillsTheServerCapacityWithEmptySlotsByDefault() {
        val slots = profileBondSlots(emptyList(), emptyList(), 3)
        assertEquals(3, slots.size)
        assertTrue(slots.all { it == ProfileBondSlot.Empty })
        assertEquals(0, activeBondCount(slots))
    }

    @Test
    fun activeBondsAndOutgoingRequestsKeepTheirServerSlots() {
        val slots = profileBondSlots(
            active = listOf(bond("a", 1)),
            requests = listOf(request("r", 3, incoming = false)),
            capacity = 3
        )
        assertTrue(slots[0] is ProfileBondSlot.Active)
        assertEquals(ProfileBondSlot.Empty, slots[1])
        assertTrue(slots[2] is ProfileBondSlot.Pending)
        assertEquals(1, activeBondCount(slots))
    }

    @Test
    fun incomingRequestsUseTheFirstFreeDisplaySlot() {
        val slots = profileBondSlots(
            active = listOf(bond("a", 2)),
            requests = listOf(request("in", 99, incoming = true)),
            capacity = 3
        )
        assertTrue(slots[0] is ProfileBondSlot.Pending)
        assertTrue(slots[1] is ProfileBondSlot.Active)
        assertEquals(ProfileBondSlot.Empty, slots[2])
    }

    @Test
    fun ignoresExtraEntriesAndDuplicatePartners() {
        val slots = profileBondSlots(
            active = listOf(bond("a", 1), bond("b", 2), bond("c", 3), bond("d", 4)),
            requests = listOf(request("a", -1, incoming = true)),
            capacity = 3
        )
        assertEquals(3, slots.size)
        assertEquals(3, activeBondCount(slots))
        assertTrue(slots.none { it is ProfileBondSlot.Pending })
    }
}
