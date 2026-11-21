# Yugm Design System & Global Visual Guidelines

## 1. Official Yugm Brand Identity

The single source of truth for Yugm's brand identity is derived from the official launcher icon (`ic_launcher_background.xml`).

### Canonical Brand Colors & Gradient Stops

| Stop | Hex Code | Color Name | Visual Role |
| :--- | :--- | :--- | :--- |
| **0.00** | `#FF8A22` | Vibrant Orange (`BrandOrange`) | Gradient Start |
| **0.52** | `#FF3E93` | Vibrant Pink (`BrandPink`) | Gradient Middle |
| **1.00** | `#8A5CFF` | Electric Violet (`BrandViolet`) | Gradient End |

```kotlin
val BrandStart  = Color(0xFFFF8A22)
val BrandMiddle = Color(0xFFFF3E93)
val BrandEnd    = Color(0xFF8A5CFF)

val BrandOrange = BrandStart
val BrandPink   = BrandMiddle
val BrandViolet = BrandEnd
val OnBrand     = Color.White

val YugmBrandColors = listOf(BrandStart, BrandMiddle, BrandEnd)
val YugmBrandStops  = arrayOf(
    0.00f to BrandStart,
    0.52f to BrandMiddle,
    1.00f to BrandEnd,
)
```

---

## 2. Centralized Ambient Background System (`YugmBackground`)

Yugm's legacy background implementation (floating circles, animated blobs, and infinite canvas loops) has been completely removed. It is replaced by a high-performance, static, diffused ambient lighting system (`YugmBackground`) rendered using native Compose radial and linear gradients.

### Background Styles (`YugmBackgroundStyle`)

1. **`Ambient`**: Soft, atmospheric lighting with a diffused violet glow upper-right (`#8A5CFF`), pink glow lower-left (`#FF3E93`), and subtle orange warmth upper-left (`#FF8A22`).
   - Light Mode Base: `#FBF8FC`
   - Dark Mode Base: `#090A15`
2. **`Aurora`**: Smooth diagonal brand gradient.
   - Light Mode: `#FCEADB` -> `#FBE6F3` -> `#E9E2FF`
   - Dark Mode: `#2D172A` -> `#23142F` -> `#171C42`
3. **`Minimal`**: Clean, high-legibility neutral surface for content-heavy and utility screens.
   - Light Mode: `#F8F6FA`
   - Dark Mode: `#090A15`
4. **`Arcade`**: Violet-dominant atmospheric glow for gaming, leaderboards, and interactive features.
   - Light Mode: `#F9F6FC` base with violet/pink ambient accents.
   - Dark Mode: `#0F0C1B` base with vibrant violet/pink ambient accents.

### Screen-to-Background Style Mapping

| Screen / Feature | Background Style |
| :--- | :--- |
| **Discover, Party, Profiles, Social, Events, Leaderboards, Creator Hub** | `YugmBackgroundStyle.Ambient` |
| **Onboarding, Login, Registration, Phone Auth, Splash** | `YugmBackgroundStyle.Aurora` |
| **Chat List, Direct Messages, Settings, Wallet, Forms, Utility Screens** | `YugmBackgroundStyle.Minimal` |
| **Arcade Home, Game Modes (Truth/Dare, WouldYouRather, etc.)** | `YugmBackgroundStyle.Arcade` |

---

## 3. Brand Components & Loading Spinner

- **Primary Action Buttons**: `YugmGradientButton` uses `BrandGradients.horizontal` with `OnBrand = Color.White`.
- **App-Wide Loading Spinner (`YugmLoadingSpinner`)**:
  - Renders a rotating sweep gradient arc featuring the official brand palette (`BrandOrange` -> `BrandPink` -> `BrandViolet` -> `BrandOrange`).
  - Includes a theme-aware background track (`Color.White.copy(alpha = 0.15f)` in Dark Mode, `Color(0xFF20182A).copy(alpha = 0.12f)` in Light Mode) to ensure full contrast and visibility across all surfaces in both theme modes.

---

## 4. White Foreground Rule on Branded Components

All primary branded gradient components MUST use white text and white icons (`OnBrand = Color.White`) in **both Light and Dark themes**.

Applied to:
- Primary action buttons (`YugmGradientButton`, `PrimaryButton`, `OnboardingPrimaryButton`).
- Active navigation indicators (`YugmBottomDock`).
- Selected gradient badges and active capsule indicators.
- Promotional hero banners and call-to-action cards.

---

## 5. Coordinated Light & Dark Theme Palettes (`YugmColors`)

| Token | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| **Background** | `#FBF8FC` | `#090A15` |
| **Surface** | `#FFFFFF` | `#171626` |
| **Surface Variant** | `#F3EDF6` | `#241D32` |
| **Elevated Surface** | `#FCFAFD` | `#201D30` |
| **Outline / Border** | `#D9CDDF` | `#3B314A` |
| **Primary** | `#B91E68` | `#FF70AD` |
| **Secondary** | `#6744C5` | `#B19AFF` |
| **Tertiary** | `#AC4E12` | `#FFB36C` |
| **Primary Text** | `#20182A` | `#F8F4FC` |
| **Secondary Text** | `#62586D` | `#BDB3CA` |

---

## 6. Architectural & Performance Rules

- **Zero Allocation**: Gradients are rendered using `Modifier.drawWithCache` to avoid allocations during scrolling or recomposition.
- **No Floating Circles**: Do NOT reintroduce floating animated circles, canvas loops, or hard-edged background shapes.
- **Single Background Owner**: Screens consume `YugmBackground` at the root layout; child Scaffold/Box containers use `Color.Transparent` to avoid duplicate background layering.
