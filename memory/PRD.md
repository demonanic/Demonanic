# Demonanic — Product Requirements & Build Log

## Original Problem Statement
Build a playable web MVP vertical slice of "Demonanic", a neon-synthwave 2D side-view
tower-defense / RPG / strategy game where the player defends a castle against advancing
enemy hordes using automated towers, barricades, and a controllable four-hero Castle Squad.
Built strictly to the authoritative "Demonanic Living Game Design v140" doc (v139 numerical
baseline). This web build is the prototype ahead of a production Android game.

## Architecture
- **Frontend (React 19 + CRA/craco, Tailwind, framer-motion, lucide, sonner)**
  - Combat runs client-side (real-time canvas engine) for responsiveness.
  - Data-driven config: `src/game/config.js` holds the v139 numerical baseline.
  - Pure logic: `src/game/logic.js` (state, economy, CP, XP, wave build, defeat/revival).
  - Engine: `src/game/engine.js` (simulation + neon canvas renderer; enemies top→down,
    towers auto-fire, heroes engage on breach, XP damage-attribution, boss XP weighted).
  - Screens: Login, Home, Preparation, Battle, Results, Profile. Components: cards
    (HeroCard/TowerCard with tactical slowdown), DebugPanel, ui-kit, contexts (Auth, Game).
- **Backend (FastAPI + MongoDB via motor)**
  - Auth boundary isolated in `auth.py` (JWT username/password; swappable to Supabase).
  - `server.py`: per-account progression persistence (`/api/game/state` GET+PUT), server-side
    offline accrual (12h cap), mocked provider-independent monetization (`/api/monetization/reward`).
  - `game_config.py`: server subset of economy constants for offline accrual.
- Backend is source of truth for saved progression/resources/account between waves.

## User Personas
- Design team & testers validating the core loop and feel of the locked design.
- Eventually mobile (Android) players; this web build is the test/prototype version.

## Core Requirements (static)
Loop: Login → Home → Preparation → 5s Scout Countdown → Active Wave → Results → Preparation.
Three pillars, each shallow-but-complete: combat, strategy/preparation, economy/progression.

## Implemented (2026-06 / first MVP)
- JWT username/password auth; per-account server-saved progression (Supabase-ready boundary).
- Full loop with 5s scout countdown, real-time portrait battlefield (neon units top→down,
  yellow outer wall, red gate line, castle keep, 4 heroes at bottom).
- 4 heroes (Knight/Rouge/Mage/Archer): XP/levels, +1 SP & +1 AP per level, stat allocation,
  Tier-1 class perks, attack-config selection; combat card opens trigger 10s tactical slowdown.
- 4 tower types (Archer/Catapult/Wizard/Ballista): construction (Gold+Stone+Food), wave-boundary
  upkeep (Gold+Stone), Food HP repair, dismantle (30% refund), XP-based level-up choices,
  underfunded-state penalties.
- 5 barricades (Gold→HP, Food repair, hazard-stripe visuals, lane pathing influence).
- Economy: Gold/Food/Stone, Workers (Gold/Stone alloc) + Farmers, exponential purchase curves,
  continuous production, morale + castle-damage efficiency multipliers, server offline accrual (12h cap).
- Morale system (events, mutiny at 0), Castle HP/damage, Castle Power = ΣheroLevels+ΣdeployedTowerLevels
  driving 1–5 tower-slot unlocks (8/15/24/36 CP) and wave scaling.
- Enemy roster (ghost/slime/goblin/skeleton/orc/reaper/lieutenant + three-headed demon boss),
  imperfect path-of-least-resistance lane pathing, per-group objectives (castle/towers/squad/resources).
- Defeat flow: one free life (30% resources, full HP, morale 20), mocked ad-revival, surrender (gold tax + morale).
- Profile screen + full Debug/developer panel (set resources/wave/levels, heal/damage castle,
  advance production time, free life, scout toggle, spawn enemies, force boss/win/defeat).
- Mocked monetization abstraction (AdMob/SpawnTap stubbed; no SDKs/secrets).

## Testing
- iteration_1.json: 11/11 backend pytest pass; frontend E2E full loop pass (100%/100%). No critical bugs.

## Backlog (staged per design doc)
- P1: Tier 2–3 ability trees & layered attack configurations; richer tower spy / Scout Knowledge
  decay effects on enemy behavior; hero Auto/Manual behavior actually altering targeting.
- P2: Full enemy roster with Lieutenant platoons (Spirit Goons) & boss special abilities
  (Demon Lord fire DoT/AoE/lifesteal+skeletons, Necromancer Lost Souls, Nuclear Behemoth slimes);
  full Horde event (countdown/gate, rewards/penalties); surrender debt-boss; numerical calibration passes.
- P3: Swap auth to Supabase; wire real AdMob + SpawnTap adapters behind existing abstraction;
  separate web landing page (+AdSense); account-level meta-progression; multiple maps; final art.

## OPEN assumptions used (smallest reversible placeholders)
- Barricade collision damage/sec and hero maxHP formula are prototype placeholders.
- Attack-config in combat sets a MANUAL flag but does not yet deeply alter targeting (shallow MVP).
- Single battlefield map; representative enemy subset; Tier-1 perks only.
