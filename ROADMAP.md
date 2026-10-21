# Demonanic Development Roadmap

Updated: 2026-10-21

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented; automated and Android device smoke coverage reported | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Automated regression tests passed. The user also reports testing tower placement on Android. |
| Main menu redesign | Implemented and running in corrected Android build | Home screen uses compact resource/status panels, stronger skull branding, and larger navigation touch targets. Existing navigation is preserved; menu operation is user-confirmed on the corrected Android build. |
| Tactical menu and combat usability | First-pass improvement implemented; device review pending | The tactical HUD now uses a horizontal, larger-target hero picker, directly accessible mage spells, and collapsed secondary commands. Tower confirmation names its selected slot and cost. Focused tests and Android debug build passed; test the layout and touch flow on-device next. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |
| Spell Research random-pool guidance | Implemented on `review/mobile-working-copy`; automated/device verification pending | Empty random pools now identify eligible Intelligence-gated spells and other affinities, explain the level-10 secondary-affinity route, and clarify that failed eligibility does not consume resources. Regression coverage added to `libraryResearch.test.js`; run the focused test and Android smoke test before calling it verified. |
| Android profile creation and save safety | Recovery UI and one manual Android persistence smoke test verified; complete backend creation/save coverage remains unverified | The user reports the corrected APK showed the recovery screen, loaded the existing profile after **RETRY LOAD**, and retained a tower deletion after an app restart. This supports the observed retry-load and that deletion persistence path only. It does not verify every save path, new-profile creation, duplicate/concurrent creation, or backend runtime behavior. |

Latest tactical usability verification (2026-10-17): focused tactical/preparation/tower-placement/profile-guard tests passed (4 suites/20 tests); the full frontend suite passed (12 suites/64 tests); Android URL validator tests passed (4/4). Guarded production frontend build, Capacitor sync, and Android `assembleDebug` succeeded. Static APK inspection found the expected backend hostname, recovery prompt, tactical command label, mage spell panel, and slot confirmation. This APK was not installed or launched in this session. Separately, the user reports having installed the preceding corrected APK, successfully loaded Keep Command after retry, and confirmed a tower deletion persisted after restart (see the manual smoke-test report). No real-backend new-profile or concurrent-creation test has run.

Latest database-verification attempt (2026-10-17): re-ran Android config tests (4/4) and `git diff --check` (pass); ADB reported a connected device. Mongo URI/database/account-ID variables were unset and `mongosh`/`mongo` unavailable, so no API or database query was performed. At that point the original save remained unverified. The later user-reported Android smoke test confirmed the profile loaded after retry, though no operator-side database query was made. See `docs/dev-sessions/2026-10-17-profile-recovery-readonly-db-check.md` and `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md`.

The original profile is now confirmed to have loaded on the user's phone after retry, based on the user's report; no independent database query was performed. Minimum remaining backend verification is an explicitly approved, disposable test account on the intended backend (or an isolated equivalent): authenticate, create via POST and verify 201, retry creation and verify 409 without replacement, save via PUT, and confirm the test state through a read-only database query. No such account or production-write approval was available in this session.

## Known follow-up

- Historical 2026-10-16 note: the first source recovery-guard version was then uncommitted and not in the older installed APK. A guarded corrected APK was built afterward and the user later reported installing it and loading the existing profile. The production backend was not changed. See `docs/dev-sessions/2026-10-16-android-profile-recovery-guard.md` and `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md`.
- 2026-10-17 follow-up: ADB currently reports a connected TCP device. The installed APK was pulled read-only; its bundled JS contains `void 0` as backend configuration and `undefined/api`, lacks the workflow backend hostname, and contains the prior auto-create marker without the new recovery prompt. No launch occurred. Do not use this APK; see `docs/dev-sessions/2026-10-17-profile-recovery-apk-adb-followup.md`.
- Historical 2026-10-17 build follow-up: both workflows set the expected backend hostname, and the Android workflow runs a fail-fast `build:android` validator. At that point the configured debug APK had not yet been installed. The user later reported installing the corrected APK. The exact historical command that produced the old APK is not recorded, but its frontend bundle was compiled without the build-time environment value or stale output was embedded. See `docs/dev-sessions/2026-10-17-profile-recovery-android-build-config.md`.
- 2026-10-17 manual Android persistence smoke test: user reports that the corrected APK's **SAVED PROFILE NOT VERIFIED** screen offered device-save and retry options; after choosing **RETRY LOAD**, the existing Keep Command profile loaded with existing resources and a completed Thought Lance research notification. A tower deletion remained after exiting and reopening. This is user-reported device evidence, not an agent-run or database verification. New-profile creation, every save path, and concurrency remain unverified. See `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md`.

- The user reports the main-menu redesign is running in the corrected Android build. Review the new tactical menu and tower confirmation at common Android viewport sizes and confirm touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
- Historical 2026-10-16 investigation: app data was not inspected or cleared, and backend progress was not queried. See `docs/dev-sessions/2026-10-16-android-profile-recovery.md` for findings, hypotheses, and safe recovery steps.
- Historical 2026-10-16 diagnostics: runtime logs and Mongo record verification were unavailable at that time. Raw logcat must not be shared; see `docs/dev-sessions/2026-10-16-android-profile-recovery-diagnostics.md` for safe fields and evidence limits.
- The Termux ADB binary was not reused. Ubuntu's repository `adb` package now sees an active TCP/IP device and confirms the Demonanic package is installed, but the log buffer has no auth/profile/API markers and backend identity remains unverified. Do not launch the app until profile-creation behavior is guarded; details are in `docs/dev-sessions/2026-10-16-android-profile-recovery-linux-adb.md`.

## Expanded ability and perk trees — Phase 1 audit

Audit started: 2026-10-21 on `review/mobile-working-copy`. No perk-system code changed during this audit.

- Progression: `addHeroXp` grants one AP and one SP per hero level. SP allocation currently supports Attack, Defense, Agility, and Intelligence.
- Perk data: `frontend/src/game/perks.js` defines class-specific roots, parent-gated children, composite abilities, legacy ID mapping, and aggregated effects. Preserve existing perk IDs, especially the historical `rouge_*` prefix.
- Runtime integration: `heroDerived` aggregates perk effects, and `frontend/src/game/engine.js` consumes derived stats and unlocked abilities. Any new effect needs explicit runtime behavior and regression coverage.
- UI: `frontend/src/components/PerkTree.jsx` currently renders one class tree and composite abilities in a horizontally wide layout. Mobile usability must be reviewed when adding branch selection and more nodes.
- Progression transaction: `commitHeroProgressionDraft` validates staged AP/SP spending before mutating the hero. Current undo is for uncommitted choices only; persistent respecialization does not yet exist.
- Save compatibility: learned perks are stored as hero perk IDs; future branch/loadout metadata must normalize safely for legacy heroes and must not erase spells, equipment, stats, or existing perks on load.

### Agreed design constraints

- Open hybrid builds: preserve the hero's permanent base class and class-specific AP perk ownership, while designing an explicit cross-discipline training/unlock path for selected abilities. Do not silently allow purchasing every other class's exclusive AP tree.
- Respecialization: available outside active combat only; use a resource cost plus cooldown as the initial design, with values tuned against the economy simulation. Reset only the chosen AP/perk build scope; preserve SP allocations, researched spells, equipment, inventory, and unrelated profile state.
- Atomicity: validate the entire respec before charging or changing the hero. A failed save must not report success or leave a partial reset.
- Verification: add unit and UI regression tests, run the full frontend suite, build Android, and request user device verification. Do not merge to `main` or deploy without explicit approval.

### Next steps

1. Finish mapping all existing perk effects to their runtime consumers and identify undocumented or inert effects.
2. Produce a node-by-node branch specification with unlock requirements, costs, effect descriptions, and test cases before adding nodes.
3. Implement the branch data model and hybrid unlock path while retaining legacy IDs.
4. Implement respecialization with cost/cooldown, safe persistence, and failure handling.
5. Balance-test, run regression suites, build Android, and verify on-device.

## Expanded perk tree — implementation specification draft

### Runtime audit findings

The existing perk catalogue contains several effects that are currently declared and aggregated but have no clear combat-engine consumer in the audited engine file:
- `reactiveSpeedPct` (Ghoststep)
- `reactionBonus` (Guardian Instinct is surfaced as a derived field, but no matching engine consumer was found in the audited source)
- `aoe` (Firestorm foundation)
- `burn` (Burning Sigil)
- `lifebloom`
- `reactiveSupport`
- `markedDamagePct`

These are **effect integration gaps to verify and resolve**, not permission to silently change their intended behavior. Before expanding the tree, either implement each effect with tests or explicitly mark it as a future effect and avoid adding more nodes that depend on it. Existing effects already consumed in combat include cleave/multi-target hits, HP-threshold damage bonuses, defense/dodge, healing/barrier/cooldown multipliers, crit healing, attack speed, range, movement speed, and damage reduction.

### Branch layout proposal

The first release should expand the four existing class trees without replacing their roots or changing legacy IDs. These are themed branches within each permanent class, not class-change systems:

- **Knight:** Vanguard (front-line pressure and cleave), Warden (guarding allies, barriers and threat response), Champion (execution, survival and decisive strikes).
- **Rouge** (retain code key and `rouge_*` IDs): Assassin (critical/opening damage), Shadow (evasion, movement and escape), Saboteur (marking, debuffs and multi-target setup).
- **Mage:** Elementalist (elemental damage and damage-over-time), Arcanist (ability efficiency, cooldowns and control), Occultist (life-force, barriers and hybrid support).
- **Archer:** Marksman (range and precision), Ranger (mobility and sustained attacks), Artillerist (multi-target attacks, piercing and setup).

Each branch should have a small, readable sequence of foundation → specialization → capstone. Exact new node count and AP prices must be finalized against the existing per-level AP budget and combat simulations before coding. No node should be purely descriptive: each must have a testable effect or a clear unlock role.

### Hybrid-build rules

1. The hero's permanent base class remains unchanged.
2. AP perks remain class-specific and use the class's existing perk tree.
3. Cross-discipline abilities are unlocked through a separate **Cross-Training** track, not by accepting arbitrary foreign-class perk IDs.
4. Cross-Training should unlock a curated set of secondary abilities with role-appropriate restrictions, a limited number of equipped cross-discipline slots, and a meaningful AP/resource opportunity cost. The initial shortlist and exact costs require balance review.
5. Class identity is retained through exclusive capstones and native-class bonuses. Hybrid builds trade some specialization depth for flexibility.
6. Existing researched Mage spells remain a separate Library system; respec must not delete or unlearn researched spells.

### Respecialization contract

- Available only in Preparation/home screens, never during an active battle or active combat transition.
- Confirm dialog lists the exact perks to be removed, AP returned, cost, and remaining cooldown.
- Cost and cooldown are both applied to the hero/profile only after all validation succeeds. Tune the values using the existing economy simulation; do not hard-code an untested high cost.
- First pass resets AP perk choices only. SP stat allocations, hero level/XP, equipment, inventory, spells, HP, identity, and unrelated progression remain unchanged.
- Persist the resulting state using the existing save path. Because the current provider save is asynchronous and may fail, do not present a respec as durably successful until save acknowledgement is received. On failure, restore the pre-respec state and resources; avoid an optimistic partial reset.
- Store a versioned respec timestamp/cooldown marker with the profile. Legacy profiles without the marker should normalize to “never respecialized” without losing existing data.

### Acceptance checklist before release

- Every existing perk effect is either verified active with tests or explicitly deferred and not relied on by new nodes.
- Old profiles with legacy perk labels and `rouge_*` IDs still load and derive the same stats.
- Invalid class IDs, duplicate perks, missing prerequisites, negative AP, and overspending are rejected without mutation.
- Hybrid ability unlocks are restricted to the curated cross-training list; no foreign-class AP node can be purchased by manipulating IDs.
- Respec is blocked during battle, has a clear confirmation and cooldown, cannot charge twice, preserves unrelated progression, and rolls back on save failure.
- Mobile UI remains readable and navigable on a phone viewport.
- Run focused perk tests and the full frontend test suite, then build/install Android and request on-device verification. Do not merge to `main` or deploy without approval.
