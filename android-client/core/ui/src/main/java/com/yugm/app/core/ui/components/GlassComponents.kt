package com.yugm.app.core.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

val AuroraPurple = Color(0xFF8D35F6)
val AuroraPink = Color(0xFFF6378B)
val AuroraCyan = Color(0xFF27D3FF)
val AuroraGold = Color(0xFFFFC52F)
val AuroraSaffron = Color(0xFFFF684D)

val auroraGradient = listOf(AuroraPurple, AuroraPink, AuroraCyan, AuroraGold)
val auroraGradientWarm = listOf(AuroraPink, AuroraSaffron, AuroraGold)
val auroraGradientCool = listOf(AuroraPurple, AuroraCyan)
val auroraGradientPrimary = listOf(AuroraPurple, com.yugm.app.core.ui.theme.AccessiblePrimaryPink)

@Composable
fun AuroraBackground(
    modifier: Modifier = Modifier,
    speed: Float = 1f,
    colors: List<Color> = auroraGradient,
) {
    val phase = if (LocalMotionEnabled.current) {
        val infiniteTransition = rememberInfiniteTransition(label = "aurora-background")
        val animatedPhase by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(
                // A full orbit should feel like a slow ambient drift, not a loading spinner.
                animation = tween((24000 / speed.coerceAtLeast(0.1f)).toInt(), easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "aurora-phase"
        )
        animatedPhase
    } else 0f
    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val cx = w / 2
        val cy = h / 2
        val maxR = kotlin.math.sqrt(w * w + h * h) / 2
        val rad = phase * (PI.toFloat() / 180f)
        for (i in colors.indices) {
            val offset = i * 120f * (PI.toFloat() / 180f)
            val rx = cx + maxR * 0.6f * cos(rad + offset)
            val ry = cy + maxR * 0.6f * sin(rad + offset * 0.7f)
            drawCircle(
                color = colors[i].copy(alpha = 0.08f),
                radius = maxR * 0.55f,
                center = Offset(rx, ry)
            )
        }
    }
}

@Composable
fun AuroraShimmer(speed: Float = 1f) {
    val progress = if (LocalMotionEnabled.current) {
        val infiniteTransition = rememberInfiniteTransition(label = "aurora-shimmer")
        val animatedProgress by infiniteTransition.animateFloat(
            initialValue = -1f,
            targetValue = 2f,
            animationSpec = infiniteRepeatable(
                animation = tween((2000 / speed).toInt(), easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "shimmer-progress"
        )
        animatedProgress
    } else 0.5f
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color.Transparent,
                        Color.White.copy(alpha = 0.03f),
                        Color.Transparent
                    ),
                    start = Offset(progress * 2000f, 0f),
                    end = Offset(progress * 2000f + 800f, 800f)
                )
            )
    )
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    gradient: Brush = Brush.linearGradient(
        listOf(SurfaceElevated.copy(alpha = 0.88f), Surface.copy(alpha = 0.85f))
    ),
    borderGradient: Brush = Brush.horizontalGradient(
        listOf(PrimaryPurple.copy(alpha = 0.2f), PrimaryPink.copy(alpha = 0.15f), Color.Transparent)
    ),
    borderWidth: Dp = 1.dp,
    cornerRadius: Dp = 20.dp,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(cornerRadius)
    val mod = modifier
        .clip(shape)
        .background(gradient)
        .border(borderWidth, borderGradient, shape)
        .then(
            if (onClick != null) Modifier.clickable(
                interactionSource = remember { MutableInteractionSource() },
                role = Role.Button,
                onClick = onClick
            ) else Modifier
        )
        .padding(contentPadding)
    Column(modifier = mod, content = content)
}

@Composable
fun GlassButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    gradient: Brush = Brush.horizontalGradient(auroraGradientPrimary),
    textColor: Color = Color.White,
    height: Dp = 56.dp,
    cornerRadius: Dp = 18.dp,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val interactionSource = remember { MutableInteractionSource() }
    var pressed by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(gradient, alpha = if (enabled) 1f else 0.4f)
            .scale(if (pressed) 0.97f else 1f)
            .semantics { contentDescription = text }
            .clickable(
                interactionSource = interactionSource,
                role = Role.Button,
                onClickLabel = text,
                enabled = enabled,
                onClick = {
                    pressed = true
                    onClick()
                }
            ),
        contentAlignment = Alignment.Center
    ) {
        LaunchedEffect(pressed) {
            if (pressed) {
                delay(100)
                pressed = false
            }
        }
        if (loading) {
            androidx.compose.material3.CircularProgressIndicator(
                color = textColor,
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp
            )
        } else {
            Text(text, color = textColor, fontWeight = FontWeight.Black, fontSize = 16.sp)
        }
    }
}

@Composable
fun GlassOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 56.dp,
    cornerRadius: Dp = 18.dp,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(Surface.copy(alpha = 0.4f))
            .border(
                1.dp,
                Brush.horizontalGradient(
                    listOf(
                        PrimaryPurple.copy(alpha = 0.3f),
                        PrimaryPink.copy(alpha = 0.3f)
                    )
                ),
                shape
            )
            .semantics { contentDescription = text }
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                role = Role.Button,
                onClickLabel = text,
                enabled = enabled,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = Color.White, fontWeight = FontWeight.Medium, fontSize = 15.sp)
    }
}

@Composable
fun AnimatedEntrance(
    modifier: Modifier = Modifier,
    delay: Int = 0,
    duration: Int = 400,
    slideOffset: Dp = 20.dp,
    content: @Composable () -> Unit,
) {
    val motionEnabled = LocalMotionEnabled.current
    var visible by remember { mutableStateOf(!motionEnabled) }
    LaunchedEffect(motionEnabled, delay) {
        if (!motionEnabled) {
            visible = true
        } else {
            visible = false
            delay(delay.toLong())
            visible = true
        }
    }
    val alpha = if (motionEnabled) {
        val animatedAlpha by animateFloatAsState(
            targetValue = if (visible) 1f else 0f,
            animationSpec = tween(duration, easing = FastOutSlowInEasing),
            label = "entrance-alpha"
        )
        animatedAlpha
    } else 1f
    val offset = if (motionEnabled) {
        val animatedOffset by animateDpAsState(
            targetValue = if (visible) 0.dp else slideOffset,
            animationSpec = tween(duration, easing = FastOutSlowInEasing),
            label = "entrance-offset"
        )
        animatedOffset
    } else 0.dp
    Box(
        modifier = modifier
            .alpha(alpha)
            .offset(y = offset)
    ) {
        content()
    }
}

@Composable
fun ShimmerCard(modifier: Modifier = Modifier) {
    val shimmer = if (LocalMotionEnabled.current) {
        val infiniteTransition = rememberInfiniteTransition(label = "loading-shimmer")
        val animatedShimmer by infiniteTransition.animateFloat(
            initialValue = -1f,
            targetValue = 2f,
            animationSpec = infiniteRepeatable(
                animation = tween(1200, easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "shimmer"
        )
        animatedShimmer
    } else 0.5f
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(SurfaceElevated)
            .border(1.dp, Line, shape)
    ) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color.Transparent,
                            PrimaryPurple.copy(alpha = 0.04f),
                            Color.Transparent
                        ),
                        start = Offset(shimmer * 400f, 0f),
                        end = Offset(shimmer * 400f + 300f, 300f)
                    )
                )
        )
    }
}

@Composable
fun DepthCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 20.dp,
    elevation: Dp = 8.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(elevation / 3, elevation / 3)
                .clip(shape)
                .background(PrimaryPurple.copy(alpha = 0.08f))
        )
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(elevation / 6, elevation / 6)
                .clip(shape)
                .background(PrimaryPink.copy(alpha = 0.04f))
        )
        Column(
            modifier = modifier
                .clip(shape)
                .background(SurfaceElevated)
                .border(1.dp, Line, shape)
                .padding(16.dp),
            content = content
        )
    }
}

@Composable
fun AuroraDivider(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(
                Brush.horizontalGradient(
                    listOf(
                        Color.Transparent,
                        PrimaryPurple.copy(alpha = 0.3f),
                        PrimaryPink.copy(alpha = 0.3f),
                        Color.Transparent
                    )
                )
            )
    )
}

@Composable
fun GlassTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "",
    placeholder: String = "",
    singleLine: Boolean = true,
    keyboardOptions: androidx.compose.foundation.text.KeyboardOptions = androidx.compose.foundation.text.KeyboardOptions.Default,
    visualTransformation: androidx.compose.ui.text.input.VisualTransformation = androidx.compose.ui.text.input.VisualTransformation.None,
) {
    val shape = RoundedCornerShape(16.dp)
    androidx.compose.material3.OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = if (label.isNotEmpty()) {{ Text(label) }} else null,
        placeholder = if (placeholder.isNotEmpty()) {{ Text(placeholder) }} else null,
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        modifier = modifier
            .fillMaxWidth()
            .clip(shape),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedLabelColor = PrimaryPink,
            unfocusedLabelColor = TextMuted,
            focusedBorderColor = PrimaryPink,
            unfocusedBorderColor = Line,
            cursorColor = PrimaryPink,
            focusedContainerColor = Surface.copy(alpha = 0.5f),
            unfocusedContainerColor = Surface.copy(alpha = 0.3f),
        ),
        shape = shape,
        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 15.sp)
    )
}

fun DrawScope.drawGlow(
    color: Color,
    radius: Float,
    alpha: Float = 0.15f,
    center: Offset = Offset(size.width / 2, size.height / 2),
) {
    drawCircle(
        color = color.copy(alpha = alpha),
        radius = radius,
        center = center
    )
    drawCircle(
        color = color.copy(alpha = alpha * 0.6f),
        radius = radius * 0.7f,
        center = center
    )
}
