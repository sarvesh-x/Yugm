package com.yugm.app.core.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression coverage for the curved dock geometry. The notch is a circular cradle centered
 * on the active indicator with symmetric cubic-bezier shoulders. Edge tabs scale symmetrically.
 */
class BottomDockGeometryTest {
    private val tabCount = 5
    private val widthPx = 1080f // 360dp at 3x
    private val cradleRadiusPx = 85.5f // 28.5dp at 3x (50dp circle/2 + 3.5dp clearance)
    private val shoulderWidthPx = 66f // 22dp at 3x

    @Test
    fun firstTabNotchIsCentredOnTheFirstDestination() {
        val center = BottomDockGeometry.notchCenterPx(0, widthPx, tabCount)
        val tabWidth = BottomDockGeometry.tabWidthPx(widthPx, tabCount)
        assertEquals(tabWidth / 2f, center, 0.001f)
    }

    @Test
    fun lastTabNotchIsCentredOnTheLastDestination() {
        val center = BottomDockGeometry.notchCenterPx(4, widthPx, tabCount)
        val tabWidth = BottomDockGeometry.tabWidthPx(widthPx, tabCount)
        assertEquals(widthPx - tabWidth / 2f, center, 0.001f)
    }

    @Test
    fun notchIsSymmetricAndOrderedForAllDestinations() {
        for (index in 0 until tabCount) {
            val center = BottomDockGeometry.notchCenterPx(index, widthPx, tabCount)
            val left = BottomDockGeometry.leftShoulderPx(center, cradleRadiusPx, shoulderWidthPx, widthPx)
            val right = BottomDockGeometry.rightShoulderPx(center, cradleRadiusPx, shoulderWidthPx, widthPx)
            assertTrue("left shoulder must be on screen (tab $index)", left >= -0.001f)
            assertTrue("right shoulder must be on screen (tab $index)", right <= widthPx + 0.001f)
            assertTrue("left shoulder must not pass center (tab $index)", left <= center + 0.001f)
            assertTrue("right shoulder must not precede center (tab $index)", right >= center - 0.001f)
            // Symmetry: equal distance from center
            assertEquals("shoulders must be symmetric (tab $index)", center - left, right - center, 0.01f)
        }
    }

    @Test
    fun edgeTabsAdaptSymmetricallyOnNarrowScreens() {
        val narrowWidth = 640f // 320dp @2x
        val narrowCradle = 57f // 28.5dp @2x
        val narrowShoulder = 44f // 22dp @2x
        for (index in 0 until tabCount) {
            val center = BottomDockGeometry.notchCenterPx(index, narrowWidth, tabCount)
            val left = BottomDockGeometry.leftShoulderPx(center, narrowCradle, narrowShoulder, narrowWidth)
            val right = BottomDockGeometry.rightShoulderPx(center, narrowCradle, narrowShoulder, narrowWidth)
            assertTrue("left >= 0 (tab $index)", left >= -0.001f)
            assertTrue("right <= width (tab $index)", right <= narrowWidth + 0.001f)
            assertEquals("symmetric on narrow (tab $index)", center - left, right - center, 0.01f)
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
        val topPadding = 84f // 28dp at 3x
        val circleSize = 150f // 50dp
        val top = BottomDockGeometry.circleTopPx(topPadding, circleSize)
        val bottom = top + circleSize
        // Cradle deepest point is at topPadding + cradleRadius
        val cradleBottom = topPadding + cradleRadiusPx
        assertTrue("circle bottom must sit inside the notch cradle", bottom <= cradleBottom + 0.001f)
        // Circle center should be on the surface top boundary
        assertEquals("circle center should sit on surface top", topPadding, top + circleSize / 2f, 0.001f)
    }
}
