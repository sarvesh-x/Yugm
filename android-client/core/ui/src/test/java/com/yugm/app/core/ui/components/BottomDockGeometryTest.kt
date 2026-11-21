package com.yugm.app.core.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression coverage for the curved dock geometry, focused on the outermost destinations
 * (first/last notch positions) where the concave curve previously folded back over the
 * top corner arcs and produced clipped or overlapping edges.
 */
class BottomDockGeometryTest {
    private val tabCount = 5
    private val widthPx = 1080f // 360dp at 3x, a common phone width
    private val radiusPx = 72f // 24dp
    private val notchWidthPx = 216f // 72dp

    @Test
    fun firstTabNotchIsCentredOnTheFirstDestination() {
        val center = BottomDockGeometry.notchCenterPx(0, widthPx, tabCount)
        val tabWidth = BottomDockGeometry.tabWidthPx(widthPx, tabCount)
        assertEquals(tabWidth / 2f, center, 0.001f)
        assertEquals(0f, center - notchWidthPx / 2f, 0.001f) // notch starts at the screen edge
    }

    @Test
    fun lastTabNotchIsCentredOnTheLastDestination() {
        val center = BottomDockGeometry.notchCenterPx(4, widthPx, tabCount)
        val tabWidth = BottomDockGeometry.tabWidthPx(widthPx, tabCount)
        assertEquals(widthPx - tabWidth / 2f, center, 0.001f)
        assertEquals(widthPx, center + notchWidthPx / 2f, 0.001f) // notch ends at the screen edge
    }

    @Test
    fun shouldersNeverFoldBackForAnyDestination() {
        for (index in 0 until tabCount) {
            val center = BottomDockGeometry.notchCenterPx(index, widthPx, tabCount)
            val notchLeft = center - notchWidthPx / 2f
            val notchRight = center + notchWidthPx / 2f
            val left = BottomDockGeometry.leftShoulderPx(notchLeft, radiusPx, center)
            val right = BottomDockGeometry.rightShoulderPx(notchRight, widthPx, radiusPx, center)

            assertTrue("left shoulder must not precede the corner arc (tab $index)", left >= radiusPx - 0.001f)
            assertTrue("left shoulder must not pass the notch centre (tab $index)", left <= center + 0.001f)
            assertTrue("right shoulder must not pass the corner arc (tab $index)", right <= widthPx - radiusPx + 0.001f)
            assertTrue("right shoulder must not precede the notch centre (tab $index)", right >= center - 0.001f)
            assertTrue("notch centre must stay on screen (tab $index)", center in 0f..widthPx)
        }
    }

    @Test
    fun shouldersStayOrderedOnNarrowScreens() {
        // 320dp wide phone at 2x density; guards the edge-tab clamps on compact devices.
        val narrowWidth = 640f
        val narrowRadius = 48f
        val narrowNotchWidth = 192f
        for (index in 0 until tabCount) {
            val center = BottomDockGeometry.notchCenterPx(index, narrowWidth, tabCount)
            val left = BottomDockGeometry.leftShoulderPx(center - narrowNotchWidth / 2f, narrowRadius, center)
            val right = BottomDockGeometry.rightShoulderPx(center + narrowNotchWidth / 2f, narrowWidth, narrowRadius, center)
            assertTrue("left shoulder must be ordered (tab $index)", left <= right)
        }
    }

    @Test
    fun animatedCenterStaysWithinTheDestinationRange() {
        assertEquals(
            BottomDockGeometry.notchCenterPx(0, widthPx, tabCount),
            BottomDockGeometry.animatedNotchCenterPx(-1f, widthPx, tabCount),
            0.001f
        )
        assertEquals(
            BottomDockGeometry.notchCenterPx(4, widthPx, tabCount),
            BottomDockGeometry.animatedNotchCenterPx(9f, widthPx, tabCount),
            0.001f
        )
    }

    @Test
    fun activeCircleSitsInsideTheNotchCradle() {
        // Dock content: topPadding 20dp, circle 50dp, clearance 4dp, notch depth 30dp.
        val topPadding = 60f // 20dp at 3x
        val circleSize = 150f // 50dp
        val clearance = 12f // 4dp
        val notchDepth = 90f // 30dp
        val top = BottomDockGeometry.circleTopPx(topPadding, circleSize, clearance, liftPx = 0f)
        // The circle center sits on the surface top boundary, so its top extends above the
        // dock container (negative relative to dock top) by design; the bottom half must
        // stay within the notch cradle.
        assertTrue("circle bottom must sit inside the notch cradle", top + circleSize <= topPadding + notchDepth)
    }

    @Test
    fun notchCradleCanAdaptToNarrowWidthWithoutLeavingTheCanvas() {
        // 320dp @2x with the production notch width (78dp) and corner radius (24dp).
        val narrowWidth = 640f
        val cornerRadius = 48f
        val notchWidth = 156f
        for (index in 0 until tabCount) {
            val center = BottomDockGeometry.notchCenterPx(index, narrowWidth, tabCount)
            val left = BottomDockGeometry.leftShoulderPx(center - notchWidth / 2f, cornerRadius, center)
            val right = BottomDockGeometry.rightShoulderPx(center + notchWidth / 2f, narrowWidth, cornerRadius, center)
            assertTrue(left <= center + 0.001f)
            assertTrue(right >= center - 0.001f)
            assertTrue(right <= narrowWidth - cornerRadius + 0.001f)
            assertTrue(left >= cornerRadius - 0.001f)
        }
    }
}
