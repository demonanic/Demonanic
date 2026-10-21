# Defeat, Revival, and Guild Defense Implementation

**Branch:** `feature/castle-management-first-pass`
**Scope:** Documented defeat-loss handling, safe revival, persistent Guild-managed barricades, temporary universal blockade, and regression coverage.

## Summary

Implemented the advertised surrender Gold tax with once-per-wave protection and Treasury-first deductions. Free Life continues to apply its documented 30% resource retention; no additional automatic loss percentage was introduced because the design documents specify none. A surviving Vault protects its stored Gold. If the Vault is destroyed, its Gold is exposed to the existing Free Life or surrender loss rule.

Added a paid group-revival offer when exactly one hero remains alive. It revives only fallen heroes at the configured 50% HP, charges each hero's existing level-based paid-revival price once, and leaves towers and castle state untouched. Rewarded-ad revival remains unavailable: the current provider is a mock and cannot prove ad completion, so the client does not grant revival from its response.

Barricades now persist combat damage, render in the existing neon synthwave style, and are installed, repaired, or replaced through the Guild. Added a Guild-level-2 temporary blockade that stops every configured enemy archetype at a live barricade; enemies resume normal behavior after it expires. Active and cooldown timestamps are persisted and bounded during save normalization.

## Changes

| Area | Implementation |
|---|---|
| Defeat/rewards | Free Life and surrender deduct exposed Gold from Treasury first. Vault Gold remains protected while its building survives. Surrender's existing wave-based tax is charged once per wave; stale/duplicate result completion is guarded. Failed-wave kill Gold, XP, and drops remain under current per-kill rules; no undocumented rollback or retry reward cap was added. |
| Revival | A one-survivor in-battle offer supports paid revival of only fallen heroes at configured 50% HP. Price is the sum of the existing `paidRevivalCost(level)` values: 100 Gold per level, minimum 300 and maximum 2,000 per hero. This reuses the Preparation economy and scales the fee with progression. The ad option is disabled until a provider reports a completed, verified, non-mock reward. |
| Barricades | Guild management requires a live, unlocked Guild (level 1+). Purchase remains 2 HP per Gold, 25–500 Gold per order (up to 1,000 HP). Repair costs 20% of missing HP in Gold plus 10% in Stone. Destroyed barricades require a confirmed 500-Gold replacement. Existing barricade damage/destruction now survives battle results and profile save/load. |
| Universal blockade | Guild level 2 unlock; upgrade costs 500 Gold and 250 Stone. Activation costs 100 Gold and 50 Stone, lasts 8 seconds, and has a 60-second cooldown. These conservative starting values are recorded here because the existing design documents specify no blockade balance values. |
| Persistence safety | New barricade and blockade state is normalized on load; active/cooldown deadlines are clamped to the configured maximum durations to prevent malformed or far-future saved deadlines. |

### Relevant implementation and regression files

- `frontend/src/game/config.js`
- `frontend/src/game/logic.js`
- `frontend/src/game/engine.js`
- `frontend/src/context/GameProvider.jsx`
- `frontend/src/screens/Battle.jsx`
- `frontend/src/screens/Results.jsx`
- `frontend/src/screens/Preparation.jsx`
- `frontend/src/components/CastleBuildings.jsx`
- `frontend/src/components/PrepField.jsx`
- `frontend/src/screens/Home.jsx`
- `frontend/src/game/rewards.js`
- `frontend/src/game/rewards.test.js`
- `frontend/src/game/logic.defeat-barricade.test.js`
- `frontend/src/game/engine.guild-blockade.test.js`
- `frontend/src/context/GameProvider.test.jsx`
- `frontend/src/screens/Battle.tactical-flow.test.jsx`

The repository already contained unrelated modified and untracked work at task start. Those changes were preserved; this list identifies files relevant to this implementation, not every pre-existing worktree change.

## Design intent and remaining gameplay policy

- `memory/PRD.md` specifies Free Life retaining 30% of resources and surrender carrying a Gold tax plus morale loss. `plan/plan.md` describes the recovery flow and mocked monetization. The prior audit found no documented separate ordinary-defeat Gold percentage. Accordingly, no new loss fee was invented.
- Existing per-kill Gold, XP, kill counts, and gear drops still persist on a failed attempt. The prior audit identified that retrying the same wave can therefore accumulate partial-kill rewards. This implementation deliberately does not change that economy without a design decision.
- The current backend ad route is a mock, not validated evidence of completed playback. Ad-based revival remains disabled rather than treating a request, loading state, failure, cancellation, or mock grant as a verified reward.

## Verification

| Check | Result |
|---|---|
| Full frontend suite: `cd frontend && CI=true npm test -- --watchAll=false --runInBand` | **Passed:** 20 suites, 143 tests. |
| `git diff --check` | **Passed.** |
| Frontend production build | **Passed** as part of `~/build-demonanic-local`. |
| Capacitor Android sync | **Passed.** |
| Android debug APK (`assembleDebug`) | **Passed.** APK copied to `/data/data/com.termux/files/home/storage/downloads/demonanic-local-test.apk` (6,776,954 bytes). |
| Backend tests (`python -m pytest -q backend/tests`) | **Not run to completion:** after installing the declared pytest and pytest-xdist runner dependencies, collection failed because backend dependencies `requests` and `fastapi` are absent from this environment. No backend tests passed. |
| Physical Android verification | **Pending.** The APK was built but not installed or tested on a phone. |

## Device verification still required

Install the built debug APK on the intended test device and verify: (1) the one-survivor offer and displayed Treasury/price, successful paid revival, and no duplicate charge on repeated taps; (2) a complete squad defeat shows no mid-battle offer; (3) ad revival stays unavailable and no failed/cancelled ad path revives anyone; (4) barricade damage and destruction persist through Results, repair/replacement use the displayed costs and do not duplicate, and a destroyed barricade no longer obstructs enemies; (5) activate the Guild blockade, confirm every enemy class including bosses pauses only for the displayed duration, then resumes, and verify active/cooldown state after app restart; and (6) surrender tax and protected-versus-destroyed Vault behavior using a non-production test profile.

No device behavior, live rewarded-ad completion, or backend persistence was independently verified in this task.
