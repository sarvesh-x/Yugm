package com.yugm.app.feature.auth.viewmodel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthOperationStateTest {
    @Test
    fun providerCredentialAndExchangeShareOneExclusiveOperation() {
        val credential = beginAuthOperation(null, AuthProvider.GOOGLE)
        assertEquals(AuthOperation(AuthProvider.GOOGLE, AuthPhase.CREDENTIAL), credential)
        assertNull(beginAuthOperation(credential, AuthProvider.FACEBOOK))

        val firebase = startAuthExecution(credential, AuthProvider.GOOGLE)
        assertEquals(AuthOperation(AuthProvider.GOOGLE, AuthPhase.FIREBASE_AUTH), firebase)
        assertNull(startAuthExecution(firebase, AuthProvider.GOOGLE))
        assertNull(startAuthExecution(firebase, AuthProvider.FACEBOOK))
        val exchange = advanceAuthOperation(firebase, AuthProvider.GOOGLE, AuthPhase.BACKEND_EXCHANGE)
        assertEquals(AuthOperation(AuthProvider.GOOGLE, AuthPhase.BACKEND_EXCHANGE), exchange)
        assertNull(finishAuthOperation(exchange, AuthProvider.GOOGLE))
    }

    @Test
    fun staleProviderCompletionCannotClearAnotherActiveProvider() {
        val active = AuthOperation(AuthProvider.PHONE, AuthPhase.BACKEND_EXCHANGE)
        assertEquals(active, finishAuthOperation(active, AuthProvider.FACEBOOK))
        assertEquals(active, advanceAuthOperation(active, AuthProvider.GOOGLE, AuthPhase.BACKEND_EXCHANGE))
    }
}
