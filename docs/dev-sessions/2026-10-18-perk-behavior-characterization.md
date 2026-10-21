# Perk Behavior Characterization

## Scope

Test-only characterization of existing perk and combat behavior following the
Phase 0 roadmap. No gameplay code, balance, perk descriptions, saved data,
progression IDs, or migrations were changed. No Phase 1 work was started.

## Tests added

Added `frontend/src/game/engine.perk-characterization.test.js` with focused
characterization coverage for:

- Derived Defense after SP allocation, equipment, and Bulwark, across direct
  enemy hits, enemy projectiles, and area damage.
- Archer Execution's existing damage behavior below 35% enemy HP, contrasted
  with its description's below-25% threshold. This records the discrepancy;
  it does not approve or change the threshold.
- MultiShot adding a secondary target to a basic projectile, while Focus
  Volley's active-ability damage does not hit that collateral target.
- Mage Overload's ability-damage modifier affecting Firestorm but not a
  researched Mage spell.
- Reactive support selecting the signaled ally with and without the
  `reactiveSupport` effect, and ordinary support target selection without an
  alert.

An initial focused run exposed two test-construction issues: the Execution
assertion measured damage against max HP instead of the target's starting HP,
and ordinary support selected the first eligible ally rather than the lowest
HP ally. The assertions were corrected to characterize the observed behavior;
no gameplay source was changed. The latter is an observed behavior that
differs from the earlier planning report's expectation and remains unresolved.

## Verification

- Focused command:
  `npm --prefix frontend test -- --watchAll=false --runInBand src/game/engine.perk-characterization.test.js src/game/engine.defense-perks.test.js`
  - Final result: **2 suites passed, 13 tests passed**.
- Full frontend command:
  `npm --prefix frontend test -- --watchAll=false --runInBand`
  - Result: **22 suites passed, 156 tests passed**, no snapshots.
  - GameProvider tests intentionally logged mocked load errors as part of their
    failure-path coverage; the suite passed.
- `git diff --check`: **passed**.

## Remaining behavior and design decisions

- Execution's 35% runtime threshold still conflicts with the 25% description;
  choosing which is authoritative requires a design decision.
- `multiTarget` affects basic projectile targeting but not active abilities;
  the tests record current scope without choosing a broader intended scope.
- `abilityDamagePct` affects active abilities but not Mage research spells;
  whether research spells should consume the effect needs a design decision.
- `reactiveSupport` does not appear necessary for signaled-ally priority in the
  tested flow. Without an alert, the current support behavior heals the first
  eligible ally rather than selecting the lowest-HP ally; verify the intended
  target-priority rule before changing it.
- These tests exercise the game engine in unit tests. Physical-device behavior
  was not tested.

## Worktree safety

The work remained on `feature/castle-management-first-pass`. Existing modified
and untracked files were preserved. Only the characterization test file and
this report were added by this pass. No files were staged; no commit, push,
merge, deployment, branch change, or `main` modification occurred.
