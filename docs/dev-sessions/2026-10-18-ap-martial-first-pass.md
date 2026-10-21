# AP and Martial Techniques Phase 0 Source Audit

## Scope and repository state

The controlling specification was read from `docs/roadmaps/AP_PERK_TREE_AND_MARTIAL_TECHNIQUES_IMPLEMENTATION_ROADMAP.md`. It was absent locally at the start, fetched from `origin` branch `docs/ap-perks-martial-techniques-roadmap`, copied from `FETCH_HEAD`, and verified byte-for-byte. Only Phase 0 was attempted; no expanded AP tree, Martial Techniques, Focus, or Training Grounds work was started.

| Checkpoint | Branch | HEAD | Worktree |
|---|---|---|---|
| Initial | `feature/castle-management-first-pass` | `7fb3d67 Fix tower placement position consistency` | Dirty: 21 tracked paths modified and 21 untracked status entries. Existing work included gameplay, profile-safety, tower-placement, test, report, and script changes. |
| Final | `feature/castle-management-first-pass` | `7fb3d67 Fix tower placement position consistency` | Dirty: all pre-existing changes remain. This pass additionally modified `frontend/src/game/engine.js`, `frontend/src/game/logic.js`, and `frontend/src/game/perks.js`; added `frontend/src/game/engine.defense-perks.test.js`; and added the exact fetched roadmap and this report. |

No pre-existing change was reset, discarded, staged, or overwritten. No commit, push, merge, deployment, branch switch, or `main` change occurred.

## Confirmed findings and fixes

### P0-A — Defense calculation inconsistency

`frontend/src/game/logic.js:heroDerived` calculates Defense from hero Defense, aggregated equipment Defense, and perk Defense (`effectiveStats.defense + perks.defense`). The authoritative mitigation formula remains `frontend/src/game/config.js:damageAfterDefense`: `raw * 100 / (100 + def)`.

Before this pass, enemy direct attacks, projectile hits, and napalm splash in `frontend/src/game/engine.js` passed only `h.ref.stats.defense` to that formula, dropping equipment and Defense perks from actual incoming-hit mitigation. All three paths now use the runtime hero's derived `h.d.defense`. The formula itself is unchanged.

### P0-B — Rogue `rouge_escape` and numeric-effect safety

`frontend/src/game/perks.js` declares the legacy ID `rouge_escape` with `lowHpDodgePct: 0.10`, but the `perkEffects` defaults omitted that key. Numeric effects were also accumulated without checking that the destination was a supported numeric field or that the input was a finite number. This could produce `NaN` (including for an unregistered value such as `knight_cleave`'s `cleave` key).

The aggregator now has a zero default for `lowHpDodgePct`, accepts numeric values only for declared numeric output fields, and ignores type-mismatched or unregistered fields instead of creating invalid values. `heroDerived` carries the finite Escape Artist bonus into runtime state. Enemy-hit resolution now applies its documented +10% dodge chance strictly below 35% HP, capped by the existing 50% dodge ceiling. The persisted `rouge_escape` identifier is unchanged.

Regression coverage in `frontend/src/game/engine.defense-perks.test.js` verifies baseline and modified derived Defense across direct, projectile, and area damage; finite aggregation for missing effects, all class perk catalogs, and the legacy Rogue ID; and Escape Artist's threshold, dodge, and ordinary damage behavior.

## P0-C — Declared effects without verified consumers

| Effect | Source evidence and current disposition | Test coverage / follow-up |
|---|---|---|
| `damageReductionPct` | `perks.js` declares Fortress at 8%; `heroDerived` exposes it as `damageReduction`, but enemy-hit handlers do not consume that field. Missing consumer. | No regression test proves Fortress reduces damage. Defer until its stacking with Defense, shields, and all damage sources is specified. |
| `lowHpDefense` | Last Stand declares +20% below 35% HP and `heroDerived` exposes the value, but hit resolution does not use it. Missing consumer. | No test proves the effect. Defer until its interaction with derived Defense and mitigation is defined. |
| `reactionBonus` | Guardian Instinct supplies `2`; the derived value is exposed, while `_triggerHeroReaction` uses fixed 3/5-second durations. The bonus is not applied. | No test proves the perk effect. Defer until units and which reaction durations it modifies are explicit. |
| `reactiveSpeedPct` | Ghoststep declares 25%; no runtime consumer was found. | No test proves reactive movement speed. Defer until the reactive movement path and scope are defined. |
| `reactiveSupport` | Reactive Barrier's flag has no combat consumer. | No test proves priority/support behavior. Defer until the threatened-ally selection rule is explicit. |
| `burn` | Burning Sigil's flag has no combat consumer. Napalm's `kind: "fire"` effect is drawn in the renderer; it does not apply damage over time. | No test proves a damage-over-time effect. Defer because damage, duration, refresh, and stacking rules are unspecified. |
| `lifebloom` | Lifebloom's flag has no healing/shield consumer. | No test proves the shield effect. Defer because shield amount and refresh rules are unspecified. |
| `markedDamagePct` | Marked Target's +10% value has no damage consumer. | No test proves a selected target's damage bonus. Defer until ownership, hit sources, and mark lifetime are specified. |
| `aoe` | Firestorm's boolean flag is not read by combat code. The area ability itself is implemented by the separate `mage_firestorm_ability` unlock requirements and Firestorm handler; that does not consume the flag. Treat the flag as redundant/dormant metadata, not as the area handler. | Existing ability tests cover the ability, not the flag. No change made. |

The `knight_cleave` effect key is also not a registered/consumed combat effect: the current multi-target hit handler reads `multiTarget`. The updated aggregator no longer emits a `NaN` value for that unregistered key, but this pass does not implement Cleave behavior.

These effects were not activated speculatively. Their remaining behavior and descriptions need a separately scoped, source-backed decision before consumer code is added. This is still an unresolved Phase 0 review item.

## Verification

| Command | Result |
|---|---|
| `npm --prefix frontend test -- --watchAll=false --runInBand src/game/engine.defense-perks.test.js src/game/engine.abilities.test.js src/game/engine.targeting.test.js src/game/engine.guild-blockade.test.js src/game/logic.progression.test.js src/game/logic.defeat-barricade.test.js src/game/towerPlacement.test.js` | Passed: 7 suites, 61 tests. |
| `npm --prefix frontend test -- --watchAll=false --runInBand` | Passed: 21 suites, 149 tests. |
| `git diff --check` | Passed. |

The frontend build was not run: an existing ignored `frontend/build/` directory was present, and replacing its contents would risk overwriting user-owned build artifacts. Android/APK and physical-device checks were not run; device verification remains outstanding. No backend test was relevant to these frontend-only changes.

## Phase 0 disposition

The inconsistent Defense input and Rogue Escape Artist numeric/dodge path are corrected with focused regressions. The nine roadmap-listed P0-C effects were audited; eight lack safe, sufficiently specified consumers, while `aoe` is redundant metadata alongside a separately implemented Firestorm ability. Cleave is another unconsumed effect field. These unresolved declared effects mean this report should be reviewed before Phase 1, and no later phase was started.
