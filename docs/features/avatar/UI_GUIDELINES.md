# Avatar UI Guidelines

## Shared dialog: `AvatarGeneratorDialog`
- **Entry points:** "Generate avatar" action alongside "Choose photo" in profile creation and Edit Profile.
- **Layout:** title "Create your avatar", subtitle "Make it uniquely yours.", large centered preview, "Randomize all", category tabs (Top/Head/Eyes/Mouth/Clothes/Background), per-category shuffle, 4-column variant grid (48 options), Reset/Use this avatar/Cancel actions.
- **Behavior:**
  - Initializes from current generated descriptor when available; otherwise starts from a random draft.
  - Confirm returns descriptor to parent draft only (parent owns persistence/save semantics).
  - Cancel/back closes without changing prior selection.
  - Draft changes are local/offline and deterministic for selected parts.
- **Implementation notes:** uses Material3 dialog/surfaces; renders generated SVG previews via `GeneratedAvatar`. Accessibility, responsive behavior on narrow/small screens, font scaling, motion/reduced-motion preferences, and process-restoration robustness require runtime/UX verification and possible refinement.

## Profile flows
- **Profile creation:** generated avatar can satisfy picture requirements as implemented; choosing photo switches source; continue/create submits descriptor without image upload for generated source.
- **Edit Profile:** same dialog and draft semantics; Save commits through existing profile update; immediate photo upload clears generated draft and marks `UPLOADED`.
- Switching between uploaded photo and generated avatar must leave exactly one active draft source.

## App-wide rendering
- Use shared `Avatar` (`core/ui/components/Avatar.kt`) rather than feature-specific renderers.
- For generated avatars, pass `avatarType` and `avatarParts` (and image URL fallback where applicable). Component renders generated descriptor when provided, otherwise falls back to uploaded image/default initials.
- Preserve existing frames, cosmetics, presence/speaking indicators, badges, click/navigation behavior, and shape/mask semantics.

## Visual QA checklist (pending)
- Light/dark themes, dynamic color contexts, and contrast.
- Font scaling and narrow/small avatar sizes (lists, chat bubbles, seats, cards).
- SVG rendering parity vs pinned engine output at multiple sizes.
- Reduced motion and accessibility labels/focus/touch targets.
- No clipping/overlap with frames, VIP decorations, or status indicators.
