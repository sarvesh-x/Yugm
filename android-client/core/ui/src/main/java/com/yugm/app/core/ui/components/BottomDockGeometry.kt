package com.yugm.app.core.ui.components

/**
 * Pure geometry for the curved bottom dock.
 *
 * The dock surface is a full-width shape with a concave notch around the elevated active
 * circle. All values are pixels; the composable converts dp with the current density. Keeping
 * this math pure makes the first/last-tab edge cases unit-testable without a device.
 *
 * Invariants maintained for every destination, including the outermost tabs:
 * - the notch centre stays inside the surface,
 * - the flat shoulders never run into the top corner arcs,
 * - the concave curve never draws backwards (no edge clipping or self-intersection).
 */
internal object BottomDockGeometry {
    fun tabWidthPx(totalWidthPx: Float, tabCount: Int): Float {
        require(tabCount > 0) { "tabCount must be positive" }
        return totalWidthPx / tabCount
    }

    /** Horizontal centre of destination [index] (0-based) for a full-width surface. */
    fun notchCenterPx(index: Int, totalWidthPx: Float, tabCount: Int): Float {
        val safeIndex = index.coerceIn(0, tabCount - 1)
        return animatedNotchCenterPx(safeIndex.toFloat(), totalWidthPx, tabCount)
    }

    /** Horizontal centre for a fractional (animating) destination position, clamped to the tabs. */
    fun animatedNotchCenterPx(fractionalIndex: Float, totalWidthPx: Float, tabCount: Int): Float {
        val safe = fractionalIndex.coerceIn(0f, (tabCount - 1).toFloat())
        return (safe + 0.5f) * tabWidthPx(totalWidthPx, tabCount)
    }

    /**
     * Where the flat top edge may end and the concave notch may begin. Clamped to the corner
     * arc start and never past the notch centre, so the first tab cannot fold back over itself.
     */
    fun leftShoulderPx(notchLeftPx: Float, cornerRadiusPx: Float, centerPx: Float): Float =
        maxOf(notchLeftPx, cornerRadiusPx).coerceAtMost(centerPx)

    /**
     * Where the concave notch ends and the flat top edge (or top-right corner arc) resumes.
     * Never before the notch centre, so the last tab cannot fold back over itself.
     */
    fun rightShoulderPx(
        notchRightPx: Float,
        totalWidthPx: Float,
        cornerRadiusPx: Float,
        centerPx: Float,
    ): Float = minOf(notchRightPx, totalWidthPx - cornerRadiusPx).coerceAtLeast(centerPx)

    /** Top edge of the elevated active circle, relative to the dock container. */
    fun circleTopPx(
        topPaddingPx: Float,
        circleSizePx: Float,
        clearancePx: Float,
        liftPx: Float,
    ): Float = topPaddingPx - circleSizePx / 2f + clearancePx - liftPx
}
