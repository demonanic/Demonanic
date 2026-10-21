# Approved Combat Perk Corrections

## Scope and repository safety

Implemented the approved combat behavior slice on
`feature/castle-management-first-pass`. No saved-profile format, migration,
AP/SP balance, perk ID, progression, or unrelated gameplay system was changed.
No file was staged; no commit, push, merge, deployment, branch switch, or
`main` change occurred.

Initial state was dirty at HEAD `7fb3d67 Fix tower placement position
consistency`. Existing tracked and untracked work was preserved. This pass
modified the existing untracked characterization test file and the already
modified game source files; all other initial status entries remain.

## Decisions and findings

### 1. Archer Execution threshold — implemented

`frontend/src/game/perks.js` now records Execution's 25% bonus in a dedicated
`executionDamagePct` effect, surfaced as `executionDamage` by
`frontend/src/game/logic.js`. `frontend/src/game/engine.js:_applyAbilityDamage`
applies Focus Fire and the other existing low-HP modifiers strictly below
35%, and applies Execution strictly below 25%. The two conditional bonuses
are summed before the damage multiplier, preserving the existing additive
stacking convention: with Focus Fire and Execution, the combined bonus is
45% below 25%, while Focus Fire alone remains 20% from 25% to below 35%.

Regression tests cover below/at/above both thresholds and combined ownership.
They also verify Archer Focus Fire and Knight Executioner retain their
existing strict 35% threshold.
The `archer_execution` ID and saved ownership representation are unchanged.

### 2. MultiShot scope — projectile behavior preserved; active-ability extension blocked

The existing projectile policy remains unchanged: one secondary target for
`multiTarget: 2`, selected among living enemies within 55 units by distance,
with 55% of primary projectile damage and no recursive spread. The target
selection was factored into `Engine._multiTargetTargets` and reused by the
projectile consumer. Tests assert nearest eligible living target, one-target
limit, damage, range, and no recursive spread; they also verify Focus Volley's
three hits remain on its selected target and that Piercing Shot and Firestorm
retain their native target behavior.

The active-ability extension could not be implemented without expanding the
approved scope. `archer_multishot` is an Archer-only perk. The Archer catalog
has no compatible single-target active ability: Focus Volley is specifically
an excluded repeated-hit ability, and Piercing Shot already has native
multi-target behavior and is explicitly excluded. Firestorm is a Mage ability
and cannot be owned with Archer Multishot. No ability was changed or added.
The extension is therefore **blocked pending an eligible single-target
Archer ability or a revised scope**; the existing projectile behavior is
fully preserved.

### 3. Mage Overload spell scope — implemented

`frontend/src/game/engine.js:castMageSpell` now multiplies combat damage by
`abilityDamageMultiplier` at resolution for researched intensity, area, and
time spells and for baseline Fireball, Frost Nova, and Chain Lightning.
Scaling is applied once per victim/hit after the existing base spell damage
and effect scale, without changing spell status previews, affinity, mana,
cooldown, targeting, attribution, or Library/research calculations.

Tests compare Overload/no-Overload damage for baseline Fireball, baseline
area/multi-hit spells, and researched intensity/area/time spells. They verify
unchanged previews, basic projectile damage, discovery chance/output, and
discovery resource costs. Firestorm's existing active-ability damage path
already uses the multiplier. Its unlock currently requires Mage Overload, so
there is no naturally available same-ability, no-Overload comparison; the
test checks the normal Overload Firestorm result against the base damage
resolver. Library and research suites also pass.

Shield Mastery and Rogue Combo still contribute to the existing shared active
ability multiplier; their narrower descriptions remain unresolved and were
not redesigned here.

### 4. Reactive Support — implemented

`frontend/src/game/engine.js:_support` now compares HP fractions across all
eligible allies when there is no valid preferred reactive ally, rather than
stopping at the first eligible ally. A valid preferred ally still takes
priority. Dead or out-of-range preferred targets fall back to the weakest
eligible ally. The existing update path continues to prioritize threatened
allies without requiring Reactive Barrier.

Tests directly cover weakest-ally selection, valid preferred-target priority,
dead/out-of-range fallback, threat expiry, and support behavior with and
without Reactive Barrier. `reactiveSupport` still has no distinct runtime
effect: the catalog flag is redundant/unimplemented and is deferred; its
existing perk ID was not removed or remapped.

## Files changed

- `frontend/src/game/engine.js` — threshold-specific damage, Mage combat-spell
  scaling, shared existing projectile target-selection helper, and weakest
  eligible support selection.
- `frontend/src/game/logic.js` — derived Execution damage field.
- `frontend/src/game/perks.js` — dedicated Execution effect aggregation field;
  existing perk ID retained.
- `frontend/src/game/engine.perk-characterization.test.js` — regression tests
  for approved behavior and documented blocked MultiShot extension.
- `docs/dev-sessions/2026-10-18-approved-combat-perk-corrections.md` — this
  report.

No unrelated source files were changed in this pass.

## Validation

- Focused:
  `npm --prefix frontend test -- --watchAll=false --runInBand src/game/engine.perk-characterization.test.js src/game/engine.abilities.test.js src/game/libraryResearch.test.js src/game/engine.defense-perks.test.js`
  - **4 suites passed, 52 tests passed**.
- Full frontend:
  `npm --prefix frontend test -- --watchAll=false --runInBand`
  - **22 suites passed, 176 tests passed**, no snapshots.
  - GameProvider emitted expected console logs for mocked load-failure paths;
    its suite passed.
- `git diff --check`: passed.
- Build: not run; it was not required for this test-focused correction pass.
- Android/device testing: not performed.

Initial test runs during construction exposed incorrect HP-baseline and
support-target-distance assumptions in test fixtures; those fixtures were
corrected, and the final focused and full-suite runs passed.

## Final state

Final branch and HEAD remain `feature/castle-management-first-pass` and
`7fb3d67 Fix tower placement position consistency`. The worktree remains
dirty; pre-existing modified and untracked files were preserved. No saved
profile data was modified. This pass stops here; the MultiShot active-ability
extension remains blocked as described above.
