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

    /** Junction angle (radians) where the circular cradle meets the shoulder cubic. */
    const val CRADLE_THETA_RAD: Double = 38.0 * Math.PI / 180.0

    /** Horizontal offset from center to the cradle-shoulder junction, before edge scaling. */
    fun junctionOffsetPx(cradleRadiusPx: Float): Float =
        (cradleRadiusPx * kotlin.math.cos(CRADLE_THETA_RAD)).toFloat()

    /** Vertical depth of the cradle-shoulder junction below topY, before edge scaling. */
    fun junctionDepthPx(cradleRadiusPx: Float): Float =
        (cradleRadiusPx * kotlin.math.sin(CRADLE_THETA_RAD)).toFloat()

    /**
     * Symmetric scale factor applied to the notch when near screen edges. Both sides scale
     * equally so the cradle remains centered and mirrored.
     */
    fun edgeScale(centerPx: Float, totalWidthPx: Float, cradleRadiusPx: Float, shoulderWidthPx: Float): Float {
        val available = minOf(centerPx, totalWidthPx - centerPx)
        val fullExtent = junctionOffsetPx(cradleRadiusPx) + shoulderWidthPx
        return if (fullExtent > 0f) (available / fullExtent).coerceIn(0f, 1f) else 1f
    }

    /** Left shoulder start on the flat top edge (screen coords). */
    fun leftShoulderPx(centerPx: Float, cradleRadiusPx: Float, shoulderWidthPx: Float, totalWidthPx: Float): Float {
        val scale = edgeScale(centerPx, totalWidthPx, cradleRadiusPx, shoulderWidthPx)
        return (centerPx - (junctionOffsetPx(cradleRadiusPx) + shoulderWidthPx) * scale).coerceIn(0f, totalWidthPx)
    }

    /** Right shoulder start on the flat top edge (screen coords). */
    fun rightShoulderPx(centerPx: Float, cradleRadiusPx: Float, shoulderWidthPx: Float, totalWidthPx: Float): Float {
        val scale = edgeScale(centerPx, totalWidthPx, cradleRadiusPx, shoulderWidthPx)
        return (centerPx + (junctionOffsetPx(cradleRadiusPx) + shoulderWidthPx) * scale).coerceIn(0f, totalWidthPx)
    }

    /** Top edge of the elevated active circle, relative to the dock container. */
    fun circleTopPx(topPaddingPx: Float, circleSizePx: Float, liftPx: Float = 0f): Float =
        topPaddingPx - circleSizePx / 2f - liftPx
}
