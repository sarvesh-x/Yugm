package com.yugm.app.core.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class YugmLoadingSpinnerTest {
    @Test
    fun globalScaleEnlargesEveryRequestedSize() {
        assertEquals(20.dp, spinnerDisplaySize(16.dp))
        assertEquals(50.dp, spinnerDisplaySize(40.dp))
    }

    @Test
    fun defaultBaselineUsesTheGlobalScale() {
        assertEquals(
            spinnerDisplaySize(YugmLoadingSpinnerDefaults.BaselineSize),
            spinnerDisplaySize(40.dp)
        )
    }
}
