# DEMONANIC Simulator (isolated)

This directory is a standalone simulation layer. It does NOT modify the live game.
It does NOT import from frontend/src/game/. All engine values are extracted into
sim/constants.js and must be VERIFIED against source before trusting results.

## Purpose

Construct validated player states at CP 8 / 15 / 24 / 36 across three state families
(hero-heavy / balanced / tower-heavy) and six equipment scenarios (E0–E5), then validate
each construction against structural rules.

## Status

- Construction validation: ready to run
- Combat simulation: NOT implemented (intentionally blocked)

## Run

    node sim/run-validation.js

Expected: 72 / 72 PASS. Any FAIL means a structural rule was violated and must be
fixed before combat simulation is drafted.

## Do not

- Do not import from frontend/src/game/.
- Do not trust numbers marked [TUNE] or [VERIFY].
- Do not treat equipment crit as additive or replacement until combat formulas are verified.
