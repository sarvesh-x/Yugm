package com.yugm.app.feature.auth.viewmodel

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthErrorMappingTest {
    @Test
    fun invalidEmailCredentialDoesNotShowFacebookMessage() {
        val message = firebaseCredentialErrorMessage(AuthProvider.EMAIL, "ERROR_INVALID_CREDENTIAL")

        assertTrue(message.orEmpty().contains("email or password", ignoreCase = true))
        assertFalse(message.orEmpty().contains("Facebook", ignoreCase = true))
    }

    @Test
    fun invalidCredentialMessageMatchesActiveProvider() {
        assertTrue(firebaseCredentialErrorMessage(AuthProvider.FACEBOOK, "ERROR_INVALID_CREDENTIAL")!!.contains("Facebook"))
        assertTrue(firebaseCredentialErrorMessage(AuthProvider.GOOGLE, "ERROR_INVALID_CREDENTIAL")!!.contains("Google"))
        assertTrue(firebaseCredentialErrorMessage(AuthProvider.PHONE, "ERROR_INVALID_CREDENTIAL")!!.contains("phone"))
    }

    @Test
    fun unrelatedFirebaseErrorsUseExistingSpecificMapping() {
        assertNull(firebaseCredentialErrorMessage(AuthProvider.EMAIL, "ERROR_TOO_MANY_REQUESTS"))
    }
}
