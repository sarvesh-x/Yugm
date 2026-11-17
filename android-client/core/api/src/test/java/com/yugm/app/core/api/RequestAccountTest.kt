package com.yugm.app.core.api

import kotlinx.coroutines.CancellationException
import okio.ByteString.Companion.encodeUtf8
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RequestAccountTest {
    private fun token(account: String, suffix: String = "one") = "header.${"{\"sub\":\"$account\"}".encodeUtf8().base64Url()}.$suffix"

    @Test fun sameAccountTokenRotationKeepsReadValid() {
        val original = token("alice")
        assertEquals("alice", tokenAccount(original))
        ensureRequestAccount(tokenAccount(original), token("alice", "rotated"))
    }

    @Test(expected = CancellationException::class) fun staleReadCannotRunAsAnotherAccount() {
        ensureRequestAccount(tokenAccount(token("alice")), token("bob"))
    }

    @Test(expected = CancellationException::class) fun logoutInvalidatesAuthenticatedRead() {
        ensureRequestAccount(tokenAccount(token("alice")), "")
    }

    @Test fun invalidTokensAreNeverUsedAsIdentityProof() {
        assertNull(tokenAccount("not-a-jwt"))
        ensureRequestAccount(null, token("alice"))
    }
}
