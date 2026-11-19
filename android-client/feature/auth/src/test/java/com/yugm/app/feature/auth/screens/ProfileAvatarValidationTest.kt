package com.yugm.app.feature.auth.screens

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileAvatarValidationTest {
    @Test
    fun acceptsServerReturnedBase64ImageDataUrl() {
        assertTrue(isValidProfileAvatarReference("data:image/jpeg;base64,/9j/AA=="))
    }

    @Test
    fun acceptsHostedHttpAndHttpsImages() {
        assertTrue(isValidProfileAvatarReference("https://cdn.example.test/avatar.jpg"))
        assertTrue(isValidProfileAvatarReference("https://pub-example.r2.dev/avatars/user_1.jpg"))
        assertTrue(isValidProfileAvatarReference("http://localhost/avatar.jpg"))
    }

    @Test
    fun rejectsUnsupportedOrMalformedDataUrls() {
        assertFalse(isValidProfileAvatarReference("data:text/html;base64,PHNjcmlwdD4="))
        assertFalse(isValidProfileAvatarReference("data:image/svg+xml;base64,PHN2Zz4="))
        assertFalse(isValidProfileAvatarReference("data:image/jpeg;base64,not base64"))
        assertFalse(isValidProfileAvatarReference("https:///missing-host.jpg"))
    }

    @Test
    fun rejectsDataUrlsLargerThanTheServerAvatarLimit() {
        val oversizedPayload = "A".repeat(300_376)
        assertFalse(isValidProfileAvatarReference("data:image/jpeg;base64,$oversizedPayload"))
    }

    @Test
    fun permitsEmptyOptionalAvatar() {
        assertTrue(isValidProfileAvatarReference("  "))
    }
}
