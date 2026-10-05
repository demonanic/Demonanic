# Demonanic Loading Animations — Next Pass

## Goal

Replace the generic loading spinner with two distinct Demonanic loading loops.

### 1. ENTERING THE KEEP…

Purpose: login/authentication in progress.

Visual sequence:
1. Idle — fortress gate and demon crest
2. Rune Ignite — gate rune powers up
3. Gate Open — portal begins forming
4. Portal Swirl — magenta portal intensifies
5. Pull In — cloaked figure is drawn into the keep
6. Fade Loop — portal settles into a loopable state

Recommended playback: 8 FPS, looping while the login request is pending.

### 2. SUMMONING…

Purpose: initial application/auth bootstrap while the auth state is being resolved.

Visual sequence:
1. Idle — skull over ritual circle
2. Energy Build — cyan/green energy gathers
3. Soul Rise — spirits/energy rise
4. Full Summon — peak energy burst
5. Spiral Fade — energy spirals down
6. Return Loop — returns to the idle ritual

Recommended playback: 8 FPS, looping while the initial auth/bootstrap state is pending.

## Integration

- Add the 12 frame PNGs under a frontend public/static loading-assets directory.
- Create a reusable loading animation component rather than duplicating markup.
- Use `Entering the Keep...` for Login submit busy state.
- Use `Summoning...` for the initial `user === null` auth bootstrap state.
- Keep the existing generic spinner as a fallback only if an animation asset fails to load.
- Do not change backend/auth behavior.
- Keep the animation lightweight for Android WebView performance.
- Preload the six frames for each animation so the first visible frame does not flash in late.

## Asset Pack

The 12 frame source pack was prepared separately as:
`Demonanic-loading-animation-pack.zip`

The pack contains:
- entering-1.png through entering-6.png
- summoning-1.png through summoning-6.png
- manifest.json

## Acceptance Check

A successful next pass should visibly show:
- Login request -> ENTERING THE KEEP… artwork loop, not the small Loader2 spinner.
- Initial auth bootstrap -> SUMMONING… artwork loop.
- Register remains visually consistent with the auth/loading treatment.
- No change to successful login/register behavior.
