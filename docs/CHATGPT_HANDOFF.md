# Demonanic — ChatGPT Development Handoff

Living handoff for repository review and continuation. Update this file after meaningful audits, implementation, debugging, architectural decisions, and verification. Preserve older decisions and label proposals separately from approved requirements. Do not include secrets or private account data.

## Latest rebuild milestone — architecture audit and progression foundation — 2026-10-22

### Repository checkpoint and scope

- Read `AGENTS.md`, this handoff, and `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md` in full. The bible remains the sole authority for perk and ability behavior.
- Branch `review/mobile-working-copy`, HEAD at task start `4df3e4cd724724e75d3fbb54796fc3bf65fb2b3b`; fetched `origin/review/mobile-working-copy` and verified 0 ahead / 0 behind. No branch switch or merge.
- Pre-existing user changes at task start: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`. Their Git blob hashes remain `a3e4bf63668f88ed1ebebca6fc441362b3ffb8c4`, `a52492e8dfb8ecd4e0ac25cb6a1817b1b6da6e4e`, `52e5fd545f7d5f99fbef95f7eda2a12057e98768`, and `7925804f09e661d91d5b983f7dc5e0e60da6f0c8` respectively; this task did not edit or stage them.
- `rg` is unavailable in this environment; source discovery used `find` and `grep -RInE` instead.

### Architecture audit — verified facts

- **Hero model and progression:** `frontend/src/game/config.js` owns four class definitions, class stat modifiers, base HP, range, attack rate, and class-specific attack configurations. `frontend/src/game/logic.js` `createHero`, `heroDerived`, recruitment, rename fallback, XP, and `buyPerk` depend on those definitions. New heroes cannot currently be unclassified. `frontend/src/game/perks.js` stores class-keyed trees and filters/validates class-specific IDs.
- **Combat:** `frontend/src/game/engine.js` derives damage type and behavior from `cls`, uses a `range < 130` melee/ranged split, restricts spells to Mage, and has class-specific targeting/attack paths. It contains the battle action and defeat lifecycle that should be retained while replacing class selection and effect dispatch in bounded slices. Existing damage formulas do not implement the bible's category pipeline and independent caps.
- **Rendering:** `frontend/src/components/ui-kit.jsx` `HeroMiniSprite` selects class-specific presentation; `engine.js` also has class-based hero rendering. Rendering should consume a configurable appearance identifier independent of progression. The owner has not selected a new default sprite; this milestone neither changes nor selects one.
- **UI:** class selection and display appear in `SquadSelect.jsx`, `CastleBuildings.jsx`, `cards.jsx`, `Roster.jsx`, `Preparation.jsx`, `Profile.jsx`, `PrepField.jsx`, `TacticalMenu.jsx`, `Armory.jsx`, and `PerkTree.jsx`. Perk UI and display names currently assume class-keyed data. Future work needs to separate build title/purchased node presentation from identity and eligibility.
- **Equipment and adjacent gameplay:** `frontend/src/game/equipment.js` constrains secondary weapon matching by class. Mage Library ownership/eligibility is class-gated in `libraryResearch.js`, `LibraryResearch.jsx`, `Armory.jsx`, and `GameProvider.jsx`. Academy training and the economy/castle/manufacturing systems are distinct subsystems and should be retained unless a traced dependency requires a change.
- **Profiles and infrastructure:** `AuthContext.jsx` and `api.js` provide separate authentication and game-state API paths. `GameProvider.jsx` normalizes full-profile data and autosaves. `backend/server.py` stores the profile as a whole state; `PUT /game/state` replaces the state and no revision/CAS protection was found in the inspected endpoint. Backend offline accrual also reads hero state. Do not use a production profile for fresh-game resets; create an isolated disposable test account/profile or dedicated test environment.
- **Tests:** existing tests cover legacy progression, engine abilities/targeting/defense, UI, `GameProvider`, economy, Academy, and Library. They do not establish the bible's classless contract; add focused unit tests first, then integration tests for new profile creation, progression-to-combat wiring, and UI. Add deterministic simulations for provisional numeric balance and repeatable playthrough checks using disposable profiles.

### Proposed architecture boundaries

- Replace class eligibility and derived class stats with an explicitly unclassified hero identity model plus separately specified shared combat profile. Keep appearance/animation configuration independent of purchased nodes and titles.
- Use a canonical progression domain for the bible's permanent node IDs, AP purchase validation, derived titles, and signature eligibility. Keep purchase validation pure and atomic. Keep effect execution in combat handlers so catalog data cannot imply an effect is live.
- Refactor combat incrementally around one shared starter ability and explicit common attack, target selection, movement, cooldown, damage, and defeat lifecycle. Replace class-based damage dispatch with bible-defined tags/categories and the Section 3 pipeline/caps; implement the approved crit, CDR, mitigation, sustain, control, marks, shields, aura, untargetability, and lethal-resolution rules with observable tests.
- Replace class-specific hero creation and UI choices with unclassified creation, roster/preparation/tactical/perk interfaces, while keeping equipment, Library, and Academy behind compatibility boundaries until separately reviewed. The sprite remains a configurable presentation choice.
- Retain authentication, backend connectivity, accounts, profile API, economy, castle, towers, and manufacturing. Change shared infrastructure only when a traced dependency demonstrates necessity. Never delete/reset production accounts or database profiles.

### First implementation slice selected

The smallest useful safe foundation is a standalone progression catalog and pure validator, not runtime hero/combat replacement. Implemented files in this task:

- `frontend/src/game/classlessProgression.js`: canonical 47 node IDs across all 11 branches; tier, AP cost, level threshold, prerequisites, and the three explicitly gated Phase 2 nodes; pure `purchaseNode` returns a copied state on success or a reason code on refusal. It rejects malformed owned state, unknown/duplicate IDs, missing prerequisites, insufficient AP, below-level purchases, gated nodes, and a third Tier III node. It has no effect handlers and no signatures/titles or profile integration.
- `frontend/src/game/classlessProgression.test.js`: catalog and validator tests, including input immutability on both success and failure.

This slice consumes a progression value with `level`, available `ap`, and `ownedNodeIds`; it does not accrue AP, define a full hero, modify `logic.js`, or connect to legacy `perks.js`. That separation avoids disturbing the user's pre-existing `perks.js` work. It is groundwork, not completion of the classless system.

### Next milestone plan, dependencies, and acceptance

1. **Approve/specify shared hero baseline.** The bible says every new hero has a shared baseline but supplies no numeric base stats, max HP, attack/range/cooldown, target policy, or movement values. Older handoff values are proposals and are not authority. Get an explicit baseline decision or a bible revision before wiring new hero creation or combat. Keep sprite configurable until the owner chooses one.
2. **Add a build-independent classless hero model and creation path.** Planned files after baseline approval: new `frontend/src/game/heroModel.js` and focused `heroModel.test.js`, then `logic.js` and `config.js` adapters for new-game creation/derived stats. Tests should prove no class eligibility key, shared baseline consistency, Shared Strike entitlement, stable progression fields, and no regression to shared profile/economy setup. Use disposable profiles only.
3. **Connect progression UI/state.** Replace legacy `PerkTree.jsx` class catalog consumers with the canonical validator and display unavailable gates. Resolve the three known bible wording/count questions only with owner approval; the current validator follows explicit IDs and prerequisites without resolving prose discrepancies. Tests: bible acceptance cases 1–4, purchase atomicity, title/eligibility separation once title recipes are approved.
4. **Refactor common combat and render adapters.** Trace `engine.js`, `config.js`, `ui-kit.jsx`, `PrepField.jsx`, and battle UI; make sprite/animation selection independent from build. Test common attack/target/cooldown/defeat paths and effect boundaries before implementing each bible system. Then incrementally implement the bible pipeline, caps, crit, CDR, mitigation, sustain, control/marks/shields/auras, untargetability, and lethal order with relevant acceptance tests.
5. **Integrate signatures and phase gates.** Add Phase 1 signatures only after their prerequisites and effect handlers are tested. Keep Pyromancer unavailable until the burn/DoT handler exists; keep Construct, Familiar, Primal Bond, Summoner, and Beastmaster unavailable until the required companion lifecycle exists. No partial gate effects.
6. **Fresh-profile gameplay validation.** Establish a dedicated disposable test identity/environment, then run progression-to-battle integration, deterministic simulations, focused and full frontend suites, and builds. Preserve production accounts/data, authentication, economy, castle, and manufacturing. Keep rollback boundaries per module/feature slice; do not change backend profile schema or enable any migration as part of these first frontend milestones.

**Acceptance for the implemented slice:** all 47 canonical IDs appear once; node tiers/costs/levels and prerequisites match the bible; only C3, C3a, and N3 are purchase-gated Phase 2 nodes; third Tier III purchase is refused; unknown, duplicate, invalid, unaffordable, and under-level requests are rejected; failed and successful validations do not mutate the input. **Not accepted by this slice:** full hero creation, AP accrual, effects, combat, signatures, titles, UI, persistence, or profile migration.

### Risks and decisions

- The bible leaves the numeric shared baseline unspecified; do not start runtime hero/combat integration using values from older proposals.
- Existing class assumptions span hero creation/derivation, battle targeting/damage/attack selection, Mage spells/Library, class-bound equipment, UI, and rendering. Removing `cls` in one pass would cause wide breakage. Retain service/account/profile/economy/castle/manufacturing infrastructure.
- Existing `normalizeState` mutates/normalizes full profiles and the backend PUT replaces whole profile state without observed concurrency control. Use only disposable profiles for fresh gameplay; no production deletion/reset or broad profile migration.
- Four bible questions remain open: catalog Phase 1/gated totals; six-versus-five nodes in a mastered branch; Loaded Dice expected value; and the sustain-cap scope. No choice was made here. Respec, elemental resistance behavior, companion lifecycle, SP, new Library access, and PvP remain as explicitly undecided in the bible.

### Validation and working-tree record

- First attempted command `CI=true yarn --cwd frontend test --watchAll=false --runInBand src/game/classlessProgression.test.js` could not start: `yarn: not found` (exit 127).
- Corrected command `CI=true npm --prefix frontend test -- --watchAll=false --runInBand src/game/classlessProgression.test.js`: **PASS**, 1 suite, 15 tests. An intermediate run exposed a malformed test fixture (an owned W2 without W1); the fixture was corrected and the final run passed.
- `git diff --check`: passed after the implementation and handoff edits; staged code diff check also passed before its commit.
- No full suite, build, backend test, profile integration, simulation, or device check was run.
- Exact changed task files: `frontend/src/game/classlessProgression.js`, `frontend/src/game/classlessProgression.test.js`, and `docs/CHATGPT_HANDOFF.md`. The two new code files were committed separately as `ddbdc5c` (`Add isolated canonical progression validator`). Existing four user-owned files remain separate and unchanged. Publication verified: code commit `ddbdc5c` and handoff-only commit `d698d95` were pushed normally to `origin/review/mobile-working-copy`; `git ls-remote` returned `d698d95945bc9ab27084336e0e780cd0260fd79d`, matching local HEAD, and the branch was 0 ahead / 0 behind after fetch. This publication record is included in a follow-up handoff-only commit.

The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.


## Current owner-approved direction — fresh classless rebuild

The project owner has changed the priority: preserving the old class-based gameplay architecture and existing hero progression is no longer a primary release requirement. Rebuild gameplay around `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`, the sole authority for perk and ability behavior. New heroes are unclassified and use the bible's shared baseline and Shared Strike. Replace class-based progression and combat assumptions with its universal perk architecture, damage pipeline, caps, combat rules, canonical IDs, prerequisites, signatures, and phase gates. Use fresh disposable test profiles for gameplay validation.

Retain authentication, backend connectivity, accounts, economy, castle systems, and other infrastructure unless investigation shows replacement is necessary. Never delete production accounts, profiles, or database data. Test resets must be limited to disposable profiles or a dedicated test environment. Existing progression preservation is not a release blocker, but production data remains protected. Do not start Phase 1.5 or Phase 2 content before its bible dependencies exist. Keep the four bible wording/count questions below unresolved until the owner explicitly approves decisions. This direction supersedes older handoff proposals that treated full legacy gameplay parity or automatic profile migration as prerequisites; those proposals remain historical context and are not implementation requirements absent further approval.

### Implementation plan — planning only; no gameplay rewrite started

1. **Baseline and isolate fresh testing.** Inspect app startup, profile creation, `GameProvider.jsx`, `api.js`, and `backend/server.py`; identify how to create/reset disposable profiles or configure a dedicated test environment without touching production accounts. Record the baseline and rollback point. Dependency: a safe isolated test target. Tests: profile creation/load/save and isolation checks. Rollback: revert only test-environment configuration or test fixtures; no production data reset.
2. **Replace progression domain.** Replace class-keyed catalogs and purchase validation in `frontend/src/game/perks.js` and `logic.js` with bible IDs, prerequisites, levels/tiers/AP rules, Tier III cap, signatures, and phase gates; update `PerkTree.jsx` and related UI. Keep unrelated XP/SP, profile, equipment, Academy, Library, economy, and castle systems unless a demonstrated dependency requires an adapter. Tests: all bible acceptance tests for catalog, unlock/refusal, costs/caps, signatures, and gated no-leak behavior. Dependency: document-to-test traceability and approved resolution of any wording ambiguity that blocks deterministic expected results. Rollback: feature boundary or isolated progression module; preserve prior files/fixtures in version control.
3. **Replace combat assumptions with the bible pipeline.** In `engine.js`, `config.js`, and focused combat helpers, establish shared baseline/Strike, category stacking, independent caps, crit/cooldown, marks/control/shields/auras, untargetability, and lethal-resolution order. Trace each effect to its runtime consumer. Tests: pipeline/caps and the bible's combat acceptance cases, including edge ordering. Dependency: milestone 2 effect data. Rollback: revert the combat slice or keep a temporary selectable test harness until acceptance cases pass.
4. **Implement Phase 1 signatures and shared rules.** Add Phase 1 signature definitions, requirements, lockout, and ownership/consumption rules exactly as specified; do not implement gated signatures early. Tests: each signature prerequisite, activation, lockout, and interaction case. Dependency: milestones 2–3. Rollback: gate the signature handlers independently.
5. **Integrate UI and isolated fresh-profile playtest.** Update hero creation, roster/preparation, perk tree, tactical controls, and presentation to remove class eligibility assumptions for new heroes while retaining service/account and non-gameplay systems. Exercise fresh test profiles through progression and battles; run focused tests, full frontend tests, and builds as appropriate. Rollback: revert UI integration and reset only disposable profiles.
6. **Review deferred gates and release boundary.** Verify Phase 1 acceptance and dependency criteria before separately proposing Phase 1.5; keep Phase 2 companion nodes/signatures unavailable until lifecycle requirements exist. Review data and infrastructure impacts before any production migration proposal. No production account/profile/database deletion or reset is permitted. Rollback: keep later phases behind explicit gates and retain the last accepted Phase 1 checkpoint.

The sequence remains a recommendation beyond the isolated validator implemented in the latest milestone above. No full hero creation, live progression integration, combat rewrite, profile change, backend data change, or production setting change has begun. The next runtime hero milestone depends on an owner-approved shared baseline; the four open bible questions remain unresolved.

### This handoff update — 2026-10-22

- **Verified repository state before edit:** branch `review/mobile-working-copy`, HEAD `8c5995658b459ed3209498576fae1dfa57411cc3`, synchronized with `origin/review/mobile-working-copy` (0 ahead/behind). Pre-existing unstaged changes remain in `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; recorded blob hashes were respectively `a3e4bf63668f88ed1ebebca6fc441362b3ffb8c4`, `a52492e8dfb8ecd4e0ac25cb6a1817b1b6da6e4e`, `52e5fd545f7d5f99fbef95f7eda2a12057e98768`, and `7925804f09e661d91d5b983f7dc5e0e60da6f0c8`.
- **Changed:** this handoff only. Recorded the approved strategy shift and six small implementation milestones with files, dependencies, test expectations, and rollback boundaries. Existing architecture audit and canonical bible record remain historical context; this section is the current direction. No gameplay implementation or tests/builds were run.
- **Validation/publication:** `git diff --check` passed; final review showed only this handoff as a task change, with the four listed user-owned files unchanged. No test/build command was run for this documentation-only planning edit. This handoff-only update is being prepared for publication on the authorized branch; the resulting commit and remote verification are reported at task completion.
- The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 21. Milestone 5 — Classless Perk Purchases and Persistence — 2026-10-22

### Starting state and implementation

- Fetched `origin/review/mobile-working-copy`; local branch and remote both started at `c3b10d81991cc47d408121645ff87fb16d56a3ac`. Worked on that branch only.
- Pre-existing user changes preserved and excluded from staging: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`.
- Read `AGENTS.md`, this handoff, and the full canonical perk/ability design bible. No bible or open design question changed. The classless progression catalog remains metadata only; this milestone does not implement combat effects, SP spending, respec, or signatures.
- Fixed a verified catalog metadata mismatch: the final node in each three-node expansion branch (`H3`, `F3`, `N3`, `I3`) is Tier III, costs 3 AP, requires level 10 and the branch's Tier II node. Previously the index-based catalog incorrectly marked those as Tier II.
- Added `purchaseClasslessNode`, a pure adapter that delegates to the existing purchase validator and returns a replacement progression only on success. Roster installs that progression on the classless hero found by stable identity inside the provider mutation. Legacy class-based roster/perk behavior remains on its prior path.
- Added a separate classless universal perk panel with catalog-derived IDs, tier, cost, level, prerequisites, and gating. It explicitly states that purchases record ownership/AP only and combat effects are not active. Phase 2 gated nodes remain unavailable.
- `Roster`'s existing alias imports were converted to relative imports because this Jest setup cannot resolve those aliases for the actual screen/provider test. No profile API, production data, appearance, class assignment, or default sprite changed.

### Tests and checks

- Initial pre-edit progression/persistence baseline from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessProgression.test.js src/game/classlessPersistence.test.js` — PASS, 2 suites / 20 tests.
- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessProgression.test.js src/screens/Roster.classlessProgression.test.jsx` — PASS, 2 suites / 23 tests. The screen/provider test uses disposable local state, actual `Roster` and `GameProvider`, mocked API IO, production serialization, and normalization on remount; it verifies purchase/reload and preservation of unrelated account/economy/castle/hero fields.
- Regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessProgression.test.js src/screens/Roster.classlessProgression.test.jsx src/game/classlessPersistence.test.js src/context/GameProvider.test.jsx src/game/logic.classlessHero.test.js src/game/logic.progression.test.js src/components/PerkTree.test.jsx src/context/classlessBattleCompletion.provider.test.jsx` — PASS, 8 suites / 57 tests.
- `npm run build` from `frontend/` — PASS, optimized production frontend compiled. Node emitted a non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS. No full frontend suite, Android/device test, live backend, or production profile was used.

### Limitations and next step

- Current model starts with 0 AP and there is not yet a verified classless level-up/AP earning path. The bible says heroes gain AP and SP per level but does not provide an XP threshold curve here. This milestone intentionally does not invent a curve or award AP through legacy class progression. Purchases are therefore available only where validated classless progression already has sufficient AP. Next task should define/approve and test the classless XP-to-level/AP grant boundary before normal fresh heroes can earn purchase points.
- Node ownership is persisted, but catalog effects remain inactive until their actual combat handlers are implemented and tested. Remaining bible wording/count questions are unchanged. This does not represent a complete perk progression/combat integration.
- Task files: `frontend/src/game/classlessProgression.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/screens/Roster.jsx`, and `frontend/src/screens/Roster.classlessProgression.test.jsx`. Code/test commit `f8bfa32ddfdc1164ea868f5b3f16ce83c11e43b5` (`Connect classless perk purchases and persistence`) was pushed to `origin/review/mobile-working-copy`; fetch, local HEAD, and `git ls-remote` verified this exact remote SHA. The handoff is being published separately after this verification. Unrelated pre-existing user changes remain uncommitted and unstaged.
- `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 22. Classless hero rebuild continuation — progression loop and initial passive effects — 2026-10-22

### Starting point and scope

- Started on `review/mobile-working-copy` at `3c970cea5d2484a428941071afac2feb2c9fe480`. Fetched `origin/review/mobile-working-copy`; remote matched HEAD. Preserved existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; these were not edited or staged.
- Re-read `AGENTS.md`, the handoff, and the design bible. No bible text, approved hero baseline, phase gates, or open design question was changed. No production profile/service/data was accessed.

### Implemented and verified

- Reused `config.js::HERO_XP` and `heroLevelForXp` as the existing shared threshold curve (levels 1–20). Classless battle XP now recalculates level and grants 1 AP plus 1 SP per crossed level, including multiple levels from one award. Victory and defeat continue to use the same legitimate engine XP awards. Legacy class XP/AP/SP/perk progression remains on its existing path.
- Added atomic classless SP allocation in the universal roster panel. It decrements `progression.sp` and increments the selected `combat.stats` value. Existing combat consumers use Defense for mitigation and Agility for evasion. Attack allocation uses a small explicit bridge: each point above the approved baseline Attack 10 adds one weapon damage, matching the legacy one-point attack scaling while preserving the approved 16 starting weapon damage. Intelligence allocation is persisted, but classless spell scaling is not connected yet; the bible marks SP stat behavior out of scope, so this is an implementation bridge that needs balance validation.
- Updated result reporting to count classless level-ups. The screen-level disposable integration test now enters battle one XP below level 2, earns XP through Shared Strike, and verifies level 2, +1 AP, +1 SP, save, and normalized provider reload. A roster/provider test allocates Attack and verifies the stat and spent SP survive serialization/reload.
- Implemented and tested six Phase 1 passive handlers: V1 weapon damage, P1 crit chance, P2a crit damage, S1 attack speed, T1 active cooldown reduction (including Shared Strike), and F1 crit damage. Caps for these categories follow bible Section 3.2. Their UI entries are marked active.
- To avoid silently charging AP for no-op nodes, the classless purchase boundary refuses catalog nodes without an implemented effect (`effect_pending`); the canonical metadata validator remains unchanged. The UI labels the remaining node effects pending, disables those purchases, and preserves Phase 2 system gates. Thus unimplemented purchases cannot become AP sinks.
- Shared Strike remains on the existing real tactical-menu → engine path. No extra ability, class assignment, sprite/default appearance, or class-based fallback was added.

### Validation

- Combined regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx src/screens/Roster.classlessProgression.test.jsx src/context/classlessBattleCompletion.provider.test.jsx src/context/GameProvider.test.jsx src/game/classlessProgression.test.js src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/engine.classless.test.js src/game/engine.targeting.test.js src/game/engine.abilities.test.js src/game/logic.classlessHero.test.js src/game/logic.progression.test.js src/components/TacticalMenu.test.jsx src/components/PerkTree.test.jsx` — final PASS, 14 suites / 116 tests. The first combined run had one regression because effect-pending enforcement was placed in the canonical metadata validator; enforcement was moved to the classless purchase boundary, the focused progression/roster suites passed (2 suites / 26 tests), and the full combined command then passed.
- `npm run build` from `frontend/` — PASS, optimized production build compiled. Node emitted non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after final review. No full test suite, backend/live API, production data, Android build, or device test was run.

### Current completion status and remaining material gaps

- This is a connected progression slice, **not completion of the requested classless hero rebuild**. The real classless creation → preparation → battle → Shared Strike → XP/level/AP/SP → provider save/normalization/reload path is covered with disposable fixtures and mocked API IO. The screen journey uses the actual Engine and components; animation start is stubbed and enemy insertion/wave outcome are deterministic test controls, not natural-wave or device validation.
- Only 6 of 43 Phase 1 perk nodes have active effects; all other non-gated nodes remain unavailable at the classless purchase boundary. Most bible abilities/signatures are not implemented or offered. W1 max HP, mitigation/control, sustain, marks, damage pipeline/caps beyond the six passives, signature recipes/lockout, and tactical abilities remain incomplete. The Phase 2 nodes remain gated. Existing panel does not yet render full names/effect descriptions for every pending node.
- Equipment numeric bonuses/secondary compatibility, classless Library/spell access, academy/recovery integration across all profile collections, and titles/appearance experience were not completed here. Legacy class behavior remains available as compatibility code. No claim is made that new heroes can use all existing game systems.
- Reusing `HERO_XP` is justified by the existing shared source rule and matches the bible's 1 AP/1 SP per level. SP stat use itself is outside the bible; the Attack point-to-damage bridge above is explicit and provisional, and should be balance-simulated before release. Respec, elemental resistance, Phase 1.5 burn handler, and Phase 2 companion lifecycle questions remain as written in the bible.
- Changed implementation/test files: `frontend/src/game/classlessProgression.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/classlessBattleResults.js`, `frontend/src/game/classlessBattleResults.test.js`, new `frontend/src/game/classlessCombatEffects.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/game/battleCompletion.js`, `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/screens/Roster.jsx`, `frontend/src/screens/Roster.classlessProgression.test.jsx`, and `frontend/src/screens/classlessScreen.integration.test.jsx`.
- Recommended next task is a bounded combat-effect implementation pass across the remaining Phase 1 nodes, starting with defensive/sustain handlers and the node-name/effect catalog. Do not call this rebuild complete until all currently purchasable nodes are implemented and the supported equipment/recovery paths are verified. `work done` means ChatGPT should retrieve and review the latest published handoff.
- Code/test commit `ef9954c9068e2c4f35f5ce5d2d2826e9d3d707ab` (`Connect classless leveling and initial perk effects`) was pushed to `origin/review/mobile-working-copy`; fetched HEAD and `git ls-remote` verified that exact SHA. This handoff update will be published as a separate handoff-only commit. Preserved user changes remain outside both commits.

## 1. Project status

### Project and architecture

Demonanic is an RPG/tower-defense game. The frontend is a React application under `frontend/src`; core game-state logic is in `frontend/src/game/logic.js`, combat simulation/rendering in `frontend/src/game/engine.js`, and profile lifecycle in `frontend/src/context/GameProvider.jsx`. The backend is a Python/FastAPI service in `backend/server.py` that stores a whole game-state object in MongoDB. The profile API currently uses `GET /game/state`, `POST /game/state`, and full-state `PUT /game/state`.

The game has hero XP/levels, AP perk progression, SP stat allocation, equipment, Academy stat training, Mage Library research/spellbooks, battle abilities, towers, castle buildings, and a shared Gold/Stone/Metal economy. The root `README.md` and `frontend/README.md` are Create React App boilerplate rather than current game architecture documentation.

### Repository checkpoint before classless architecture audit — 2026-10-22 03:22 UTC

- Branch: `review/mobile-working-copy` (verified; no branch switch performed).
- HEAD: `23cfaae518fa90190ae45f7161fa1f260537226f` — `Record collaboration handoff publication`.
- Local branch matched `origin/review/mobile-working-copy` (0 ahead, 0 behind).
- Pre-existing worktree changes before this audit:
  - Modified: `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`.
  - Untracked: `frontend/src/components/PerkTree.test.jsx`.
- The changes add themed labels for the existing class-root branches and focused component coverage; the roadmap also records that work. They are user-owned, uncommitted, and were not altered by this task.

Recent commits observed:

| SHA | Subject |
| --- | --- |
| `aaf672f` | Document return-to-login recovery action |
| `8cfd905` | Add return to login from profile error screens |
| `59b8338` | Record mobile perk tree layout pass |
| `5788bc5` | Make perk tree layout responsive on mobile |
| `4ae6f29` | Record first perk expansion batch and verification status |
| `4609ac4` | Test first expanded perk nodes and effect wiring |
| `46662bd` | Add first expansion batch of class perk nodes |
| `7e20eae` | Document verified perk runtime audit findings |

### Current phase and objective

The user has approved classless progression planning constraints: seven universal branch direction with specialization-based hybrid progression and signatures added gradually; new heroes start unclassified on a shared-midline combat baseline and get one shared single-target starter strike; dynamic titles describe current builds and never determine eligibility; existing equipment and Mage Library assets/access are grandfathered; legacy progression/behavior and unrelated profile/account/economy/castle state are preserved; and conflict protection is required before automatic remote migration. Detailed nodes, balance, eligibility, and migration mechanisms remain proposals where noted. This remains planning only; no classless implementation or data migration has begun.

The newest user direction supersedes earlier fixed-class hybrid/Cross-Training assumptions. Concrete branch/node values and migration mechanisms below are proposals, not approved implementation specifications, except for the decisions explicitly listed as approved in Section 5.

The repository workflow is in root `AGENTS.md`. This audit completes the requested classless dependency review and provides recommendations only; no gameplay or save changes are in scope. The exact phrase `work done` means ChatGPT must retrieve the latest published handoff, review it, and report back. Preserve the pre-existing perk-tree and roadmap work.

## 2. Architecture and audits

### Current authoritative perk/ability specification — bible v1.0

The approved source of truth is `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`, published on `review/mobile-working-copy` in commit `fd37d2454ebdd7134a6fbaba3c9f9aaa946dfde3` and verified from fetched remote commit `5ac34b8e653921e7ad20b01c0db2f89747215ef0`. It supersedes earlier perk/ability proposals and discussions in this handoff wherever they conflict, including the older seven-branch-only candidate list, candidate signature recipes, tier/depth ideas, and classless implementation proposals. The approved bible defines 11 branches (seven core and four expansion), all permanent node IDs and rules, nine signature definitions, shared systems, acceptance tests, and phase gates. Values are locked for implementation but provisional for release and require simulation evidence before tuning. Four internal specification questions remain open; see the 2026-10-22 07:11 audit below. The design document itself was not modified.

The preceding classless architecture inventory remains useful as a compatibility/save-risk audit, not as authority for perk mechanics. The older class-bound `ROADMAP.md` and legacy source remain implementation context only; no gameplay work is approved by this documentation update.

### Files and verified findings

Inspected during the classless architecture audit (2026-10-21 local date; exact UTC time was not captured in the conversation):

- `frontend/src/game/logic.js`: `createHero`, `heroDerived`, `createNewState`, `addHeroXp`, `allocateSp`, `buyPerk`, `commitHeroProgressionDraft`, Academy enrollment/training, and composition logic.
- `frontend/src/game/config.js`: `HERO_CLASSES`, `HERO_ORDER`, `ATTACK_CONFIGS`, `HERO_XP`, `AP_COST`, damage types/affinities, and economy baselines.
- `frontend/src/game/perks.js`: class-keyed perk trees, legacy ID normalization, `unlockedAbilities`, `getAbility`, and effect aggregation.
- `frontend/src/game/engine.js`: base attacks, targeting, damage types, defensive hits, spell casting, ability status/execution, enemy targeting, and class-specific rendering.
- `frontend/src/components/PerkTree.jsx` and tests including `engine.perk-characterization.test.js`, `engine.abilities.test.js`, `logic.progression.test.js`, and `GameProvider.test.jsx`.
- `frontend/src/game/equipment.js`: `CLASS_SECONDARY_TYPE` and `secondaryTypeMatchesHero` restrict secondary weapons by class.
- `frontend/src/game/libraryResearch.js`, `frontend/src/screens/Armory.jsx`, `frontend/src/components/LibraryResearch.jsx`, and `frontend/src/components/TacticalMenu.jsx`: Mage-only research, affinity, spellbook, and equipped spell behavior.
- `frontend/src/context/GameProvider.jsx`: `normalizeState`, local backup, profile load, `mutate`, debounced saves, and `saveNow`.
- `frontend/src/api.js` and `backend/server.py`: profile endpoints and whole-state persistence.
- `frontend/src/screens/SquadSelect.jsx`, `frontend/src/screens/Preparation.jsx`, `frontend/src/screens/Roster.jsx`, `frontend/src/screens/Profile.jsx`, `frontend/src/components/cards.jsx`, `PrepField.jsx`, `TacticalMenu.jsx`, `CastleBuildings.jsx`, and `frontend/src/components/ui-kit.jsx`: class-keyed creation, presentation, or labels.

Verified source facts:

- XP grants one AP and one SP per hero level. SP spends on Attack, Defense, Agility, and Intelligence. AP currently buys perk IDs from the hero's class tree.
- Hero creation bakes class stat modifiers into saved stats, and class also determines base HP, attack range/rate, attack scaling, magic behavior, attack configuration, and abilities. Removing `cls` without replacing these inputs changes combat.
- The classless audit search found 103 source/test references to legacy class keys or `HERO_CLASSES`/`HERO_ORDER` across the searched frontend and backend files. This is a broad count, not proof every reference was individually reviewed.
- Equipment stats are mostly generic, but secondary weapon compatibility uses the class map (`Knight → Shield`, `Rouge → SecondDagger`, `Mage → Wand`, `Archer → Arrows`). Existing equipped items need preservation while future eligibility is redesigned.
- Academy training is mostly stat-based and class-neutral. Heroes may also be represented in `academyHeroes`, so profile migration must account for that collection as well as active heroes and bench heroes.
- Library research and spell use are explicitly Mage-gated and spell ownership/equipping are per hero. Existing spellbooks, affinities, research orders, and equipped spells must survive migration. A classless Library eligibility rule remains to be designed.
- The profile is stored as a full JSON state. `normalizeState` applies backward compatibility defaults. The backend `PUT /game/state` replaces the full stored state and has no observed revision/CAS contract.
- Current perk/ability lookup and the UI assume class-keyed trees. Combat also branches on class for damage type, range/target rules, spell behavior, AI targeting, and rendering.
- The current perk catalog contains effects without verified runtime consumers; see “Known issues.”

### Recommended architecture — pending approval

Replace the **class-bound progression subsystem**, not the entire game. Add a distinct progression domain for branch catalogs, prerequisites, depth, typed effects, signature-build recipes, migration, and derived titles. Integrate it through adapters to the existing hero state, AP/SP, combat, equipment, Library, and profile systems. Keep the profile envelope, account APIs, economy, castle management, and battle action lifecycle wherever compatible.

Candidate shape: a versioned `hero.progression` object with stable purchased node IDs. Derive branch depth and dynamic titles rather than storing duplicate counters. A title such as Battle Mage is presentation only and must not be used as an eligibility/class key. Keep `hero.name` independent. Use explicit signature recipes and verified ability handlers; do not claim summon behavior until summon lifecycle, targeting, attribution, and cleanup are designed.

Approved direction: seven universal branches supporting specialization-based hybrid progression, with signature builds added gradually after the universal foundation. Proposed roster: Vanguard (physical offense), Warden (defense/support), Precision (range/critical/target setup), Shadowcraft (speed/evasion), Arcana (elemental/spell/healing), Tactics (traps/control), and Conjuration (summons). The branch direction is approved; exact effects, costs, gates, and effect handlers still require final review. Candidate signature recipes include Battle Mage, Bandit, Pyromancer, and Summoner; names, recipes, effects, and rollout order remain proposals.

### Legacy migration — approved preservation requirements; mechanisms pending approval

- Preserve legacy hero stats, XP, AP/SP, perk IDs, and existing perk behavior. Do not delete `cls`, existing perk IDs, or legacy gameplay data during migration or rollback.
- Add a versioned classless progression field and retain legacy class/perk identity as compatibility data until parity is demonstrated.
- Preserve saved stats as-is; they already contain class stat modifiers. Capture the remaining class-derived combat inputs (base HP, range, attack rate/scaling, magic/damage behavior, attack configuration, and free starter ability entitlement) in an explicit legacy combat profile or equivalent adapter. Do not assign Knight defaults to new unclassified heroes.
- Preserve recognized legacy perk investments and their existing behavior idempotently, without spending AP again, refunding points, or double-applying effects. Keep canonical `rouge_*` identifiers available for legacy reads and rollback. Effects without verified runtime consumers remain dormant until explicitly specified and tested; do not silently remove, activate, or invent their behavior. Maintain a dormant-effect catalog with legacy ID, description, consumer status, compatibility notes, and focused test requirement.
- Migrate active heroes, bench heroes, Academy-held heroes, and heroes referenced by ongoing Library research. Grandfather existing equipment, equipped items, inventory, Mage spellbooks, affinities, research queues/progress, blueprints, and access. Preserve unrelated profile, account, economy, and castle state throughout migration and rollback.
- Keep legacy class parsing/runtime adapters until each caller has moved to class-independent combat capabilities (for example melee/ranged/arcane tags or weapon/spell disciplines).
- The shared-midline concept and shared single-target starter strike are approved. Proposed numeric values are simulation starting points only; final balance requires the documented deterministic simulation and review.
- Require profile-write conflict protection before enabling automatic remote migration. Prefer server-side revision/CAS with atomic validation and update. If that cannot be implemented safely, defer automatic remote migration.

### Classless dependency inventory — source audit completed 2026-10-22

Design documents reviewed: `ROADMAP.md` and its expanded perk-tree section still assume permanent base classes and Cross-Training; those assumptions are superseded by the user's current classless direction and should be reconciled later, not silently treated as approved. `docs/roadmaps/AP_PERK_TREE_AND_MARTIAL_TECHNIQUES_IMPLEMENTATION_ROADMAP.md` contains class-specific implementation guidance and relevant parity/migration test expectations. `docs/dev-sessions/2026-10-18-perk-design-decision-preparation.md` records unresolved combat effect consumers; it contains recommendations, not newly approved classless rules.

The audit searched production source under `frontend/src` and `backend` for `HERO_CLASSES`, `HERO_ORDER`, `ATTACK_CONFIGS`, `cls`, `classKey`, and legacy class gates; test fixtures were also checked. The dependency inventory is:

| Area | Verified dependencies and implications |
|---|---|
| Creation and class data | `frontend/src/game/config.js` owns the four classes, class modifiers, base HP, attack range/cooldown, Mage `magic`, class color, `HERO_ORDER`, and class-specific `ATTACK_CONFIGS`. `logic.js` `createHero`, `createNewState`, `setSquad`, and `recruitHero` require class keys. `SquadSelect.jsx` and Tavern UI in `CastleBuildings.jsx` expose those keys. `renameHero` falls back to a class name. Legacy class stat bonuses are baked into saved stats at creation. |
| Derived stats and progression | `heroDerived` reads `HERO_CLASSES[hero.cls]` for max HP, range, attack cooldown, magic, color, and Archer's extra per-level attack scaling. `heroMaxHp` consumes class base HP. `addHeroXp`, `buyPerk`, `undoPendingPerk`, and `commitHeroProgressionDraft` validate against the class tree. XP grants one AP and one SP per level; current XP data reaches level 20 (19 level-ups). `commitHeroProgressionDraft` is an in-memory draft validator, not persistent respec. |
| Perks and abilities | `frontend/src/game/perks.js` stores four class-keyed trees. `getPerk`, `normalizePerks`, `canUnlockPerk`, `unlockedAbilities`, and `perkEffects` depend on `cls`; normalization filters unknown IDs. Empty `requires` makes a native starter ability free; other abilities require exact perk IDs. Preserve canonical `rouge_*` IDs. |
| Combat and target rules | `frontend/src/game/engine.js` maps class to damage type in target checks, area previews, `_applyAbilityDamage`, projectiles, and manual attacks. Spell status/cast is Mage-gated. `_selectTarget` has Mage-specific affinity preference; attack policy also parses `attackConfig` text (`Sniper`, `Guard`, `Weakest`). `range < 130` determines melee/ranged behavior; `d.magic` controls support behavior and magic immunity. The derived `rate` is a cooldown in seconds (`h.cd` is reset to it). An unclassified hero without an explicit combat profile can fall through to Arcane/default or Archer render paths. |
| Damage types and enemy response | `config.js` defines Knight melee, Rouge melee, Archer ranged, Arcane, and elemental types; it has no neutral physical type. Affinity lookup defaults unlisted types to normal, but boss tables enumerate legacy types. `logic.js` `buildWave` increases Warlock weight when an active Mage exists. The searched engine has no other direct class-specific enemy-to-hero targeting priority; class-specific target behavior is primarily hero target selection and Mage affinity preference. |
| Equipment | `frontend/src/game/equipment.js` maps classes to secondary types (Shield, SecondDagger, Wand, Arrows); `secondaryTypeMatchesHero` rejects foreign secondary weapons when equipping. Numeric gear stats and primary gear are generic. `Armory.jsx` labels the class secondary identity. Preserve existing equipped items/vault entries; changing eligibility must not strand or alter them. |
| Academy | Academy code in `logic.js` has no class gate; it trains stats. Enrollment moves a hero from `bench` into `academyHeroes`, and `academyTraining` keeps `heroId` references, paused state, and timers. `normalizeState` normalizes `heroes` and `bench`, but does not derive/normalize `academyHeroes` the same way. Migration must cover all three collections and maintain IDs/course state. |
| Library and spells | `libraryResearch.js` restricts spell affinity, research candidate, secondary affinity, and Mage lists to `cls === "mage"`. `LibraryResearch.jsx`, `Armory.jsx`, and `TacticalMenu.jsx` present Mage-only research/spells. Engine spell status/casting is also Mage-gated. Spellbook, equipped IDs, affinities, blueprints, active order, and `mageId` are per-hero; `ensureResearchMageBenched` can move the researcher to the bench. Preserve these records; grandfather old Mage access and decide new Arcana eligibility separately. |
| Rendering and screens | `engine.js` `_drawHeroSprite` branches by class and its final fallback renders Archer. `ui-kit.jsx` `HeroMiniSprite` uses class color/weapons. Class keys/names occur in `PerkTree.jsx`, `cards.jsx`, `PrepField.jsx`, `TacticalMenu.jsx`, `Preparation.jsx`, `Roster.jsx`, `Profile.jsx`, `Armory.jsx`, `CastleBuildings.jsx`, and `SquadSelect.jsx`. A dynamic title must never be sent to a class-keyed renderer/lookup. |
| Profile normalization and backend | `GameProvider.jsx` `normalizeState` mutates state, normalizes active-hero perk IDs by class and recalculates their HP through `heroDerived`; bench Mage data and research ownership are repaired separately. The profile API stores/replaces the whole state; backend `PUT /game/state` uses `$set` with no observed revision/CAS check. Backend offline recovery in `server.py` uses `cls`/`key`, defaults missing identity to Knight, and uses class base HP when saved `maxHp` is absent. Refactor this before writing classless records or removing legacy identity. |

The requested category inventory is complete at source level for the searched class-keyed paths. It does not prove every arbitrary string/reflection use or every serialized profile variant; repeat `git grep` and fixture review before removing legacy fields. No classless gameplay, migration, or level-build simulation exists yet.

### Neutral starting combat baseline — approved concept; numeric details proposed

Current class base HP is 320/240/210/230 (mean 250); starting stats are 10 with a class-specific +3 primary stat. Attack cooldowns are 1.1/0.5/1.6/1.0 seconds (mean 1.05); ranges are 70/90/300/340. There is a large melee/ranged divide and each class has a different free active ability.

| Option | Practical package | Tradeoff |
|---|---|---|
| Shared frontline | 250–260 base HP, neutral physical attack, range below the current 130 melee/ranged cutoff, about 1.0 s cooldown, all stats 10, no class-specific ability. | Least refactor; front-loads everyone into melee and reduces initial tactical breadth. |
| Shared midline (recommended to simulate) | 250 HP, stats 10 across the board, explicit neutral-physical damage, roughly 150–180 range, about 1.0–1.05 s cooldown, `magic=false`, common appearance, and one low-impact shared single-target active technique. | Starts between legacy range roles without class stat bonuses. Requires replacing the 130 cutoff with explicit target/attack capabilities, adding neutral damage semantics, and a generic ability handler. Values are simulation inputs, not approved balance. |
| Player-selected combat profile | Let a new hero choose melee/ranged/arcane attack behavior while progression remains open. | Preserves tactical diversity, but risks creating an implicit permanent class and expands creation/save/respec rules; Arcana also needs magic-immunity and spell access rules. |

Approved concept: every new hero is unclassified, uses a shared-midline combat baseline, and receives one shared single-target starter strike. Numeric values and cosmetic policy remain proposals. Simulate the shared-midline package on waves 1–5 and level 5/12/20 squads. Use neutral affinity and do not infer magic behavior from range or title. Keep baseline stats and strike entitlement identical for every new hero. Preserve existing class appearance/combat profile for old heroes until parity is proven.

### Universal branches and titles — proposal, not approved

Proposed universal branches: **Vanguard** (weapon pressure/cleave), **Warden** (durability/protection/support), **Precision** (range/targeting/marks), **Shadowcraft** (mobility/evasion/ambush), **Arcana** (elemental damage/spells/wards/control), **Tactics** (traps/debuffs/team setup), and **Conjuration** (summons/constructs). Do not enable summons before entity targeting, attribution, death cleanup, and save/restart behavior are designed.

Proposed tier skeleton: Tier I foundation costs 1 AP; Tier II specialization costs 2 AP and requires a Tier I node in that branch plus hero level 5; Tier III mastery costs 3 AP and requires a Tier II node, two investments in that branch, and hero level 10. Each node has explicit prerequisites. Derive branch depth from purchased node IDs instead of persisting a second rank counter. Costs and gates must be simulated against the current 19 level-up AP budget.

Candidate signature recipes: Battle Mage = Arcana depth 2 plus Vanguard or Warden depth 1; Bandit = Shadowcraft depth 2 plus Precision or Tactics depth 1; Pyromancer = elemental Arcana mastery depth 3 plus a Tactics area-synergy node; Summoner = Conjuration depth 3 plus Warden or Arcana depth 1. Recipes and associated abilities need approval and focused tests. Unlock ability eligibility from recipe predicates, never from title text.

Dynamic title should be a pure derived value: `Unclassified` at zero investment; otherwise prefer a satisfied signature, then deepest branch, then AP invested, with a deterministic tie rule. If top branches tie, use an explicit hybrid title or stable catalog order. Do not persist titles or use them as combat/eligibility keys. Register signature abilities independently in the established ability lifecycle.

### Legacy-save migration — recommended additive, idempotent strategy

1. Add a versioned whole-state/per-hero migration helper. Copy on write, preserve unknown profile keys, and make a repeated migration a no-op. Do not rewrite `cls`, `key`, stats, AP/SP, `perks`, or IDs destructively.
   Proposed additive shape: top-level `progressionSchemaVersion` and new-hero `progression: { version: 1, nodeIds: [] }`. Legacy heroes keep `cls`/`perks` as the source of truth; a reviewed ID map can derive read-only branch depth. Add a combat compatibility snapshot only if the new runtime adapter requires one. Never copy old effect-bearing perks into `nodeIds` and aggregate their effects twice.
2. Traverse active `heroes`, `bench`, and `academyHeroes`; keep `academyTraining.heroId`, `libraryResearch.mageId`, and `libraryBlueprints.mageId` references stable. Do not duplicate or drop heroes while they move between collections.
3. Preserve each legacy `perks` array and every canonical `rouge_*` ID. Keep legacy effect consumers active. An explicit read-only legacy-ID-to-branch map may derive branch depth/title; do not copy old purchases into new node storage and apply effects twice. Retain/report unknown IDs instead of silently filtering them during transition.
4. Capture legacy combat behavior in a compatibility profile (base-HP formula, saved stats as-is, range/cooldown/damage scaling/type, magic and immunity behavior, target policy, free starter abilities, and sprite). Class modifiers are already baked into stats; never add them again. Keep `cls`/`key` readable until frontend/backend adapters and rollback pass parity.
5. Preserve equipment objects, equipped secondary identities, vault/inventory, Academy courses, spellbooks, equipped spells, affinities, research orders/blueprints, resources, accounts, and unrelated fields. Grandfather current Mage Library access; separately define new Arcana access without unlearning/reassigning spells.
6. Do not activate cross-device migration until writes have a conflict strategy. `PUT /game/state` replaces the whole state without observed CAS; add revision/CAS or a single-writer gate, save acknowledgement, rollback snapshot, and failure tests. Refactor backend offline recovery before classless records can reach its Knight fallback.

This is design only. No migration helper, profile field, gameplay value, branch node, or effect handler was added.

### Concrete classless progression specification — proposal for approval (2026-10-22)

The user's approved constraints are listed in Section 5. Every numeric value, node, recipe, rollout policy, and save protocol below is a proposed default pending approval. The explicit proposal makes it reviewable; it is not authorization to implement.

#### Universal branches, node IDs, effects, costs, prerequisites, and depth

Proposed persisted shape: hero.progression = { schemaVersion: 1, nodes: [stableNodeId, ...] }. Node IDs are globally unique. Do not persist branch-depth counters, hybrid/signature flags, or titles; derive them from owned node IDs and hero level. Each node is bought once and costs AP once. Effects are derived from the owned node set, never copied into base stats. Existing hero.ap remains unspent AP.

Branch depth is the number of distinct owned nodes in that branch, maximum 3. No tier skipping. Tier I requires level 1 and costs 1 AP; Tier II requires the listed Tier I parent and level 5, costs 2 AP; Tier III requires the listed Tier II parent, at least two owned nodes in the branch after purchase, and level 10, costs 3 AP. All validation (known ID, prerequisites, level, depth, AP, and proposed cap) is atomic. A complete branch costs 6 AP. Current progression grants 19 level-up AP by level 20, before any starting AP policy.

Magnitudes are initial balance proposals. Each effect needs a typed runtime consumer and test in its implementation phase.

| Branch / node ID | Tier; AP; level | Prerequisite | Proposed effect |
|---|---:|---|---|
| Vanguard / vanguard.edge | I; 1; 1 | none | +8% weapon direct-hit damage |
| Vanguard / vanguard.followthrough | II; 2; 5 | vanguard.edge | +10% damage against a target this hero hit in the prior 4 s |
| Vanguard / vanguard.cleave | III; 3; 10 | vanguard.followthrough; branch depth 2 | Active, 20 s cooldown: 160% weapon damage to one target and 40% to one adjacent target |
| Warden / warden.vitality | I; 1; 1 | none | +8% maximum HP |
| Warden / warden.guard | II; 2; 5 | warden.vitality | +6% received-damage reduction; progression total capped at 30% |
| Warden / warden.interpose | III; 3; 10 | warden.guard; branch depth 2 | Active, 24 s cooldown: for 5 s reduce damage to the lowest-HP allied hero in range by 25%; self-target if no ally qualifies |
| Precision / precision.focus | I; 1; 1 | none | +8 percentage points critical chance; cap 50% |
| Precision / precision.mark | II; 2; 5 | precision.focus | First hit on a new target marks it for 5 s; this hero deals +10% to it |
| Precision / precision.execution | III; 3; 10 | precision.mark; branch depth 2 | Active, 22 s cooldown: 180% weapon damage to one target; +25% if target is below 35% HP |
| Shadowcraft / shadowcraft.quickstep | I; 1; 1 | none | +5% attack speed; progression cap +20% |
| Shadowcraft / shadowcraft.evasion | II; 2; 5 | shadowcraft.quickstep | 8% chance to evade a direct attack; not area/status effects |
| Shadowcraft / shadowcraft.ambush | III; 3; 10 | shadowcraft.evasion; branch depth 2 | First hit after 3 s without dealing damage gains +25%, once per target per combat |
| Arcana / arcana.spark | I; 1; 1 | none | Unlock Arcane damage capability and +8% Arcane damage; does not itself grant spellbook/research access |
| Arcana / arcana.elementalism | II; 2; 5 | arcana.spark | Select Fire, Ice, Poison, or Mind in preparation; +10% damage of selected element |
| Arcana / arcana.channel | III; 3; 10 | arcana.elementalism; branch depth 2 | Active, 20 s cooldown: single-target Arcane bolt for 175% Arcane damage; explicit magic/immunity behavior |
| Tactics / tactics.readiness | I; 1; 1 | none | +5% ability cooldown recovery |
| Tactics / tactics.disrupt | II; 2; 5 | tactics.readiness | First direct hit every 8 s slows target attack/move speed 15% for 3 s; bosses receive 5% |
| Tactics / tactics.opening | III; 3; 10 | tactics.disrupt; branch depth 2 | Allies deal +8% to this hero's controlled target |
| Conjuration / conjuration.focus | I; 1; 1 | none | +8% damage to targets affected by this hero's active ability |
| Conjuration / conjuration.echo | II; 2; 5 | conjuration.focus | First ability hit every 10 s applies 4 s echo mark; next allied hit adds 20% of this hero's attack damage |
| Conjuration / conjuration.construct | III; 3; 10 | conjuration.echo; branch depth 2 | Active, 30 s cooldown: stationary construct for 6 s with owner, targeting, health, attribution, cleanup; no persistent save state |

Recommendation: cap a hero at two Tier III nodes in the first universal release while allowing Tier I/II purchases across branches. This limits simultaneous high-impact actives while allowing hybrids. The cap and respec policy need approval; recommendation is no respec until a refund policy is designed and tested.

#### Hybrid and signature eligibility

Hybrid status is derived when a hero has a Tier II or Tier III node in at least two distinct branches. It is informational and may affect display title only. Investment in two roots alone is a multi-branch build, not the hybrid milestone.

Signature eligibility is a pure predicate of stable owned node IDs and level. Never inspect title text, class string, user-facing labels, or title history. Universal branches ship first; signatures follow as a separately approved additive catalog.

| Signature recipe ID | Proposed requirements | Proposed granted content |
|---|---|---|
| signature.battlemage | arcana.channel plus any Tier II+ Vanguard or Warden node | Arcane infusion: next 3 direct hits gain +20% Arcane damage; 24 s cooldown |
| signature.bandit | shadowcraft.ambush plus tactics.disrupt or precision.mark | 150% weapon opener with selected control/mark; 15 s cooldown |
| signature.pyromancer | arcana.elementalism with Fire selected, arcana.channel, and tactics.disrupt | 3-target maximum Fire area technique, 28 s cooldown, 100% Arcane damage plus 4 s burn; burn consumer and immunity must be tested |
| signature.summoner | conjuration.construct plus any Tier II+ Warden or Tactics node | Defer from initial signature rollout; requires separately designed summon lifecycle |

Recipes may unlock abilities, but titles remain presentation only. Display-title tie-break proposal: most satisfied recipe predicates, then highest tier-weight sum (I=1, II=2, III=3), then lexical recipe ID. If no recipe qualifies, display the most-invested branch title; ties use fixed branch order Vanguard, Warden, Precision, Shadowcraft, Arcana, Tactics, Conjuration; with no nodes display “Unclassified”. A title change has no eligibility, combat, equipment, Library, or save side effect.

Library proposal needing approval: grandfather all existing Mage research, spells, affinities, queued jobs, and profiles. For new heroes, arcana.spark unlocks basic spell use and arcana.elementalism unlocks research; these nodes do not grant existing content automatically.

#### Exact shared-midline baseline and simulation plan

Approved concept: new heroes are unclassified on a shared-midline baseline and all get the same shared single-target starter strike. Proposed simulation profile, not yet numeric-balance-approved: base HP 250; Attack/Defense/Agility/Intelligence each 10; no baked class modifier; normal direct-hit damage max(1, 10 + 0.6 * Attack), before weapon/progression modifiers; cooldown 1.05 s; effective range 170 world units; nearest-in-range target policy; neutral physical damage with no elemental affinity and no magic flag; no class-specific range, immunity, support, or target preference. Use explicit rangeMode=midline and capability fields instead of the current range<130 heuristic. Use identical neutral silhouette and cosmetic-seed policy.

Proposed starter ability starter.shared_strike: single target only; 12 s cooldown; 150% of the hero's normal direct-hit damage; no area damage, stun, slow, healing, mark, summon, or damage-type conversion. Every new hero gets it independent of progression, title, and equipment. It uses the hero's current attack damage type/capability. Coefficient and cooldown remain simulation inputs and are not persisted in stats.

Required pre-release simulation (not yet run): deterministic fixed-seed battles, same waves/equipment/SP/action policy, comparing the unclassified baseline with legacy Knight/Rouge/Mage/Archer reference heroes in squads of 1, 3, and 5, at levels 1, 5, 10, 12, and 20. Run at least 1,000 seeded encounters per configuration across waves 1–5, both without gear and with standardized budget-matched gear. Record damage dealt/taken, clear time, deaths, ability contribution, time out of target range, and wave completion. Add deterministic fixtures for positioning, neutral/elemental affinity, magic immunity, target selection, strike target legality, and cooldown.

Proposed balance thresholds: baseline squad clear time and damage taken within ±15% of the median legacy reference across waves 1–5; death rate no more than 10 percentage points above the median; shared strike contributes no more than 20% of total squad damage over five waves. If it fails, tune baseline/strike only and rerun the same seed matrix. Record inputs/results/deltas in a balance artifact. Approval needed for thresholds and legacy benchmark choice.

#### Class-independent capabilities and equipment

Proposed combat profile fields: rangeMode (melee/midline/ranged), effective range, cooldown, damage type, isMagic, capability tags (weapon/arcane/support/ranged), target-policy enum, ability IDs, presentation key. Resolve attack legality, affinity, immunity, targeting, projectiles, and rendering from these fields and typed effects. Keep a legacy adapter. Ability handlers declare target mode/range/cooldown/damage type/target cap/status/immunity/ownership/attribution/cleanup. Do not use class names or titles in runtime decisions.

Equipment proposal: explicit item discipline requirements (weapon/shield/dual-wield/bow/focus) and hero capability tags. Grandfather existing equipped and stored gear; migration never unequips, deletes, or converts items. New secondary-item eligibility uses capability/progression, not class/title. Whether capability is innate, gear-derived, or purchased is unresolved. Recommendation: make secondary disciplines a Tier I node or explicit equipment capability, avoiding opening penalties.

#### Legacy compatibility, migration, save conflicts, and rollback

Proposed migration is additive and versioned. Keep the profile envelope/API and all unknown fields; retain legacy cls, perk IDs, class-derived stats, equipment, spell records, and profile fields during compatibility. Implement a pure hero migration plus profile wrapper. Repeated migration gives identical output. Preserve source class/perk IDs in compatibility metadata, including canonical rouge_* IDs. Translate only recognized perks with known live-equivalent effects. Unknown/dormant IDs remain in legacy data without invented effects or AP refunds.

Traverse active heroes, bench, academyHeroes, and heroes reachable from Library researcher/order references, deduplicated by stable hero ID. Preserve IDs, names, XP/level/AP/SP/stats/max HP, equipment/durability/inventory/vault, Academy course/progress/timers/paused state, research queues/progress/blueprints, spellbooks/affinities/equipped spells, account/profile metadata, currencies, and unrelated fields. Legacy class stat modifiers are already baked into stats: never apply them again. Capture class-derived combat values in immutable legacyCombatProfile; grandfather Mage spell access explicitly.

Migration computes one candidate snapshot and validates all invariants/references before marking schemaVersion. Return the entire candidate or unchanged source with a structured error. No partial hero edits, AP spending, duplicate effects, or server write on failure. Do not normalize and auto-save remotely until conflict protection exists.

Verified limitation: profile PUT replaces the whole state and has no observed revision/CAS contract. Proposed default: add a server revision/ETag and conditional update with expectedRevision; server atomically writes only on match and returns the next revision. On conflict, keep remote state and local pre-migration backup; do not stale-overwrite or auto-retry. On network/validation failure, keep valid local/remote snapshots, do not set the schema marker, and retain legacy fields. If server CAS cannot be added, do not auto-migrate remote profiles; require a single-writer migration gate and explicit reload before write.

Rollback proposal: retain legacy fields and pre-migration backup through at least two successful versioned saves and a release verification window (proposed 30 days). Restore the backup or perform a validated merge that preserves post-migration unrelated changes; never overwrite a newer remote revision. Use a migration kill switch and telemetry limited to schema version/error category, without profile values. Retention and rollback ownership require approval.

#### Phases, tests, and acceptance criteria

| Phase | Scope | Specific automated checks and exit criteria |
|---|---|---|
| 0. Design and harness | Approve catalog/rules/baseline/compatibility; deterministic simulator | Fixed seed produces repeatable golden fixture; metrics emitted. No runtime or save changes. Exit only after numeric profile, strike, thresholds, signature rollout, conflict, and rollback policies approved. |
| 1. Progression domain | Catalog, validation, derived depth/hybrid/signature/title, typed effects | Every node ID/cost/gate/prerequisite; unknown/duplicate IDs; order/depth; level boundaries 4/5 and 9/10; insufficient/exact/extra AP; cap; atomic no-mutation failures; hybrid/signature predicates; deterministic title ties; title never changes eligibility; each effect references a consumer. |
| 2. Combat adapters | Shared profile, damage types, targeting, abilities, rendering, legacy adapter | Characterization parity for all four old classes and live abilities; range/target legality; neutral/elemental affinity; magic immunity; cooldown/reset; target caps; ownership/kill attribution; status expiry; every renderer profile without class/title fallback; same starter entitlement and one target. |
| 3. Creation and UI/equipment/Library | Unclassified creation, baseline/strike, dynamic display, item disciplines, Arcana gating | Exact creation fields and no cls; UI/title snapshots; title changes do not gate; legacy gear remains equipped/usable; new invalid equips rejected; Mage records remain usable; Arcana only grants approved new access. Component coverage for roster, squad selection, prep, tactical menu, Armory, Library, and both renderers. |
| 4. Migration/profile writes | Additive migration, traversal, revision/CAS, backup, rollback | Fixtures for every legacy class, no/partial/full perks, rouge_*; active/bench/Academy/research-linked and duplicate references; secondary gear; Academy timers; Mage queues/spells/affinities; unknown fields/malformed state. Assert preservation, no double application, idempotence across repeated load/save, round-trip, CAS success/conflict, failure leaves source unchanged, rollback never overwrites newer revision. Backend tests cover atomic CAS and rejection. |
| 5. Balance/release | Seed matrix, universal branches first, signatures as approved batches | Persist balance inputs/results; all approved metrics pass at sampled wave/level; frontend/backend suites/builds pass; rollback exercised on copied fixture; platform/device checks recorded. No release before compatibility and balance gates pass. |

No tests, build, device check, simulation, migration, gameplay edit, or profile write was performed for this planning update. The table describes future checks, not passing results.

## 3. Implementation log

Times are UTC. When conversation history did not preserve an exact time, that limitation is stated rather than guessed.

### 2026-10-22 06:36 UTC — Record classless safeguards and preservation decisions

- **Objective:** Update the classless planning handoff with the user's newly approved decisions and remaining approval items. Documentation only.
- **Approved decisions recorded:** Seven universal branch direction and specialization-based hybrid progression; signatures added gradually; shared-midline and common single-target strike concepts with proposed numbers used only as simulation inputs; grandfather all specified legacy equipment and Mage Library assets/access; preserve legacy hero stats/XP/AP/SP/perk IDs/behavior and unrelated profile/account/economy/castle state; unverified perk effects remain dormant; profile conflict protection required before automatic remote migration, preferably server revision/CAS.
- **Remaining decisions recorded:** Simulation thresholds/benchmark; final node effects/costs/gates/depth/Tier III cap; newly acquired gear disciplines; new Arcana access; CAS implementation, rollback retention/conflict UX; dormant effect catalog and test process.
- **Files changed:** docs/CHATGPT_HANDOFF.md only. No gameplay source, tests, profiles, saves, or migration code changed.
- **Pre-existing work preserved:** Modified ROADMAP.md, frontend/src/components/PerkTree.jsx, frontend/src/game/perks.js; untracked frontend/src/components/PerkTree.test.jsx.
- **Tests/builds/simulations:** Not run; outside this documentation-only scope. The handoff's deterministic simulation remains a future design acceptance gate.
- **Verification/publication:** git diff --check passed; the staged diff contained only docs/CHATGPT_HANDOFF.md. Handoff-only commit d0acfdb807cb0ee3c7b682a5bee72facecb188f9 was pushed, and git ls-remote verified origin/review/mobile-working-copy at that SHA. This handoff-only follow-up records the result. No unrelated files were staged or published.
- **Next decision:** Settle the listed balance and implementation safeguards before any gameplay implementation or automatic remote migration.

### 2026-10-22 04:32 UTC — Specify approved classless planning decisions

- **Objective:** Continue classless progression planning on the current authorized branch and expand the living handoff into an implementation-ready proposal, while remaining strictly within documentation scope.
- **Approved decisions recorded:** New heroes start unclassified with a shared-midline combat baseline; every new hero receives one shared single-target strike; universal progression is built first and signatures arrive gradually; dynamic titles describe the current build and never determine eligibility; preserve existing heroes, progress, equipment, Academy training, Mage spells/research, accounts, and profiles wherever compatible.
- **Files changed:** docs/CHATGPT_HANDOFF.md only. No gameplay source, tests, profile, save data, or migration changed.
- **Proposal added:** Seven branch tables with stable IDs/effects/AP/level/prerequisites/depth, hybrid/signature predicates and candidates, exact baseline/strike simulation matrix, class-independent combat and equipment model, additive legacy migration traversal, revision conflict/failure/rollback plan, phase-specific tests and exit criteria. Numeric values and architectural mechanisms are clearly marked pending approval.
- **Verified starting state:** Branch review/mobile-working-copy; HEAD 8940a3a (Record classless audit handoff publication). Pre-existing changes remain: modified ROADMAP.md, frontend/src/components/PerkTree.jsx, frontend/src/game/perks.js; untracked frontend/src/components/PerkTree.test.jsx. These are untouched.
- **Tests/builds/simulation:** None run. This is documentation-only planning; specified tests and combat simulation are future acceptance gates, not verified results.
- **Verification:** git diff --check passed. Diff and status review confirmed only this handoff file is task-edited; the other four worktree changes are pre-existing. No source tests/build/device checks are in scope.
- **Publication:** Handoff-only commit 6df1d3b5f2ebf8e556deeef74de625eaa41e2fab was pushed to origin/review/mobile-working-copy; git ls-remote verified that exact SHA. This follow-up updates the handoff with that result and is also handoff-only. No unrelated files are included.
- **Next decision:** Review the proposed numeric baseline/strike and simulation thresholds, branch catalog/costs/depth/cap, signature recipes, Library/equipment policies, and revision/rollback strategy before implementation.

### 2026-10-22 03:22–03:24 UTC — Complete classless architecture dependency audit

- **Objective:** Audit class-dependent creation, progression, combat, abilities, equipment, Academy, Library, targeting, rendering, and persistence; propose a neutral baseline, universal branches, titles, migration, phases, and acceptance criteria.
- **Files changed:** `docs/CHATGPT_HANDOFF.md` only. Source files and the pre-existing roadmap/perk-tree changes were inspected read-only and preserved.
- **Verified findings:** The inventory and specific consumers are recorded in Section 2. New heroes cannot currently omit `cls`; `heroDerived`, `renameHero`, class-specific damage defaults, renderer fallbacks, Library gates, normalization, and backend offline healing all assume classes. AP/SP are one per level to level 20; old class stat bonuses are baked into stats. Academy training itself is class-neutral but stores heroes separately. Whole-state profile replacement has no observed CAS/revision guard.
- **Recommendations, not decisions:** Shared-midline baseline; seven universal branches; three tier/depth gates; example Battle Mage/Bandit/Pyromancer/Summoner recipes; derived titles; additive migration with legacy adapter and write conflict protection. Require user approval before gameplay implementation.
- **Documents reviewed:** `ROADMAP.md`, `docs/roadmaps/AP_PERK_TREE_AND_MARTIAL_TECHNIQUES_IMPLEMENTATION_ROADMAP.md`, and `docs/dev-sessions/2026-10-18-perk-design-decision-preparation.md`. The existing class-bound roadmap material conflicts with the current classless direction and is marked for later reconciliation.
- **Search/inspection:** `git status --short --branch`, `git branch --show-current`, `git log -6 --oneline --decorate`, `git rev-list --left-right --count origin/review/mobile-working-copy...HEAD`; searched `frontend/src` and `backend` for `cls`, `HERO_CLASSES`, `HERO_ORDER`, `ATTACK_CONFIGS`, class creation, and class gates; inspected creation/derivation, perks, engine, equipment, library, provider normalization, UI, and backend offline recovery. One broad UI grep matched generic JSX `className` and its output was truncated; the search was narrowed to class fields/constants and targeted files afterward. One documentation patch attempt used stale checkpoint text and failed to apply; no files were modified by that failed attempt, and the edits were reapplied with current anchors.
- **Tests/builds:** No tests, build, Android build, device check, or migration was run. This task is architecture/source audit only. `git diff --check` passed; the publication outcome is recorded below.
- **Compatibility:** No gameplay, profile, or saved data changed. Existing uncommitted `ROADMAP.md`, `PerkTree.jsx`, `perks.js`, and untracked `PerkTree.test.jsx` remain untouched.
- **Commit/publication:** Audit handoff commit `64f712a333305291207dbfac2ae28542abcf3064` contains only `docs/CHATGPT_HANDOFF.md`. It was pushed to `origin/review/mobile-working-copy`; `git ls-remote` verified the branch at that SHA. This outcome record is a separate handoff-only follow-up; the final report gives its SHA.

### 2026-10-22 03:07–03:09 UTC — Establish permanent Codex–ChatGPT collaboration workflow

- **Objective:** Add mandatory repository-level procedures for task kickoff, preserving work, verification, handoff updates/publication, and final reporting.
- **Files changed:** `AGENTS.md` (new) defines sections A–E, including the `work done` review signal and safe handoff-only publishing rules. `docs/CHATGPT_HANDOFF.md` updates this checkpoint and records the setup task.
- **Important APIs/data:** Documentation only; no gameplay code, profile data, or saved data changed.
- **Compatibility:** Pre-existing `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js` modifications and untracked `frontend/src/components/PerkTree.test.jsx` are preserved.
- **Inspection issue:** `rg --files` was attempted but `rg` is unavailable (`/bin/sh: 1: rg: not found`). `find . -name AGENTS.md -print` located only `frontend/node_modules/recharts/AGENTS.md` before the root file was created.
- **Tests/builds:** No tests, build, Android build, or device check were run; this is a documentation-only task. `git diff --check` passed before the AGENTS commit; it will be rerun for the final handoff diff.
- **Commits/publication:** `AGENTS.md` was committed alone as `c18467c` (`Add mandatory collaboration workflow`). The handoff was committed separately as `1c69d81477fb4e9c78cc8134f190e09a12c79c58` (`Update ChatGPT development handoff`). Both commits were pushed to `origin/review/mobile-working-copy`; `git ls-remote` independently confirmed that branch at `1c69d81477fb4e9c78cc8134f190e09a12c79c58`. This entry records the verified outcome; its final publication is a handoff-only follow-up commit.

### 2026-10-22 03:12 UTC — Expand the permanent final-report requirements

- **Objective:** Update the repository procedure to enumerate all eight required final-report items and make the `work done` handoff-review action explicit.
- **Files changed:** `AGENTS.md` expands section E. `docs/CHATGPT_HANDOFF.md` updates this checkpoint and records the current task.
- **Important APIs/data:** Documentation only; no gameplay, profile, or save data changed.
- **Compatibility:** Existing uncommitted `ROADMAP.md`, perk-tree source changes, and untracked component test are preserved.
- **Tests/builds:** No tests, frontend/backend suites, or builds were run for this documentation-only change. `git diff --check` passed on the worktree and staged documentation diff.
- **Commit/publication:** `AGENTS.md` was committed alone as `ca5256b` (`Specify required final collaboration report`). Handoff commit `fb6685f006581477db11ca66569a0d2d6d4805ff` (`Update ChatGPT handoff requirements`) contains only `docs/CHATGPT_HANDOFF.md`. Both approved documentation commits were pushed to `origin/review/mobile-working-copy`; `git ls-remote` verified that branch at `fb6685f006581477db11ca66569a0d2d6d4805ff`. This final verification note is published separately in a handoff-only follow-up commit; consult Git history for that commit's SHA.

### 2026-10-22 02:55 UTC — Create permanent ChatGPT handoff

- **Objective:** Create this living repository document from inspected repository facts and conversation context.
- **Files changed:** `docs/CHATGPT_HANDOFF.md` only; newly created. It was uncommitted at the time of creation; its later publication status is reflected in repository history and the task report.
- **Important APIs/data:** Documents current React/FastAPI/Mongo profile architecture and existing progression/profile APIs; no runtime API or data changed.
- **Compatibility:** No gameplay/profile change.
- **Commit:** None — UNCOMMITTED.

### 2026-10-21 (exact UTC time unavailable) — Classless architecture audit

- **Objective:** Assess replacement of fixed class progression and plan classless specialization, safe legacy migration, and preservation of combat/equipment/Academy/Library/profile behavior.
- **Files changed:** None. Source and documentation were inspected read-only.
- **Findings:** 103 broad class-key references; progression is separable, but combat, UI, equipment, Library, enemy composition, and persistence need adapters/refactors. Recommendation was to replace progression as a distinct subsystem while retaining existing game systems and a legacy combat adapter.
- **Decision status:** The user's classless direction is approved. Branch names, migration field details, combat baseline, signatures, and implementation phases are recommendations pending review.
- **Compatibility:** No save migration or gameplay changes.
- **Commit:** None; no files changed.

### 2026-10-21 (exact UTC time unavailable) — Cross-Training design proposal, superseded

- **Objective:** Design a controlled cross-class ability route under the former permanent-class model.
- **Files changed:** None.
- **Proposal:** Curated starter-ability whitelist, limited cross-ability slots, AP plus existing Gold/Stone costs, and profile/runtime validation.
- **Decision status:** This was an assistant recommendation, not approved. The user's later decision to replace fixed classes supersedes this design. Do not implement it without re-evaluating it under the classless architecture.
- **Commit:** None; no files changed.

### 2026-10-21 (exact UTC time unavailable) — Three-branch labels and mobile tree presentation

- **Objective:** Continue the class perk tree with a small presentation improvement.
- **Files changed:** `frontend/src/game/perks.js` adds static themed names to the existing roots; `frontend/src/components/PerkTree.jsx` displays the names; `frontend/src/components/PerkTree.test.jsx` tests all four classes; `ROADMAP.md` records the work and remaining dependencies. All remain UNCOMMITTED in the current worktree.
- **Compatibility:** Existing perk IDs, ownership, unlock rules, saves, class identity, and runtime effects were not changed.
- **Commit:** None — UNCOMMITTED.

## 4. Test results

Verified in the prior implementation session (frontend working directory `frontend/`):

| Exact command | Result |
| --- | --- |
| `yarn test --watchAll=false --runInBand src/components/PerkTree.test.jsx src/game/engine.perk-characterization.test.js` | Did not run: `/bin/sh: 1: yarn: not found`. |
| `npm test -- --watchAll=false --runInBand src/components/PerkTree.test.jsx src/game/engine.perk-characterization.test.js` | Passed: 2 suites, 36 tests. |
| `npm test -- --watchAll=false --runInBand` | Passed: 24 suites, 208 tests; no snapshots. |

No tests, build, Android build, or device check were run during the handoff creation, collaboration-procedure setup, or current classless architecture audit. No claim is made that the current uncommitted state has been rebuilt or tested on a device. The current `ROADMAP.md` and prior session reports record earlier Android build/device statements; those are historical and must retain their evidence labels. For example, Android persistence success is user-reported in `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md`, not an independent database verification.

## 5. Decisions and requirements

### Approved constraints

- Preserve the current branch and all existing work. No branch switching, commit, push, merge, or deploy without explicit permission.
- Replace the fixed four-class progression model with classless, specialization-based progression. New heroes begin unclassified; titles describe builds and do not restrict them.
- Approve the seven universal progression branch direction and specialization-based hybrid progression. Build the universal foundation first and add signature builds gradually.
- New heroes use a shared-midline combat baseline.
- Every new hero receives the same shared, single-target starter strike.
- Dynamic titles describe the current build and never determine eligibility.
- Numeric values in the baseline proposal are simulation starting values only; final balance requires the documented deterministic simulation and review.
- Grandfather existing equipment, equipped items, inventory, Mage spellbooks, affinities, research queues/progress, blueprints, and Mage access.
- Preserve legacy hero stats, XP, AP/SP, perk IDs, and existing perk behavior. Effects without verified runtime consumers remain dormant until explicitly specified and tested; do not silently remove, activate, or invent their effects.
- Preserve legacy heroes and unrelated profile, account, economy, and castle state throughout migration and rollback.
- Require profile-write conflict protection before enabling automatic remote migration. Prefer server-side revision/CAS with atomic validation and updates; if that cannot be implemented safely, defer automatic remote migration.
- This task is planning/documentation only: do not modify gameplay source, tests, profiles, save data, or migrations; do not switch branches, merge, or deploy.

### Proposals, not approved decisions

- The concrete values in “Concrete classless progression specification”: 250 HP, all stats 10, 1.05 s cooldown, 170 range, neutral physical type, damage formula, strike coefficient/cooldown, node IDs and effects, costs, gates, depth rule, two Tier III cap, signatures, and title tie-break.
- The distinct progression subsystem/module split, final versioned migration schema, combat capability representation, new-hero equipment discipline rules, new Arcana/Library access, CAS implementation details, rollback retention, and migration safety gate.
- The proposed simulation thresholds and the use of legacy class squads as the benchmark.
- The previous fixed-class Cross-Training whitelist/cost proposal; superseded by the classless direction.

### Unresolved approval items

- Approve exact balance thresholds and whether legacy class squads are the benchmark for the deterministic simulation.
- Final review remains for node effects, costs, level gates, prerequisites/depth rules, and the proposed Tier III cap; the seven-branch direction itself is approved.
- Decide signature recipes and gradual rollout order; recommend deferring Summoner until lifecycle/cleanup is designed.
- Decide equipment discipline rules for newly acquired gear; existing items/inventory are grandfathered.
- Decide Arcana eligibility for new heroes versus grandfathered Mage spell/research access.
- Confirm a safe server revision/CAS implementation, rollback retention window, and conflict UX; otherwise defer automatic remote migration.
- Approve how dormant legacy effects will be catalogued, then separately specify and test any effect before activation; none may be silently removed or enabled.

## 6. Known issues and regressions

### Confirmed from inspected source/docs

- Multiple declared perk effects lack verified consumers: `reactionBonus`, `reactiveSpeedPct`, `reactiveSupport`, `aoe` metadata, `burn`, `lifebloom`, `markedDamagePct`, `damageReductionPct`, and `lowHpDefense`. `aoe` is redundant to the separately implemented Firestorm ability path; it is not a verified effect consumer.
- Earlier characterization/audit documentation also records behavior/description mismatches or unresolved behavior for Archer Execution thresholds, Multishot scope, Rogue Combo sequencing, Speed Rush attack-tempo wording, and Poison/Mind spell affinity handling. Consult `docs/dev-sessions/2026-10-18-combat-effect-audit.md`, `docs/dev-sessions/2026-10-18-perk-behavior-characterization.md`, and `docs/roadmaps/AP_PERK_TREE_AND_MARTIAL_TECHNIQUES_IMPLEMENTATION_ROADMAP.md` before changing these.
- The current `ROADMAP.md` still documents permanent class identity and class-specific AP trees. That conflicts with the newer approved classless direction and should be reconciled after architecture approval; it was not edited for this handoff task.
- A new hero with no `cls` is not currently supported: `createHero` requires a valid class key, `heroDerived` dereferences `HERO_CLASSES[hero.cls]`, `renameHero` uses the class for fallback naming, and profile normalization recalculates derived HP. `buildWave` and backend offline recovery also contain legacy class assumptions.
- Profile backend writes replace the entire state object without an observed revision check. A client migration must be idempotent and must not assume concurrent-write protection.

### Unverified or suspected

- All class-keyed runtime/UI dependencies may not have been captured by the broad source search. Perform a full reference audit before removing legacy fields.
- No parity test currently proves that a classless migrated hero reproduces all old class-derived combat behavior; no classless migration exists yet.
- New hero neutral combat balance and new signature abilities have not been specified or simulated.

## 7. Next steps and phased implementation proposal

1. **Approve design inputs:** settle the neutral baseline, branches, node/effect inventory, AP/level/depth gates, signature recipes, Library policy, equipment policy, and profile concurrency/rollback plan. No gameplay code should start before these decisions.
2. **Add a separate progression domain:** introduce a versioned branch catalog, typed node IDs/effects, pure validation, derived depth/title/signature functions, and an explicit legacy-ID compatibility map. Keep `perks.js` as the legacy adapter during migration. Focused tests: unknown/duplicate IDs, prerequisites, ranks, AP overspend, valid/invalid signatures, deterministic titles, and atomic no-mutation on failure.
3. **Refactor combat through typed capabilities:** create explicit attack profile fields for range mode, cooldown, damage type, magic/immunity behavior, target policy, support role, and appearance. Replace `range < 130` and class-key default branches. Keep a legacy adapter and compare each old class' derived and battle behavior before using the new path. Focused tests cover targeting, affinity, immunity, melee/ranged actions, all ability handlers, projectiles, rendering, and legacy parity.
4. **Update hero creation and UI:** create truly unclassified heroes with the approved baseline; update squad selection, Tavern, rename fallbacks, roster/profile/preparation cards, tactical UI, Armory, PerkTree, and both sprite renderers. Titles derive from investment and never feed eligibility. Focused component tests cover no-class heroes, title changes/ties, responsive tree, and all classless screen paths.
5. **Add additive migration behind a safety gate:** migrate active, bench, and Academy-held heroes while preserving IDs and all unrecognized profile data. Keep old `cls`/`perks` as compatibility data. Add backend offline recovery support and a write conflict rule before automatic remote migration. Tests: all four legacy classes, no/partial/full perks, `rouge_*`, equipped items, Academy timers, Mage spells/research, repeated normalization, round-trip, save failure/conflict, and unrelated state snapshots.
6. **Balance and rollout:** simulate opening waves and levels 5/12/20, then run focused frontend/backend tests, the full frontend suite, production build, Android build, and on-device review. Roll out additively with a rollback path retaining old fields until parity and saves are verified.

**Acceptance criteria before release:** new heroes have no fixed class and use the approved neutral profile; universal branches validate all purchases atomically; depth/signatures/titles are deterministic and titles never gate combat; every enabled effect has a consumer; existing legacy heroes preserve stats/AP/SP/perk IDs and behavior; Mage research/spells, equipment, Academy and unrelated profile fields round-trip; migration is idempotent and save conflicts/failures do not partially apply; full tests/build and device review are recorded honestly.

**Acceptance criteria:**

- New heroes have no fixed class and can build through universal branches; dynamic titles follow the current build and never gate eligibility.
- Existing classed heroes preserve AP/SP, stats, equipment, active combat behavior, class-granted baseline abilities, Academy work, Mage spellbooks/affinities/research, and unrelated profile/economy/account data.
- Migration preserves legacy XP, stats, AP/SP, perk IDs, and behavior, including `rouge_*`; no effect is double-applied, silently invented, removed, or activated without specification and tests. Dormant effects are catalogued before implementation.
- Existing equipment, equipped items, inventory, Mage spellbooks, affinities, research queues/progress, blueprints, and access remain grandfathered.
- Unrelated profile/account/economy/castle data survives migration and rollback. Automatic remote migration is disabled until profile writes have safe conflict protection; prefer atomic server revision/CAS.
- Branch depth and signature combinations reject unknown IDs, missing prerequisites, duplicates, overspending, invalid ranks, and invalid combinations without partial mutation.
- Every live effect has an explicit consumer and focused tests. Combat uses the established target/range/immunity/cooldown/action lifecycle.
- Existing profiles load and save round-trip; rollback retains original fields until parity and device verification are accepted.

No step above has been started as implementation in the current task.

## 8. Handoff summary

### Historical checkpoint — 2026-10-22 06:36 UTC

At this planning checkpoint, the branch was `review/mobile-working-copy` at `25661b6`. The classless direction and preservation decisions are documented in Sections 2 and 5. The then-existing changes to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx` were user-owned and preserved. This is historical context; the canonical bible and current audit below supersede earlier perk/ability proposals.

### 2026-10-22 — Canonical Perk & Ability Bible v1.0 audit

- **Authority:** The approved bible at `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md` is the single source of truth and supersedes conflicting earlier perk/ability proposals. It was added by remote commit `fd37d2454ebdd7134a6fbaba3c9f9aaa946dfde3`. Structure, IDs, prerequisites, tiers, AP economy, caps, stacking, gates, and signatures are final for implementation; numeric values are implementation-locked but provisional for release pending simulation. The bible was not changed.
- **Audit scope:** Inspected `frontend/src/game/perks.js`, `logic.js`, `engine.js`, `config.js`, `frontend/src/components/PerkTree.jsx`, `frontend/src/context/GameProvider.jsx`, and existing test inventory including perk characterization, abilities, targeting, defensive perks, progression, Library, provider, and `PerkTree.test.jsx`. Read progression, derived stats, ability execution, damage/shield/defeat, and profile-normalization paths. No tests or builds were run.
- **Current implementation status:** Four class-keyed trees (`knight`, `rouge`, `mage`, `archer`), legacy IDs, AP checks, optional parent checks, and legacy combat/ability paths exist. These do not implement the bible's classless system. Canonical branch catalog and IDs, level/tier purchase rules, global two-Tier-III cap, Shared Strike, signatures, phase gates, title-derived eligibility, damage categories, independent caps, sustain/mitigation limits, control/marks/auras, untargetability, and ordered survival resolution are absent. Crit chance is capped at 50%, and shields/death checks exist, but are only partial legacy behavior. Legacy cooldown reduction can reach 50%, exceeding the bible's 30% CDR cap. Legacy base crit multiplier is 1.75 (175%) versus bible Section 3.3's 1.50 (150%).
- **Canonical node IDs absent from implementation:** V1, V2, V2a, V3, V3a; W1, W2, W2a, W3, W3a; P1, P2, P2a, P3, P3a; S1, S2, S2a, S3, S3a; A1, A2, A2a, A3, A3a; T1, T2, T2a, T3, T3a; C1, C2, C2a, C3, C3a; H1, H2, H3; F1, F2, F3; N1, N2, N3; I1, I2, I3. Legacy IDs remain available; no rename is proposed.
- **Rules and shared systems:** Bible Sections 1–2 specify T1 at level 1/1 AP; T2 at level 5/2 AP with its T1 parent; T3 at level 10/3 AP with any T2 in the branch; maximum two T3 nodes globally; one AP and one SP per level; signatures cost no AP and do not count toward the T3 cap; no respec. Section 3.1's pipeline is `base × (1 + Σ situational) × (1 + Σ weapon) × (1 + Σ elemental) × crit multiplier × (1 − mitigation)`, additive within categories and multiplicative across categories. Independent caps in Section 3.2 are weapon +50%, situational +50%, crit chance 50%, crit damage 250%, attack speed +20%, CDR 30%, progression mitigation 30%, progression sustain 4% max HP/sec, enemy slow 50%. The pipeline and corresponding category caps are absent (except the legacy crit-chance ceiling). Specified internal-CDR exclusions, signature lockout, element timing, lethal order, untargetability behavior, control lookback, independent marks, shield attribution/expiry, and aura stacking are also absent.
- **Signatures and requirements absent from current runtime:** Battle Mage (Arcane Channel + T2+ Vanguard or Warden); Bandit (Ambush + Disrupt or Mark); Pyromancer (Fire Elementalism + Arcane Channel + Disrupt; Phase 1.5); Summoner (Construct + T2+ Warden or Tactics; deferred); Blood Knight (Crimson Covenant + T2+ Vanguard); Gambler (Jackpot + T2+ Shadowcraft); Beastmaster (Primal Bond + T2+ Conjuration; deferred); Phantom (Phantom Strike + T2+ Precision); Archon (any Arcana T3 + T2+ Fortune). Shared 8-second signature lockout is absent.
- **Phase gates and undecided systems:** Phase 1 covers ungated content. Phase 1.5 gates Pyromancer pending burn/DoT. Phase 2 gates C3 Construct, C3a Familiar, N3 Primal Bond, Summoner, and Beastmaster pending companion lifecycle rules; unavailable purchases must leak no partial effects. Section 10 leaves respec undesigned, elemental resistances undesigned, companion lifecycle deferred, Stance/Counter/Channel reserved, SP out of scope, Library research access separate, and PvP unaddressed. Numeric tuning requires simulation.
- **Acceptance tests 1–20:** (1) Missing tier/parent/level validation and reason codes. (2) Missing global third-T3 refusal. (3) Missing build titles and title-independent behavior. (4) Missing gate presentation/refusal. (5) Missing category stacking pipeline. (6) Missing independent observable caps. (7) Missing Loaded Dice. (8) Partial: legacy 1.75 crit multiplier and 50% chance ceiling, but not bible crit damage/cap or Jackpot behavior. (9) Partial: active cooldown multiplier exists, but not 30% cap or specified internal cooldowns. (10) Missing signature lockout. (11) Missing control ownership/lookback and Opening. (12) Missing independent Mark/Echo/Root state. (13) Missing Disrupt slow and boss root. (14) Missing shared sustain cap. (15) Partial: shield/death paths exist, but not specified reduction→shield→survival→death order or Covenant timer. (16) Missing Blood Price refusal/cost. (17) Missing untargetability direct/area/DoT/retarget behavior. (18) Missing Echo mark consumption/attribution. (19) Missing Conjuration Focus window. (20) Missing gate refusal/no-leak behavior. Existing legacy tests do not prove these criteria.
- **Four open specification questions (verified against the bible; do not resolve without the owner):**
  1. Section 4 reports 47 nodes, “43 Phase 1, 4 gated.” C3, C3a, N3 are three gated nodes; Summoner and Beastmaster are deferred Phase 2 signatures. Confirm the intended count split.
  2. Section 2 says a fully mastered branch has six nodes costing 11 AP; the listed core-plus-alternate structure appears to have five nodes (T1 + two T2 + two T3) costing 11 AP. Confirm the wording.
  3. F2 calls Loaded Dice neutral, but the listed outcomes calculate to `0.10×1.50 + 0.10×0.75 + 0.80×1.00 = 1.025`; acceptance test 7 expects +2.5%. Keep unresolved.
  4. Section 3.2 caps all progression sustain at 4% max HP/sec, while acceptance test 14 calls Sanguine Edge + Crimson Covenant + Regeneration “lifesteal”; Regeneration is healing and Wilds N1 is also sustain. Keep unresolved.
- **Legacy compatibility/save risks:** Creation, derived stats, purchases, spell eligibility, and combat targeting/damage types depend on `cls`. Removing it early can alter HP/stats, range, attack timing, damage, abilities, rendering, and Mage Library behavior. Profile normalization filters unknown legacy perk IDs and recalculates active hero max HP. Equipment eligibility is class-keyed. Academy heroes and Library ownership use separate linked records. Whole-profile PUT has no observed revision/CAS protection. Partial migration risks changed max HP, lost IDs, stranded gear, broken Academy/research associations, or concurrent profile overwrite. No migration or profile write occurred.
- **Recommended next task:** After review of the four open questions, create a requirement-to-node/effect/runtime-consumer/acceptance-test traceability matrix, then plan implementation that preserves legacy IDs and behavior. No perk implementation is authorized until the owner approves that phase.
- **Validation/publication history:** The audit's initial push was rejected after the remote advanced. A later fetch verified remote `5ac34b8` and its bible commit `fd37d24`; no force-push was attempted. The audit was local-only before this approved merge. After conflict resolution, `git diff --check` passed and a content check verified no conflict markers and the required bible/audit sections. The staged merge diff contains only the handoff and the remote bible; hashes verified that the four pre-existing worktree files remain unchanged. No automated tests/builds were run. This merge is not pushed.
- **`work done` signal:** The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back. Until a push is verified, this merged audit is not yet published to GitHub.

## 9. Approved canonical perk and ability bible — v1.0

The approved source of truth is `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`, added in commit `fd37d2454ebdd7134a6fbaba3c9f9aaa946dfde3` and present on the authorized remote branch. It is authoritative and supersedes prior perk/ability discussions wherever they conflict. Structure, permanent IDs, prerequisites, tiers, AP economy, caps, stacking, phase gates, and signatures are final for implementation. Numeric values are locked during implementation and provisional for release; simulation data and owner review are required for tuning. Do not add undocumented behavior or modify this design as part of the audit.

The remote bible-and-handoff publication comprised commits `fd37d2454ebdd7134a6fbaba3c9f9aaa946dfde3` (bible) and `5ac34b8e653921e7ad20b01c0db2f89747215ef0` (handoff record). The local audit commits remain handoff-only. They and the remote commits are combined by the current approved merge; no push has occurred.

The four specification questions are listed once in Section 8 above and remain open. No design discrepancy was silently corrected. Preserve all existing working-tree changes, legacy profiles, account/economy/castle data, and compatibility behavior. No gameplay implementation began.

## 10. Milestone 2 — Shared Hero Baseline Audit, Simulation, and Recommendation — 2026-10-22

### Scope and repository checkpoint

- Objective: audit current combat and recommend (not integrate) a common classless starting baseline. The bible remains unchanged. No hero creation, live combat, profile, production service, or sprite changes were made.
- Branch `review/mobile-working-copy`; HEAD at start `6aecb2ea5f4d926747ae9fb2ef84d432e35986f9`; fetched the authorized branch before publication and verified 0 ahead / 0 behind. No branch switch or merge occurred. Simulation artifact commit `3ae1024` (`Add deterministic classless baseline simulation`) and handoff-only commit `5fe1e4f` (`Record shared hero baseline audit`) were pushed. Post-push `git fetch` and `git ls-remote` verified remote branch SHA `5fe1e4f8ae7eb76f17e993ad486c970dacc6f1f0`; local tracking was 0 ahead / 0 behind at verification.
- Pre-existing user changes preserved: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`. Their content was not edited or staged. Task addition: `frontend/src/game/classlessBaselineSimulation.test.js`.
- Read `AGENTS.md`, this handoff, and the canonical design bible before work. The baseline below is a recommendation requiring owner approval, not a standard.

### Verified current behavior and values

- `frontend/src/game/config.js` defines legacy base stats `{attack:10, defense:10, agility:10, intelligence:10}` and classes: Knight 320 base HP / range 70 / rate 1.1s / +3 defense; Rouge 240 / 90 / 0.5s / +3 agility; Mage 210 / 300 / 1.6s / +3 intelligence; Archer 230 / 340 / 1.0s / +3 attack. At level 1, `heroMaxHp = classBaseHp + 3×defense + level growth` yields HP 380 / 270 / 240 / 260 respectively. `heroDerived` adds the level to attack (Archer adds 2×level), giving initial attack 11 / 11 / 11 / 15. These are class-specific references and were not copied into the recommendation.
- `frontend/src/game/logic.js` defines `heroMaxHp`, `heroDerived`, and `createHero`; all require a `cls`. `heroDerived` computes rate as class interval × `max(0.45, 1 - perkRatePct)`, derives range/magic from class config, and adds equipment/perk fields. New unclassified heroes are not supported by the production model.
- `frontend/src/game/config.js` and `frontend/src/game/engine.js` verify legacy base crit chance 5%, crit multiplier 1.75 (175%), crit chance cap 50%, dodge `clamp(0.005×agility, 0, 0.35)` at config level (hero derived caps at 50%), and incoming damage `raw×100/(100+defense)`. A hero with defense 10 takes 90.91% raw damage before dodge; agility 10 yields 5% dodge. Bible base crit multiplier is 1.50 (150%), so retaining legacy 1.75 would violate the canonical rule.
- `frontend/src/game/engine.js` launches projectiles at 460 units/s for non-magic attacks; hero movement uses 155 world units/s (with legacy perk multipliers) in movement paths. It treats `range < 130` as melee. Melee heroes close until within `range−6` then strike; ranged heroes hold their position and attack only when a valid target is inside range. Target selection defaults to nearest in-range enemy, except class/config overrides (weakest, strongest, frontmost, Mage affinity). A dead current target is discarded and another is selected. Ranged validity can reject affinity-immune/magic-immune targets. This class/range heuristic is not suitable as the classless contract without explicit range mode.
- `frontend/src/game/config.js` defines enemy base HP/speed/damage: Ghost 40/34/6, Slime 55/22/8, Goblin 45/40/7, Skeleton 70/30/12, Orc 120/24/18, Reaper 90/32/15, Dark Elf 105/38/17, Warlock 115/20/13, Lieutenant 300/26/30, and three bosses 2800/20/55, 3300/18/48, 3800/16/60. The first three waves have fixed counts 8/10/11 and onboarding pools; wave 1 has no specialists, wave 2 cap 10%, wave 3 cap 15%. Wave 4+ adds a lieutenant; wave 5 adds two lieutenants and a boss. Generic enemy HP/damage scaling is `(1 + .05×(wave−1) + .02×castlePower)×.85` and `(1 + .032×(wave−1) + .015×castlePower)×.75`; the first three waves also multiply by .75/.82/.88. `buildWave` uses heroes/towers for castle power and specialist weights.
- `frontend/src/game/engine.js` resolves defense, shield, dodge, hero death, boss attacks, enemy escape, and wave end. Defeat occurs when all heroes die, castle HP reaches zero, or escapes reach `floor(wave.total/2)+1`; a wave clears when all enemies are resolved and at least one hero is alive, even if some escaped below the majority threshold. There is no general passive in-combat healing; legacy class abilities can heal. Separate `config.js` recovery is 8% max HP/hour; paid revival is 50% max HP.
- Known formula/design mismatches relevant to any results: legacy crit is 175% vs bible 150%; legacy attack speed can exceed bible's +20% cap; CDR allows 50% vs bible 30%; combat affinity, magic immunity, and class-specific attack types remain active; no Shared Strike exists in engine. `heroDerived` exposes attack, not a direct derived `damage`; ordinary projectile damage consumes `d.damage || d.attack`. All prevent interpreting the legacy combat profile as an approved classless implementation.

### Proposed starting baseline — owner approval required

| Attribute | Recommendation | Units / rationale |
|---|---:|---|
| Identity | No permanent class | Every new hero uses the same stat/combat profile. Appearance remains configurable and independent. |
| Max HP / starting HP | 300 / 300 | HP, full at creation. 300 is a modest durability lift over the 250 audit seed; same-seed wave-5 sensitivity retained 530 aggregate HP vs 384 at 250 after a clear, though it is one trial. |
| Base combat stats | Attack 10, Defense 10, Agility 10, Intelligence 10 | Equal neutral starting attributes; later variation comes from universal perks/equipment/spells/unlocked abilities. |
| Basic attack | 16 direct weapon damage | Damage per hit, using the proposal `max(1, 10 + 0.6×Attack)` at Attack 10. No legacy class/element type; use a neutral weapon category. |
| Attack interval | 1.05 seconds | Interval between attack starts. Midpoint near the old 1.0–1.1s common ranged/heavy references without using their class damage. |
| Range | 220 world units | Explicit `rangeMode: "midline"`; same-seed sensitivity at 220 had fewer out-of-range frames and less HP loss than 130/170. Needs validation in a classless engine. |
| Movement | 155 world units/second when moving | Verified legacy shared movement constant. Midline heroes hold a position and attack valid targets in range; do not chase a target across the field. Movement is for explicit reposition/approach behavior, and should stop at an in-range firing position. |
| Target policy | Nearest valid enemy in range; keep target while alive/valid; on death or invalid range, immediately choose nearest valid target; if none, hold position and acquire the next entering range | Matches the engine's default nearest rule and avoids repeated changes among equally valid targets. Specify stable tie-break by spawn/id order. No boss/low-HP/class preference. |
| Defense / evade | Defense 10; Agility 10 implies 5% legacy direct-attack dodge if retained | Starting engine-compatible values; defense formula yields 9.09% mitigation. The bible does not define baseline dodge, so whether to keep 5% evade needs approval. |
| Crit | 5% chance; 150% damage multiplier | Chance is legacy baseline; 150% multiplier is mandated by bible §3.3. Do not use legacy 175%. |
| Other attributes | No starting damage reduction, sustain, shield, slow, elemental affinity, magic immunity, or bonus damage | No undocumented free perk effects. Enemy defenses/immunities need class-neutral handling separately. |
| Shared Strike | 150% direct-hit weapon damage = 24 at 16 base damage; 12-second cooldown; no resource cost | Entitled at creation, no AP. This is separate from the 16-damage basic attack. Exactly the bible behavior; no stun, slow, healing, AoE, summon, or damage conversion. |

Alternative conservative profile for review: 250 HP, range 170, retaining 16 damage / 1.05s. It is easier to survive with on wave 1 but had fewer wave-5 squad clears in this small run. The 300 HP / 220 range default is still provisional; tuning beyond those points requires a wider simulation and owner approval. No default sprite is recommended.

### Simulation method, results, and limitations

- Added `frontend/src/game/classlessBaselineSimulation.test.js`. It calls production `buildWave` and the real `Engine.update` loop with deterministic LCG seeds and captures enemy HP losses from `_applyHit`. Disposable in-memory state only; no profile, backend, MongoDB, or production data access.
- Since `heroDerived` has no classless path, the harness creates an Archer-shaped fixture solely to satisfy constructor data, then overwrites derived combat fields with the proposed common profile, neutral damage type, 150% crit damage, and nearest-target behavior. It does not change production behavior. Enemy wave construction remains production-derived and thus still uses class/tower assumptions in composition. Movement sensitivity is not measurable for these stationary ranged heroes because production movement speed applies to melee approach, not ranged positioning.
- 90 main scenarios: wave 1 and wave 5 × squad size 1/3/5 × low/typical/high pressure × five deterministic seeds. Low pressure truncates the generated wave to 70%; high pressure duplicates the generated roster and scales enemy damage/HP to 125%/115%; typical uses production `buildWave`. This is a controlled stress range, not three official game difficulties. Every result is one wave, not a multi-wave playthrough.
- Clear rate: all wave 1 cells cleared 5/5. Wave 5 low: 3/5 for 1 hero, 3/5 for 3, 4/5 for 5. Wave 5 typical: 0/5, 2/5, 4/5 respectively. Wave 5 high: 0/5 for all squads. Average wave-5 typical duration was 48.2s/85.9s/97.6s for 1/3/5 heroes. Average hero deaths were 0.8/2.2/1.8 per encounter; five-hero typical average HP loss 542 and dealt damage 3367. Wave 1 typical durations averaged 37.9/29.6/28.2s and caused no hero HP loss in any squad size. These rates are preliminary (n=5 per cell), not balance certification.
- Same-seed wave-5 three-hero sensitivity (seed 4242; one trial each): baseline 250 HP / attack 16 / 1.05s / range 170 cleared in 90.8s, one death, 384 HP remained, 8 escapes, 2,156 dealt damage. 300 HP cleared in 87.6s, one death, 530 HP remained, 5 escapes. Attack 19 cleared in 87.95s with one death and 2,707 damage; attack 13 took 93.35s, no deaths, 2,468 damage. Interval .9s took 91.45s and dealt 2,517; 1.2s took 88.4s and dealt 2,397 (boss reinforcements and target order add variance). Range 130 took 94.6s, lost 481 HP, and had 2,546 out-of-range/no-target frames; range 220 took 84.95s, lost 295 HP, and had 1,070 such frames. Changing movement multiplier .75→1.25 had no effect, confirming ranged movement is not exercised by this harness.
- Target-search and out-of-range counters count calls to the existing `_selectTarget` method, not wall-clock downtime; they are rough proxies and include method call sites beyond the one attack-selection point. The run did not measure Shared Strike use/cooldown, test ability rotation, measure exact attack uptime, or validate UI/tactical orders. Shared Strike math was calculated directly from the approved coefficient and proposed base attack.
- Confidence: low to moderate for the direct engine loop and very low for final balance. The engine is class-bound, the adaptation overrides fields, pressure variants alter production roster post-generation, and there are only five seeds/cell. Wave 5 failures show a large difficulty cliff with this harness and need more testing, not a promise that the recommended numbers guarantee victory.

### Validation, remaining decisions, and next step

- Exact focused command: `CI=true npm --prefix frontend test -- --watchAll=false --runInBand src/game/classlessBaselineSimulation.test.js` — PASS, 1 suite / 1 test, 90 main trials + 11 sensitivity trials, deterministic repeat check included. An intermediate run failed only because the expected sensitivity count was stale (10 vs 11); corrected and the final run passed.
- `git diff --check`: PASS. No broader tests, build, mobile/device check, or profile integration were run; none are needed for this isolated harness. No gameplay source, design bible, profile, or sprite changed.
- Owner approval required before implementation: approve or revise the shared baseline table, especially 300 HP, 16 basic damage, 1.05s interval, 220 range, 5% starting dodge, and Shared Strike's 24 raw damage at this proposed weapon baseline. Decide if wave-5 three-hero 2/5 typical clears are acceptable; the numbers are not tuned to guarantee victory. Once approved, implement behind an isolated classless model and focused tests; do not start integration before that approval.
- Handoff records this audit, exact validation results, and the verified publication above. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 11. Milestone 3 — Approved Hero Baseline and Creation Model — 2026-10-22

### Repository checkpoint and scope

- Owner-approved baseline from Milestone 2 was implemented as a classless model contract. This milestone does not claim that the game is fully classless.
- Started on `review/mobile-working-copy`, HEAD `11f9773ea2c4fcfb9212ee926935bfd6df3bba57`; fetched origin and confirmed 0 ahead / 0 behind before edits. Stayed on this branch. Implementation commit `1db2245` (`Add approved classless hero creation model`) contains only the model, adapter, and focused tests. Handoff-only commit `9b85b49` was pushed; post-push fetch and `git ls-remote` verified branch SHA `9b85b49892f935c37c10214b9483be5d985106e9` and local tracking at 0 ahead / 0 behind.
- Pre-existing user changes preserved and not staged: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`.
- No production profile, account, API, backend, MongoDB, sprite, or canonical bible data was changed. Tests use local in-memory state.

### Implementation

- Added `frontend/src/game/heroModel.js` as the authoritative baseline/model module. `HERO_BASELINE` contains the approved 300 HP, four base stats at 10, 16 damage / 1.05s / 220 range / `midline` / 155 movement, nearest-valid retain/reacquire policy with stable spawn-order tie-break, 5% crit chance, 150% crit damage, and 5% dodge. Shared Strike is represented as a single-valid-target weapon capability at 150% damage, 12s cooldown, zero resource cost, and explicit false values for prohibited effects. At the approved baseline its raw damage is 24.
- Hero model separates `identity`, configurable `appearance`, `combat`, and `progression`; it has no `cls` or class eligibility field. Appearance defaults to unset (`null`) so no sprite/default was chosen. `withHeroAppearance` is a pure update that preserves combat/progression and rejects invalid inputs without mutating the input.
- `frontend/src/game/logic.js` now routes `createHero()` with no class key to the classless model and exports `createClasslessHero(options)`. `recruitHero(state)` with no class key uses that model while preserving existing gold affordability behavior. Calls with an explicit legacy class remain unchanged for compatibility.
- The current fresh-profile path still creates an empty shared economy state and routes through the existing class-selecting `SquadSelect`; `setSquad` and Tavern UI still pass explicit class keys. This live UI path was intentionally not redirected because roster/preparation/rendering, `normalizeState`, and the battle engine require class-keyed fields. The model/recruitment API is implemented, but classless hero persistence through normalization and live profile-to-squad integration are not complete.
- No engine attack execution was added. `Engine` uses class-derived `heroDerived`, class-specific damage types/target validity, and `range < 130` checks across automatic targeting, tactical targeting, interaction, and ranged UI. Safe classless basic attack/Shared Strike execution requires a separate engine adapter with explicit `rangeMode`, plus classless rendering/state handling. Shared Strike here is only a tested capability/data contract; cooldown enforcement and prohibited-effect behavior in battle are not yet executable/tested.
- The classless progression validator remains disconnected. No PerkTree, signature, Phase 1.5, Phase 2, or gated content integration occurred.

### Tests and actual results

- Added `frontend/src/game/heroModel.test.js`: shared baseline, no-class identity, approved values, 24-damage Shared Strike calculation/restrictions, appearance independence, unknown/absent legacy class-field handling, and failure immutability.
- Added `frontend/src/game/logic.classlessHero.test.js`: no-argument classless creation, classless no-key recruitment, new-state economy/castle preservation, failed recruitment atomicity, and explicit legacy class factory compatibility.
- Focused command `CI=true npm --prefix frontend test -- --watchAll=false --runInBand src/game/heroModel.test.js src/game/logic.classlessHero.test.js src/game/logic.economy.test.js src/game/logic.tavern.test.js` — PASS, 4 suites / 15 tests.
- Regression command `CI=true npm --prefix frontend test -- --watchAll=false --runInBand src/game/logic.progression.test.js src/game/logic.wave-composition.test.js src/game/engine.targeting.test.js src/context/GameProvider.test.jsx` — PASS, 4 suites / 34 tests. Provider tests emitted expected mocked network-error logs; no real profile/network operation occurred.
- Build `npm --prefix frontend run build` — PASS, optimized build compiled successfully. Node emitted a deprecation warning for `fs.F_OK`; it did not fail the build.
- `git diff --check` — PASS after implementation and handoff edits. No full frontend suite, device test, or live profile integration test was run.

### Remaining boundary and next step

- Implemented and tested: class-independent model, approved starting profile data, no-class creation API, no-class recruitment API, independent appearance data, progression placeholder fields, Shared Strike descriptor, legacy explicit-class compatibility.
- Not integrated: current new-game squad selection flow, roster/preparation/profile visuals for classless heroes, `GameProvider.normalizeState` and save round-trip for the new model, `heroDerived`, basic attack execution, Shared Strike cooldown/damage resolution, class-neutral enemy-validity handling, and live combat. Route no-class creation into the app only after these consumers have a tested adapter; otherwise a classless hero cannot safely enter current combat.
- Next step: design a bounded classless persistence/rendering adapter and add normalization/save round-trip tests using disposable local state, then separately implement explicit-range basic attack and Shared Strike execution in the engine. Do not claim full classless gameplay until both integration layers are verified.
- The handoff records this implementation, test/build results, and the remaining engine/UI boundary. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 12. Milestone 4 — Classless Persistence and Rendering Adapter — 2026-10-22

### Repository checkpoint and outcome

- Started on `review/mobile-working-copy`, HEAD `9b85b49892f935c37c10214b9483be5d985106e9`; branch was synchronized with origin at start. Preserved the pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. These were not edited or staged.
- Read `AGENTS.md`, this handoff, and the canonical design bible. No branch switch, merge, deployment, backend request, production profile/account modification, or MongoDB access occurred.
- Implemented a JSON-compatible persistence and normalization adapter for the already approved classless hero data. Classless heroes render in roster and preparation using their stored identity and appearance identifier. They are explicitly blocked from starting a battle. The class-based profile path remains supported.

### Verified profile paths and behavior

- `GameProvider.loadGame` reads `gameApi.getState()` (`GET /game/state`), normalizes `data.state`, writes a local backup, and loads it into provider state. `startNewGame` still creates the existing empty economy/castle state; it has not been redirected to classless combat or a classless live squad flow. Local fallback also normalizes before the player chooses to continue.
- `gameApi.createState` and `gameApi.saveState` send a JSON object under `{ state }` to `POST /game/state` and `PUT /game/state`. They now call `serializeGameState`, which returns an isolated JSON snapshot and throws on invalid/cyclic input without changing the caller's object.
- Backend save endpoints accept the root state as a dictionary and store/return it without requiring hero `cls`; root-level legacy economy migrations remain. The existing backend offline accrual code only reads legacy top-level hero `hp`/`maxHp`, so it does not restore nested classless `combat.hp`. That backend recovery behavior remains a known limitation and was not changed in this milestone.
- Before this change, `GameProvider.normalizeState` edited its input and passed every active hero through class-keyed perk normalization, mage setup, and `heroDerived`; those assumptions rejected the nested classless model. The normalizer now JSON-clones first and dispatches classless heroes through `normalizeClasslessHero` in both squad and bench. Legacy squad and bench normalization retain their prior paths.

### Implementation and boundaries

- `frontend/src/game/heroModel.js` now exports `normalizeClasslessHero` and `serializeGameState`. The normalizer preserves nested identity, appearance, combat, progression, and unknown JSON fields; it supplies safe values for absent/malformed optional identity, HP, stat, attack-setting, appearance, and progression fields. Approved Shared Strike behavior is normalized back to its canonical coefficient, cooldown, zero cost, and no prohibited effects.
- `GameProvider.normalizeState` now works on a JSON copy, so validation/clone failures happen before mutating the supplied save. `frontend/src/api.js` serializes create/save payloads through the snapshot helper. `castlePower` reads the classless progression level as a display/economy fallback when the legacy top-level level is absent.
- Roster and preparation show classless identity, level, HP, base stats where applicable, and appearance ID or “Unselected”, without selecting or drawing a default sprite. No new appearance picker was introduced. Classless heroes do not open legacy `HeroCard` progression or class configuration controls, and preparation refuses to enter battle while a classless hero is in the squad.
- Live new-game selection was not redirected. Combat execution, the battle engine, classless healing/revival/recovery, and perk-tree progression remain unsupported. The adapter only makes classless records safe to normalize, JSON-save/load, and display; it does not claim full classless gameplay. Offline recovery for nested `combat.hp` is the specific backend blocker noted above.
- No class values or combat baseline were changed, and no default sprite, ability, perk, or progression behavior was invented.

### Tests and validation

- Added `frontend/src/game/classlessPersistence.test.js` covering classless state save/load round-trip of identity, appearance, HP, stats, combat settings, and progression; unchanged legacy class normalization; malformed/unknown optional fields; failure atomicity for normalization and serialization; and disposable new-game economy/castle/profile fields. It uses only local data, not a production identity or service.
- Focused command: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessPersistence.test.js src/context/GameProvider.test.jsx src/game/logic.wave-composition.test.js src/components/PrepField.test.jsx` from `frontend/` — PASS, 4 suites / 24 tests.
- Full frontend command: `CI=true npm test -- --watchAll=false --runInBand` from `frontend/` — PASS, 29 suites / 236 tests. This full run occurred before the final one-line `castlePower` fallback and display-label polish; the focused suite and build below ran afterward.
- Build: `npm run build` from `frontend/` — PASS, optimized build compiled successfully. Node printed a non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after final documentation/code review. No roster-specific or preparation-screen integration test existed; the existing `PrepField` regression test passed. No live API/backend, device, or combat test was run.

### Publication and next step

- Milestone code/test commit `87e21d8` (`Add classless profile persistence adapter`) contains only the seven files listed in this section. Handoff-only commit `188da97` (`Record classless persistence milestone`) contains only this file. Follow-up handoff-only commit `f6a051c` (`Verify classless hero milestone publication`) corrected the publication record and was pushed to `review/mobile-working-copy`; `git fetch`, local tracking ref, and `git ls-remote` verified SHA `f6a051cd96daf6df14de4408a836d782d0a943fa`, with 0 ahead / 0 behind at that verification. The four pre-existing user changes above remained unstaged and uncommitted.
- Next step: implement backend-compatible offline HP recovery for nested `combat.hp` only if desired, then complete a classless combat-engine adapter and targeted roster/preparation interaction tests before routing new-game heroes into battle. Do not integrate classless heroes into live combat based on this persistence milestone alone.
- The handoff records actual results and the remaining limits. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back. At the start of Milestone 5, this section was published through `f6a051cd96daf6df14de4408a836d782d0a943fa`.

## 13. Milestone 5 — Classless Combat Engine Adapter — 2026-10-22

### Repository checkpoint and scope

- Started on `review/mobile-working-copy`, HEAD `f6a051cd96daf6df14de4408a836d782d0a943fa`, fetched the authorized branch, and verified 0 ahead / 0 behind. No branch switch or merge occurred.
- Preserved the pre-existing changes to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. These were not edited or staged. No production profile, real account, backend database record, or MongoDB data was used.
- Read `AGENTS.md`, this handoff, and the canonical design bible. The approved baseline remains unchanged. New-game selection and live combat entry remain blocked for classless heroes.

### Verified engine behavior and implementation

- `Engine` previously called class-only `heroDerived` during construction. Target status, tactical targeting, auto-selection, and hit resolution inferred attacks from class and damage-type affinity; the attack loop treated `range < 130` as melee. Ordinary attacks use projectiles and `_applyHit`, which applies criticals, enemy death/rewards/XP attribution, and `_checkEnd` handles squad/castle defeat. Mage spells and legacy abilities use class eligibility and element/status handlers.
- `frontend/src/game/engine.js` now recognizes the persisted classless model and builds a runtime-only view over nested `combat.hp`, `combat.maxHp`, identity, and progression fields. It does not add or write a class key. Derived combat values come from `combat.basicAttack` and `combat.stats`: the approved 300 HP, 16 weapon damage, 1.05s interval, 220 range, explicit `midline`, 155 movement, 10 defense/agility/intelligence, 5% crit chance, 150% crit damage, and 5% dodge.
- Midline target eligibility checks the explicit range mode and radius. It does not use the legacy numeric range threshold and does not auto-chase; the hero holds position and fires only on valid targets within range. Explicit move/rally/retreat paths use the classless movement speed. The nearest valid target is retained while valid; when dead, removed, or out of range it is reacquired by nearest distance, with stable `active` spawn order as the equal-distance tie break.
- Classless weapon hits are neutral and untyped: they receive no legacy class affinity, magic identity, or elemental conversion. This also means legacy enemy affinity immunities/resistances do not grant special class advantages against the shared weapon attack. Legacy class paths and damage-type rules remain unchanged.
- `Shared Strike` is a dedicated single-target direct hit routed through `_applyHit` and the normal enemy-kill/reward path. It uses the canonical 1.5 multiplier and 12s cooldown, no mana/resource cost, and a null perk payload so legacy cleave, heal, stun, area, and conversion effects cannot leak in. It is shown by engine status APIs but was not added to tactical UI or enabled in the live Battle screen. Classless heroes cannot cast legacy class abilities or spells.
- `Battle.jsx` retains a defensive classless gate and returns to preparation rather than instantiating the engine. Preparation already blocks the start-wave action. The engine renderer does not fall through to the legacy Archer sprite for a classless model; this milestone chooses no appearance or default sprite.
- Existing enemy hit, nested hero HP death, enemy death, XP attribution, and wave defeat lifecycle are reused. Engine test state remains isolated and in-memory. The profile/persistence completion UI still writes legacy hero fields, so the `Battle` gate must remain until the full flow is adapted and verified.

### Offline HP recovery investigation

- `backend/server.py::apply_offline_accrual` recovers wounded legacy `hero.hp` toward `hero.maxHp`, capped at the existing 8%/hour and never reviving a zero-HP hero. Classless nested `combat.hp` is not currently covered.
- A minimal nested-HP backend change and test were drafted locally, but the repository environment has neither `pytest` nor FastAPI installed: `python3 -m pytest -q tests/test_classless_offline_recovery.py tests/test_profile_creation_safety.py tests/backend_test.py` failed with `No module named pytest`, and the runtime dependency check failed with `No module named fastapi`. To avoid publishing unverified backend behavior, the draft change/test were removed. No backend file is part of this milestone. The exact blocker is the missing backend test/runtime dependencies; rerun/add nested recovery only in a configured backend test environment.

### Tests and validation

- Added `frontend/src/game/engine.classless.test.js` for approved runtime values, neutral 16 damage, 1.05s basic attack timing, explicit midline behavior below the old 130-unit heuristic, 155 movement, deterministic nearest/retain/reacquire selection, invalid/dead/out-of-range targets, Shared Strike 24 damage/crit/cooldown/no cost/prohibited effects, classless nested HP death, and normal enemy kill/reward/XP lifecycle.
- Updated `frontend/src/screens/Battle.tactical-flow.test.jsx` to verify a classless profile is returned to preparation and never constructs the live engine.
- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/game/engine.classless.test.js src/game/engine.targeting.test.js src/game/engine.abilities.test.js src/game/engine.defense-perks.test.js src/game/engine.perk-characterization.test.js src/screens/Battle.tactical-flow.test.jsx` — PASS, 6 suites / 90 tests.
- Full frontend command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand` — PASS, 30 suites / 247 tests.
- Build from `frontend/`: `npm run build` — PASS, optimized build compiled. Node emitted a non-fatal `fs.F_OK` deprecation warning.
- Backend command and limitation are recorded above. No live API/backend/database, device, or combat-screen test was performed. No production data was touched.
- `git diff --check` — PASS after final code and handoff review.

### Limits, publication, and next step

- The engine adapter is tested but is not connected to new-game selection or enabled for live battles. No attack/Shared Strike control was integrated into tactical UI. Classless hero XP progression, post-battle persistence merging, appearance rendering, recovery, perks, equipment, and class-neutral enemy AI are not complete. Do not claim the game is fully classless.
- Backend offline HP recovery remains unimplemented until its tests can run in a configured backend environment. Next: verify the nested recovery adapter there, then add the UI/profile completion adapter and end-to-end test before removing either battle gate.
- Code/test commit `1823cd0` (`Add bounded classless combat engine adapter`) contains only the four files listed in this milestone. Handoff-only commit `3fe588f` (`Record classless combat adapter milestone`) contains only this handoff. Both were pushed to `review/mobile-working-copy`; `git fetch`, local tracking ref, and `git ls-remote` verified remote SHA `3fe588fec025d06eaac3a72003f558a0171dbb33`, matching local HEAD, with 0 ahead / 0 behind. The existing unrelated worktree changes remain unstaged.
- The handoff is published at the verified SHA above. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 15. Milestone 6B — Complete the Classless Flow Safely — 2026-10-22

### Repository checkpoint and scope

- Started on `review/mobile-working-copy`, HEAD `347601757e39a31ba8b6abd4de18840960e8ef2d`; fetched origin and confirmed 0 ahead / 0 behind. Preserved the pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. They were not staged. No real accounts, production profiles, MongoDB records, merge, deploy, or Android build were used.
- Read `AGENTS.md` and this latest handoff. Kept the classless hero model authoritative and retained the Battle/Preparation safety gate.

### Backend recovery

- `backend/server.py::apply_offline_accrual` now recognizes nested classless records by the classless identity/combat shape and absence of a legacy `cls`. It recovers valid numeric `combat.hp` toward `combat.maxHp` at the existing 8% of maximum HP per hour, after the existing elapsed-time calculation and 12-hour cap. Zero HP remains zero. Invalid, non-finite, boolean, missing, zero-max, negative, or over-max HP is ignored. The classless branch continues before legacy recovery, preventing double recovery. Legacy top-level `hp`/`maxHp`, inferred maxima, and rate remain unchanged.
- Dependencies were provisioned only under `/tmp/demonanic-m6b-pydeps` using `pip --python /usr/bin/python3.12 install --target /tmp/demonanic-m6b-pydeps` and the Python packages declared by `backend/requirements.txt` needed for pytest/server imports (pytest, pytest-xdist, FastAPI, Motor, PyMongo, python-dotenv, Pydantic, email-validator, PyJWT, bcrypt and transitive dependencies). No global Python packages or repo/production configuration changed.
- Added `backend/tests/test_classless_offline_recovery.py` for wounded, full, zero HP, malformed nested values, one/twelve/over-twelve-hour and zero-elapsed boundaries, and unchanged legacy HP recovery. These tests use frozen time and disposable dictionaries. Backend API smoke tests in `backend/tests/backend_test.py` were not run because they issue HTTP requests to a configured remote service; local profile-creation safety tests use in-memory fakes.

### Frontend creation, display, and action wiring

- Added `setClasslessSquad` in `frontend/src/game/logic.js`; it only accepts a fresh profile with no existing squad and creates four independently identified instances of `createHeroModel`, with no `cls`, no chosen appearance, and no changes to economy/castle fields.
- `frontend/src/screens/SquadSelect.jsx` now offers a separate explicit classless starting-squad choice, persists the result using the existing provider save path, and routes to home/preparation. Its copy clearly states combat remains gated. Class selection behavior remains available.
- `TacticalMenu.jsx` now reads nested classless identity, HP, maximum HP, and AP/SP for its selector/status display and uses a neutral placeholder rather than rendering the legacy default class sprite. It displays Shared Strike’s baseline 24 raw damage, 12-second cooldown, and zero cost from engine ability status; the button follows the existing enemy-target selection callback. Engine `getHeroAbilityStatus` now exposes those values and the direct-hit description from `HERO_BASELINE`. Shared Strike execution remains through the already-tested engine action API.
- Existing classless result staging (`classlessBattleResults.js`) and serialization/normalization remain in use. No live Battle gate was removed. Because that gate still stops classless heroes before Engine creation, the actual combat → result callback → provider save → remote reload journey is not end-to-end verified. UI action wiring is component-tested and engine execution is separately tested, but not exercised together in a live Battle screen.

### Validation and actual outcomes

- Backend: `PYTHONPATH=/tmp/demonanic-m6b-pydeps python3 -m pytest -n 0 -q tests/test_classless_offline_recovery.py tests/test_profile_creation_safety.py` from `backend/` — PASS, 9 tests, 4 FastAPI `on_event` deprecation warnings. No remote API/backend test was run.
- Frontend focused command: `CI=true npm test -- --watchAll=false --runInBand src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx src/screens/SquadSelect.classless.test.jsx src/game/logic.classlessHero.test.js src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/screens/Battle.tactical-flow.test.jsx` from `frontend/` — PASS, 7 suites / 59 tests.
- After refining Shared Strike target-mode UI coverage: `CI=true npm test -- --watchAll=false --runInBand src/components/TacticalMenu.test.jsx` — PASS, 1 suite / 14 tests.
- An earlier focused run initially had 1 test-suite setup failure (`Cannot find module '@/context/GameProvider'`) while 6 other suites passed. The new SquadSelect imports were changed to the same relative module paths used by tests; the replacement focused commands above passed.
- `npm run build` from `frontend/` — PASS, optimized build compiled. Node emitted a non-fatal `fs.F_OK` deprecation warning. Full frontend suite and Android build were not run under the stated budget; no device check occurred.
- `git diff --check` — PASS after code and handoff review.

### Limits, publication, and next step

- The creation choice now yields a classless roster that serializes and normalizes through existing adapters and can be displayed in preparation. The combat gate remains because the full runtime battle/reward/save/reload loop is not exercised end-to-end. Shared Strike UI wiring is prepared and tested, but cannot be reached through the gated live Battle route. Do not claim full classless playability.
- Backend nested recovery and focused profile tests are verified. No changes were made to `backend/requirements.txt`, production data, `GameProvider`, the canonical design bible, perk tree, or Android project.
- Milestone files: `backend/server.py`, `backend/tests/test_classless_offline_recovery.py`, `frontend/src/game/logic.js`, `frontend/src/game/logic.classlessHero.test.js`, `frontend/src/screens/SquadSelect.jsx`, `frontend/src/screens/SquadSelect.classless.test.jsx`, `frontend/src/components/TacticalMenu.jsx`, `frontend/src/components/TacticalMenu.test.jsx`, `frontend/src/game/engine.js`, and `frontend/src/game/engine.classless.test.js`. Code/test commit `1c85b6e` (`Complete classless creation and recovery foundation`) contains only these ten files. It and handoff commit `bd2837b` were pushed; fetch and `git ls-remote` verified remote SHA `bd2837b1324a33c3f7f098a695f3722cbf43cf6c`. This final handoff-only commit records that verified publication.
- Next step: use a disposable test identity to verify full classless Battle completion through nested HP/XP result merge, save and normalized reload. Keep both gates until that full sequence is demonstrably safe. Then consider an Android build only when explicitly requested.
- The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 14. Milestone 6A — Classless Recovery and End-to-End Integration Foundation — 2026-10-22

### Repository checkpoint and boundaries

- Started on `review/mobile-working-copy`, HEAD `bffd3427b888104875dfce460ecfe056031b55e6`; fetched `origin/review/mobile-working-copy` and confirmed 0 ahead / 0 behind. Preserved the pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. No edits or staging of those files.
- Read `AGENTS.md`, this handoff, and `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`. No production profile/account, MongoDB, backend API, merge, deploy, or `main` branch was used. The approved baseline and classless Battle safety gate remain unchanged.

### Post-battle persistence foundation

- Added `frontend/src/game/classlessBattleResults.js`, a pure staging adapter that JSON-clones a profile before applying valid classless runtime `combat.hp` and awarded `progression.xp` by stable identity ID. It preserves appearance, combat settings/capabilities, progression fields, economy, castle, and unrelated profile fields. It rejects invalid runtime HP / XP without mutating source state. It does not apply legacy class level-up, SP/AP, or perk rules; those are not approved classless progression rules.
- `Battle.jsx` now uses identity IDs and stages/copies nested classless result fields in its completion callback, while retaining `addHeroXp` for legacy heroes. Legacy-only runs skip this staging adapter. This completion code is not yet reachable for classless heroes because the safety gate returns them to preparation before Engine construction. The tested adapter proves the merge/serialization/normalization seam, not a playable battle or backend save round trip.
- Shared Strike tactical UI wiring was not added. Engine status/use APIs and the approved direct-hit behavior remain tested from Milestone 5. UI use cannot be verified through the actual Battle screen while the classless gate is active, and bypassing it would violate the milestone’s safety requirement.

### Backend offline recovery blocker

- Verified `backend/server.py::apply_offline_accrual` remains unchanged: it caps elapsed offline time at the configured 12 hours, recovers legacy top-level HP at 8% of max HP per hour, and skips heroes at zero HP. Nested `combat.hp` is still unsupported. No backend implementation or recovery tests were added or published because a declared-dependency test environment could not be safely provisioned here.
- Exact backend command `python3 -m pytest -q tests/test_classless_offline_recovery.py tests/test_profile_creation_safety.py tests/backend_test.py` from `backend/` — BLOCKED immediately: `/usr/bin/python3: No module named pytest`. `python3 -c 'import fastapi'` also fails with `No module named fastapi`; Python 3.12 lacks pytest, and `python3.12 -m venv /tmp/demonanic-backend-venv` failed because `ensurepip` is unavailable. No `pip` executable is installed. The next backend step is to provide a disposable Python environment with `backend/requirements.txt` dependencies, then add and run nested wounded/full/dead/malformed/boundary and legacy recovery tests before implementing/publishing recovery.

### Tests and validation

- Added `frontend/src/game/classlessBattleResults.test.js`: classless HP/XP result merge followed by serialization and normalization; defeat at zero HP; preservation of identity, appearance, combat capabilities, progression fields, economy/castle/profile data; legacy state untouched by the adapter; and invalid-result atomicity.
- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/engine.classless.test.js src/screens/Battle.tactical-flow.test.jsx` — PASS, 4 suites / 39 tests. After final helper adjustments, `CI=true npm test -- --watchAll=false --runInBand src/game/classlessBattleResults.test.js src/screens/Battle.tactical-flow.test.jsx` — PASS, 2 suites / 24 tests.
- Full frontend command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand` — PASS, 31 suites / 251 tests, including existing legacy battle, profile/provider, rewards, and classless Shared Strike engine tests.
- `npm run build` from `frontend/` — PASS, optimized build compiled successfully; Node emitted the existing non-fatal `fs.F_OK` deprecation warning. The focused run after the final adapter edit also passed.
- `git diff --check` — PASS after final edits. No backend tests, live end-to-end test, live API, device/Android build, or production data operation occurred.

### Remaining blockers and next step

- Nested offline recovery remains unimplemented pending an isolated declared-dependency backend environment. This is the primary incomplete item for Milestone 6A.
- The result adapter is ready for a future classless battle completion path but full flow is unverified: classless creation is not wired into live new-game selection; Battle remains gated; Shared Strike is not exposed in tactical UI; recovery is missing; backend save/load and the full creation → preparation → battle → rewards → reload journey are not verified. Do not remove the gate or describe the game as fully playable/classless.
- Code files for this milestone: `frontend/src/screens/Battle.jsx`, `frontend/src/game/classlessBattleResults.js`, and `frontend/src/game/classlessBattleResults.test.js`. No backend file changed. Milestone code/test commit `8cd1a5b` (`Add classless battle result persistence adapter`) contains only those three files. It and handoff-only commit `02208f2` were pushed to `review/mobile-working-copy`; fetch and `git ls-remote` verified remote SHA `02208f2dee2383426a0f8e812f3908183fe6231f`. A final handoff-only update is recording this verification.
- The handoff must be published on `review/mobile-working-copy` when safe. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 16. Classless lifecycle verification review — 2026-10-22

### Starting point and verified boundary

- Started on `review/mobile-working-copy` at HEAD `d694969deae060eb5ff78c28d46792faaa37862d`. Fetched `origin/review/mobile-working-copy`; the branch was synchronized at 0 ahead / 0 behind. Preserved the pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. No production profile, account, MongoDB record, or remote service was used.
- Re-read this file and `AGENTS.md`, and reviewed the canonical design bible. The bible remains authoritative; no perk/ability rules or open questions were changed. The approved baseline remains unchanged.
- Current creation path offers a four-hero classless squad via `setClasslessSquad`, and preparation/persistence normalization supports those nested hero records. The post-battle adapter stages nested HP and XP by stable `identity.id`, preserving the serialized profile fields and avoiding legacy class XP/AP/SP handling. The engine adapter and Shared Strike behavior remain independently covered by engine tests.
- The exact live integration gap remains the intentional gates: `Preparation.startWave` rejects a classless squad before saving or navigating to battle, and `Battle` returns to preparation before constructing `Engine`. Consequently, the `Battle.onEnd` classless-result merge cannot run for this roster in the current live route. Existing result-adapter round-trip tests establish the pure merge/serialize/normalize behavior only; they do not establish battle rewards exactly once, provider persistence after a real classless battle, or profile reload after battle.
- Both gates remain unchanged. No safe, bounded code change can prove or close the end-to-end seam while retaining those checks; removing them would exceed the evidence. No legacy class was added. No backend change was needed for this review; nested offline recovery is implemented and covered as recorded in the preceding Milestone 6B section (the older Milestone 6A notes are historical status at that milestone).

### Changes and validation

- Added `frontend/src/screens/Preparation.classless-gate.test.jsx`, which renders the real Preparation screen with a disposable classless hero and verifies that Start Wave does not call `saveNow` or navigate to battle. Added no live-flow bypass.
- Changed `frontend/src/screens/Preparation.jsx` import specifiers from `@/...` to equivalent relative paths so Jest can resolve and mock the actual screen in this repository's current test configuration. This has no runtime behavior change. Also changed active roster row keys to fall back to stable `identity.id` for classless heroes, which do not have legacy `h.id` fields.
- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/screens/Preparation.classless-gate.test.jsx src/screens/Battle.tactical-flow.test.jsx src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/engine.classless.test.js src/screens/SquadSelect.classless.test.jsx src/context/GameProvider.test.jsx` — PASS, 7 suites / 53 tests. GameProvider tests emitted their expected mocked load-error logs. A follow-up `CI=true npm test -- --watchAll=false --runInBand src/screens/Preparation.classless-gate.test.jsx` after the stable-key fix — PASS, 1 suite / 1 test, with no missing-key warning.
- The first focused attempt failed because Jest could not resolve the screen's `@/...` imports. After converting those imports to equivalent relative paths, the focused command above passed. A first attempt to launch with `yarn` was unavailable (`yarn: not found`); validation used the repository's installed npm dependencies instead.
- `npm run build` from `frontend/`, rerun after the stable-key fix — PASS, optimized production bundle compiled. Node emitted the non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after code, test, and handoff edits. Full frontend suite, backend suite, live API, real save/reload integration, and Android/device checks were not run. No end-to-end classless battle lifecycle is claimed.

### Current direction, publication, and next step

- Files changed for this review: `frontend/src/screens/Preparation.jsx`, new `frontend/src/screens/Preparation.classless-gate.test.jsx`, and this handoff. Unrelated user-owned changes remain unstaged and uncommitted.
- Current status: classless creation, preparation display, engine actions, result staging, and normalized serialization each have focused coverage, but the complete creation → preparation → battle → completion/defeat → rewards → save → reload path is not verified. Shared Strike UI-to-engine action cannot be exercised on the live route while Battle is gated, despite separate component/action tests from earlier milestones. Neither gate changed.
- Recommended next task: build a disposable integration test harness that exercises the actual battle completion callback, provider save, and normalization/reload path for classless heroes without changing production profiles; only after that and the needed tactical action route pass should the owner consider relaxing either gate.
- Focused code/test commits `5c65369` (`Test classless preparation safety gate`) and `c8b2627` (`Use stable classless roster keys`) contain only the Preparation screen/test files. Handoff-only commits `d4abe99`, `62cb3a9`, and `b83526f` were pushed separately. `git fetch` and `git ls-remote` verified `b83526f3dfddec7ad195708a8178fd9f7b79e068` on `review/mobile-working-copy`, matching local HEAD with 0 ahead / 0 behind. This verification note is being published in its own handoff-only follow-up. The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 17. Milestone 1 — Verify Classless Battle Integration — 2026-10-22

### Checkpoint and scope

- Started on `review/mobile-working-copy` at HEAD `4e2dc073032314132150d85a12e55214ca9ce4d4`; fetched origin and confirmed 0 ahead / 0 behind. Preserved the pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. No production account/profile/database, real API, merge, deploy, or Android build was used.
- Re-read `AGENTS.md`, this handoff, and the canonical design bible. No combat baseline, perk/ability behavior, or documented open question was changed.

### Disposable integration harness and result

- Added `frontend/src/game/classlessBattleLifecycle.integration.test.js`. It constructs the real classless `Engine` over a disposable profile, resolves a real engine victory and defeat callback, passes nested runtime HP and engine XP awards through `mergeClasslessBattleResults`, then serializes and runs the actual `normalizeState` adapter. Victory verifies engine XP attribution, one enemy/gold reward, stable identity, no legacy `cls`, preserved AP/SP/owned nodes, and economy/castle/profile markers. Rechecking an ended engine verifies it does not pay the enemy reward or call the end callback a second time. Defeat verifies zero nested HP remains zero after normalization.
- Added a TacticalMenu integration test which selects Shared Strike from the real menu and routes the emitted hero/action pair into the real Engine `useHeroAbility`; the target receives 24 raw damage and the engine enforces the 12-second cooldown. Existing separate engine tests continue to cover prohibited effects and other Shared Strike rules.
- **This is not full Battle/provider integration.** `Battle` intentionally returns before creating the engine for classless heroes, and Preparation refuses the transition. Thus the classless `Battle.onEnd` callback, `GameProvider.mutate` completion merge, `saveNow`, API persistence, and reload-after-save cannot run together through the production screen path without bypassing the gates. The harness uses the real engine, result adapter, serializer, and normalizer, but it does not fake a provider save. Existing legacy Battle tests still cover callback repeat protection for class-based heroes; that does not prove the classless Battle callback path.
- Both Battle and Preparation gates remain unchanged. The evidence does not yet demonstrate the complete creation → preparation → actual Battle screen → victory/defeat → rewards → provider save → profile reload journey. Do not enable classless live battle yet.

### Tests and validation

- Initial focused harness attempt: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessBattleLifecycle.integration.test.js` from `frontend/` — FAIL, 2 tests, because this Jest runtime does not define `structuredClone`. Changed only the disposable test fixture clone to JSON cloning; no production behavior changed.
- Focused harness rerun with the same command — PASS, 1 suite / 2 tests.
- Tactical UI/engine command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/components/TacticalMenu.test.jsx` — PASS, 1 suite / 15 tests, including the new menu-to-engine Shared Strike test.
- Combined focused regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/game/classlessBattleLifecycle.integration.test.js src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx src/screens/Battle.tactical-flow.test.jsx src/screens/Preparation.classless-gate.test.jsx` — PASS, 7 suites / 57 tests. This run includes classless engine/results/persistence, legacy Battle regressions, and gate checks.
- `git diff --check` — PASS after final test and handoff edits. No build was run because this milestone changes tests and handoff only. Full frontend suite, actual provider save/reload integration, live service, backend, and device checks were not run.

### Files, publication, and next step

- Milestone files: `frontend/src/game/classlessBattleLifecycle.integration.test.js`, `frontend/src/components/TacticalMenu.test.jsx`, and this handoff. No gameplay implementation or gate changed.
- The remaining blocker is specifically the unreachable classless `Battle.onEnd` → provider save/reload chain. Next task: extract or expose a narrow production completion boundary used by `Battle.onEnd`, then test that boundary together with `GameProvider` and mocked profile save/load while the screens remain gated. Only after a test traverses that complete chain should either gate be reconsidered.
- Code/test commit `15ac382` (`Test classless battle lifecycle composition`) contains only the new lifecycle harness and the TacticalMenu test. It and handoff-only commit `bb885a8` (`Record classless battle integration test results`) were pushed after checking the exact outgoing commits. `git fetch` and `git ls-remote` verified remote branch SHA `bb885a815465280183411255c985c0c827ce758c`, matching local HEAD with 0 ahead / 0 behind. This publication verification is being recorded in a separate handoff-only correction. Unrelated user changes remain unstaged. `work done` means ChatGPT should retrieve and review the latest published handoff.

## 18. Milestone 2 — Classless Battle Completion and Save/Reload Boundary — 2026-10-22

### Starting point and exact gap

- Started on `review/mobile-working-copy` at `5e04824a7aacc436c6db63fdfd0608c412978f4f`. Fetched `origin/review/mobile-working-copy`; remote matched HEAD (0 ahead / 0 behind). Preserved pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. No production profiles, accounts, databases, services, or configuration were touched.
- Re-read `AGENTS.md`, this handoff, and the canonical design bible. No bible text, combat baseline, perk behavior, or open question was changed.
- Verified the concrete result/completion bug: the old inline `Battle.onEnd` rechecked `sim.heroes[].hp`, even though classless engine heroes store HP at `combat.hp`. A living classless squad could therefore be turned into a defeat (`reason: "heroes"`) at the React completion boundary. Preparation and Battle gates continue to protect the live route, so this faulty callback was not reachable from the classless screen flow.

### Boundary extraction and provider test

- Extracted `stageBattleCompletion` in `frontend/src/game/battleCompletion.js`; `Battle.onEnd` now calls this production function and applies its staged mutation through the existing `GameProvider.mutate`. It resolves survival from legacy top-level HP for class heroes and nested HP for classless heroes; preserves legacy result handling; maps classless runtime HP/XP by stable `identity.id`; and does not apply legacy class XP/AP/SP/perk progression to classless heroes. Result staging occurs before mutation so rejected classless HP/XP cannot partially update the provider draft. Battle's existing `endedRef` callback guard remains.
- Added `frontend/src/context/classlessBattleCompletion.provider.test.jsx`. It renders the actual provider against a disposable in-memory mock API, invokes the same production completion boundary called by `Battle.onEnd`, waits for the actual provider's delayed save, uses the real `serializeGameState`, then unmounts/remounts and exercises provider load/`normalizeState`. Victory and defeat cases verify stable identity, nested HP/XP, no `cls`, unchanged AP/SP/owned nodes, appearance/combat settings, gold/castle/account marker, and wave outcomes. The test deliberately applies the staged draft update twice to check classless XP assignment and victory wave progression are not duplicated. This tests the production completion-to-provider save/normalize/reload boundary with mocked IO, not the gated live Battle screen or an actual remote API.
- Neither the Battle nor Preparation gate changed. No end-to-end live creation → preparation → engine → Battle callback → provider save/reload is claimed; the screen gates still prevent that route, and Shared Strike's actual tactical UI-to-engine route remains unverified in live Battle.

### Validation and publication status

- First focused run `CI=true npm test -- --watchAll=false --runInBand src/context/classlessBattleCompletion.provider.test.jsx` — FAIL (2 tests): the new test's mock had no configured API implementations after Jest mock clearing. Configured the test-local mock explicitly; production code was not changed in response. Rerun with the same command — PASS, 1 suite / 2 tests (victory and defeat).
- Regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/screens/Battle.tactical-flow.test.jsx src/context/GameProvider.test.jsx src/game/classlessPersistence.test.js src/game/classlessBattleResults.test.js src/game/classlessBattleLifecycle.integration.test.js src/context/classlessBattleCompletion.provider.test.jsx` — PASS, 6 suites / 45 tests.
- Final focused rerun after adding combat settings assertions: `CI=true npm test -- --watchAll=false --runInBand src/context/classlessBattleCompletion.provider.test.jsx` — PASS, 1 suite / 2 tests.
- `npm run build` from `frontend/` — PASS, optimized frontend build compiled successfully. Node emitted a non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after the code, focused tests, and handoff edits. No full suite, live API, production data, Android/device, or ungated live Battle test was run.
- Task files are `frontend/src/screens/Battle.jsx`, `frontend/src/game/battleCompletion.js`, and `frontend/src/context/classlessBattleCompletion.provider.test.jsx`, plus this handoff. Code-only commit `090bc92` (`Extract classless battle completion boundary`) and handoff-only commit `71b4f5d` (`Record classless completion boundary results`) were pushed. `git fetch` and `git ls-remote` verified remote SHA `71b4f5ddf8d8c3ed83414be7d5988116845e18f9`, matching local HEAD with 0 ahead / 0 behind. This remote verification is recorded in a separate handoff-only follow-up. Unrelated worktree changes remain unstaged and uncommitted.
- Remaining blocker / recommended next task: add a disposable screen-level test that exercises real classless preparation and the live Battle callback/tactical action route without bypassing production safety checks; retain both gates until that integrated journey (including the required completion/save/reload path) is demonstrated. Backend API save/load remains mocked here, so no live backend compatibility is claimed. `work done` means ChatGPT should retrieve and review the latest published handoff.

## 19. Milestone 3 — Classless Screen-Level Integration — 2026-10-22

### Starting point and screen boundary

- Fetched `origin/review/mobile-working-copy` before editing. Started on `review/mobile-working-copy` at `10865cf05f0520d116f6907c5e44e3a8bc33280a`; remote matched (0 ahead / 0 behind). Preserved pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`.
- Re-read `AGENTS.md`, this handoff, and the canonical design bible. No baseline, bible rule, perk behavior, or open design question changed. No production data, account, backend service, or real API was accessed.
- Confirmed the production gates: `Preparation.startWave` rejects classless heroes before `saveNow` or `setScreen("battle")`; if a Battle route is reached independently, `Battle`'s effect sends the screen back to preparation before constructing `Engine`. The actual normal screen journey cannot reach battle while these gates remain.

### Test and evidence

- Added `frontend/src/screens/classlessScreen.integration.test.jsx`. It renders the actual `GameProvider`, `Preparation`, and `Battle` components with a disposable normalized classless profile and mocked API. A small test-only screen harness selects the components. It verifies the real Preparation button keeps the route in preparation without saving or creating a profile; it then probes direct Battle entry and verifies Battle returns to preparation without constructing the mocked engine. The test does not weaken either production gate.
- The test harness's direct Battle-route attempt is only a guard check, not a real Preparation → Battle transition. As a result, this milestone does **not** exercise classless Battle engine combat, the real Battle tactical menu's Shared Strike callback, or `Battle.onEnd` as a live screen callback. Those are unreachable through the gated route.
- Previously added coverage remains separate: `TacticalMenu.test.jsx` routes Shared Strike from the real menu component into the real engine action; `classlessBattleCompletion.provider.test.jsx` tests victory/defeat through the production completion boundary and actual `GameProvider` save/reload with mocked API I/O. Those component tests do not combine into a single screen-level end-to-end journey and are not claimed as such.
- Neither Battle nor Preparation gate changed. No production code changed in this milestone.

### Validation, files, and next step

- New focused test first: from `frontend/`, `CI=true npm test -- --watchAll=false --runInBand src/screens/classlessScreen.integration.test.jsx` — PASS, 1 suite / 1 test.
- Relevant regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand src/screens/classlessScreen.integration.test.jsx src/screens/Preparation.classless-gate.test.jsx src/screens/Battle.tactical-flow.test.jsx src/components/TacticalMenu.test.jsx src/context/GameProvider.test.jsx src/context/classlessBattleCompletion.provider.test.jsx src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/classlessBattleLifecycle.integration.test.js` — PASS, 9 suites / 62 tests. Existing GameProvider expected mocked error logs appeared; no test failed.
- `git diff --check` — PASS after the test and handoff edits. No frontend build was run because production code did not change. No full suite, Android/device build, live API, or backend integration was run.
- Task files: new `frontend/src/screens/classlessScreen.integration.test.jsx` and this handoff. Code/test commit `b9fee29` (`Test classless screen safety boundary`) contains only the new test. It and handoff-only commit `ce86565` (`Record classless screen integration test`) were pushed. `git fetch` and `git ls-remote` verified remote SHA `ce86565ddb7dea410db8e4dee6600af27cc09c7a`, matching local HEAD with 0 ahead / 0 behind. This publication verification is being recorded in a separate handoff-only follow-up. Unrelated user-owned modifications remain unstaged and uncommitted.
- Remaining blocker / next task: the gates intentionally prevent the requested combined screen journey. A future milestone must explicitly implement and test classless battle support across the real screen path before changing either gate; until then, keep both gates. `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 20. Milestone 4 — Implement Classless Battle Support — 2026-10-22

### Starting point and verified path

- Fetched `origin/review/mobile-working-copy` before editing. Started on that branch at `27a1e4d6eaaf1c7b06b0e71421a43246c5a7ac74`; fetched remote HEAD matched. The pre-existing user changes to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx` were preserved and not staged. No branch switch, merge, deployment, live service, account, or production data was used.
- Read `AGENTS.md`, this handoff, and `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`. The approved combat baseline and bible behavior were not changed.
- The production entry gap was exactly two gates: Preparation rejected classless squads before saving/routing to Battle, and Battle redirected a classless roster to Preparation before constructing the Engine. Removed those two gates after a focused test exercised both victory and defeat through the production screen path.

### Implementation

- `Preparation.jsx` now uses its existing save-and-route action for classless squads. `Battle.jsx` now constructs the existing Engine for classless profiles and retains the existing `Battle.onEnd` → `stageBattleCompletion` → provider mutation/result route. No legacy `cls` is added.
- `TacticalMenu` and Battle's existing callback route the classless Shared Strike selection to `Engine.useHeroAbility`. The integration test clicks the real menu control, selects a test enemy, and observes the real Engine kill/reward/cooldown behavior.
- Classless result handling continues to map runtime HP and XP by stable identity, preserve nested progression/appearance and unrelated profile data, and avoid legacy class XP/AP/SP/perk progression. The test invokes Battle's completion callback a second time and verifies the wave/reward state is not applied twice.
- Fixed battle revival writeback to use nested classless HP and stable identity. Fixed shared preparation heal, revive, rest recovery, and defeat Free Life helpers to update nested HP without creating a top-level `hp` or invoking class-derived stats.
- Changed `Results.jsx` imports to relative paths because Jest could not resolve the existing `@/…` aliases for the actual Results component in the screen-level harness. Results renders for both outcomes in the integration test.

### Integration methodology and limitations

- `frontend/src/screens/classlessScreen.integration.test.jsx` renders the actual `GameProvider`, `Preparation`, `Battle`, `TacticalMenu`, and `Results` components against a disposable serialized classless profile. The test traverses Preparation → Battle → tactical Shared Strike → victory or defeat → Results → provider autosave → serialization → a newly mounted provider and normalized reload.
- The network API is mocked. The mock uses the production `serializeGameState` and returns that saved snapshot on reload; this verifies provider save/reload plus serialization/normalization, but not a live API or backend.
- The real Engine constructor and action/result methods are used. Its animation-loop `start` is stubbed to avoid browser RAF/canvas requirements; the test inserts a deterministic enemy. Victory uses the Engine's `forceWin()` test/debug action after Shared Strike; defeat uses the real enemy-attack and end checks. It does not verify natural wave spawning/animation timing or device rendering.
- The tested profile is a disposable classless profile fixture, not the `SquadSelect` creation journey. This milestone verifies the screen integration seam, not universal perk purchases/effects, natural wave balance, backend/device play, or completion of the larger classless RPG rebuild.

### Validation

- Initial focused test before code changes: `CI=true npm test -- --watchAll=false --runInBand src/screens/classlessScreen.integration.test.jsx` from `frontend/` — PASS, 1 suite / 1 test for the then-current safety gate.
- Final focused/regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx src/screens/Battle.tactical-flow.test.jsx src/screens/Preparation.classless-gate.test.jsx src/components/TacticalMenu.test.jsx src/context/GameProvider.test.jsx src/context/classlessBattleCompletion.provider.test.jsx src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/game/classlessBattleLifecycle.integration.test.js src/game/engine.classless.test.js src/game/engine.targeting.test.js src/game/engine.abilities.test.js src/game/logic.classlessHero.test.js` — PASS, 13 suites / 102 tests.
- Frontend build from `frontend/`: `npm run build` — PASS, optimized build compiled. Node emitted the existing non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after the implementation and handoff review. No full frontend suite, Android build, device, backend, or live network test was run.

### Publication and next step

- Task implementation files: `frontend/src/screens/Preparation.jsx`, `frontend/src/screens/Battle.jsx`, `frontend/src/screens/Results.jsx`, `frontend/src/game/logic.js`, `frontend/src/game/logic.classlessHero.test.js`, `frontend/src/screens/classlessScreen.integration.test.jsx`, `frontend/src/screens/Battle.tactical-flow.test.jsx`, and `frontend/src/screens/Preparation.classless-gate.test.jsx`. Unrelated user changes remain unstaged.
- Code/test commit `5ec2515fc5d5a87afa05facc1a41f4d81f9f6ce4` (`Enable classless battle screen flow`) contains only the eight task files above. It was pushed to `origin/review/mobile-working-copy`; `git fetch`, `git rev-parse`, and `git ls-remote` all verified remote SHA `5ec2515fc5d5a87afa05facc1a41f4d81f9f6ce4`. No main merge or deploy occurred.
- Next recommended task: connect the canonical universal perk progression validator/catalog to classless hero purchases and persistence, without claiming perk effects are active until their combat handlers are implemented and tested.
- The exact phrase `work done` means ChatGPT should retrieve the latest published handoff, review it, and report back.

## 23. Pass 1 combat-effect implementation review — 2026-10-22

### Checkpoint and boundaries

- Started on `review/mobile-working-copy`, HEAD `041486f30ebb9c158ba25cafaee6a3eed7f10f31`; fetched `origin/review/mobile-working-copy` and verified it matched. The pre-existing working-tree modifications to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`, were preserved and excluded from task staging. No production accounts, profiles, database records, services, or configuration were accessed. No main merge, deployment, release, or Android build occurred.
- Read `AGENTS.md`, the handoff history, and the canonical design bible. No canonical rules, baseline values, open questions, or phase gates were changed.

### Implemented and verified in this pass

- Extended the shared classless direct-hit pipeline so ordinary `_fire` attacks are explicitly classified as weapon damage and receive the same category-based calculation as Shared Strike. Base damage remains unmodified by perk ownership; weapon, situational, elemental, and critical bonuses are applied in the hit resolver to avoid reload/render compounding.
- Added tested engine handling for 22 passive node IDs: `V1`, `V2`, `V2a`, `W1`, `W2`, `W2a`, `P1`, `P2`, `P2a`, `S1`, `S2`, `S3`, `T1`, `T2`, `C1`, `W3a`, `H1`, `F1`, `N1`, `I1`, `I2`, and `N2`. Implemented behavior includes max HP, mitigation, low-health and out-of-combat sustain, crit/speed/CDR, mark/follow-through/momentum/ambush conditional damage, direct-only evasion, lifesteal, decoy, Disrupt slow, and Ensnaring Roots. Slow also reduces enemy attack cooldown progress; roots stop enemy movement for their specified duration. Classless HP display, heal, recovery, revive, battle result bounds, and free-life paths now use effective max HP for Vitality.
- Classless Perk UI now renders canonical human-readable names/descriptions and lists an effect as active only when the explicit handler registry contains it. `purchaseClasslessNode` continues to reject unhandled effects and phase-gated nodes. This does not enable any legacy class-specific perk handler for a classless hero.
- Fixed the classless evasion bonus so the purchased evasion passives do not affect area attacks. Corrected Verdant Vigor's initial wait to the specified five seconds.
- Existing classless screen lifecycle, result/save/normalize/reload path, Shared Strike UI-to-engine route, XP/AP/SP, and legacy combat behavior were regression-tested but not redesigned in this pass.

### Remaining incomplete systems and limits

- This pass does **not** complete the requested classless rebuild. Classless active abilities for V3/V3a, W3, P3/P3a, S2a/S3a, A3/A3a, T2a, C2/C2a, H2/H3, F3, and I3 are not connected to the classless TacticalMenu/engine loop, and remain unpurchasable through the production adapter. Several passive nodes also remain unhandled and unpurchasable, including Arcana element selection/chaining, Tactics aura/Opening, Conjuration Echo, Fortune Loaded Dice, and Phase 1.5/Phase 2 content. The bible's mathematically inconsistent Loaded Dice expected-value note remains unresolved and unchanged.
- The engine tests use deterministic local scenarios and the existing disposable screen integration harness; they do not verify live backend behavior, Android/device rendering, natural wave balance, or production profiles. No full frontend suite was run. Current combat effects should not be described as fully complete or release-balanced.
- The safety gates were already removed in the previously published Milestone 4 implementation, after the screen-level disposable test; neither gate was changed during this pass.

### Validation and files

- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js src/game/classlessProgression.test.js src/game/classlessBattleResults.test.js src/screens/Roster.classlessProgression.test.jsx src/game/classlessPersistence.test.js` — PASS, 5 suites / 51 tests. The first run before updating the stale C1-pending assertion failed in two assertions; the test now correctly treats C1 as active and C2 as pending.
- Combined regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx src/context/classlessBattleCompletion.provider.test.jsx src/screens/Battle.tactical-flow.test.jsx src/components/TacticalMenu.test.jsx src/game/engine.classless.test.js src/game/engine.targeting.test.js src/game/engine.abilities.test.js src/game/classlessProgression.test.js src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js src/screens/Roster.classlessProgression.test.jsx src/game/logic.classlessHero.test.js` — PASS, 12 suites / 119 tests.
- `npm run build` from `frontend/` — PASS, optimized production bundle compiled. Node emitted the existing non-fatal `fs.F_OK` deprecation warning.
- `git diff --check` — PASS after implementation and handoff edit. No full frontend suite, backend/live API, production-data, Android, or device test was run.
- Task code/test files: `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/game/classlessBattleResults.js`, `frontend/src/game/classlessCombatEffects.js`, `frontend/src/game/classlessProgression.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/heroModel.js`, `frontend/src/game/logic.js`, `frontend/src/screens/Roster.classlessProgression.test.jsx`, and `frontend/src/screens/Roster.jsx`. The known user-owned files listed above are not part of this task.

### Publication and next step

- Code/test commit `96e8b09` (`Implement additional classless combat passives`) and handoff-only commit `ee84251` (`Record classless combat passives implementation`) were pushed to `origin/review/mobile-working-copy`. Fetch and `git ls-remote` verified SHA `ee842514f8bb6fb955066d16f7e6e66a0b4ffe8b`, matching local HEAD at that verification. This final handoff-only note records the new resulting branch SHA in the Codex report.
- Next recommended task: implement the classless active ability execution and tactical status path, beginning with one cohesive branch of canonical Phase 1 active nodes, then wire and test the remaining defined current-phase passive handlers. Do not call the classless rebuild complete until all permitted nodes and abilities have real, tested runtime consumers.
- The exact phrase `work done` means ChatGPT should retrieve and review the latest published handoff.

## 24. Pass 1 continuation — Classless active ability framework and Precision branch — 2026-10-22

### Starting point and scope

- Started on `review/mobile-working-copy`, local and remote HEAD `297f5498307fad97f705cc5e798ec559f2e7733a`. Read `AGENTS.md`, this handoff, and `docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md`. Preserved pre-existing user edits to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; none were staged. No branch switch, merge, deploy, live service, account, or production data access occurred.
- Chose Precision because its two Tier III node abilities are direct single-target weapon strikes and can use the established classless weapon/crit/mitigation/death pipeline. This implements P3 Execution and P3a Killshot, including the already-supported P1/P2/P2a progression path. It does not implement the cross-branch Phantom signature recipe or other branches' active abilities.

### Verified implementation

- Added `frontend/src/game/classlessAbilities.js` as the canonical runtime definition/validation registry for this implemented slice. Unlocks are derived from stable owned node IDs, not class or title. Shared validation checks unlock, battle/alive eligibility, cooldown, valid target, and the selected ability's target-HP threshold. Definitions carry target mode, range mode, damage coefficient, cooldown, and cost.
- Connected `Engine.getHeroAbilityStatus`, target enumeration, and `useHeroAbility` to the runtime registry. Execution uses `_applyHit` with weapon damage category so weapon bonuses, crit, Precision Mark, enemy death, kill credit, and battle lifecycle use existing engine rules. Classless active use returns a structured result; Battle reports a structured failure reason through its existing action announcement. Failed use leaves target HP and cooldown unchanged. P3 is 180% weapon damage (+25% below 35% target HP), 22-second cooldown; P3a is 200% against a target below 40%, 18-second cooldown refunded on kill. Both cost zero resources. Shared Strike remains unchanged at its canonical 150%/12-second/zero-cost behavior.
- `purchaseClasslessNode` now permits P3/P3a only after the existing canonical progression validator succeeds and only because these node IDs have registered runtime handlers. Other unhandled nodes remain unavailable for purchase. `ClasslessPerkTree` identifies these two active effects accurately; TacticalMenu displays target-health eligibility reasons and routes the selected action through the existing Battle targeting callback into the Engine.
- Extended `classlessScreen.integration.test.jsx`: uses the production Preparation, Battle, TacticalMenu, Results, GameProvider, and Engine route with disposable profile state and mocked API I/O; purchases P3 with the canonical purchase adapter; selects and executes Execution in tactical targeting; finishes via the existing test/debug `forceWin()` helper; then checks save/serialization/provider normalization/reload retains node ownership and classless identity. This is a mocked screen/provider integration test, not a live backend test or natural-wave/device test. Existing integration tests separately cover defeat; this new Execution scenario covers victory.
- Existing classless Mark semantics were preserved: the first hit marks, later hits within five seconds receive +10%. P3's conditional +25% is a separate situational bonus and is resolved by the established additive situational aggregation. The classless baseline, design bible, phase gates, default sprite, and legacy class path were not changed.

### Validation

- Final combined focused/regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/engine.classless.test.js src/game/classlessProgression.test.js src/components/TacticalMenu.test.jsx src/screens/classlessScreen.integration.test.jsx src/game/engine.abilities.test.js src/game/engine.targeting.test.js src/context/GameProvider.test.jsx src/context/classlessBattleCompletion.provider.test.jsx src/game/classlessPersistence.test.js` — PASS, 10 suites / 112 tests. This includes classless definition/validation, purchase, actual tactical-to-engine actions, screen/provider mocked save-reload, and legacy engine ability/targeting coverage.
- Initial focused iteration exposed stale test expectations for the updated TacticalMenu message, Mark timing, and an uncontrolled test critical roll; tests were made deterministic and aligned with the canonical existing Mark semantics. The final combined command above passed.
- `npm run build` from `frontend/` — PASS, optimized production frontend compiled. Node emitted non-fatal `fs.F_OK` deprecation warning.
- After the structured engine result/Battle feedback adjustment, `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js src/screens/classlessScreen.integration.test.jsx src/screens/Battle.tactical-flow.test.jsx` — PASS, 3 suites / 41 tests. The combined 10-suite regression above preceded this small result-routing adjustment; these three directly affected suites were rerun afterward.
- `git diff --check` — PASS after the final code and handoff edits. No full frontend suite, Android/device test, live API/backend test, natural wave simulation, or production-data test was run.

### Remaining work and next implementation pass

- Remaining Phase 1 active nodes include W3; S2a/S3a; A3/A3a; T2a; C2a; H2/H3; F3; and I3. Current Phase 1 signatures and their shared lockout/eligibility/execution are also not delivered by this pass. Active abilities from branches other than Precision are not exposed. Loaded Dice's inconsistent expected-value wording remains unresolved. Phase 1.5 Pyromancer and all Phase 2 summons remain gated; no gate was opened. The four-pass roadmap remains: (1) finish classless hero/perk/ability/combat mechanics, (2) dedicated VFX and combat feedback, (3) spells/Library/Academy, (4) equipment/items and guarded automatic consumables at the previously specified 15% HP threshold.
- Recommended next Codex task: implement the next cohesive Phase 1 active branch using this registry and validation/execution seam, with tests through TacticalMenu, engine state/results, and persistence as required. Do not call Pass 1 complete while other current-phase active mechanics/signatures remain absent.

### Copilot Analyst Handoff — independent review assignment

```text
Repository: https://github.com/demonanic/Demonanic
Branch: review/mobile-working-copy
Implementation commit: 4cab6f01f9f46585a0ccb88c6d4e43274f15fe0a (`Implement classless Precision active abilities`).
Current published HEAD at the time of this handoff update: 4cab6f01f9f46585a0ccb88c6d4e43274f15fe0a; retrieve and verify the latest origin/review/mobile-working-copy HEAD before reviewing.
Read: docs/CHATGPT_HANDOFF.md (section 24 and latest section) and docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md.

Demonanic is a mobile RPG/tower-defense game. The classless rebuild gives heroes a shared baseline and universal perk progression while preserving legacy class-based heroes/saves. The four major passes are: (1) classless progression, perks, abilities, and combat; (2) VFX/combat feedback; (3) spells, Library, and Academy; (4) equipment/items, including guarded automatic consumables at the established 15% HP threshold. Before this task, the classless model, persistence, Battle screen route, XP/AP/SP, canonical perk purchase adapter, 22 passive handlers, and weapon/status combat pipeline existed. This task added reusable runtime ability definitions/validation and connected Precision P3 Execution and P3a Killshot from TacticalMenu through Engine execution; P3/P3a purchases require registered effects.

Act as an independent reviewer only. Retrieve the handoff and design bible from review/mobile-working-copy, verify the actual HEAD, inspect source files for every claim, and do not edit or commit during this initial review. Codex remains implementation owner unless the user later assigns you coding work. Do not change canonical rules, resolve open questions, enable gated content, or disturb user work, existing saves, legacy heroes, or production data. If repository access fails, state the exact limitation; do not claim source inspection.

Inspect at least frontend/src/game/classlessAbilities.js, frontend/src/game/engine.js, frontend/src/game/classlessProgression.js, frontend/src/components/TacticalMenu.jsx, frontend/src/components/ClasslessPerkTree.jsx, and tests named in handoff section 24. Independently map every current-phase canonical perk and ability to its stable ID, prerequisites/cost/phase, actual runtime consumer, UI route, persistence need, and test evidence. Specifically trace TacticalMenu → eligibility validation → Engine execution → combat result/state update → save/reload for P3 and P3a; verify each selected ability has a real consumer; inspect failure atomicity, target/range/death handling, cooldown/refund and resource behavior, damage category/stacking, repeated activation, and legacy compatibility. Distinguish verified production behavior from mocks/debug helpers/assumptions. Identify concrete gaps with paths and evidence, prioritize by player impact and technical risk, and recommend the next cohesive current-phase implementation pass. Do not change code in this review.

Remaining work includes current Phase 1 active nodes W3, S2a/S3a, A3/A3a, T2a, C2a, H2/H3, F3, I3; Phase 1 signatures and their shared lockout; other current-phase effects not wired; and the unresolved Loaded Dice expected-value inconsistency. Pyromancer is Phase 1.5 gated; summons/related content remain Phase 2 gated. Recommend one next branch/mechanic set without entering the VFX, spells/Library/Academy, or equipment/items passes.
```

### Publication and working tree

- Intended task files are `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/classlessProgression.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/components/TacticalMenu.jsx`, `frontend/src/components/TacticalMenu.test.jsx`, `frontend/src/screens/classlessScreen.integration.test.jsx`, and this handoff. The known user-owned `ROADMAP.md`, `PerkTree.jsx`, `perks.js`, and `PerkTree.test.jsx` are excluded.
- Code/test commit `4cab6f01f9f46585a0ccb88c6d4e43274f15fe0a` (`Implement classless Precision active abilities`) was pushed to `origin/review/mobile-working-copy` after fetching and confirming 0 behind / 1 ahead; the push succeeded. Verify the final branch SHA after the separate handoff-only commit. No main merge or deploy occurred. `work done` means ChatGPT should retrieve and review the latest published handoff and report back.

## 25. Pass 1 continuation — Vanguard active abilities — 2026-10-22

### Checkpoint, choice, and implementation

- Started on `review/mobile-working-copy`, HEAD `29a6d70f64702d6fac90d1242ea1dea0f9edcc2f`; fetched `origin/review/mobile-working-copy` and verified 0 ahead / 0 behind. Read `AGENTS.md`, the newest handoff section, and the canonical design bible. Section 24 provided Copilot review instructions but no independent findings/report was available. Preserved existing user edits to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; no production services or data were accessed.
- Selected Vanguard after Precision because both canonical Tier III actions fit existing single-target weapon hit/death/crit/kill attribution and hero runtime paths. Completed both Vanguard active nodes while retaining P3/P3a behavior.
- Extended `frontend/src/game/classlessAbilities.js` and the existing Engine adapter with V3 Cleaving Strike (160% direct weapon damage to selected target, 40% to one nearest adjacent target; 20s cooldown; 0 resource) and V3a War Cry (15% attack speed for six seconds to living allies within 8 units; 30s cooldown; 0 resource). V3 primary/secondary hits use `_applyClasslessHit`, so direct weapon passives, crits, kill credit, and death resolution follow the common pipeline. The adjacent radius uses the existing Engine cleave helper's 55 world units because the bible says “adjacent” but does not state a numeric radius; this is the only implementation assumption and is kept in the ability definition.
- War Cry is a targetless action through the same validator/result path. Battle’s existing tactical action route applies a six-second runtime buff and reports the result; basic-attack cooldown progress uses the buff, excluding legacy Mage support cadence. Same-type War Cry effects do not add together, and the combined classless passive plus aura attack speed is clamped to the bible's 20% cap. TacticalMenu reports active duration/cooldown; the PerkTree marks both nodes active only because runtime handlers are registered. Ability ownership remains canonical node IDs in progression serialization; temporary battle buffs are runtime state only.
- No other abilities, signatures, passive nodes, phase gates, baseline values, default appearance, or legacy class progression were changed. Existing Copilot section 24 has been superseded by the updated standalone review assignment below.

### Verified player path and tests

- `frontend/src/screens/Roster.classlessProgression.test.jsx` purchases V3 and V3a through the real Roster/ClasslessPerkTree UI and provider mutation, saves, reloads, and verifies node ownership.
- `frontend/src/components/TacticalMenu.test.jsx` routes V3 target selection to real Engine hits for primary/adjacent targets and routes targetless V3a directly to the Engine. `frontend/src/screens/classlessScreen.integration.test.jsx` purchases V3a through the canonical adapter in a disposable profile, executes War Cry from the actual Battle TacticalMenu, completes battle with the test/debug `forceWin()` helper, and checks mocked provider save/reload retains identity and owned node ID. It is not a natural wave run or live API test.
- Combined focused/regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/classlessProgression.test.js src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx src/screens/classlessScreen.integration.test.jsx src/game/engine.abilities.test.js src/game/engine.targeting.test.js src/screens/Battle.tactical-flow.test.jsx src/context/GameProvider.test.jsx src/context/classlessBattleCompletion.provider.test.jsx` — PASS, 10 suites / 134 tests. Includes prior Precision/Shared Strike and legacy ability/targeting regressions.
- Roster purchase/save/reload test from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/Roster.classlessProgression.test.jsx` — PASS, 1 suite / 2 tests. An initial run failed only because the new assertion shortened “6 seconds” to “6s”; the assertion was aligned with canonical catalog text and the rerun passed.
- New screen integration test initially omitted the engine HUD refresh before checking TacticalMenu; after adding that normal UI refresh, focused command `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx -t 'purchased Vanguard War Cry'` — PASS, 1 test (3 skipped by test filter). No product defect remained.
- `npm run build` from `frontend/` — PASS, optimized production build compiled; Node emitted non-fatal `fs.F_OK` deprecation warning. `git diff --check` — PASS after final implementation and handoff content edits; the staged implementation diff also passes `git diff --cached --check`.
- Not verified: full frontend suite, Android/device rendering, live backend/API, production profiles, natural wave balance, or device performance. The new profile/battle integration uses mocked API and a debug victory helper. No main merge or deploy occurred.

### Remaining work and next task

- Implemented classless node abilities are now P3, P3a, V3, and V3a. Current Phase 1 active nodes still missing runtime consumers include W3, S2a/S3a, A3/A3a, T2a, C2a, H2/H3, F3, and I3. Phase 1 signatures and their 8-second shared lockout remain incomplete. Passive holes include Arcana element/chain behavior, Tactics Opening/Formation effects, Conjuration Echo, Fortune Loaded Dice, and other nodes without a registered handler. Loaded Dice's expected-value inconsistency remains unresolved. Pyromancer stays Phase 1.5 gated; Construct, Familiar, Primal Bond, Summoner, and Beastmaster stay Phase 2 gated.
- Recommended next Codex scope: Warden Interpose (W3), using a timed single-ally mitigation state integrated into the existing mitigation cap and ally selection, then real TacticalMenu/Engine tests. Continue Pass 1 afterward; do not start the VFX, spells/Library/Academy, or equipment/items roadmap passes.

### Updated Copilot Analyst Handoff

```text
Repository: https://github.com/demonanic/Demonanic
Branch: review/mobile-working-copy. Vanguard implementation commit: 4f8c5878abd15b3dcd6b1f5dd83e82b08ffb8ad5 (`Implement classless Vanguard abilities`). Retrieve and verify the latest remote HEAD before review; at this handoff update the published branch points to that implementation commit, with a handoff-only follow-up commit to follow.
Read latest docs/CHATGPT_HANDOFF.md sections 24–25 and docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md.

Demonanic is a mobile RPG/tower-defense game. The classless rebuild uses a shared hero baseline and universal perk tree while retaining legacy heroes and profile systems. Roadmap passes: (1) classless progression/perks/abilities/combat; (2) VFX and combat feedback; (3) spells/Library/Academy; (4) equipment/items and guarded automatic consumables at the approved 15% HP threshold. The classless foundation includes hero model/persistence, Battle flow, XP/AP/SP, canonical perk validation, 22 passive handlers, and a shared weapon/status damage pipeline. Runtime node abilities presently include Precision P3 Execution/P3a Killshot and Vanguard V3 Cleaving Strike/V3a War Cry.

Act as an independent read-only reviewer. Retrieve the latest handoff and bible from review/mobile-working-copy, verify actual HEAD, and inspect the source files and tests for all claims. Codex remains implementation owner; do not edit or commit during this review. Do not invent or rewrite rules, resolve open bible questions, unlock gated content, or disturb user changes, saves, legacy heroes, or production data. If repository access fails, state the exact limitation rather than claiming source review.

Trace each new Vanguard ability from canonical definition and purchase prerequisites through ClasslessPerkTree/Roster, TacticalMenu, Battle callbacks, Engine validation/execution, combat state/results, and save/reload as applicable. Verify V3 primary/adjacent damage, the existing 55-unit adjacency assumption against the bible, weapon/crit/passive stacking, kill handling, and cooldown. Verify V3a's 8-unit ally radius, six-second duration, 15% attack-speed application, 20% combined speed cap, cooldown, same-type stacking behavior, dead-hero checks, and effect on legacy actors. Check invalid-use atomicity, repeat activation, status/error feedback, and compatibility with Shared Strike/P3/P3a. Distinguish production runtime from mocks/debug helpers.

Independently map all current-phase perks and active/signature abilities to stable ID, prerequisites/cost/phase, actual runtime handler, UI path, persistence need, and tests. Identify concrete defects or missing coverage with exact source paths and evidence, prioritize by player impact and technical risk, then recommend the next cohesive Phase 1 pass. Current ability gaps include W3, S2a/S3a, A3/A3a, T2a, C2a, H2/H3, F3, I3, and Phase 1 signatures/shared lockout; passive and Loaded Dice gaps are listed in section 25. Pyromancer remains Phase 1.5 gated; summons remain Phase 2 gated. Do not change code during this initial review.
```

### Files and publication

- Intended implementation/test files: `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/components/TacticalMenu.jsx`, `frontend/src/components/TacticalMenu.test.jsx`, `frontend/src/screens/Roster.classlessProgression.test.jsx`, `frontend/src/screens/classlessScreen.integration.test.jsx`, and this handoff. Pre-existing user files remain outside staging.
- Code/test commit `4f8c5878abd15b3dcd6b1f5dd83e82b08ffb8ad5` (`Implement classless Vanguard abilities`) was pushed to `origin/review/mobile-working-copy` after fetching and confirming 0 behind / 1 ahead. The handoff will be published separately and the resulting branch SHA verified after that push. No main merge or deploy occurred. `work done` means ChatGPT should retrieve and review the latest published handoff and report back.

## 26. Phase 1 combat continuation — Warden and Hemomancy survival actions — 2026-10-22

### Starting checkpoint and scope

- Started on `review/mobile-working-copy` at `fd3370d94a936ee6fa6404af9c487d91f1c1698f`; fetched `origin/review/mobile-working-copy` and verified 0 ahead / 0 behind. Preserved pre-existing user changes to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`; none are task files. No production accounts, profiles, services, or databases were accessed.
- Read `AGENTS.md`, this handoff, and the canonical design bible. Section 25's Vanguard abilities and the 22 listed passive consumers were verified in source. No Copilot review findings were present in the handoff.
- This is a bounded continuation, **not Phase 1 completion**. It adds Interpose (W3), Blood Price (H2), and Crimson Covenant (H3) to the existing registry/Engine. No signature, phase gate, catalog identity, baseline, design-bible text, or unrelated roadmap feature changed.

### Implemented behavior

- W3 is a targetless TacticalMenu action through the existing classless registry and `Engine.executeClasslessAbility`. It selects the living non-caster ally with the lowest current HP within the Engine's allied-support radius; ties use runtime hero index. It falls back to the caster if no other ally qualifies, applies 25% reduction for 5s, and starts a 24s cooldown only on successful use. The effect combines additively with Warden progression mitigation and clamps to the shared 30% cap. The effect also works for a legacy ally runtime actor without changing that hero's class or saved fields.
- The bible says “in range” for W3 but gives no numeric radius. The implementation centralizes and displays 150 battlefield units, using the existing Engine allied-support radius as a reversible assumption. This value needs owner/design confirmation before being treated as canonical.
- H2 is registered as an implemented classless progression handler. While owned, successful active ability uses (including Shared Strike) cost 5% of pre-action current HP and add +12% to the situational damage category for active hits. The bible does not name a category for this bonus; assigning it to the existing situational category is a reversible implementation assumption that needs reviewer/owner confirmation. The use is rejected before effects/cooldown/resource changes if that cost would leave less than 1 HP. Healing/weapon-only rules remain separated; the +12% is not a passive basic-attack bonus.
- H3 is registered as a targetless 30s action. For 6s it doubles H1 direct-weapon lifesteal, still subject to the existing combined 4% max-HP-per-second sustain cap, and activates the existing lethal-resolution survival clause. A lethal hit saves the hero at 1 HP once, then starts the 60s shared survival timer. H3 cooldown recovery uses the existing active-cooldown path; the 60s internal timer is not reduced by CDR. Failed use does not set the effect or cooldown.
- TacticalMenu now reports Blood Price's health-cost failure as `HEALTH TOO LOW`. Ability ownership remains stable node IDs and temporary effect state is runtime-only. The previous classless completion/save/reload flow and legacy class ability route were not modified.

### Tests and validation

- Focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/engine.classless.test.js src/game/classlessProgression.test.js src/components/TacticalMenu.test.jsx` — PASS, 4 suites / 80 tests. Covers registry/unlocks, W3 selection/fallback/duration/mitigation cap, H2 damage/cost/rejection atomicity, H3 lifesteal/lethal save/60s timer, purchase prerequisites, and TacticalMenu → Engine W3 activation.
- Regression command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.abilities.test.js src/game/engine.targeting.test.js src/screens/classlessScreen.integration.test.jsx src/screens/Battle.tactical-flow.test.jsx src/context/GameProvider.test.jsx src/context/classlessBattleCompletion.provider.test.jsx` — PASS, 6 suites / 60 tests.
- `npm run build` from `frontend/` — PASS, optimized frontend compiled. Node emitted the existing non-fatal `fs.F_OK` deprecation warning. `git diff --check` — PASS. Android/device, live backend, production profile, and natural-wave play were not run.
- The existing `classlessBaselineSimulation.test.js` constructs legacy archer heroes and replaces their derived stats. It is not evidence for classless Phase 1 balance. No valid classless Phase 1 balance simulation was completed in this continuation; a deterministic harness using actual `createHeroModel`, `buildWave`, and the production `Engine` remains required before balance can be claimed.

### Current Phase 1 coverage and remaining gaps

- Runtime node abilities currently registered: P3, P3a, V3, V3a, W3, H3. H2's active modifier is purchasable and active through the combat calculation. The prior 22 passive handlers remain, now including H2.
- Still missing or requiring independent canonical verification: Shadowcraft Smoke Bomb (S2a) and Vanish (S3a); Arcana Arcane Spark/Elementalism/Chain Spark and Arcane Channel/Meteor (A1/A2/A2a/A3/A3a); Rally/Opening/Formation (T2a/T3/T3a); Echo/Ward (C2/C2a); Loaded Dice/Jackpot (F2/F3); Phantom Strike (I3); and all six Phase 1 signatures with shared 8s lockout. The bible's Loaded Dice expected-value note remains inconsistent and F2 stays unavailable; no interpretation was chosen. Explicit Phase 1.5 Pyromancer and Phase 2 construct/familiar/spirit-beast content remains gated.
- Canonical Phase 1 acceptance requirements still not established include the full damage-category and critical caps, guaranteed-crit consumption, untargetability/retargeting, independent mark/Echo/root expiry, control lookback/Opening, aura and shield interactions, signature lockout, complete passive-to-runtime mapping, save/reload for all new effects, and comprehensive legacy/profile regression.
- Accordingly, this is useful playable progress but does **not** meet the definition of done for Pass 1 and is not evidence that the game is ready for the VFX pass. Next task: finish the connected Phase 1 defensive/support/status framework and signature eligibility/lockout; then complete remaining Arcana/offense systems and run the real classless balance harness.

### Updated Copilot Analyst Handoff

```text
Repository: https://github.com/demonanic/Demonanic
Authorized branch: review/mobile-working-copy. The Warden/Hemomancy implementation commit is `fa7411fa701f77ea4e3713306461af74a15c9828`; verify the latest remote HEAD before reviewing because the handoff-only publication commit follows it.
Read docs/CHATGPT_HANDOFF.md section 26 and docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md.

Demonanic is a mobile RPG/tower-defense game. Pass 1 is the classless hero/perk/ability/combat rebuild; later passes are (2) VFX/combat feedback, (3) spells/Library/Academy, and (4) equipment/items. Before this continuation, the classless model, progression/persistence, battle route, shared Engine, 22 passive handlers, and Precision/Vanguard abilities existed. This continuation adds Warden W3 Interpose, Hemomancy H2 Blood Price, and H3 Crimson Covenant, using the existing ability registry and Engine.

Perform an independent read-only review; Codex remains implementation owner. Retrieve the latest published handoff and bible, verify HEAD, and inspect actual source/tests. Do not edit or commit during this initial review. Preserve user changes, old saves, legacy heroes, and production data. Do not reinterpret canonical rules or open phase gates; if repository access fails, state the exact limitation.

Trace W3/H2/H3 from canonical node purchase/unlock and ClasslessPerkTree through TacticalMenu → Engine eligibility/execution → damage/state update. Check W3 target choice, the assumed 150-unit radius, duration, cooldown, combined mitigation cap, and legacy ally behavior. Check H2's 5% current-HP cost, below-1 rejection atomicity, +12% situational-category assumption for active damage including Shared Strike, and interactions with other bonuses. Check H3 lifesteal multiplier/sustain cap, lethal ordering, one survival per 60s, active cooldown/CDR, repeat use, death, and cleanup. Distinguish tests/mocks from actual gameplay. Review focused tests and identify missing UI, integration, save/reload, signature, acceptance, and balance coverage with exact paths/evidence.

Independently map all 43 canonical Phase 1 perk nodes, all Phase 1 active abilities, and six signatures to prerequisites/cost/phase, runtime consumer, UI, persistence, and test evidence. Report concrete prioritized defects and recommend the next cohesive Phase 1 pass. Remaining gaps are summarized in handoff section 26. Keep Pyromancer Phase 1.5 and companion content Phase 2 gated; do not enter the VFX, Library/Academy, or equipment/items passes.
```

### Publication and next step

- Intended implementation files: `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/classlessCombatEffects.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/components/TacticalMenu.jsx`, and `frontend/src/components/TacticalMenu.test.jsx`. The existing user-owned changes listed above are excluded.
- Implementation commit `fa7411fa701f77ea4e3713306461af74a15c9828` (`Implement Warden and Hemomancy combat actions`) was pushed to `origin/review/mobile-working-copy`. `git fetch`, `git rev-parse`, and `git ls-remote` verified remote SHA `fa7411fa701f77ea4e3713306461af74a15c9828`, 0 ahead / 0 behind at that checkpoint. This handoff is being published separately. No main merge, deploy, production-data access, or Android build occurred.
- The exact phrase `work done` means ChatGPT should retrieve and review the latest published handoff and report back.

## 27. Phase 1 continuation — untargetability and mobility — 2026-10-22

### Starting checkpoint and selected work

- Started on `review/mobile-working-copy`, local HEAD `bd0ee92e9d1a8c943a8c0f683fdce5fe7b59edba`, matching the then-current remote. Fetched `origin/review/mobile-working-copy` before final review; it remained 0 ahead / 0 behind at that checkpoint. Preserved the pre-existing user changes in `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; none are part of this implementation. No production profiles, accounts, backend records, or live services were accessed.
- Read `AGENTS.md`, the latest handoff, and the canonical design bible. Continued with the connected untargetability/mobility group: S2a Smoke Bomb, S3a Vanish, and I3 Phantom Strike. This was a bounded feature slice within Pass 1, not completion of Phase 1.

### Implemented behavior

- Added S2a, S3a, and I3 to the existing `classlessAbilities.js` registry. Their unlock remains stable node ownership through the existing progression validator, so the three implemented IDs become purchasable under their canonical prerequisite, AP, and level validation. They require no resource cost.
- Smoke Bomb starts its 20-second cooldown and grants 1.5 seconds of untargetability. Vanish starts its 25-second cooldown, grants 3 seconds of untargetability, and arms one next direct-hit bonus. Both are self actions in the existing TacticalMenu → Battle → Engine action path.
- The shared Engine target selectors skip an untargetable hero for direct enemy attacks. Enemy tactical target selection, melee retargeting, mage targeting, and in-flight enemy bolts use the same runtime flag; bolts retarget during the next Engine update and at impact if the prior target became untargetable. Area damage still resolves against the hero. This state is runtime-only and ends with the battle; it does not cleanse or pause other effects.
- Vanish's canonical +80% bonus is tagged situational in the bible, so it follows the shared +50% situational category cap. The bonus applies once to the next direct hit, then clears; area and damage-over-time events do not consume it. There is no production damage-over-time consumer in the current Engine to validate yet.
- Phantom Strike validates a live enemy in the normal hero attack range, checks whether the enemy is currently targeting the caster, teleports behind it, and executes 150% weapon damage through the common weapon/crit/mark/kill pipeline. Its +50% conditional bonus applies only when the target was not targeting the caster. The bible gives no numeric placement offset or precise facing rule; the placement is isolated as a reversible 30-unit offset using the existing hero/defender body interaction radius, with enemies' increasing-y movement defining the rear as the smaller-y side. This placement interpretation needs review before being treated as a canonical spatial rule.
- No legacy class, profile schema, Shared Strike behavior, phase gate, default sprite, canonical design text, or unrelated UI was changed. TacticalMenu required no production UI change: its existing self-action and enemy-target callbacks route these definitions to the Engine.

### Tests and validation

- From `frontend/`, focused command: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx` — PASS, 3 suites / 58 tests. This final focused run covers ability definitions, targeting/expiry, one-time Vanish damage, AoE and bolt retarget behavior, both Phantom conditional outcomes, TacticalMenu callbacks into the Engine, and existing Shared Strike/Vanguard/Warden action regressions.
- From `frontend/`, regression command: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx src/game/engine.abilities.test.js src/game/engine.targeting.test.js` — PASS, 3 suites / 26 tests. The classless screen integration remains a disposable profile/provider test with mocked API I/O. No production or live backend flow was exercised.
- From `frontend/`, broader persistence/progression regression command: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/classlessScreen.integration.test.jsx src/screens/Battle.tactical-flow.test.jsx src/game/engine.abilities.test.js src/game/engine.targeting.test.js src/game/classlessProgression.test.js src/game/classlessBattleResults.test.js src/game/classlessPersistence.test.js` — PASS, 7 suites / 84 tests. This run preceded the final small Phantom target-state helper adjustment; the final focused Engine suite and final production build ran afterward.
- `npm run build` from `frontend/` — PASS after the final Engine changes; optimized frontend bundle compiled. Node emitted the existing non-fatal `fs.F_OK` deprecation warning. `git diff --check` — PASS before the handoff update; rerun after final edits and before publication.
- No full frontend suite, Android build/device combat, live backend, natural-wave play, production profile, or classless balance simulation was run. The existing baseline simulation is not classless evidence. Numerical balance is therefore unestablished.

### Current Phase 1 status and remaining gaps

- Registered active node abilities now include P3, P3a, V3, V3a, W3, S2a, S3a, I3, and H3; H2 has its previously documented active modifier/health cost. Shared Strike remains the creation ability. The previously registered passive-effect list contains 23 node IDs, but that count is not proof that every passive matches its canonical effect or cap.
- Still missing current-phase combat paths include Arcana A1/A2/A2a/A3/A3a; Tactics T2a/T3/T3a; Conjuration C2/C2a; Fortune F3; and the six Phase 1 signatures plus their shared eight-second lockout. F2 Loaded Dice remains gated because its expected-value statement is internally inconsistent. The prior H2 situational-category and W3 range assumptions remain unresolved review items from section 26. The explicit Phase 1.5 and Phase 2 content remains gated.
- The 43 Phase 1 node mapping, all global damage/category/crit/sustain/shield/control acceptance tests, signature behavior, full save/reload of all effect state, classless balance simulation, and Android/device behavior are not complete. Do not report the Phase 1 combat system or classless rebuild as complete or ready for the visual-effects pass.
- Next cohesive implementation: finish the Tactics/Conjuration support and control consumers (Rally, Opening, Formation, Echo, and Ward) with canonical lookback, aura, shield, attribution, and expiry tests; then complete Arcana and remaining Fortune/signature dependencies. Keep Loaded Dice gated until its wording is approved. The four-pass roadmap remains unchanged: (1) finish classless progression/perks/abilities/combat; (2) dedicated VFX and combat feedback; (3) spells/Library/Academy; (4) equipment/items and the previously approved guarded consumable behavior.

### Copilot Analyst Handoff — latest implementation review

```text
Repository: https://github.com/demonanic/Demonanic
Branch: review/mobile-working-copy. Verify the latest published HEAD before review; section 27's implementation is intended to publish after code validation, followed by a handoff-only commit.
Read docs/CHATGPT_HANDOFF.md sections 26–27 and docs/design/DEMONANIC_PERK_ABILITY_DESIGN_BIBLE_v1.0.md.

Demonanic is a mobile RPG/tower-defense game. Pass 1 is the classless hero, perk, active ability, signature, and combat rebuild. The later passes are (2) visual effects/combat feedback, (3) spells/Library/Academy, and (4) equipment/items. The existing foundation includes classless identity, progression, persistence, Battle/Engine routing, 23 registered passive IDs, and active node abilities P3/P3a, V3/V3a, W3, S2a/S3a, I3, and H3 (with H2's active modifier). This continuation adds runtime untargetability/retargeting, Vanish's next-hit effect, and Phantom Strike's weapon hit and conditional damage.

Perform an independent read-only review; Codex remains implementation owner. Retrieve the current handoff and canonical bible from this branch, verify current HEAD, and inspect source/tests for each claim. Do not edit or commit during the initial review. Preserve user changes, legacy saves/heroes, and production data. Do not invent rules, resolve open questions, or enable gated content. If repository access fails, state the exact limitation rather than claiming source review.

Inspect frontend/src/game/classlessAbilities.js, frontend/src/game/engine.js, frontend/src/game/classlessProgression.js, frontend/src/game/classlessCombatEffects.js, frontend/src/components/TacticalMenu.jsx, frontend/src/components/ClasslessPerkTree.jsx, and the ability/Engine/TacticalMenu tests. Trace S2a/S3a/I3 from canonical purchase eligibility through TacticalMenu → Engine validation/execution → combat state/result. Check target selection, same-update AI and projectile retargeting, AoE behavior, effect expiry/cleanup, Vanish's one-time damage and the +50% situational cap, Phantom's targeting condition, teleport direction/offset assumption, cooldowns, failure atomicity, kill attribution, persistence needs, and legacy targeting. Distinguish real production paths from test fixtures.

Independently map each of the 43 Phase 1 perk nodes, each Phase 1 active ability, and all six Phase 1 signatures to canonical prerequisites/cost/phase, actual runtime consumer, UI path, persistence need, and tests. Identify concrete defects or missing acceptance coverage with source paths and evidence; prioritize by player impact and technical risk. Report the 30-unit Phantom placement interpretation for design review. Recommend the next cohesive current-phase implementation. Keep Pyromancer Phase 1.5 and companion content Phase 2 gated; do not start VFX, spells/Library/Academy, or equipment/items. Do not change code during this initial review.
```

### Publication and repository safety

- Intended task files: `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/components/TacticalMenu.test.jsx`, and this handoff. `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx` are pre-existing user work and must remain unstaged.
- No main merge, deploy, release, Android build, or production data access occurred. The implementation commit and separate handoff-only commit are pending publication; record their exact SHAs after commit/push verification. The exact phrase `work done` means ChatGPT should retrieve and review the latest published handoff.

## 28. Rally validation on the advanced branch — 2026-10-22

### Repository checkpoint

- The requested expected starting SHA `41325f84fe6d1169c7cc970b00aa9babde19c903` was the fetched remote tip, not the initial local tip. Local HEAD began at `bd0ee92e9d1a8c943a8c0f683fdce5fe7b59edba`, three commits behind. Preserved the entire dirty worktree (including user files and the preceding local continuation edits) with a temporary stash, fast-forwarded only `review/mobile-working-copy` to `41325f84fe6d1169c7cc970b00aa9babde19c903`, then reapplied the stash. No content was discarded. At validation time local HEAD matched `origin/review/mobile-working-copy`; unrelated working-tree changes remain unstaged.
- Reviewed Rally's definition/execution and cooldown fields in `frontend/src/game/classlessAbilities.js` and `frontend/src/game/engine.js`, derived HP in `frontend/src/game/heroModel.js` and Engine classless derivation, cooldown recovery/passive ownership in `frontend/src/game/classlessCombatEffects.js` and `frontend/src/game/classlessProgression.js`, tactical action presentation in `frontend/src/components/TacticalMenu.jsx`, the Rally fixture in `frontend/src/game/engine.classless.test.js`, and canonical Rally text in the design bible.

### Findings and test correction

- Rally's runtime behavior is correct: T2a ownership is required; it targets living heroes (including the caster) within 8 battlefield units; heals each by 10% of that hero's derived maximum HP; clamps at maximum HP; does not revive zero-HP heroes; uses no mana/resource cost; and starts its cooldown only after successful execution. This review did not change Rally's runtime code.
- The original Rally test owned T1 Readiness but expected the full 22-second cooldown. The Engine correctly applies Readiness's 5% active cooldown recovery, yielding `22 * 0.95 = 20.9` seconds. Updated the expectation to 20.9 and expanded the fixture to verify a 295-HP ally clamps to 300 and a dead ally remains at zero. Also corrected a local ability-registry assertion to include T2a after the fetched branch advanced; that assertion also includes the preceding uncommitted local mobility abilities, so it is specific to the combined worktree, not a standalone test change suitable for publication by itself.
- No Rally production defect was found. Legacy class combat, live API/profile persistence, natural-wave gameplay, and Android/device behavior were not exercised by this validation.

### Validation and publication

- First focused run, before correcting the stale cooldown expectation: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js -t Rally` — FAIL, 1 failed test. Actual cooldown was 20.9; test expected 22.
- After correcting the cooldown and local registry assertion: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/engine.classless.test.js src/game/classlessProgression.test.js src/components/TacticalMenu.test.jsx` — PASS, 4 suites / 87 tests. This run preceded the added near-maximum-HP assertion.
- Final focused Rally run after adding the clamp/death assertions: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js -t Rally` — PASS, 1 passed / 29 skipped.
- `npm run build` from `frontend/` — PASS, production bundle compiled; existing non-fatal Node `fs.F_OK` deprecation warning appeared. `git diff --check` — rerun after this handoff edit before final reporting.
- No commit or push was made for the validation changes. The only remotely published Rally implementation remains at `41325f84fe6d1169c7cc970b00aa9babde19c903`. The local test edits share files with the preceding uncommitted mobility continuation, and the handoff contains its local-only section 27; publishing those mixed files/notes as part of this narrowly scoped validation would include unrelated uncommitted work. Preserve them locally and publish only after they are separated and validated. No main merge or deployment occurred.

## 29. Living handoff workflow checkpoint — 2026-10-23

- Verified branch: `review/mobile-working-copy`. Local HEAD is `41325f84fe6d1169c7cc970b00aa9babde19c903`; `git ls-remote origin refs/heads/review/mobile-working-copy` returned the same SHA, so local HEAD and the live remote branch are synchronized (0 ahead / 0 behind). No fetch, commit, or publication was performed during this checkpoint. Fetch again before any future push.
- Current worktree inventory: modified `ROADMAP.md`, `docs/CHATGPT_HANDOFF.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/components/TacticalMenu.test.jsx`, `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/game/engine.js`, and `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`. The four previously identified user-owned files (`ROADMAP.md`, `PerkTree.jsx`, `perks.js`, and untracked `PerkTree.test.jsx`) remain present. The remaining modified implementation/tests include local continuation work and the Rally assertion edits; they have not been classified as independently publishable, and none was staged or altered for this checkpoint.
- Reviewed the complete tracked diff summary and the local classless ability/Engine/TacticalMenu test diffs. Section 27 is a local-only mobility implementation report whose source changes remain uncommitted in the mixed worktree. Section 28 records the Rally validation and its test correction. These must not be represented as published source until the related code is separately reviewed and committed.
- Rally validation evidence is as recorded in section 28: focused Rally test PASS (1 passed / 29 skipped); focused regression PASS (4 suites / 87 tests); `npm run build` PASS with a non-fatal Node `fs.F_OK` deprecation warning; `git diff --check` PASS. The first Rally test attempt failed on the stale 22-second expectation; T1 Readiness correctly reduces it to 20.9 seconds. No additional test or build was run in this checkpoint. TacticalMenu-to-Rally interaction, live profile persistence/backend, and Android/device behavior remain unverified.
- Ran `git diff --check` on 2026-10-23; PASS (no output). No tests or build were run during this handoff-only checkpoint.
- Publication is intentionally blocked: the handoff's uncommitted appended sections 27–29 are in one contiguous append, and section 27 documents source implementation that is still local alongside the Rally assertion edits. Committing the whole handoff-only file would publish that mixed continuation report; staging gameplay files or reconstructing a partial handoff patch would violate this checkpoint's safety boundary. Nothing was staged, committed, or pushed. The handoff update remains local. Exact next safe step: separate and validate the local continuation against its source changes, then publish the appropriate implementation and handoff using the repository's protected-file workflow; do not publish the current handoff alone.
- Recommended next Phase 1 gameplay task, after that repository checkpoint is safely published: implement and test the connected Tactics/Conjuration support-control group (Opening, Formation, Echo, and Ward) around the already validated Rally action. Keep Loaded Dice gated pending an approved resolution of its documented expected-value inconsistency.
- `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review the recorded evidence, and report back. This checkpoint is local-only and is not retrievable from GitHub yet.

## 30. Publish mobility implementation and Rally validation — 2026-10-23

### Implementation and separation decision

- Continued from the synchronized `review/mobile-working-copy` base `41325f84fe6d1169c7cc970b00aa9babde19c903`. The live remote was verified with `git ls-remote` before publishing.
- The mobility changes and Rally test corrections overlap in `classlessAbilities.test.js` and `engine.classless.test.js`; the registry expectation also includes T2a plus the new mobility IDs. They were kept together in one coherent source/test commit instead of splitting changes into partial versions of shared tests. Rally production runtime files were not changed by this validation.
- Implemented S2a Smoke Bomb and S3a Vanish using the existing classless ability registry/Engine path, including direct-target exclusion while untargetable, continued area damage, and bolt retargeting. Implemented I3 Phantom Strike via the existing TacticalMenu target callback and weapon hit pipeline. The bible does not specify Phantom Strike's placement distance; this implementation uses the documented-in-code reversible 30-unit offset. Treat that spatial interpretation as an open review item, not a canonical value.
- No production TacticalMenu component change was needed; its existing callbacks route the new definitions. The PerkTree/ROADMAP changes remain separate local user work and are excluded.

### Validation actually run for this publication

- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx` — PASS, 3 suites / 59 tests. This run includes Rally's 20.9-second cooldown expectation and max-HP/dead-ally checks, as well as Smoke Bomb, Vanish, Phantom Strike, shared combat, and TacticalMenu callback coverage.
- From `frontend/`: `npm run build` — PASS; optimized bundle compiled. Node emitted the non-fatal `[DEP0176] fs.F_OK` deprecation warning.
- `git diff --cached --check` before source commit — PASS. The final handoff update is subject to a fresh `git diff --check` before its separate commit.
- The earlier standalone Rally outcomes remain recorded in section 28: the initial stale-expectation test failed, the 4-suite/87-test regression passed, and the final Rally-filtered run passed (1 passed / 29 skipped). Those are historical results; they were not rerun as separate commands in this publication. The focused 3-suite/59-test run above was run now.
- Not verified: live profile persistence, backend behavior, Android/device behavior, natural-wave balance, or the Rally click path through a rendered production battle screen.

### Commits and publication

- Source/test commit: `12e9b84ed0c27ea49b44818b9325a6f4b6b8e179` (`Implement classless mobility abilities`). It contains only `frontend/src/components/TacticalMenu.test.jsx`, `frontend/src/game/classlessAbilities.js`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/engine.classless.test.js`, and `frontend/src/game/engine.js`.
- The source commit was pushed to `origin/review/mobile-working-copy`. `git ls-remote origin refs/heads/review/mobile-working-copy` returned `12e9b84ed0c27ea49b44818b9325a6f4b6b8e179`, matching local HEAD at verification.
- This section is being published as a separate handoff-only commit after running `git diff --check`; no gameplay or user-owned files belong in that commit.
- Remaining unstaged user/local files after the source commit: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. Preserve them; do not include them in the handoff commit.
- `work done` means ChatGPT should retrieve the latest published handoff, review its recorded evidence, and report back.

## 31. Phase 1 support and control — Opening, Formation, and Echo — 2026-10-23

### Starting point and scope

- Fetched `origin/review/mobile-working-copy` before editing. Local branch and remote were synchronized at `2a3d789f5c301481437db9332a2f3c6a60c9cf2b`. The worktree already contained user-owned edits in `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; preserved them and excluded them from this task. No branch switch, reset, production profile, account, database, or live service was used.
- Read `AGENTS.md`, the current handoff, and the canonical design bible. Implemented the unambiguous parts of T3 Opening, T3a Formation, and C2 Echo using the existing purchase catalog, classless effect adapter, Engine, and `ClasslessPerkTree`. C2a Ward remains unavailable because the bible specifies “in range” but gives no range value; no range was guessed and no Ward action was registered.

### Runtime behavior

- T3 Opening is purchasable with the existing canonical prerequisites/cost/level validation. Its +8% damage applies when the target has a control expiry recorded by that T3 owner, and lingers for four seconds beyond that expiry. Current classless slow/root control paths record this state. It is evaluated for classless and legacy hero hit paths. Multiple eligible owners contribute to the existing situational bonus category, which retains its 50% cap.
- T3a Formation gives living allies within 5 world units 5% damage reduction. Same-type aura values use the highest nearby value rather than stacking with another Formation owner; it combines with existing progression/interpose reduction under the shared 30% mitigation cap. The aura is calculated at damage time, so movement/death immediately changes its coverage.
- C2 Echo becomes purchasable with its existing canonical C1 prerequisite, cost, and level gate. A successful ability hit starts the owner’s 10-second proc timer and, if the target survives, applies a four-second mark. The next hit from any living allied hero consumes the mark and adds damage equal to 20% of the Echo owner’s derived attack; the damage is credited to that owner in enemy damage attribution and can receive kill credit. Echo, P2 marks, and N2 roots remain separate runtime fields and expire/consume independently. C2 does not alter saves or require persistent enemy state.
- Canonical text does not assign Echo’s added damage a damage category, affinity, critical behavior, or modifier interactions. To complete the specified hit, this implementation treats it as a flat, untyped bonus packet using the owner’s attack, without reapplying the recipient’s weapon/ability bonuses or critical roll. This is a limited implementation interpretation, not a settled design rule; review it before relying on cross-category interactions.
- C2a remains disabled in progression and has no TacticalMenu/Engine action. The perk UI now explains that the canonical range is unspecified. Approval or a bible revision specifying Ward’s range is needed before implementation.

### Tests and build

- Initial focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js src/game/classlessProgression.test.js src/game/classlessAbilities.test.js src/screens/Roster.classlessProgression.test.jsx` — FAIL, 1 failed / 71 passed. The new Roster UI test initially expected wording different from the actual canonical description rendered by the component; assertions were corrected to check the rendered descriptions.
- `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/Roster.classlessProgression.test.jsx` from `frontend/` — an intermediate run failed 1 of 3 tests because the provider’s normal resource accrual added a small fractional amount during the save debounce, violating an exact-gold assertion. The fixture now asserts that gold remains in its expected 456–457 interval, while still checking castle/account markers are preserved. It does not disable or change production accrual.
- Final combined focused command from `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.classless.test.js src/game/classlessProgression.test.js src/game/classlessAbilities.test.js src/screens/Roster.classlessProgression.test.jsx` — PASS, 4 suites / 72 tests. It covers Opening’s control lookback boundary, Formation same-type aura and mitigation cap, Echo’s proc/expiry/attribution and independent P2/root state, C2 purchase, Ward rejection, and the existing focused progression/ability regressions.
- After strengthening the Roster UI test to verify C2 ownership through mocked save and normalized reload, `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/Roster.classlessProgression.test.jsx` from `frontend/` — PASS, 1 suite / 3 tests. The save/load boundary uses disposable state and mocked API I/O, not a live profile service.
- `npm run build` from `frontend/` — PASS, optimized production build compiled. Node emitted a non-fatal `[DEP0176] fs.F_OK` deprecation warning. This build includes the production Engine and perk UI edits; the later change only strengthened a test assertion/fixture.
- `git diff --check` — PASS after the final handoff edit. No full application suite, live backend/profile, natural-wave balance simulation, Android build, or device behavior was tested.

### Changed files, publication, and next step

- Task files: `frontend/src/components/ClasslessPerkTree.jsx`, `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/classlessCombatEffects.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.classless.test.js`, `frontend/src/game/engine.js`, and `frontend/src/screens/Roster.classlessProgression.test.jsx`. No TacticalMenu, Battle, serialization schema, legacy perk UI, or canonical bible changes were needed.
- Source/test commit `706297dc7c74432b6836f22b45b8490c82734315` (`Implement Opening, Formation, and Echo effects`) contains exactly the seven task files listed above. It was pushed to `origin/review/mobile-working-copy`; `git ls-remote` verified that exact SHA as the remote tip before the handoff-only follow-up. The four pre-existing user files listed above remain untouched and unstaged. This section is published separately after the source commit; the final handoff commit SHA and remote-head verification are included in the Codex completion report.
- Ward’s unspecified range and Echo’s unspecified category/modifier semantics are the remaining design limitations for this batch. The entire Phase 1 combat system is not complete. Next recommended task: resolve Echo’s damage-category interaction with the canonical wording/design owner, then implement Ward once its range is specified; continue the remaining Phase 1 passive/ability/signature gaps afterward. Phase 1.5/Phase 2, VFX, Library/Academy, equipment/items, Android, and balance simulation remain untouched/unverified.
- `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back; local-only handoff edits are not visible from GitHub.

## 32. VFX, classless hero sprite, and roster progression — 2026-10-23

### Repository checkpoint and rendering audit

- Started on `review/mobile-working-copy` at `82fedd406efc3d82445e242bd7e36c89dfa45a09`; the fetched `origin/review/mobile-working-copy` tip matched. Source implementation commit `0ec07d10fa0e1ac3875d58fdbc3edf540d743830` (`Add classless hero sprite and combat feedback`) and first handoff-only commit `3665944017a1e8f4af2c9f38c7654a6822fe5988` were pushed; a subsequent fetch confirmed local and remote matched at the latter SHA. No branch switch, main merge, deploy, production profile, account, database, or live service was used.
- The active game screen is `frontend/src/screens/Battle.jsx`; its combat visuals use the canvas renderer in `frontend/src/game/engine.js`. The requested `frontend/src/pages/Game.jsx` and `frontend/src/pages/SideViewGame.jsx` are absent from this repository. No separate active SideView renderer was found. Legacy class sprites and enemies are drawn procedurally in Engine; `frontend/public` had no hero sprite sheet.
- Capacitor uses `webDir: 'build'` in `frontend/capacitor.config.ts`, so public SVG assets are copied into the regular web build. The SVG uses one cached browser `Image` per Engine module and a procedural classless fallback while loading or if image decoding fails. Asset loading and appearance on an actual Android WebView/device have not been checked.
- The user-referenced image was not available as an accessible attachment or repository asset during this task. The new vector artwork was authored to the written brief (dark silhouette, cyan/magenta neon trim, top-down orientation); it is not represented as a recreation of that exact reference image.

### Sprite and combat feedback implemented

- Added `frontend/public/sprites/classless-hero-atlas.svg`, a transparent 144×336 SVG atlas with a consistent 3-column, 7-row grid of 48×48 frames: idle, walk, run, basic attack, Shared Strike, hit, and death. The Engine chooses the state/frame from runtime movement/action/hit/death state and rotates the figure toward its current target or movement direction. The foot anchor is shared across frames. Legacy class sprite drawing is unchanged.
- Added `frontend/src/game/heroSprite.js` and `heroSprite.test.js` for deterministic animation/frame selection and an Engine atlas-draw test. Added `ClasslessHeroAvatar.jsx` and used the same atlas in new-game selection, roster, preparation, and tactical hero indicators. The art does not write to `appearance`, identity, equipment, stats, progression, or serialization fields; no appearance ID/default was added to saved heroes.
- Engine feedback is event-driven: basic classless attack trail at projectile launch; confirmed hit impacts and stronger critical impacts; Shared Strike cyan/magenta arc on a confirmed hit; enemy hit flash and death burst; Rally ring/floaters only when HP was restored; Opening bonus marker on a boosted hit; Formation nearby-ally ring; Echo mark/consumption feedback; Smoke Bomb/Vanish smoke; Phantom Strike trail after successful damage; and Blood Price, Interpose/Last Stand, Crimson Covenant, survival, and hero-death cues. Existing rings/floaters continue to provide healing/shield feedback for other supported actions. Effect and floater queues are capped at 180 and 120 entries respectively and continue to expire through the normal Engine update.
- Engine animation/effect changes are visual-only; damage, cooldowns, range, targeting, progression, and baseline combat values were not changed. The effects remain lightweight canvas drawing; no audio/SFX work or rendering dependency was added.

### New-game roster and recruitment

- Fresh classless profiles now start with exactly one unclassified 300-HP hero. The active squad and total-owned limit are centralized in `HERO_ROSTER` at six. Recruitment refuses atomically at the cap and counts active, benched, and Academy-training heroes. Existing saves are not rewritten or truncated; explicit legacy class creation remains supported.
- Classless recruitment uses a separate doubled curve based on the established four-hero first recruitment price: first recruit costs 1,100 gold (the existing 550-gold reference doubled), then the existing 1.6 growth curve. A fresh profile starts with 500 gold, so the second hero cannot be recruited immediately. Legacy recruitment prices continue to use the existing formula. This is an implementation choice for the user's qualitative “a lot more difficult” request; it is not balance-tested or a claim of final economy tuning.
- Tavern UI recruits another classless hero for classless rosters, shows the owned count and cap, and disables at six. Legacy-only profiles retain the legacy class recruitment choices. Roster promotion and Library's replacement promotion use the six-person squad cap.

### Files changed for this task

- `frontend/public/sprites/classless-hero-atlas.svg`
- `frontend/src/components/CastleBuildings.jsx`
- `frontend/src/components/CastleBuildings.recruitment.test.jsx`
- `frontend/src/components/ClasslessHeroAvatar.jsx`
- `frontend/src/components/TacticalMenu.jsx`
- `frontend/src/game/config.js`
- `frontend/src/game/engine.classless.test.js`
- `frontend/src/game/engine.js`
- `frontend/src/game/heroSprite.js`
- `frontend/src/game/heroSprite.test.js`
- `frontend/src/game/libraryResearch.js`
- `frontend/src/game/logic.classlessHero.test.js`
- `frontend/src/game/logic.js`
- `frontend/src/screens/Preparation.jsx`
- `frontend/src/screens/Roster.jsx`
- `frontend/src/screens/SquadSelect.classless.test.jsx`
- `frontend/src/screens/SquadSelect.jsx`
- This handoff file.

Pre-existing local user files remain separate and unstaged: `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. The remaining source/test files above are this task's changes.

### Validation and limitations

- From `frontend/`, final focused command: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroSprite.test.js src/game/logic.classlessHero.test.js src/game/engine.classless.test.js src/screens/SquadSelect.classless.test.jsx src/screens/classlessScreen.integration.test.jsx src/components/TacticalMenu.test.jsx src/components/CastleBuildings.recruitment.test.jsx src/screens/Battle.tactical-flow.test.jsx src/screens/Roster.classlessProgression.test.jsx src/game/engine.abilities.test.js` — PASS, 10 suites / 112 tests.
- After the final facing-target fallback adjustment, `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroSprite.test.js src/game/engine.classless.test.js` from `frontend/` — PASS, 2 suites / 43 tests.
- The Tavern test was first authored with a Jest-DOM matcher unavailable in this project, then its fixture was too poor to afford the fifth recruit; both test-only issues were corrected. A later case was added to check the recruit activity label with an existing reserve. The final combined command above passed all three Tavern assertions; the earlier isolated one-test result preceded that added case.
- Exact isolated attempts: `CI=true npm test -- --watchAll=false --runInBand --silent src/components/CastleBuildings.recruitment.test.jsx` first failed because `toBeDisabled` was not installed; the next run failed because the test fixture had only 10,000 gold for five recruits. After switching to the native `.disabled` property and raising disposable test funds to 50,000, the same command passed (1 suite / 1 test). This was before the extra bench-label test; the final 10-suite command above verifies both Tavern cases in the final source state.
- `python3 -c 'import xml.etree.ElementTree as ET; ET.parse("frontend/public/sprites/classless-hero-atlas.svg"); print("SVG XML parse: PASS")'` — PASS.
- Final `npm run build` from `frontend/` — PASS after the final source changes; optimized production bundle compiled at 218.94 kB JS / 14.06 kB CSS gzipped. Node emitted the non-fatal `[DEP0176] fs.F_OK` deprecation warning.
- `git diff --check` — PASS after this handoff edit. No Android build/device check, screenshot/visual inspection, performance test, live backend/profile test, natural-wave playtest, or recruitment balance simulation was run. The automated Engine draw test checks atlas source cropping, not visual quality on device. The supplied image was unavailable, as noted above.
- The initial aggregate run before increasing only the Tavern fixture gold failed that test while the other nine suites passed (110 tests passed); the final aggregate and isolated Tavern run then passed. Record this as fixture correction, not a production behavior defect.

### Publication and next work

- Source commit `0ec07d10fa0e1ac3875d58fdbc3edf540d743830` (`Add classless hero sprite and combat feedback`) contains exactly the 17 task files listed above excluding this handoff. The separate first handoff-only commit `3665944017a1e8f4af2c9f38c7654a6822fe5988` contains only `docs/CHATGPT_HANDOFF.md`; the fetched remote ref matched that SHA. This follow-up handoff-only commit corrects the initial “pending” wording and records the full published SHAs. Do not include the four pre-existing user files. No main merge, deploy, Android build, or production data action is authorized or performed.
- Next VFX task: inspect the delivered atlas and event cues on representative Android viewport/device hardware, tune only visual scale/contrast after that review, and add rendering checks for any missing current-runtime events. Do not start audio/SFX or another gameplay balance change in that pass.
- Broader roadmap remains unchanged: (1) finish classless progression/perks/abilities/combat; (2) VFX and combat feedback; (3) spells/Library/Academy; (4) equipment/items. This pass adds initial VFX/sprite support but does not close Phase 1 combat or certify device visual quality.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review the recorded implementation and evidence, and continue from that checkpoint. Local-only handoff edits are not retrievable from GitHub.

## 33. Sprite references, equipped weapons, and persistent hero colors — 2026-10-23

### Starting point and asset inspection

- Continued on `review/mobile-working-copy`. The uploaded sprite-source ZIP was published at starting HEAD `6772d46ccda7f9f1d248e8e0a397b7f3866ed471`; the implementation source commit is `20fcc01` (`Add equipped weapon sprites and hero colors`). No branch switch, reset, merge, deployment, production account/profile, or live service was used.
- Extracted `frontend/public/sprites/demonanic-sprite-assets-source-bundle.zip` to `/tmp/demonanic-sprite-source/` and inspected `Spritepack1-reference.png`, `Spritepack2-reference.png`, and `demonanic-weapons-vfx-source.png`. The 1536×1024 RGBA files are presentation/reference boards with labels, borders, and background panels, so their panels were not cropped into production assets.
- Preserved the existing `frontend/public/sprites/classless-hero-atlas.svg` byte-for-byte. Added a body-only sibling atlas for the active Battle canvas renderer and separate transparent vector assets for sword, bow, and staff. The supplied boards informed the visual direction; the individual weapon SVGs were recreated as clean, lightweight assets rather than extracted from the reference sheets.

### Implementation

- `frontend/src/game/heroWeapon.js` maps equipped item metadata to the sword, bow, or staff SVG. `frontend/src/game/equipment.js` adds `weaponType` metadata to newly generated primary weapons while retaining existing equipment names, item stats, rarity, pricing, and slots. Legacy primary weapons without metadata use a sword fallback; saved class/hero labels do not choose the weapon. The Engine caches at most three weapon images and draws the selected asset as a separate overlay; missing/undecoded images are skipped safely.
- `frontend/src/game/heroSprite.js` points the classless canvas renderer and avatar component to the new body-only atlas, leaving the old atlas file untouched. Battle draws the hero's neon identity color as a small body accent. Roster, preparation, and tactical avatar borders use the same color when present.
- `frontend/src/game/heroModel.js` assigns a random palette color when a new classless or legacy hero is created. Existing saves lacking a color receive a deterministic identity-based color during normalization, avoiding repeated rerolls before save. `GameProvider.normalizeState` applies the cosmetic migration to active, benched, and Academy heroes; existing appearance fields are retained. The color does not affect combat statistics, progression, title, equipment, or recruitment.
- No recruitment rules, economy, or combat behavior were changed. The renderer selects weapons from saved equipment only.

### Files in implementation commit

`20fcc01` contains exactly these 20 files:

- `frontend/public/sprites/classless-hero-body-atlas.svg`
- `frontend/public/sprites/weapons/bow.svg`
- `frontend/public/sprites/weapons/staff.svg`
- `frontend/public/sprites/weapons/sword.svg`
- `frontend/src/components/ClasslessHeroAvatar.jsx`
- `frontend/src/components/TacticalMenu.jsx`
- `frontend/src/context/GameProvider.jsx`
- `frontend/src/context/GameProvider.test.jsx`
- `frontend/src/game/engine.js`
- `frontend/src/game/equipment.js`
- `frontend/src/game/heroModel.js`
- `frontend/src/game/heroModel.test.js`
- `frontend/src/game/heroSprite.js`
- `frontend/src/game/heroSprite.test.js`
- `frontend/src/game/heroWeapon.js`
- `frontend/src/game/heroWeapon.test.js`
- `frontend/src/game/logic.js`
- `frontend/src/screens/Preparation.jsx`
- `frontend/src/screens/Roster.jsx`
- `frontend/src/screens/classlessScreen.integration.test.jsx`

### Validation and limits

- From `frontend/`, `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroWeapon.test.js` — PASS, 1 suite / 5 tests, including equipment type mapping and swap behavior.
- From `frontend/`, `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroModel.test.js src/game/logic.classlessHero.test.js src/context/GameProvider.test.jsx` — PASS, 3 suites / 28 tests for new/legacy identity color assignment, normalization, creation, and provider persistence regressions.
- From `frontend/`, the earlier combined focused command `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroModel.test.js src/game/heroWeapon.test.js src/game/heroSprite.test.js src/game/engine.classless.test.js src/context/GameProvider.test.jsx src/screens/classlessScreen.integration.test.jsx src/components/TacticalMenu.test.jsx src/screens/Preparation.classless-gate.test.jsx src/screens/Roster.classlessProgression.test.jsx src/screens/SquadSelect.classless.test.jsx` — PASS, 10 suites / 97 tests. This preceded the final restoration of original generated equipment names; the final weapon-specific test above was rerun after that change.
- From `frontend/`, `npm run build` — PASS, optimized production build compiled. Node printed a non-fatal `[DEP0176] fs.F_OK` deprecation warning.
- From repository root, `git diff --check` — PASS. XML parsing of the four new SVGs — PASS. `git diff --quiet HEAD -- frontend/public/sprites/classless-hero-atlas.svg` — PASS, confirming the prior atlas is unchanged.
- Automated canvas tests verify the actual renderer's weapon asset selection path and color retention, but Android/WebView rendering, visual quality, low-memory performance, and natural battle presentation were not checked on a device. No live profile/backend or production data was used. The body atlas keeps the existing 3-frame-per-state/rotated-facing renderer; this task does not add new animation states or combat VFX.

### Publication, remaining changes, and next task

- Implementation commit `20fcc01` (`Add equipped weapon sprites and hero colors`) was pushed to `origin/review/mobile-working-copy`; the separate handoff-only follow-up publishes this section. Verify the final remote branch SHA against the handoff commit before relying on it.
- The pre-existing local user changes remain outside both commits: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. Preserve them. No other uncommitted task files remain after publication.
- Next recommended task: review the new sprite/weapon overlays on Android hardware at the actual battle viewport, then adjust visual size/contrast only if device evidence supports it. Do not change combat, recruitment, or economy based solely on visual review. The published source ZIP remains available for future asset reference.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review the evidence, and continue from that checkpoint.

## 34. Integrate supplied transparent combat VFX — 2026-10-23

### Starting point and ZIP inventory

- Started on `review/mobile-working-copy` at published HEAD `569a29402e60164467061a11ee3774d0e467ca61`; the branch was synchronized with `origin` and the source ZIP was already committed at `6772d46ccda7f9f1d248e8e0a397b7f3866ed471`. Existing unstaged user changes were `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`; they were preserved and excluded.
- Extracted `frontend/public/sprites/demonanic-sprite-assets-source-bundle.zip` to `/tmp/demonanic-vfx-source-review/`. The archive contains exactly three 1536×1024, 8-bit RGBA PNGs: `Spritepack1-reference.png`, `Spritepack2-reference.png`, and `demonanic-weapons-vfx-source.png`.
- The two `Spritepack*-reference.png` boards contain labeled examples of idle/walk/run, attack, hit/death, directional views, equipped weapons, and ability effects. Their labels, panel borders, dark backplates, and largely opaque image backgrounds are composited into the image; they are reference boards, not clean VFX animation sheets suitable for direct use. Their example frame rows are not used as production animation frames.
- `demonanic-weapons-vfx-source.png` is the usable transparent source sheet. It contains four sword illustrations, four bow illustrations, four staff illustrations, eight standalone projectile/energy sprites, and eight standalone impact sprites. The VFX are individual still images, not sequential animation frames. The weapon illustrations were not used in this task; the previous equipped-weapon assets remain as they were.
- Cropped the eight projectiles and eight impacts directly from that RGBA source sheet, preserving their source pixel colors and alpha; only transparent margins were trimmed. No newly drawn replacement artwork was used.

### Runtime integration

- Added `frontend/src/game/combatVfx.js` as the single path/selection/cache/draw adapter. The Engine lazily loads original assets and caches image objects by the fixed 16-ID registry. Unloaded or missing images safely fall back to the Engine's existing canvas effects. The pre-existing 180-effect cap remains in place; no unbounded timers or per-frame image construction were added.
- Equipped classless bows use one of the supplied arrow sprites while their projectiles travel; equipped staffs use one of the supplied energy-bolt sprites. Classless sword attacks use the supplied diagonal slash. Existing legacy archer/mage and enemy ranged projectiles use the corresponding original arrow/energy art; other legacy attack visuals retain their existing fallback.
- Confirmed ordinary hits use a supplied star impact and critical hits use a larger burst impact. Successful legacy Mage spell casts show the supplied orbit flare; Fireball and researched elemental hits use the impact art, Frost Nova uses per-target impacts plus the supplied area/orbit art, and Chain Lightning uses impacts on its targets. Arcane Ward's existing shield target feedback now maps to supplied orbit art.
- Existing runtime effect events map to original source art where there is a fitting asset: Shared Strike to the crescent; Rally/heal, shields/guards, and Echo marks to the orbit; Echo bonus hits to the smaller star; Smoke Bomb/Vanish to the vortex; Phantom trails to energy art; Opening and sword swings to the slash; enemy death to burst; and napalm to a larger burst. These are visual-only mappings; damage, target rules, cooldowns, ability ownership, and combat timing were not changed.
- Static source images are positioned at the existing event locations, rotated along projectile/trail direction, rendered at bounded battlefield sizes, and faded using the existing effect lifetime. The source bundle provides no clean multiframe VFX sequences, so this integration does not claim frame-by-frame sprite animation.

### Files and verification

- Source commit `0085a20a35b56d0e2a95595d61d904bab04485d0` (`Integrate source-bundle combat VFX`) contains 21 task files: the 16 cropped PNGs under `frontend/public/sprites/vfx/{projectiles,impacts}/`, `frontend/src/game/combatVfx.js`, `frontend/src/game/combatVfx.test.js`, `frontend/src/game/engine.js`, `frontend/src/game/engine.classless.test.js`, and `frontend/src/game/engine.abilities.test.js`.
- From `frontend/`, `CI=true npm test -- --watchAll=false --runInBand --silent src/game/combatVfx.test.js src/game/engine.classless.test.js src/game/engine.abilities.test.js` — PASS, 3 suites / 50 tests. Coverage includes PNG registry paths/RGBA headers, event-to-asset mapping, deterministic projectile variants, lazy image caching, unloaded-image fallback, image draw geometry, equipped bow/sword events, critical impact mapping, Shared Strike mapping, and a successful Fireball cast/impact event.
- From `frontend/`, `npm run build` — PASS, optimized build compiled. Reported gzip sizes: JS 221.24 kB (+1.28 kB) and CSS 14.06 kB. Node printed the non-fatal `[DEP0176] fs.F_OK` deprecation warning.
- From repository root, `git diff --check` and staged `git diff --cached --check` — PASS. `file` confirmed all 16 extracted assets are non-interlaced 8-bit RGBA PNGs. No Android/WebView device check, screenshot review, low-memory profiling, or visual-quality review was performed; phone validation remains necessary to judge scale, color contrast, and battlefield readability.

### Publication and next step

- Source commit `0085a20a35b56d0e2a95595d61d904bab04485d0` was pushed only to `origin/review/mobile-working-copy`. A separate handoff-only commit publishes this section. Verify the remote tip after that push.
- The four pre-existing user changes remain local and unstaged: `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. Do not include them in this task's commits.
- Recommended next task: inspect the integrated effects on an Android phone at the real battle viewport and adjust only visual size/overlap/contrast based on that evidence. Do not start an audio pass or alter combat/recruitment/economy.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and report back.

## 35. Combat VFX visibility and Engine renderer coverage — 2026-10-23

### Checkpoint and verified runtime findings

- Continued on `review/mobile-working-copy` from synchronized published HEAD `a978981dfaeea617d0ad996b4f82f3ef5cb80afd`. The published source implementation is commit `975ef12` (`Improve combat VFX visibility and render coverage`). No branch switch, merge, deployment, production-data access, or Android build/device session occurred.
- The active Battle screen uses the `Engine` canvas renderer in `frontend/src/game/engine.js`. Its projectile loop loads registered images from `frontend/src/game/combatVfx.js`; the combat-effects loop draws event-mapped art after the hero sprites and before damage floaters. Both paths require `image.complete` and positive `naturalWidth`/`naturalHeight`, then use `ctx.drawImage`; unavailable assets continue to use the existing canvas fallback. The fixed image cache and 180-effect cap are unchanged.
- **Code-level visibility cause:** the supplied artwork was already connected to real Engine events, but ordinary and critical hit art defaulted to only 28 and 38 logical canvas units. At full opacity the renderer further scaled assets to 92% of that size. An ordinary hit's 0.22-second lifetime fed an initial Engine alpha of about 0.48, making the soft, transparent source-sheet impact especially faint on the narrow mobile canvas. Prior tests covered mappings and the draw helper, but did not call the full `Engine.render()` path. The phone screenshot itself was not available for pixel-level diagnosis, so this is a source-supported explanation of why the integration could be hard to see, not a claim of Android visual verification.
- Image URLs are rooted at `PUBLIC_URL` plus `/sprites/vfx/...`; this repository build assumes `/`. The production build copied all 16 registered PNGs into `frontend/build/sprites/vfx/`. The renderer test uses a loaded-image fixture to verify the Engine passes these URL-bearing image objects into real canvas `drawImage` calls. Actual Android WebView decoding/loading remains unverified.

### Changes in source commit `975ef12`

- `frontend/src/game/combatVfx.js`: raised normal hit artwork from 28 to 46 logical units and critical hit artwork from 38 to 60; generic impact cues now default to 46 and slash/area cues to 52. Removed the 8% shrink at full opacity. Image opacity now maps the existing Engine fade alpha into a 0.4–1.0 visual range, improving short impact visibility while retaining fade and existing event expiry.
- `frontend/src/game/engine.js`: enlarged supplied projectile artwork from 40 to 50 logical units. No combat damage, cooldown, target, movement, or event lifetime was changed.
- `frontend/src/game/engine.vfx-render.test.js`: added an Engine renderer-level test with a deterministic loaded-image fixture. It generates a classless equipped-bow projectile and hit, executes Shared Strike, generates a legacy archer projectile/critical hit and a legacy Mage Fireball cast, then calls each real `Engine.render()` and asserts the supplied projectile, star, critical burst, crescent, and orbit PNGs reach `drawImage` with visible dimensions and opacity.

### Validation

- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/engine.vfx-render.test.js src/game/combatVfx.test.js src/game/engine.classless.test.js src/game/engine.abilities.test.js` — PASS, 4 suites / 51 tests.
- From `frontend/`: `npm run build` — PASS; optimized bundle compiled at 221.25 kB JS and 14.06 kB CSS gzip. The existing non-fatal Node `[DEP0176] fs.F_OK` deprecation warning was printed. Verified `frontend/build/sprites/vfx/` contains 16 PNGs.
- From repository root: `git diff --check` and `git diff --cached --check` — PASS. The staged source commit contained only the two production renderer files and the renderer-level test.
- No Android/WebView device test, screenshot review, natural-wave play session, live backend/profile test, or low-memory performance test was run. The renderer test proves the Engine draw call using a loaded-image fixture; it does not prove image decoding or visual readability on the phone.

### Publication and next step

- Source commit `975ef12` was pushed to `origin/review/mobile-working-copy` after confirming the prior remote tip was `a978981dfaeea617d0ad996b4f82f3ef5cb80afd`. A separate handoff-only commit publishes this record; verify the final remote HEAD before relying on the handoff.
- The four unrelated local user changes remain unstaged and excluded: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`.
- Next task: review ordinary attacks, critical impacts, spells, and classless abilities on an Android phone at the real battle viewport. Confirm WebView image decoding, scale, contrast, overlap, and frame-time behavior; adjust visuals only from that evidence.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and continue from that checkpoint.

## 36. Replace battlefield hero artwork with uploaded character frames — 2026-10-23

### Checkpoint and root cause

- Started on `review/mobile-working-copy` at local and remote HEAD `fa09606edf116601503d61d4759a148f06a9d958`. The implementation source commit is `9a661286aa9ffba3f4c86080284811bafa5a7cd0` (`Use uploaded hero sprites in battle renderer`). No branch switch, reset, merge, deployment, production-data access, or Android/device test occurred.
- The active route is `App.js` battle → `screens/Battle.jsx` → `game/engine.js` canvas `Engine.render()`. The old `HERO_SPRITE_ATLAS` selected `/sprites/classless-hero-body-atlas.svg`, a recreated SVG, not the uploaded hero art. More importantly, `_drawHeroSprite` selected that atlas only for classless heroes; legacy class heroes used hand-drawn, class-specific procedural shapes in the same method. Thus existing class-based heroes never received the new atlas, and classless heroes saw a recreated character rather than the uploaded character. The previous VFX change affected effects, not this character path. This is the source-verified integration cause; the phone screenshot was not available for pixel inspection.

### Bundle inventory and asset comparison

- `frontend/public/sprites/demonanic-sprite-assets-source-bundle.zip` contains three 1536×1024 RGBA images: `Spritepack1-reference.png` (SHA-256 `cb8a8df875e357a8a5aad760adcaf553f58ba7576336c9edd53673f36b19740b`), `Spritepack2-reference.png`, and `demonanic-weapons-vfx-source.png`. The first two are labeled hero reference boards with panel backgrounds; the third contains weapon and VFX examples. The bundle contains no enemy character artwork. No artwork was invented or substituted for enemies.
- Old classless asset: `frontend/public/sprites/classless-hero-body-atlas.svg`, 144×336, SHA-256 `5d5971c9134973cf065529f42837065def9622ab5c73562af4cdbd431c3240d3`. The earlier, unused `classless-hero-atlas.svg` was also left untouched (SHA-256 `fc58333d230788336400f62a814a43efe830c840303ec4f4f00f12c814cf1de9`). Legacy heroes previously had no sprite asset path; their bodies were procedural. Both prior SVG files remain in the repository but the live hero renderer no longer selects them.
- New live asset: `frontend/public/sprites/hero/supplied-classless-hero-atlas.png`, a 192×448 RGBA atlas of 21 64×64 crops from the actual hero figures in `Spritepack1-reference.png`, SHA-256 `eacabaa7e3ced62b08e1adadd5241169fc5e0529d93494692f67397b74ea659a`. The crops use these source-board origins (x,y): idle `(368,36)`, `(447,36)`, `(525,36)`; walk `(64,162)`, `(169,162)`, `(274,162)`; run `(64,278)`, `(172,278)`, `(279,278)`; hit `(22,744)`, `(85,744)`, `(149,744)`; death `(303,744)`, `(375,744)`, `(448,744)`. The dark, edge-connected panel backgrounds were masked to transparency. Attack and Shared Strike body rows reuse the walk body crops because the board's attack examples bake in weapon swings/effects; weapon overlays and combat VFX remain separate to avoid duplicating them.
- Source-level before/after comparison is saved as `docs/visual-evidence/hero-sprite-before-after.png` (480×230; SHA-256 `de29ee53441ccda60dd9ee272b041bb57641542cafad04b5896504614b495199`). It shows old and new body frames at comparable 48×48 render scale on the same battlefield background. This is an asset comparison, not an Android screenshot. `file`, dimensions, SHA-256, and visual inspection verified that the new frame is visibly different from the old recreated frame.

### Renderer integration and compatibility

- `game/heroSprite.js` now selects `/sprites/hero/supplied-classless-hero-atlas.png` with 64×64 source frames. The live Engine draws this same supplied body atlas for both classless and legacy heroes, retaining identity-color accents, state selection, health bars, hit/death state, and classless facing. Legacy heroes keep their prior upward facing and receive an equipped-weapon overlay from item metadata, with a visual-only class fallback for older weapon records. The renderer's missing-image fallback is a neutral silhouette, not the removed class-specific procedural artwork.
- The enemy renderer remains `_drawEnemySprite` and continues drawing enemy forms procedurally by enemy type. It was exercised separately in the renderer test and was not changed. Enemy sprite replacement remains blocked until actual enemy artwork is supplied; the uploaded bundle has none.
- `engine.vfx-render.test.js` now runs `Engine.render()` for a classless bow hero, legacy archer, and legacy Mage. It asserts all three draw the new atlas URL, the prior SVG URL is absent, enemy drawing still runs, and damage-counter text remains emitted. It also exercises supplied projectile, impact, critical, Shared Strike, and Fireball VFX draw calls. The focused regressions confirm existing VFX files and draw mappings are unchanged.

### Files and validation

- Implementation commit `9a661286aa9ffba3f4c86080284811bafa5a7cd0` contains only: `frontend/src/game/engine.js`, `frontend/src/game/engine.vfx-render.test.js`, `frontend/src/game/heroSprite.js`, `frontend/src/game/heroSprite.test.js`, the new supplied hero atlas PNG, and the before/after evidence PNG.
- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/game/heroSprite.test.js src/game/heroWeapon.test.js src/game/engine.vfx-render.test.js src/game/combatVfx.test.js src/game/engine.classless.test.js src/game/engine.abilities.test.js` — PASS, 6 suites / 66 tests.
- From `frontend/`: `npm run build` — PASS, optimized bundle compiled at 221.01 kB JS and 14.06 kB CSS gzip. The existing nonfatal `[DEP0176] fs.F_OK` warning was printed. `cmp frontend/public/sprites/hero/supplied-classless-hero-atlas.png frontend/build/sprites/hero/supplied-classless-hero-atlas.png` — PASS. Verified the build still contains all 16 VFX PNGs.
- From repository root: `git diff --check` and `git diff --cached --check` — PASS. Confirmed both prior hero SVGs and all existing `frontend/public/sprites/vfx` files are unchanged from the source commit's base.
- No real phone screenshot, Android WebView decode/visual test, natural battle session, or device performance check was performed. Automated tests use a deterministic loaded-image fixture; they prove the Engine draw calls and selected URLs, not device rendering quality.

### Publication, remaining work, and next step

- Source commit `9a661286aa9ffba3f4c86080284811bafa5a7cd0` was pushed only to `origin/review/mobile-working-copy`; a separate handoff-only commit publishes this record. Verify the final remote HEAD before relying on this handoff.
- Four unrelated local user changes remain unstaged and excluded: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`.
- The hero art is now objectively changed in the live renderer for both legacy and classless heroes. Enemy art is unchanged because no enemy sprites were supplied. Next, test the new hero sprite on Android and request/upload actual enemy character artwork before attempting enemy replacement.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review the evidence, and continue from that checkpoint.

## 37. Saved profile loading and new profile creation safeguards — 2026-10-23

### Starting point and verified flow

- Started on `review/mobile-working-copy` at local and remote HEAD `6b47a35449e2bbb19f138975c72c696afde849bc` (synchronized). Preserved the four pre-existing user changes: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`. They were not edited or staged.
- Traced login/register in `frontend/src/context/AuthContext.jsx` to `authApi` in `frontend/src/api.js`, then `GameProvider.loadGame` and `startNewGame`, and finally the profile screen in `frontend/src/App.js`. Backend auth in `backend/auth.py` returns the same UUID `id` on register/login and resolves bearer-token `sub` back to the user document's `id`. The client passes that authenticated user ID only for its local-backup key; `/game/state` is bearer-authenticated, and backend lookup, create, and save all key `game_states` by `current["id"]`.
- Verified backend route contract in `backend/server.py`: `GET /api/game/state` returns HTTP 200 with `{ "state": null }` only when no record is found, returns the stored state otherwise, and rejects malformed stored state with HTTP 500. `POST /api/game/state` inserts under the authenticated ID, returns HTTP 201 `{ "ok": true }`, and returns 409 on duplicate `user_id`; startup creates a unique index. `PUT` is used only after provider server-save enablement. Existing insert-only logic and in-memory duplicate/concurrency tests were already present.
- Verified `frontend/src/api.js` resolves `REACT_APP_BACKEND_URL` to an `/api` base and profile calls use `/game/state`. The production Android build guard requires HTTPS `https://demonanic.onrender.com`. The local production-mode bundle produced below embedded that host; its bundled URL resolver appends `/api`. This verifies this build's compile-time configuration, not the configuration or age of the APK currently installed on the user's phone.
- **No production root cause is confirmed.** No authenticated production lookup/create request was made, no production profile/database was read, and no Android device was available. Source inspection found account ID consistency and safe missing-vs-error classification. The confirmed client gap addressed here was that `startNewGame` treated any resolved POST response as success without checking the backend's `{ok:true}` acknowledgement; its failure message was also generic. These changes harden the boundary and recovery guidance but do not establish that they alone explain the reported phone symptom.

### Changes

- `frontend/src/context/GameProvider.jsx`: new-profile creation now enters the game only after the API returns explicit `{ok:true}`. Failed creation keeps server saving disabled/state empty and shows safe, actionable guidance for duplicate (409), session (401/403), timeout/network, and other unconfirmed outcomes. Error details remain sanitized to status and code; no token or credential is logged.
- `frontend/src/context/GameProvider.test.jsx`: added/extended tests for unexpected lookup 404 versus explicit missing, retrying a failed verification without exposing creation, unconfirmed creation response, network creation failure followed by lookup and retry, and 409 conflict followed by loading the existing profile. Existing tests still cover explicit null, transient lookup errors, duplicate rapid taps, successful creation, and no replacement.
- `backend/tests/test_profile_creation_safety.py`: added an isolated fake-collection test that creates under one authenticated ID, retrieves under that same ID, and sees no profile under another ID. No backend production code or database configuration changed.

### Validation and limitations

- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/context/GameProvider.test.jsx src/apiConfig.test.js` — PASS, 2 suites / 26 tests.
- From `frontend/`: `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` — PASS. Android backend guard accepted `demonanic.onrender.com`; optimized frontend compiled (221.27 kB JS gzip, 14.06 kB CSS gzip). Existing non-fatal Node `[DEP0176] fs.F_OK` deprecation warning appeared. This was not a Gradle APK build or device test.
- From repository root, build-output inspection confirmed the compiled JS contains the production backend host and the `resolveApiBaseUrl` resolver that appends `/api`.
- From repository root, `git diff --check` and staged `git diff --cached --check` — PASS. `python3.12 -m py_compile backend/tests/test_profile_creation_safety.py` — PASS (syntax only; it does not import or execute the test).
- Backend execution attempt from `backend/`: `python3 -m pytest -q tests/test_profile_creation_safety.py` — BLOCKED: `/usr/bin/python3: No module named pytest`. The system Python 3.12 also lacks FastAPI/runtime dependencies, and `python3 -m venv /tmp/demonanic-profile-test-venv` could not bootstrap because `ensurepip` is unavailable. A temporary `/tmp` dependency-target install on the available Python 3.14 was canceled while building the dependency chain; no global packages were changed. The added backend fake-collection test has not executed. The remote-writing `backend/tests/backend_test.py` was deliberately not run.
- No authenticated live backend response/status, production profile, account, MongoDB record, currently installed APK, Android login, or on-device profile creation/recovery was tested. Therefore the production incident is not declared fixed.

### Android retest and next step

1. Build/install a fresh APK from the current `review/mobile-working-copy` using the production backend URL, then fully close and relaunch the app. Confirm the bundle is rebuilt; an older installed APK is not covered by this build.
2. Sign in to an account with a known existing profile and verify it loads unchanged. If verification fails, choose retry and confirm the error screen does not offer profile creation.
3. On a disposable newly registered test account only, confirm an explicit missing response shows `START NEW GAME`; create once and confirm entry only after server acknowledgement. Relaunch and verify the profile loads. Tap create rapidly or simulate a retry and confirm the existing profile is recovered/409 is actionable, never replaced.
4. If it still fails, capture sanitized HTTP status and response shape for `/api/auth/login`, `/api/game/state` GET, and POST (omit credentials, bearer tokens, username, and profile contents) plus the app build/commit. Do not retry creation against an account whose profile status is unknown.

- Implementation commit `bd8cf7a1383fcf92ba1dcdb3d84f82e17feaa2b2` (`Harden saved profile creation and recovery`) contains only the two frontend provider files and the isolated backend test file. The handoff entry was first published in handoff-only commit `1dcfd4e01b633c9d05ec1694414dc8cc89890e76` (`Record saved profile recovery validation`); a separate handoff-only correction follows to record that publication accurately. Both source and documentation changes are limited to the authorized branch. The four pre-existing user changes remain excluded.
- Recommended next task: obtain an isolated backend test environment and execute the new route test, then run the Android retest with a known existing account and a disposable new account before attributing or declaring the production issue fixed.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its actual evidence, and report back.

## 38. Profile-creation diagnosis and review checkpoint — 2026-10-24

### Verified repository and live-service findings

- Started from local `review/mobile-working-copy` HEAD `42a6f78e1e867795711f2e83d3fa70d6c56f2676`, synchronized with `origin/review/mobile-working-copy`. Current `origin/main` is `07ba6524eed5b6ee838ca7ec0bc09168420858de`. The review worktree's pre-existing changes were preserved and left unstaged: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`; untracked `frontend/src/components/PerkTree.test.jsx`.
- Read-only requests to `https://demonanic.onrender.com/api/` returned HTTP 200 with `{"message":"Demonanic API online"}`. An unauthenticated POST to `/api/game/state` returned HTTP 405, `Allow: GET`, and `{"detail":"Method Not Allowed"}`. The request carried no bearer token and the framework rejected the method before route authentication/handler/database access; no profile data was read or written. This verifies that the currently reachable service does not expose the first-profile POST route.
- The deployed source SHA is **not verified**. This environment had no Render CLI, service configuration file, Render dashboard/log connector, Render API key, or service ID. The public `rndr-id` header is a request ID, not a Git revision. The 405 is consistent with `origin/main`'s backend, but does not uniquely identify its deployed commit. The service's exact deployed frontend revision is also unknown.
- Source contract: current `origin/review/mobile-working-copy` frontend `gameApi.createState` sends `POST /game/state` with `{state: serializeGameState(state)}` and `GameProvider.startNewGame` proceeds only when response data has `ok: true`. The current review backend route returns HTTP 201 `{ok:true}` and uses the authenticated account ID. On `origin/main`, the frontend's `gameApi` exposes GET and PUT only; the proposed POST is additive for that client. The new-profile flow observed on the phone is therefore incompatible with the live route table if the installed frontend uses the review POST flow.

### Fix review and existing publication

- A local diagnostic branch, `fix/profile-create-post-diagnostic`, was created from `origin/main` for comparison. Its source patch is commit `e975034f7b4fa6486eff0694f1d0b7d797dd82f5`; its follow-up local handoff commit is `97c96e649deb22d36972955c3e637a805a1488b8`. Neither diagnostic commit was pushed. The patch adds authenticated, insert-only POST creation, returns 201 `{ok:true}`, maps `DuplicateKeyError` to 409, and copies/converts incoming state before Food-to-Metal normalization. Its six fake-collection tests cover identity, duplicate/racing inserts, relogin/account isolation, and preservation of existing data.
- No duplicate backend fix needs to be added to this branch: review already contains the integrated route from `287ef1661b2a650bf744f48179a4feaa7cef018d`, with state validation, duplicate protection, and Food-to-Metal handling. Startup creates a unique `game_states.user_id` index. POST only inserts; a duplicate returns 409 and cannot replace a saved document. Existing GET recovery and PUT saves remain in place. Food-to-Metal conversion is retained in review GET/offline accrual and PUT paths. Therefore the review branch, rather than the older main-based diagnostic snapshot, is the appropriate code for owner review.
- Authenticated live creation, real profile recovery, and Android logout/relogin were not tested. No production account or Mongo record was accessed. Do not infer that an account is new from a lookup error; only an authenticated explicit `{state:null}` response authorizes the new-profile UI.

### Validation from this continuation

- From `backend/`: `PYTHONPATH=/tmp/demonanic-profile-test-py312 python3.12 -m pytest -q tests/test_profile_creation_safety.py tests/test_classless_offline_recovery.py` — PASS, 10 tests; 8 existing FastAPI lifecycle deprecation warnings.
- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/context/GameProvider.test.jsx src/apiConfig.test.js` — PASS, 2 suites / 26 tests.
- From the repository root: `git diff --check` — PASS. No frontend build was needed because no frontend source changed. No deployment, authenticated production call, live profile test, or Android/device test was performed.
- On the isolated diagnostic branch, re-ran from `backend/`: `PYTHONPATH=/tmp/demonanic-profile-test-py312 python3.12 -m pytest -q tests/test_profile_creation_safety.py` — PASS, 6 tests; 8 existing FastAPI lifecycle deprecation warnings. This is supplemental isolated validation; it does not identify the deployed SHA.

### Review/publication and next action

- The diagnostic implementation and tests are already represented by existing, more complete code on `origin/review/mobile-working-copy`; publishing the older main-based diagnostic snapshot as a separate branch would duplicate the fix while omitting later recovery behavior. This checkpoint is a handoff-only update on the review branch. No merge, deployment, or production change occurred.
- To identify the deployed commit, an authorized Render project owner should open the Demonanic backend service in Render and inspect the latest **successful** deployment under Events/Deploys. Record the source repository, branch, and full commit SHA, then compare it with `07ba6524eed5b6ee838ca7ec0bc09168420858de` and `287ef1661b2a650bf744f48179a4feaa7cef018d`. If the dashboard does not show a source revision, use authorized read-only deployment metadata/log access. Do not provide API secrets in chat.
- Only after the owner confirms the intended backend commit and separately authorizes deployment should the route be released. Then test a known existing account for unchanged recovery and a dedicated disposable account for first creation, duplicate retry, logout/login, and reload. Never use an account whose profile status is uncertain to test creation.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back.

## 39. New-profile route validation and deployment preparation — 2026-10-24

- Verified current remote review HEAD before this checkpoint: `087595e28337016e3c214f5db3b64cd2824c3549`, which includes the handoff-only diagnostic checkpoint; source route commit `287ef1661b2a650bf744f48179a4feaa7cef018d` is an ancestor. The profile-creation code was already present, so no gameplay/backend source file was changed or duplicated. The local root worktree remains behind this handoff commit and contains the four preserved user-owned changes.
- Revalidated the review backend route in `backend/server.py`: protected `POST /api/game/state` uses `Depends(get_current_user)`, keys the insert with `current["id"]`, creates with `insert_one`, returns HTTP 201 `{ "ok": true }`, and converts a duplicate-key violation to HTTP 409. `backend/server.py` startup creates a unique `game_states.user_id` index, so concurrent insert attempts cannot both claim the same account or replace an existing document. GET lookup and PUT save routes remain; the review path retains Food-to-Metal conversion in creation, save, and offline/recovery flow. The frontend expects the same POST body/acknowledgement and continues to use GET for load and PUT for save.
- From `backend/`: `PYTHONPATH=/tmp/demonanic-profile-test-py312 python3.12 -m pytest -q tests/test_profile_creation_safety.py tests/test_classless_offline_recovery.py` — PASS, 10 tests; 8 existing FastAPI lifecycle deprecation warnings.
- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/context/GameProvider.test.jsx src/apiConfig.test.js` — PASS, 2 suites / 26 tests. From repository root: `git diff --check` — PASS. No frontend build was needed because there were no frontend changes. No authenticated live request, profile read/write, or Android test was performed.
- Deployment workflow inspection: `.github/workflows/demonanic-pages.yml` is a manual `workflow_dispatch` workflow that builds `frontend/` with `REACT_APP_BACKEND_URL=https://demonanic.onrender.com` and deploys the frontend to Cloudflare Pages project `demonanic-game`. No Render deployment workflow or tracked `render.yaml`/`render.yml` exists in the repository. This fix is backend-only, so the Cloudflare workflow is not needed to make the API route available. The Render service's dashboard configuration is not accessible here; no deploy command or automatic branch mapping can be confirmed.
- Next deployment action: an authorized project owner should open the existing Render FastAPI service, verify its configured repository and branch, and use that service's established deployment action to deploy a reviewed commit containing `287ef1661b2a650bf744f48179a4feaa7cef018d` (or the current review tip). Do not select an unverified branch or rely on presumed auto-deploy. After deployment, confirm unauthenticated POST no longer returns 405 (it should reach auth and return 401), then use a disposable test account for authenticated creation and reload. Separately check an existing account's profile remains unchanged. No deployment was attempted.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back.

## 40. Fix first-profile classless onboarding click-through — 2026-10-24

### Starting checkpoint and diagnosis

- Continued from verified `origin/review/mobile-working-copy` HEAD `d198359feaa984f751ede9862018cdc32bda46d2` in an isolated worktree. The primary checkout remained at `42a6f78e1e867795711f2e83d3fa70d6c56f2676` with its four pre-existing user changes preserved and untouched: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`.
- The production path was: `App.js` explicit missing-profile prompt → `GameProvider.startNewGame` → `gameApi.createState` → `SquadSelect` → `setClasslessSquad` → home. The POST contract was already correct in `frontend/src/api.js`: authenticated Axios `POST /game/state` with `{ state: serializeGameState(state) }`; its request interceptor adds `Authorization: Bearer <dm_token>`. `startNewGame` accepts only `{ok:true}`, then installs the initial state and selects the squad screen. No backend or profile-creation API change was needed.
- The verified click-path defect was in `SquadSelect`: it called `mutate` and relied on a variable assigned inside React's state-updater callback before deciding whether to navigate. `GameProvider.mutate` also unconditionally called `structuredClone`; the production-path test initially reproduced an uncaught `ReferenceError` at that click when `structuredClone` was absent (as it is in the test DOM and may be absent in older Android System WebViews). The handler had no visible error path. It then called `saveNow()` against `stateRef.current` before React necessarily committed the cloned state, allowing an immediate stale-state PUT. This is a source/test-confirmed failure mode; the exact System WebView version on the user's phone was not available, so the device-specific trigger remains unverified.

### Implementation

- `frontend/src/context/GameProvider.jsx`: added a JSON-compatible state-clone fallback when `structuredClone` is unavailable, used for provider mutation and periodic state updates. Added `beginClasslessJourney`, which clones the current state, creates the starter through the existing `setClasslessSquad`, synchronously updates the state ref and React state, writes the local backup, and schedules the normal authenticated server save. Repeated taps cannot create another hero.
- `frontend/src/screens/SquadSelect.jsx`: replaced the updater side-channel with the explicit provider action. A failed initialization now displays an actionable alert, and a tap guard prevents duplicate execution while the screen transitions.
- `frontend/src/screens/SquadSelect.classless.test.jsx`: updated the focused component test for the provider action and added failure-feedback coverage.
- `frontend/src/screens/onboarding.profile-flow.integration.test.jsx`: added a disposable integration test using the real `GameProvider` and `SquadSelect`, with mocked API I/O and a small routing probe. It covers explicit missing → HTTP 201 `{ok:true}` creation acknowledgement → one starter click → home state, rapid double tap, preserved classless HP/identity shape, and visible provider errors for HTTP 401, HTTP 409, network failure, and an unexpected acknowledgement. The test deliberately removes `structuredClone`, proving the fallback path. The route probe and mocked API do not constitute a real backend, authenticated account, or full `App`/device test.
- The backend expects authenticated insert-only POST and returns the `{ok:true}` acknowledgement; that backend behavior was previously validated and deployed per the owner. This task did not access production or test the live Render service. HTTP 201 was represented in the mocked response. The existing POST request body and auth interceptor were inspected but no real HTTP request was issued.

### Validation and publication

- From `frontend/`: `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/onboarding.profile-flow.integration.test.jsx src/screens/SquadSelect.classless.test.jsx src/context/GameProvider.test.jsx src/apiConfig.test.js` — PASS, 4 suites / 33 tests. An earlier focused run before the fallback failed at `structuredClone is not defined`; after adding the fallback, the final run passed with `structuredClone` explicitly unavailable.
- From `frontend/`: `npm run build` — PASS. Optimized bundle: 221.31 kB JS and 14.06 kB CSS gzip. Existing non-fatal Node `[DEP0176] fs.F_OK` deprecation warning printed.
- From repository root: `git diff --check` — PASS. No Android APK build or phone test was run.
- Implementation commit: `38c679e` (`Fix classless journey onboarding action`), containing only the three production/test files and the new integration test listed above. The separate handoff-only commit follows this implementation. Both are intended for `review/mobile-working-copy`; verify the final remote SHA before relying on publication.

### Remaining checks and next step

- Create a new frontend/Android build from this branch and retest the entire onboarding path on the affected phone. Confirm `START NEW GAME` reaches “Begin Your Journey”, “Start with One Hero” enters the home/playable screen, and restart/relogin retains the hero. No live account or profile was used here.
- If the device still appears unresponsive, capture Android System WebView version and sanitized console output; the source-level integration test now covers the missing-`structuredClone` failure mode.
- No backend deployment is required for this frontend fix. Publish the rebuilt frontend using the repository's existing Cloudflare Pages workflow when separately approved; create/install a fresh Android package for phone testing. Do not infer Android behavior from the web build.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back.

## 41. Android debug APK build attempt for onboarding fix — 2026-10-24

- Fetched `origin/review/mobile-working-copy` and verified remote HEAD `cc0019a4ac4e5432578dd7cc677210cccf422831`. Confirmed onboarding implementation commit `38c679e5f90eef3295f3815f27871b7d320aa2ac` is an ancestor of that HEAD. The primary checkout remained at `42a6f78e1e867795711f2e83d3fa70d6c56f2676` with the four known local user changes intact. Build work was isolated to a temporary worktree at the published HEAD.
- Followed `.github/workflows/castle-management-build.yml`: from `frontend/`, `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` — PASS; the Android backend guard accepted the production host and CRA compiled (221.32 kB JS / 14.06 kB CSS gzip; non-fatal Node `[DEP0176] fs.F_OK` warning). `npx cap sync android` — PASS.
- From `frontend/android/`, `./gradlew assembleDebug` — BLOCKED/FAIL: `SDK location not found`. `/usr/lib/android-sdk` contains only `platform-tools`; no `ANDROID_HOME`/`ANDROID_SDK_ROOT`, `android/local.properties`, SDK platform/build-tools, or `sdkmanager` is available here. Java 21 and `adb` 34 are installed, but are insufficient. The isolated build worktree did not produce `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. A pre-existing APK at that path in the primary checkout was left untouched; its filesystem modification time is 2026-10-23, before the published onboarding fix, so it is not evidence of this build and was not offered as the updated APK. Capacitor sync changed generated `capacitor.settings.gradle` because `node_modules` was symlinked from the primary checkout; that generated path change was inspected and restored, leaving the build worktree free of source changes.
- No APK was produced, installed, or tested on a device. This is a build-environment blocker, not evidence that the onboarding issue is fixed on Android. No backend deploy occurred.
- To continue in Termux from an existing clone with the Android SDK installed under `$PREFIX/opt/android-sdk`, use:

  ```sh
  cd "$HOME"
  git clone --branch review/mobile-working-copy --single-branch https://github.com/demonanic/Demonanic.git Demonanic-apk-cc0019a
  cd "$HOME/Demonanic-apk-cc0019a"
  git rev-parse HEAD
  cd frontend
  npm ci
  export ANDROID_HOME="$PREFIX/opt/android-sdk"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android
  npx cap sync android
  cd android
  ./gradlew assembleDebug
  termux-setup-storage
  cp app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/Demonanic-debug.apk"
  ```

  The printed HEAD should be `cc0019a4ac4e5432578dd7cc677210cccf422831` or a later review-branch commit containing `38c679e`. If `platforms/android-36/android.jar` or `build-tools/35.0.0/aapt2` is absent and `sdkmanager` is available, install the required components with `sdkmanager "platforms;android-36" "build-tools;35.0.0" "platform-tools"`, accept licenses with `yes | sdkmanager --licenses`, then rerun Gradle. The expected APK is `frontend/android/app/build/outputs/apk/debug/app-debug.apk`; copy it to shared storage only after confirming it exists. Keep any local modifications out of the clone used for building.
- The latest handoff update is committed separately; this APK build did not change gameplay source files. The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and report back.

## 42. Require acknowledged starter-hero save before entering Home — 2026-10-24

### Starting point and confirmed gap

- Started from fetched `origin/review/mobile-working-copy` at `f3bb440466fff17d32b112f236e1476a020677d8`, in the isolated worktree `/tmp/demonanic-onboarding-fix`. The primary checkout remains on local `review/mobile-working-copy` at `42a6f78e1e867795711f2e83d3fa70d6c56f2676` with its four pre-existing user changes untouched: modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`.
- The source-confirmed gap was after “Begin Your Journey”: `GameProvider.beginClasslessJourney` updated UI state and used a 700 ms debounced save, then `SquadSelect` navigated to Home immediately. The delayed save logged a failure but did not return one to the onboarding screen. This allowed navigation before an authenticated `PUT /api/game/state` had been acknowledged; the server could retain only the empty profile created by the preceding POST. This is a verified code path, not a confirmed explanation of the user's specific device run.
- Initial profile creation remains the existing authenticated `POST /api/game/state` through `gameApi.createState`; the API interceptor adds the current bearer token. Backend `backend/server.py` exposes insert-only authenticated POST (201 `{ "ok": true }`) and authenticated PUT returns `{ "ok": true }`. No backend or API contract was changed.

### Implementation

- `frontend/src/context/GameProvider.jsx`: `beginClasslessJourney` is now asynchronous and waits for an explicit successful PUT acknowledgement before returning success for a server-backed new profile. It updates the in-memory state/ref once, preserving the same starter hero identity for retry; an unsuccessful or malformed acknowledgement returns a sanitized actionable error, and no delayed save can be mistaken for journey completion. It writes the local backup after server confirmation. HTTP 401/403 returns a login recovery action; HTTP 409 returns a reload action so the stale candidate cannot be blindly retried. An explicitly selected local device backup remains playable offline and continues to save locally without an unauthenticated server write.
- `frontend/src/screens/SquadSelect.jsx`: disables the action and shows “Saving Hero…” while the PUT is pending, blocks repeated taps, remains on onboarding after a failed save with a visible retry/session/conflict message, and navigates to Home only after the provider confirms persistence. Session rejection exposes Return to Login; profile conflict exposes Reload Saved Profile.
- `frontend/src/screens/onboarding.profile-flow.integration.test.jsx`: now renders the production `Home` screen after its provider route probe, verifies navigation is withheld while the PUT is pending, rapid double taps issue one PUT, failed PUT retry preserves the same single hero ID, malformed success acknowledgement does not navigate, 401 exposes logout, 409 reloads the server profile, serialized save/reload returns to Home without another profile creation, an existing saved profile still opens Home without POST/PUT, and an explicitly selected device backup remains locally playable offline.
- `frontend/src/screens/SquadSelect.classless.test.jsx`: adapted component tests to the now-async click handler and visible failure copy.
- No backend, production profile, account, API, or deployment changes were made. Existing legacy/profile-loading behavior was not redesigned.

### Validation and evidence

- From `frontend/`, attempted `CI=true npm test -- --watchAll=false --runInBand --silent src/screens/onboarding.profile-flow.integration.test.jsx src/screens/SquadSelect.classless.test.jsx src/context/GameProvider.test.jsx src/apiConfig.test.js` — **BLOCKED before Jest starts**. The shell's `node` is `/data/data/com.termux/files/usr/bin/node` and exits with `CANNOT LINK EXECUTABLE "node": cannot locate symbol "_ZNSt6__ndk113__hash_memoryEPKvm"`. Retried with elevated command execution; same result. Therefore the new or regression tests have not passed in this environment.
- From `frontend/`, attempted `npm run build` — **BLOCKED before the build starts** by the same Node linker error. No frontend build or APK was produced.
- From the repository root: `git diff --check` — PASS.
- `adb devices -l` showed a connected Samsung Android device. A filtered `adb logcat -d -t 1000 -s AndroidRuntime:E Capacitor/Console:E chromium:E` snapshot returned no matching error lines. This is only a log snapshot; no app was tapped, no profile was created, and no device reproduction or visual/on-device verification occurred. No dedicated disposable credentials were available, and no existing account was used.
- Backend tests were not run because no backend code changed. Existing-profile preservation is covered in the added frontend mock-IO test only; the actual deployed backend, real authenticated POST/PUT, app restart, and account recovery have not been verified in this pass.

### Publication and retest

- Source commits `74710a239e996fee9a4f3884554bac2bf3205517` (`Wait for starter hero profile save`), `7f9dc712a1d38c73ad466894f9e3306e74b59e57` (`Add safe recovery actions for onboarding save errors`), and `ab810af9bb6291db9f3ff944bfb5ad1e723a1c53` (`Preserve offline onboarding from device backups`) were pushed to `origin/review/mobile-working-copy`. Together they contain only the provider, SquadSelect, and two onboarding test files. The final source tip before this handoff-only update is `ab810af9bb6291db9f3ff944bfb5ad1e723a1c53`; this documentation-only commit is being published separately. Verify the resulting remote HEAD before relying on it.
- Required next verification before calling the phone issue fixed: use a compatible Node environment to run the focused tests and `npm run build`; install a fresh APK built from this published branch; with a dedicated disposable account, register/login, create the one-hero profile, confirm Home and Preparation render, force-stop/restart and confirm the same hero loads, then separately log into a known existing account and confirm its saved profile remains unchanged. Do not use production accounts for creation tests.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and report back.

## 43. Classless screen compatibility and render-error fallback — 2026-10-24

### Starting point and diagnosis

- Continued in isolated worktree `/tmp/demonanic-onboarding-fix` from the published review tip `b0d430f861bb90a6ddea20a71e9b12e774f4b246`; the primary checkout and its four user-owned PerkTree/ROADMAP changes were not edited. The worktree was detached for isolation; intended publication target remains `review/mobile-working-copy`.
- Source inspection confirmed the reported structural mismatch. `heroModel.js` stores classless identity, stats, HP, and level under `identity`, `combat`, and `progression`; `logic.js::heroDerived` previously immediately read `HERO_CLASSES[hero.cls]` and `hero.stats`. `Armory` called it before selecting either Vault or Shoppe, then read `hero.cls` and top-level stats in the Vault. This made the shared Armory/Shoppe route unsafe for a classless starter. Battle Details passed the Engine runtime wrapper into `HeroCard`, whose legacy rendering assumed class, top-level HP/stats/XP and class attack configs. Battle manual banner similarly read `state.heroes[i].name`. Academy UI and training records used legacy `id/name/stats`, so classless records could render incorrectly or fail to find their hero at completion/reload.
- This establishes source-level failure paths and reproduces the `heroDerived` path in a focused test. It does not verify which screen caused the user's phone behavior or reproduce that behavior on a device. No evidence showed these rendering reads mutate saved data.

### Implementation

- `frontend/src/game/logic.js`: made `heroDerived` a safe read model for classless nested combat data. Legacy formulas remain below the new classless branch unchanged. Adapted Academy training duration, stable ID lookup, stat completion, and training counters to read/write classless `combat.stats` and `progression.academyTrainingCounts`, while preserving legacy top-level behavior. Classless training changes the selected combat stat; it does not add legacy-only max-HP growth.
- `frontend/src/context/GameProvider.jsx`: profile normalization now retains active and paused Academy course records keyed by classless `identity.id` as well as legacy `id`.
- `frontend/src/components/CastleBuildings.jsx`: Academy rows now display nested name/level/stats/HP, use stable identity IDs, and allow the existing stat course to complete for classless reserves.
- `frontend/src/screens/Armory.jsx`: classless heroes can render the shared Armory and open Shoppe; Vault identity/stat presentation is nested-field safe. Because the classless combat path does not apply legacy equipment bonuses, the Vault explains that equipment combat support is pending and does not offer Equip/Unequip for classless heroes. Shoppe transactions and legacy equipment remain unchanged.
- `frontend/src/components/cards.jsx`: Battle Details now recognizes the Engine's classless runtime wrapper and renders its model, nested combat/progression values, identity color, and tactical controls without class assumptions. Added a JSON clone fallback for WebViews lacking `structuredClone` in this component.
- `frontend/src/screens/Battle.jsx`: manual mode label uses classless identity name with legacy-name fallback.
- `frontend/src/screens/Preparation.jsx`: rewarded revival writes nested classless HP and does not create top-level legacy HP fields. Existing preparation row behavior remains as implemented.
- `frontend/src/components/ScreenErrorBoundary.jsx` and `frontend/src/App.js`: added a screen-level React error boundary with a non-sensitive, actionable reload message; it does not expose raw exception text or modify game state.
- Tests: `logic.classlessScreens.test.js` covers classless derived display values, nested Academy training, normalized course identity, and legacy Knight derivation. `Armory.classless.test.jsx` renders the classless Armory and opens Shoppe. `HeroCard.progression.test.jsx` exercises the classless Engine wrapper in Details. `CastleBuildings.recruitment.test.jsx` exercises Academy display/enrollment for a classless reserve. `ScreenErrorBoundary.test.jsx` checks the fallback. Existing Academy, provider, and Battle tactical-flow regressions were also run.

### Validation and limits

- Repaired Node execution for this shell without changing machine configuration: invoking Termux Node/npm with `LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib` avoids the pre-existing linker failure caused by the default library path.
- The first test-harness attempt failed before component tests could load: the repo does not provide `@testing-library/react`, and Jest needed the project's virtual mocks for `@/` imports. The new component tests were rewritten to use the existing React DOM `createRoot`/`act` convention; the successful runs below use that harness. No gameplay assertion failure remained.
- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand --silent src/game/logic.classlessScreens.test.js src/screens/Armory.classless.test.jsx src/components/ScreenErrorBoundary.test.jsx src/game/logic.academy.test.js src/screens/Battle.tactical-flow.test.jsx src/context/GameProvider.test.jsx src/components/HeroCard.progression.test.jsx src/components/CastleBuildings.recruitment.test.jsx` — PASS, 8 suites / 57 tests.
- After changing error-boundary copy to omit raw exception details, reran `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand --silent src/components/ScreenErrorBoundary.test.jsx src/screens/Armory.classless.test.jsx src/game/logic.classlessScreens.test.js` from `frontend/` — PASS, 3 suites / 6 tests.
- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib /data/data/com.termux/files/usr/bin/npm run build` — PASS, optimized production bundle 223.61 kB JS / 14.07 kB CSS gzip. npm printed an upgrade notice; the build compiled successfully.
- `git diff --check` — PASS (run from the repository worktree; no output).
- No backend code changed; no backend test was needed. No full test suite, live backend/account/profile operation, Android APK build, or device test was run. The current build/test evidence is web/Jest only. Screen-level mocks exercise the components, while provider normalization and Academy helpers use production code; there was no whole-device onboarding-to-combat session.

### Remaining compatibility limits and next action

- Classless Vault equipment application is intentionally unavailable because the classless Engine does not consume legacy equipment-derived stats; inventory purchases/sales and legacy equipment remain available. This is a visible compatibility boundary, not a claim that classless equipment is integrated.
- Phone-specific WebView behavior and the user's exact runtime error remain unverified. The next check is to install a fresh APK from the published review branch, open the Armory and Shoppe, inspect Battle Details/manual mode, and enroll/complete an Academy course using a disposable profile; verify the saved profile still reloads. Do not use production accounts for destructive creation tests.
- No deployment, merge, production profile access, or production data change occurred. The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back.
- Implementation commit: `6dd5b9b898c0dc6ef42b38ed3cc07dce8f79c9a4` (`Guard shared screens for classless heroes`), containing the 14 frontend implementation/test files listed above. The branch was verified at `b0d430f861bb90a6ddea20a71e9b12e774f4b246` before publication. The source commit was pushed first; handoff-only commit `405e6733e56bc3b54168858317e83956e8ebd94a` was pushed next. A subsequent fetch verified `origin/review/mobile-working-copy` at `405e6733e56bc3b54168858317e83956e8ebd94a`, and the remote handoff contained this Section 43. No local source changes remained in the isolated worktree at that verification point.

## 44. Fix Preparation render failure for the classless starter — 2026-10-24

### Root cause and implementation

- Continued from verified `origin/review/mobile-working-copy` HEAD `5d2d0e1ed33cfed27bc9feb237cea356473d420c`, in an isolated worktree. The primary checkout remains on local `review/mobile-working-copy` at `42a6f78e1e867795711f2e83d3fa70d6c56f2676`; its pre-existing modified `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js`, plus untracked `frontend/src/components/PerkTree.test.jsx`, were not edited or staged.
- Confirmed render crash: `Preparation` always renders `PrepField`. Its hero marker used `C.HERO_CLASSES[h.cls].color`. New classless heroes intentionally have no `cls`, so this lookup returned `undefined` and reading `.color` threw during preparation render. The existing `Preparation.classless-gate.test.jsx` had mocked `PrepField`, hiding the production child failure; the generic `ScreenErrorBoundary` then replaced the screen with its error message.
- `frontend/src/components/PrepField.jsx` now selects the legacy class color when present, otherwise the classless hero's persisted `appearance.identityColor`, with a cyan fallback. It also uses stable classless `identity.id` for the React key. Legacy class appearance remains unchanged.
- `frontend/src/components/PrepField.test.jsx` now renders actual classless and legacy hero markers and checks their colors. `frontend/src/screens/Preparation.classless-gate.test.jsx` now renders the real `PrepField` inside `Preparation` and asserts the classless marker appears before entering battle, rather than mocking that child.
- Source implementation commit: `e9c5d12a47d13ec501fe178d01a7eee0b0cea223` (`Fix classless preparation field crash`), containing only those three implementation/test files.

### Validation and limits

- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand --silent src/components/PrepField.test.jsx src/screens/Preparation.classless-gate.test.jsx src/screens/classlessScreen.integration.test.jsx` — PASS, 3 suites / 8 tests. This uses actual `PrepField` and `Preparation` rendering with the repository's existing isolated component mocks; it does not reproduce the user's installed APK or live account.
- Test setup note: the isolated worktree initially had no `node_modules`, so the first invocation stopped with `craco: not found`; tests then ran against the already-installed repository dependencies through a temporary worktree symlink. An intermediate version of the new assertion also failed because the DOM normalizes `#F02DCA` to `rgb(240, 45, 202)`; the assertion was corrected and the final full focused command above passed.
- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib /data/data/com.termux/files/usr/bin/npm run build` — PASS, optimized bundle 223.62 kB JS and 14.07 kB CSS gzip.
- From the worktree root: `git diff --check` and `git diff --cached --check` — PASS. No backend changes, APK build, Android install, phone test, deployment, or production-data access occurred.
- The exact root cause is verified by the production source path and the test that now renders the actual preparation child. Whether this was the only issue on the user's phone remains unverified until a fresh Android build is installed and the Preparation screen is opened there.

### Publication and next step

- The source commit is based directly on verified remote tip `5d2d0e1ed33cfed27bc9feb237cea356473d420c`. Handoff-only commit `eaab6d8e4b2d03a1d249113f8577bbc41c36834e` was pushed after the source commit and verified as the remote review-branch tip; this handoff-only correction is published separately afterward. No merge, deployment, or Android build was performed.
- Next: build and install a fresh Android APK from the published review tip, sign in using the appropriate test profile, open Preparation, and verify the battlefield field and hero markers render. If another error screen appears, record the screen and sanitized runtime error; do not infer device success from this web build.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review its evidence, and report back.

## 45. Enable existing equipment for classless heroes — 2026-10-25

### Scope and implementation

- Continued from verified `origin/review/mobile-working-copy` HEAD `8db0aaa31ba251180b58e4b697170763b545c0d3` in an isolated detached worktree. The primary checkout remains on local `review/mobile-working-copy`; its pre-existing ROADMAP/PerkTree changes were not touched or staged.
- Connected existing catalog equipment to classless heroes without changing their saved base stats. `Armory` now offers existing equip/unequip controls for classless heroes. Generic catalog stats are calculated in the shared derived-stat path and classless Engine runtime: attack, defense, agility, intelligence, max HP, critical chance, and critical damage. Base stats and `combat.maxHp` remain unchanged; gear bonuses are derived once, avoiding compounding through Engine recreation, serialization, or normalization.
- Classless heroes can equip a secondary item without requiring a legacy class identity. This applies only the item's generic catalog stats; no class-specific secondary identity bonus is assigned. The canonical specification leaves secondary identity modifiers unresolved, so those remain excluded.
- Preparation HP display now uses derived maximum HP. Equip/unequip clamps current classless HP to the new maximum where needed and does not heal on equip. Legacy class equipment derivation and eligibility paths are preserved.
- Backend offline recovery now derives the same classless maximum HP from saved base HP, equipped `maxHP` bonuses, and owned W1's 8% maximum-HP modifier. It preserves the saved base `combat.maxHp`, existing recovery rate/cap, dead-hero behavior, and legacy top-level recovery.

### Validation

- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand --silent src/game/logic.classlessScreens.test.js src/game/engine.classless.test.js src/screens/Armory.classless.test.jsx src/game/engine.abilities.test.js src/game/engine.perk-characterization.test.js src/game/logic.progression.test.js` — PASS, 6 suites / 92 tests. Coverage includes Armory equip/unequip and Shoppe access, generic secondary equipment, classless battle-derived stats and max HP, non-compounding, save/normalize reload, and legacy Knight equipment derivation.
- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib /data/data/com.termux/files/usr/bin/npm run build` — PASS; optimized gzip bundle 223.83 kB JS / 14.07 kB CSS.
- From `backend/`: `PYTHONPATH=/tmp/demonanic-profile-test-py312 python3.12 -m pytest -q tests/test_classless_offline_recovery.py tests/test_profile_creation_safety.py` — PASS, 12 tests, 8 existing FastAPI lifecycle deprecation warnings. The first run exposed that `_offlineGains.heroHpRecovered` is rounded to one decimal; the assertion was corrected to match the existing reporting behavior and the same focused command then passed.
- `git diff --check` — PASS.
- No Android APK/device or live account/production-data test was run. Backend tests use disposable in-memory state; no MongoDB or live service was contacted. The offline recovery calculation is covered by tests but has not been exercised against deployed backend data.

### Files and status

- Intended implementation/test files: `frontend/src/game/classlessCombatEffects.js`, `frontend/src/game/engine.js`, `frontend/src/game/equipment.js`, `frontend/src/game/logic.js`, `frontend/src/screens/Armory.jsx`, `frontend/src/screens/Preparation.jsx`, `frontend/src/game/engine.classless.test.js`, `frontend/src/game/logic.classlessScreens.test.js`, `frontend/src/screens/Armory.classless.test.jsx`, `backend/server.py`, and `backend/tests/test_classless_offline_recovery.py`.
- Equipment support is a bounded compatibility slice; it does not complete the classless rebuild. Remaining work points include unfinished Phase 1 passive/active/signature mechanics and their acceptance coverage, Android verification of equipped combat and offline recovery, visual inspection of the existing VFX on Android, unresolved Library/spell/Academy support, and later item/consumable work. Phase 1.5/2 content and unresolved canonical decisions remain gated.
- Next recommended implementation: audit and connect one dependency-complete set of remaining Phase 1 combat mechanics against the canonical bible, with tests for the actual Engine consumer. Then build/install an APK and check preparation, equipment combat, offline recovery, and the existing battle visuals on device.
- Source implementation commits: `f57773fab64c0f297f9064a8b2ddbb654a4d5be3` (`Enable existing equipment for classless heroes`) and `50ea2aa322a3977c5d5d86a65940a9f619e53609` (`Use effective classless max HP for offline recovery`). Handoff-only commits `46fc0d9b637235fadd3112ebfc3be25254fa5177`, `fa44198ced73052beebe714d1d26511ac03546ec`, and `453285b462cb36290fcae23afc608a62439d6803` record/publish the first checkpoint. This current backend-recovery update is being recorded in another handoff-only commit. No merge, deployment, or production-data access is part of this work. The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and report back.

## 46. Add Fortune Jackpot to classless combat — 2026-10-25

### Starting point and canonical scope

- Continued from verified `origin/review/mobile-working-copy` HEAD `394f75264c1853b40b0d2840e0d68006c083067e` in the isolated worktree `/tmp/demonanic-continuation`. The primary checkout remains on `review/mobile-working-copy` at `42a6f78e1e867795711f2e83d3fa70d6c56f2676`, 27 commits behind this published work, with the same four pre-existing ROADMAP/PerkTree changes preserved and unstaged.
- The bible defines F3 Jackpot as Tier III, 3 AP, level 10, requiring any Fortune Tier II node, 35-second cooldown, and the next three direct hits as guaranteed critical hits. Guaranteed crit bypasses the 50% crit-chance cap but not the 250% crit-damage cap. F2 Loaded Dice remains unimplemented because its stated outcomes conflict with its neutral expected-value claim; this work does not resolve that inconsistency.
- Inspection also confirmed T3 Opening, T3a Formation, and C2 Echo already have runtime consumers and focused Engine coverage in the current branch. C2a Ward remains deliberately unavailable: its rule says “in range” but supplies no radius. No value was guessed.

### Implementation

- Added F3 to the existing `classlessAbilities.js` registry. Existing classless progression validation now permits its purchase only through canonical F1/F2 ownership, level, AP, prerequisite, and tier-cap rules.
- `Engine` activation sets three transient guaranteed-hit charges and starts the existing active-cooldown path at 35 seconds, subject to the hero's approved active cooldown reduction. Direct classless hits consume one charge each; area and damage-over-time events do not consume a charge. Damage uses the existing critical multiplier, including its 250% cap. The hit state is battle-runtime only, consistent with existing ability cooldown state.
- TacticalMenu routes its F3 button through the supplied ability callback and displays the remaining guaranteed-critical charges while active. This is component-to-Engine integration coverage; the test does not mount the complete Battle screen or run a natural wave.

### Validation

- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand --silent src/game/classlessAbilities.test.js src/game/classlessProgression.test.js src/game/engine.classless.test.js src/components/TacticalMenu.test.jsx src/game/engine.abilities.test.js src/game/engine.perk-characterization.test.js` — PASS, 6 suites / 139 tests. Includes ability definition and ownership, canonical F3 purchase/duplicate rejection, exactly three direct guaranteed crits, non-consumption by area damage, cooldown enforcement, TacticalMenu click routing to Engine, active-charge UI, and legacy ability/perk regressions.
- During test development, an initial four-suite run had one assertion failure because the test expected a 150% crit while the fixture owned F1 (which raises crit damage to 165%). The expectation was corrected to use the Engine's derived critical multiplier; the final six-suite command above passed.
- From `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib /data/data/com.termux/files/usr/bin/npm run build` — PASS; 224.03 kB JS and 14.07 kB CSS gzip.
- `git diff --check` — PASS. No Android APK, device, live backend, or profile data was tested or modified.

### Files, status, and next work

- Source files: `frontend/src/game/classlessAbilities.js`, `frontend/src/game/engine.js`, `frontend/src/components/TacticalMenu.jsx`; tests: `frontend/src/game/classlessAbilities.test.js`, `frontend/src/game/classlessProgression.test.js`, `frontend/src/game/engine.classless.test.js`, and `frontend/src/components/TacticalMenu.test.jsx`.
- The Phase 1 system is still incomplete. Unfinished areas include the remaining current-phase active abilities and six signatures/shared lockout, incomplete current-phase passive effects, A2 element selection and Arcana effects, Ward pending an approved range, and Loaded Dice pending an approved interpretation. Phase 1.5/2 gates remain closed. Android VFX/equipment verification, full Library/spell/Academy work, and the later items/consumables pass also remain.
- Next recommended code pass: implement the canonical Gambler signature together with a reusable shared signature lockout, if its eligibility and persistence boundaries can be kept separate from titles; then continue the remaining Phase 1 signatures/abilities. After a meaningful combat batch, run a reproducible balance scenario and build/install on Android for visual/runtime checks.
- Implementation commit: `229872d21ecfea255a85de170b30c1f63eb6fdf5` (`Implement Fortune Jackpot combat ability`), based directly on verified remote HEAD `394f75264c1853b40b0d2840e0d68006c083067e`. It was pushed before handoff-only commit `e231a3399665db0641a04065792f5baa3a09a47f`; fetch and `git ls-remote` verified the review branch at that handoff commit. No deployment, merge, or production-data access occurred. The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and continue from that checkpoint.

## 47. Classless recruitment market design simulation — 2026-10-26

### Scope and checkpoint

- Continued from published `origin/review/mobile-working-copy` HEAD `81a3acf38d8b889d5e16a2314bfa6ff0b31989f5`. The primary checkout remains on local `review/mobile-working-copy` at `42a6f78e1e867795711f2e83d3fa70d6c56f2676`, 30 commits behind, with its four existing local user changes preserved. No gameplay files, production data, account, backend service, or deployment were changed.
- The owner clarified that a market slot whose hero is purchased stays blocked/empty until the scheduled refresh; it must not refill immediately. This is the recommended market rule to carry forward.
- This is a design recommendation backed by a bounded simulator, not an approved economy implementation or final balance lock.

### Simulator and evidence

- A temporary Jest simulation imported the published production `config.js` and `logic.js` functions, specifically `buildWave`, `productionRates`, `ENEMY_TIERS`, and the configured morale/reward values. It used deterministic seeded wave composition (`20261026 + wave`), one level-1 hero (castle power 1), one gold worker, 50% mine gold allocation, a full-health castle, and no towers. Kill-gold was calculated from the real generated enemy tiers. Morale advanced using the Engine's per-tier kill rewards plus the configured wave-completion award.
- Three deliberately bounded spending/time scenarios retained 80% of earned gold at 5 minutes per cleared wave (low defense spend), 55% at 8 minutes (typical), and 30% at 12 minutes (high). The retention fractions and durations are scenario assumptions, not measured player telemetry. Earned enemy and mine gold were included; tower construction/upgrade, repairs, other purchases, surrender/resource losses, equipment, and variable castle power were not simulated. Thus this estimates affordability pressure and offer stock, not actual campaign success or hero value.
- Seeded opening wave results: W1 8 enemies / 32 kill-gold / 3.50 gold per minute; W2 10 / 40 / 4.07; W3 10 / 46 / 4.76; W4 20 / 111 / 5.00; W5 23 / 285 / 5.00. Wave 5 includes its configured boss and elite pressure. The mine rate reflects the production morale multiplier, which rises to its cap under the modeled kill/completion morale awards.
- First affordability from the initial 500 gold, with income spending retained as above (no recruitment purchases subtracted):

  | Scenario | L1 recruit $1,100 | Veteran 2× $2,200 | Veteran 2.5× $2,750 | Specialist 3× $3,300 | Specialist 4× $4,400 |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | Low spend | W6 | W12 | W15 | W17 | W20 |
  | Typical | W8 | W15 | W18 | W20 | Later than W20 |
  | High spend | W10 | Later than W20 | Later than W20 | Later than W20 | Later than W20 |

- Simulated offer stock through ten completed waves: refresh every three waves supplies 16 offer slots (initial four plus three refreshes); every four or five waves supplies 12 (initial four plus two refreshes). The six-hero owned cap permits at most five additional purchases after the starting hero. Consumed slots remain blocked until the refresh under the owner's rule.
- Exact command from `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand src/game/RecruitmentMarketSimulation.tmp.test.js` — PASS, 1 suite / 1 test. The temporary simulation test was removed after execution. `git diff --check` — PASS. No production build or gameplay test was run because no production code changed.

### Recommendations, limits, and next step

- Start testing a five-cleared-wave refresh interval: the four-slot market then offers 12 total slots across ten cleared waves, above the maximum five additional purchases, while avoiding the extra churn/oversupply of a three-wave cadence. Refresh only after wave completion. Purchases leave the specific slot visibly empty and unavailable until that refresh; unaffordable offers remain stable.
- Use four offers, with two entry recruits, one veteran, and one rotating veteran/specialist. For a classless game, the two level-1 choices must not be different classes: new heroes share the approved baseline and Shared Strike. Until legal generated builds exist, those two offers differ cosmetically only and do not create a strategic power distinction. Developed offers should differ by valid purchased-node/stat/equipment package and descriptive role tags, never a permanent class or title-based eligibility.
- As a first price experiment, anchor an entry recruit at the current classless first-hire reference ($1,100), test a veteran at 2× ($2,200), and a specialist at 3× ($3,300). In this model those premiums become affordable at W12/W17 in the low-spend case, W15/W20 in the typical case, and remain unavailable through W20 in the high-spend case. The 2.5×/4× alternatives pushed those options later still. This supports testing the low end of the proposed premium ranges, not declaring those prices balanced.
- Keep roster-size pricing separate from offer development value. The current classless recruit formula starts at $1,100 and escalates to $1,760, $2,816, $4,506, and $7,209 by owned count. Applying that full exponential surcharge on top of veteran/specialist multipliers risks making late-slot offers unreachable. Do not stack both curves by default; if a roster adjustment is retained, test a small, separately visible surcharge after the base tier prices.
- Significant limitation: the current classless recruitment implementation creates the same baseline hero, while no stable offer-market generator, stored seed, veteran build generator, or package valuation exists. The simulator cannot value perk synergies, equipment, role coverage, or the combat contribution of a generated developed hero. It also holds castle power at one and assumes successful complete waves. The next practical step is a disposable-profile market prototype/simulation with legal generated classless builds and actual tower/recovery spending, before implementing persisted rotating offers or committing to prices.
- The exact phrase `work done` means ChatGPT should retrieve the latest **published** `docs/CHATGPT_HANDOFF.md`, review the evidence, and report back.

## 48. Compare classless recruitment packages with defense spending — 2026-10-27

### Scope and method

- Continued from published `origin/review/mobile-working-copy` HEAD `0952bf3d8092fb233aecdfc7db88da60de069ccc` in the isolated temporary worktree `/tmp/demonanic-continuation`. The primary checkout and its four preserved ROADMAP/PerkTree user changes were not edited.
- A temporary Jest harness used production `Engine.update()`, `buildWave()`, classless hero creation/progression/purchases/stat allocation, equipment definitions, tower/barricade purchase helpers, and defense repair. It created fresh disposable local profile state for each encounter. It compared one baseline hero, a second baseline recruit, a legally progressed level-5 Warden-style build, a legally progressed level-10 Precision-style build, and one archer tower plus two barricades. The latter spent 1,100 construction gold plus the configured 8-gold upkeep. The veteran bought W1/W2 and E2 chest/helm equipment; the specialist bought P1/P2/P2a/P3, allocated earned SP to Attack, carried E3 weapon/chest/boots, and used Execution through the Engine when available. No permanent class was assigned.
- Wave generation and combat random rolls used deterministic seeds. Each option was run five times on waves 1 and 5 (50 encounters total). Hero packages were placed at full derived HP. Tower/barricade construction used actual purchase helpers; defense repair used the production repair helper after each simulation.

### Results

| Wave / option | Package cost | Clears | Avg. enemies | Avg. kills | Avg. hero deaths | Avg. hero HP left | Avg. castle HP left | Avg. duration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| W1 one baseline hero | 0 | 5/5 | 8.0 | 8.0 | 0.0 | 300/300 | 1000 | 33.4s |
| W1 second baseline recruit | 1,100 | 5/5 | 8.0 | 8.0 | 0.0 | 600/600 | 1000 | 29.7s |
| W1 level-5 veteran | 2,560 | 5/5 | 8.0 | 8.0 | 0.0 | 646/646 | 1000 | 29.5s |
| W1 level-10 specialist | 4,988 | 5/5 | 8.0 | 8.0 | 0.0 | 640/640 | 1000 | 29.0s |
| W1 tower + two barricades | 1,108 incl. upkeep | 5/5 | 8.0 | 8.0 | 0.0 | 300/300 | 1000 | 20.2s |
| W5 one baseline hero | 0 | 0/5 | 28.2 | 17.8 | 0.8 | 6/300 | 678 | 55.4s |
| W5 second baseline recruit | 1,100 | 1/5 | 27.8 | 19.0 | 1.8 | 60/600 | 721 | 56.9s |
| W5 level-5 veteran | 2,560 | 2/5 | 30.4 | 22.8 | 1.4 | 85/646 | 617 | 61.6s |
| W5 level-10 specialist | 4,988 | 2/5 | 33.4 | 24.4 | 1.6 | 74/640 | 788 | 59.1s |
| W5 tower + two barricades | 1,108 incl. upkeep | 3/5 | 31.4 | 26.8 | 0.4 | 82/300 | 591 | 67.5s |

Tower/barricade sample details: the first W5 run cleared in 80.2s, killed 33/33, ended with 143/300 hero HP and 437 castle HP, and the repair helper reported 19 gold/10 stone. The specialist used Execution an average of 1.0 times in W1 and 1.8 times in W5. Higher-level hero packages increased wave enemy counts through their campaign-power contribution; package comparisons therefore include a difficulty increase, not just more hero damage.

### Recommendation and limits

- Keep the occupied-offer-slot rule already recorded in Section 47: after purchase, that slot stays empty/unavailable until the scheduled refresh; unpurchased offers, including unaffordable ones, remain stable. This pass did not implement a market.
- The sampled W5 results show a useful strategic tradeoff: 1,100 gold spent on tower/barricade defense had the highest W5 clear count (3/5) and lowest average hero deaths (0.4), while the 4,988-gold specialist package killed more enemies on average than a baseline hero (24.4 vs. 17.8) but cleared only 2/5. The defense option also faced more enemies on average than the baseline (31.4 vs. 28.2), and had lower mean remaining castle HP (591 vs. 678), so it did not establish a universally superior purchase. The five-seed sample is directional only.
- This supports testing the affordable entry recruit and defense as competing early choices, while keeping veteran/specialist offers as premium options whose value depends on valid builds. It does not establish final market prices: the veteran/specialist prices were test inputs (2x/3x the 1,100 entry anchor plus catalog equipment buy values), not values solved by the simulator. The two baseline recruit choices remain cosmetically different only unless a future approved system creates meaningful classless variation.
- Limitation: this was a seeded battle-snapshot comparison, not a continuous campaign economy simulation. It did not simulate gold income and purchases across sequential waves, offer refreshes, player decision timing, recruitment-slot pressure, losses/revival, routine tower repairs/upgrades over multiple waves, or statistical variation beyond five seeds per scenario. Equipment packages and builds were valid production progression/equipment data, but authored representative packages rather than a production market generator. The harness also triggered Execution automatically when available; it did not validate TacticalMenu interaction. No production profile, backend, Android device, or live service was used.
- Exact command from `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand src/game/RecruitmentMarketEngineSimulation.tmp.test.js` — PASS, 1 suite / 1 test covering ten scenario aggregates and 50 deterministic Engine encounters. `git diff --check` — PASS. The temporary simulation test was removed afterward. No production source, frontend build, Android APK, or device test was part of this task.
- Next useful decision evidence is a longer sequential campaign simulation that spends actual earned gold on offers, towers, upkeep, repairs, and upgrades while preserving blocked offer slots through five-wave refreshes. Use multiple seeds and report campaign survival and remaining resources before locking prices or finalizing market tiers. The five-wave refresh remains a candidate, not a simulated optimum.
- No implementation, deployment, or production-data access occurred. The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review the evidence, and report back.

## 49. Sequential recruitment and defense campaign simulation — 2026-10-27

### Method and assumptions

- Continued from published `origin/review/mobile-working-copy` HEAD `471f928fb0544186ed457ffa95df5866db92a075` in the isolated `/tmp/demonanic-continuation` worktree. The primary checkout and four pre-existing ROADMAP/PerkTree changes remain untouched.
- A temporary Jest harness ran 18 disposable campaign trajectories (six policies × common seeds `601`, `1409`, and `3779`) for up to ten cleared waves. The 18 trajectories ended after 110 real `Engine.update()` battle attempts, because the one-hero start could not continue reliably beyond wave 5/6. It called production `buildWave`, `Engine`, `stageBattleCompletion`, `completeWave`, classless XP/progression, `produce`, paid revival and Free Life, recruitment, tower/barricade purchase, upkeep, resupply, repair, castle repair, and upgrade helpers.
- Eight minutes of production/recovery time were simulated after each cleared wave and after a defeat requiring return to preparation. This is the prior “typical” downtime assumption, not observed player timing. Combat generated gold/XP normally; heroes used Shared Strike automatically whenever the production Engine reported it available, and a hypothetical specialist used Execution when available. This is idealized action use, not TacticalMenu input.
- Policies: existing classless recruit helper and its roster cost curve; a hypothetical fixed $600 level-1 market recruit; veteran-first; specialist-first; defense-first; and a hybrid that built an archer tower then reserved funds for an entry hero. Candidate veteran/specialist packages were valid generated progression/equipment packages priced at $2,560/$4,988 as in Section 48. The market itself does not exist: initial four offers and refresh after five cleared waves were modeled in the harness. Purchased slots were removed until refresh; unused offers stayed stable. No production market state was changed or claimed.
- Defense policy used actual purchase/maintenance helpers and reserved configured tower upkeep before optional spending. The Engine charged upkeep at each wave start; preparation attempted actual ammunition resupply and pooled defense repairs when affordable. Realized repair and ammunition gold spending happened to be zero in these sample runs. This run therefore includes those decisions and rules, but does not establish their average long-run cost under richer defense builds.

### Results

| Strategy | Mean clears | Reached wave 6 | Reached wave 10 | Mean ending gold | Mean ending castle HP | Mean roster | Mean kills | Mean hero-death events | Mean towers built / remaining | Mean upkeep + ammo spending |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current-price recruit-first | 4.0 | 0/3 | 0/3 | 398 | 1104 | 1.0 | 73 | 2.0 | 0 / 0 | 0 |
| Hypothetical $600 entry offer | 4.0 | 0/3 | 0/3 | 131 | 1166 | 2.0 | 95 | 5.0 | 0 / 0 | 0 |
| Veteran-first ($2,560 package) | 4.0 | 0/3 | 0/3 | 398 | 1104 | 1.0 | 73 | 2.0 | 0 / 0 | 0 |
| Specialist-first ($4,988 package) | 4.0 | 0/3 | 0/3 | 398 | 1104 | 1.0 | 73 | 2.0 | 0 / 0 | 0 |
| Defense-first | 4.3 | 1/3 | 0/3 | 104 | 1172 | 1.0 | 90 | 2.0 | 1.3 / 0.7 | 45 |
| Hybrid tower + entry reserve | 4.3 | 1/3 | 0/3 | 326 | 871 | 1.0 | 100 | 2.0 | 2.0 / 1.0 | 55 |

- Current-price recruits, veterans, and specialists were never purchased in these trajectories. The fixed-$600 recruit was purchased once in wave 3 in each seed, raising the average roster to two and mean kills from 73 to 95, but did not increase cleared waves or wave-6 reach; all three runs still stopped on wave 5. This does **not** show $600 is a good price: it shows price alone did not solve survival in this small cohort.
- Defense and hybrid reached wave 6 in one of three seeds each, versus zero of three for the other strategies. Defense-first built 1.3 towers on average; hybrid built 2.0 but ended with 1.0 still present. These options faced wave difficulty changes as castle power grew and the samples were small. They are directional evidence that defense can add kills and occasionally buy a wave, not proof that either strategy is dominant.
- No strategy reached wave 10. Veteran/specialist package combat value remains untested in a campaign because those offers were unaffordable before the modeled wave-5 failures. The five-wave market refresh was only reached in two defense/hybrid trajectories; none bought into the refreshed market before failure.
- The ending hero states were defeated in the reported runs. One Free Life was used where available; following later defeat, the test waited eight minutes and attempted the production paid revival path. It stopped when revival was unaffordable or the attempt limit was reached. No ad-based revival was assumed. Hero recovery follows the configured 8% max HP/hour rule, so an eight-minute rest only restores about 1.07% HP; this constraint contributes to the failure point.

### Decision and limits

- Do not lock recruitment prices or implement the persistent market from this evidence. It shows a concrete economy/survival dependency: with a new one-hero profile, 500 starting gold, current kill rewards/production, Shared Strike used on cooldown, and eight-minute preparation intervals, the current $1,100 entry recruit and the premium packages are not bought before the W5 danger point. A fixed $600 test offer was attainable in W3 but did not improve milestone survival in three seeds. The next recruitment decision should follow early-wave survival/economy validation; lowering the price alone is not supported as a fix.
- Keep the owner’s blocked-slot rule. Continue treating five-cleared-wave refresh and four offer slots as design candidates; these trajectories were too short to test market cadence meaningfully. Do not add exponential roster surcharge to developed packages by default, but note this campaign used the current helper’s existing curve for its current-price-recruit comparison.
- Limitations: only three shared seeds, a maximum ten-wave target not reached, idealized automated Shared Strike, no tactical menu, no ads, no human decision quality, no routine repair/ammo expenditure in the resulting samples, and no live market generator. Campaigns stop on the five-wave wall, so veteran/specialist package value and offer refresh benefits are unresolved. This is a deterministic model using production combat/economy functions, not player telemetry or balance certification.
- Exact final command from `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true /data/data/com.termux/files/usr/bin/npm test -- --watchAll=false --runInBand src/game/RecruitmentCampaignSimulation.tmp.test.js` — PASS, 1 suite / 1 test, 18 trajectories / 110 Engine battle attempts. Earlier harness runs failed due to missing jsdom `structuredClone`, importing `freeLife` from the wrong module, and a stale expected trajectory count; these harness-only issues were corrected before the recorded passing run. `git diff --check` — PASS. The temporary test was removed; no gameplay source changed, so no production build was run. No Android, backend, production profile, or live-service check occurred.
- Next recommended simulation task: investigate early campaign survival and the affordability/revival bottleneck with tactical Shared Strike use modeled through the production ability API; then repeat the campaign comparison after specifying the player’s intended preparation-time and ad-revival assumptions. Do not proceed to persistent rotating offers or treat the candidate prices as final until those results exist.
- No gameplay implementation, deployment, or production-data access occurred. The exact phrase `work done` means ChatGPT should retrieve the latest **published** handoff, review its evidence, and report back.

## 50. Early campaign survival diagnosis — 2026-10-30 (published documentation update)

### Checkpoint and method

- Verified origin/review/mobile-working-copy with git ls-remote: 883408ef2938dd60b2ac4fd610c48ca33848c817, matching the authorized commit. Work ran only in detached worktree /tmp/demonanic-early-survival-883408e. The primary checkout was not edited, switched, reset, rebased, or stashed; its HEAD remains 42a6f78e1e867795711f2e83d3fa70d6c56f2676 and its four pre-existing ROADMAP/PerkTree changes remain intact.
- Read the handoff including Sections 47–49. Traced frontend/src/game/config.js, logic.js, engine.js, heroModel.js, classlessAbilities.js, battleCompletion.js, classlessBattleResults.js, context/GameProvider.jsx, screens/Battle.jsx, Preparation.jsx, Results.jsx, components/TacticalMenu.jsx, and relevant classless/wave tests.
- A temporary Jest diagnostic used fresh normalized local state, production buildWave, Engine.update() at 0.05-second steps, stageBattleCompletion, actual getHeroAbilityStatus + useHeroAbility("shared_strike"), produce, freeLife, reviveHero, healHero, tower/barricade purchase, upkeep, repair and resupply helpers. No persistent profile/API, backend, or live account was used.
- Paired isolated-wave comparison covered waves 1–5 with 12 seeds each, Shared Strike disabled versus production API auto-use: 120 encounters. Campaign comparison covered 40 trajectories (10 shared seeds for each of no optional spending, defense-first, balanced defense/recovery, and recovery-first), 245 battle attempts, up to seven cleared waves. Each campaign used a fixed eight-minute preparation interval after battle/defeat. Defense policy attempted one archer tower plus one barricade on the first preparation when affordable; balanced healed below 80% HP; recovery-only healed below 95%. These are scenario assumptions, not intended player behavior or required game timing.

### Measured results

| Wave | Clears without / with API Shared Strike | Mean kills without / with | Mean hero HP lost without / with | Mean boss adds with API use | Mean Shared Strikes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 12/12 / 12/12 | 8.0 / 8.0 | 0 / 0 | 0 | 2.2 |
| 2 | 12/12 / 12/12 | 10.0 / 10.0 | 1.3 / 0.7 | 0 | 3.3 |
| 3 | 12/12 / 12/12 | 10.0 / 10.0 | 2.6 / 1.8 | 0 | 3.2 |
| 4 | 7/12 / 8/12 | 17.6 / 17.8 | 188 / 170 | 0 | 4.5 |
| 5 | 0/12 / 0/12 | 14.5 / 15.1 | 300 / 300 | 2.3 | 3.7 |

- All 24 isolated W5 battles ended because the hero died (Engine reason “heroes”), not because the castle fell. Mean remaining castle HP was about 1,194.
- Campaign averages: no optional spend cleared 3.8 waves (0/10 reached W6); defense cleared 4.1 (2/10 reached W6, 1/10 W7); balanced cleared 4.2 (2/10 W6, 2/10 W7); recovery-only cleared 3.8 (0/10 W6). These small samples are directional, not calibrated odds.
- Defense and balanced spent about 330 gold on tower/barricade and about 72–74 stone on repairs on average. The tower dealt about 136, 208, and 273 damage on W1–W3. Compared with no tower, defense reduced average hero damage on W1/W2/W3 from 217/328/405 to 92/137/174. However, its added castle power raised later wave pressure: W5 averaged about 35.8 total enemies with defense versus 25.5 with no optional spending. Defense cleared W5 in only 2/12 runs; it helps but did not make the wave safe in this scenario.
- Eight minutes of preparation recovered about 3 HP on average per campaign. All ten no-spend, defense, and recovery trajectories eventually stopped at the harness’s eight-minute revival affordability checkpoint; this means “not affordable yet at that time,” not permanently unaffordable. Paid revival prices of $400–$600 occurred in later attempts as heroes leveled. The player can remain in preparation longer.

### Verified behavior and assessment

- W5 has a configured boss. While alive, Engine boss behavior periodically spawns two skeleton adds. This raised incoming pressure, but it is implemented behavior; this investigation found no specification or source evidence that it is a defect.
- Shared Strike was queried and activated through the production Engine API when it reported available. It modestly improved W4 in this sample but did not clear W5. This is idealized immediate activation, not the TacticalMenu input path; real input may be less effective.
- Engine reports defeat when all heroes die. In these W5 outcomes, castle HP remained high. stageBattleCompletion maps classless nested HP/XP by stable hero ID. Relevant Engine, wave, classless hero, battle result, and provider completion regression tests passed.
- Assessment, not confirmed defect: the strongest measured pressure is sustained hero damage in W4/W5 and the W5 boss/add wave. Tower defense reduces early hero exposure but increases later wave power. Slow HP recovery and rising paid-revival cost contribute to recovery pressure under the chosen eight-minute wait, but the game does not impose that waiting limit. No individual mechanic was established as a bug.
- Limitations: the campaign stops at an eight-minute checkpoint, uses fixed action policies, and does not model ads, TacticalMenu latency, human decisions, changing rest duration, production telemetry, or market offers. No balance values were changed.

### Validation and publication

- Temporary simulation command from frontend/: env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true npm test -- --watchAll=false --runInBand --cacheDirectory=/tmp/demonanic-early-survival-883408e/.jest-cache --runTestsByPath src/game/EarlyCampaignSurvivalDiagnosis.tmp.test.js — PASS, 1 suite / 1 test, 120 snapshots, 40 campaign trajectories, 245 battle attempts. One earlier harness run failed after simulation due to a reporting-variable typo; corrected before the passing run.
- Regression command from frontend/: env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true npm test -- --watchAll=false --runInBand --cacheDirectory=/tmp/demonanic-early-survival-883408e/.jest-cache --runTestsByPath src/game/engine.classless.test.js src/game/logic.wave-composition.test.js src/game/logic.classlessHero.test.js src/game/classlessBattleResults.test.js src/context/classlessBattleCompletion.provider.test.jsx — PASS, 5 suites / 59 tests.
- This handoff is the only intended tracked change in the isolated worktree. The temporary test and dependency/cache artifacts are not deliverables. No gameplay source changed. No frontend build, Android build/device check, backend/live-service test, or production data operation was performed.
- The handoff update was prepared from base 883408ef2938dd60b2ac4fd610c48ca33848c817 and contains documentation only. Its publication status and resulting commit SHA are reported in the Codex completion message; no gameplay source changed.

### Recommended next step

Do not tune recruitment prices yet. Compare no defense, one tower, and tower plus barricade with more shared seeds through W5, tracking target distribution, hero damage, tower kills/ammo, composition/power, and repair/upkeep. Separately measure time-to-revival-cost with actual preparation production rather than treating eight minutes as a hard cutoff. Then decide whether evidence points to a code defect or an owner-approved balance adjustment. Keep the Section 47 blocked-slot rule unchanged. The exact phrase “work done” means ChatGPT should retrieve the latest published handoff, review evidence, and report back.

## 51. Controlled early combat survival comparison — 2026-10-31 (local, unpublished)

### Checkpoint, scope, and method

- Verified `origin/review/mobile-working-copy` at `7bf715100933299ec774d0f3e3c47551001d12da`; the isolated worktree `/tmp/demonanic-controlled-survival-7bf7151` is detached at that exact commit. The primary checkout `/root/Demonanic` was not edited, switched, reset, stashed, or published from.
- Traced production `Engine` behavior in `frontend/src/game/engine.js` (`_selectEnemyTacticalTarget`, `_updateEnemy`, `_enemyAttack`, bolt/napalm resolution, `_damageCastle`, `_checkEnd`, tower firing and hit resolution); wave/power/economy helpers in `frontend/src/game/logic.js` (`castlePower`, `buildTower`, `buyBarricade`, `chargeUpkeep`, `resupplyTower`, `buildWave`); and wave/tower/barricade/revival formulas in `frontend/src/game/config.js`. Also checked classless normalization/creation, Shared Strike's Engine status/action methods, and related regressions.
- A temporary Jest harness ran production `buildWave` and `Engine.update(0.05)` with fresh disposable local state, one approved-baseline classless hero at 300 HP, and 20 common seeded runs for each of three strategies at each wave 1–5: 300 isolated encounters total. Strategies: A, no defenses; B, one archer tower using `buildTower`; C, the same tower plus a 400-HP lane-0 barricade using `buyBarricade`. The seed set was `102701 + 37*i` for `i=0..19`, offset by wave before use. The production `getHeroAbilityStatus`/`useHeroAbility` API auto-activated Shared Strike as soon as available. Each encounter charged actual tower upkeep and started with the actual full tower magazine.
- This is a *wave snapshot stress comparison*, not 60 sequential campaigns: every wave starts with a full-HP hero, fresh tower/ammo, wave-appropriate full castle HP, and the same 500 gold/150 stone budget. Defenses are constructed anew for each isolated encounter. Common seed does not force identical enemy composition when campaign power differs; wave generation deliberately incorporates that power. Automated enemy combat is not human/TacticalMenu input.

### Results

| Wave | Strategy | CP | Initial enemies (mean) | Total spawned (mean) | Enemy attacks aimed at heroes | Hero damage (mean) | Castle damage (mean) | Building damage (mean) | Tower damage / kills (mean) | Tower HP lost (mean) | Barricade damage | Hero survival / wave clear | Mean hero HP end | Mean castle HP end |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | A | 1 | 8 | 8 | 12.5% | 0.2 | 0 | 1.4 | 0 / 0 | 0 | 0 | 100% / 100% | 299.8 | 1000 |
| 1 | B | 2 | 8 | 8 | 0% | 0 | 0 | 0 | 147.6 / 4.8 | 0 | 0 | 100% / 100% | 300 | 1000 |
| 1 | C | 2 | 8 | 8 | 0% | 0 | 0 | 0 | 147.6 / 4.8 | 0 | 0 | 100% / 100% | 300 | 1000 |
| 2 | A | 1 | 10 | 10 | 14.3% | 0.2 | 0 | 1.4 | 0 / 0 | 0 | 0 | 100% / 100% | 299.8 | 1050 |
| 2 | B | 2 | 10 | 10 | 0% | 0 | 0 | 2.5 | 204.9 / 5.5 | 0 | 0 | 100% / 100% | 300 | 1050 |
| 2 | C | 2 | 10 | 10 | 0% | 0 | 0 | 2.5 | 204.9 / 5.5 | 0 | 0 | 100% / 100% | 300 | 1050 |
| 3 | A | 1 | 10 | 10 | 33.3% | 2.1 | 0 | 4.3 | 0 / 0 | 0 | 0 | 100% / 100% | 297.9 | 1100 |
| 3 | B | 2 | 10 | 10 | 0% | 0 | 0 | 2.2 | 263.3 / 5.5 | 0 | 0 | 100% / 100% | 300 | 1100 |
| 3 | C | 2 | 10 | 10 | 0% | 0 | 0 | 2.2 | 263.3 / 5.5 | 0 | 0 | 100% / 100% | 300 | 1100 |
| 4 | A | 1 | 20 | 20 | 47.7% | 210.1 | 9.7 | 335.4 | 0 / 0 | 0 | 0 | 50% / 50% | 89.9 | 1140.3 |
| 4 | B | 2 | 20 | 20 | 33.4% | 143.4 | 8.1 | 156 | 540.9 / 6.3 | 159.1 | 0 | 65% / 65% | 156.6 | 1141.9 |
| 4 | C | 2 | 20 | 20 | 33.4% | 143.4 | 8.1 | 156 | 540.9 / 6.3 | 159.1 | 0 | 65% / 65% | 156.6 | 1141.9 |
| 5 | A | 1 | 23 | 27.1 | 40.0% | 300 (HP-capped) | 29.8 | 377.9 | 0 / 0 | 0 | 0 | 0% / 0% | 0 | 1170.2 |
| 5 | B | 2 | 23 | 35 | 14.8% | 292.2 | 105.8 | 886.1 | 777.9 / 7.3 | 458.6 | 0 | 5% / 5% | 7.8 | 1094.2 |
| 5 | C | 2 | 23 | 35 | 14.8% | 292.2 | 105.8 | 886.1 | 777.9 / 7.3 | 458.6 | 0 | 5% / 5% | 7.8 | 1094.2 |

- Each wave/strategy cell has 20 encounters. Hero damage prevented by classless mitigation averaged 30.6/25.1/25.1 on W4 and 70.3/70.4/70.4 on W5 for A/B/C; this is not damage prevented by structures. Mean tower shots/ammo consumed for B and C were 9.8/9.8 (W1), 11.6/11.6 (W2), 14.1/14.1 (W3), 29.9/48.4 (W4), and 41.6/65.3 (W5). Each snapshot began with 120 ammo; no resupply was needed or charged within an encounter.
- Actual defensive outlay per snapshot, if funded: A 0; B 100 gold + 20 stone construction and 8 gold + 2 stone upkeep; C 300 gold + 20 stone construction and the same 8 gold + 2 stone upkeep. The harness also printed net end-of-battle gold change; that value includes enemy gold rewards and is **not** gross spending. These are repeated snapshot costs, not cumulative campaign expenditures.
- At W4, the no-defense hero died in 10/20 encounters while average castle damage was only 9.7 and average ending castle HP was 1140/1150. The tower raised clears/survival to 13/20, reduced mean hero damage by 66.7 versus paired no-defense runs, and dealt 540.9 damage on average. At W5, 20/20 no-defense runs and 19/20 tower runs ended with all heroes dead; all castles survived. The tower reduced aimed-at-hero share, but average hero damage still approached the 300-HP cap. It also faced 35 mean total spawns versus 27.1 without a tower; the initial count stayed 23, and the extra spawns largely reflect the boss's recurring skeleton additions during longer encounters. B and C outcomes were identical in the measured damage/clear aggregates.
- A single barricade took zero damage in every run. `pickLane` in `engine.js` includes barricade HP as a lane cost and selects the least-threatened lane, so a barricade can cause enemies to route away from its lane. This is consistent with the implemented path-of-least-resistance rule; this experiment does not prove whether the deterrence is strategically valuable. The one-barricade purchase had no measured damage-prevention or survival benefit over tower-only in these encounters.

### Verified behavior, concerns, and limitations

- Enemy targeting is not a global hero-first rule. `_selectEnemyTacticalTarget` gives archetypes different priorities: Reapers select the most-wounded nearby hero; Orcs prefer a tower then a nearby hero; Lieutenants and Ghosts prefer heroes then towers; Dark Elves prefer towers at range then heroes; Warlocks target a Mage, then another hero, then a tower. Generic enemies advance, attack a same-lane barricade at the wall if present, attack a nearby hero (or an objective tower) at the defender line, attack eligible buildings near the castle, then breach the castle. Boss napalm selects its nearest living hero/tower in range, and its periodic ability spawns two skeletons. `_enemyAttack` intervals are archetype-specific; ranged bolts and boss napalm use separate cooldowns. `Engine._checkEnd` declares defeat as soon as every hero is dead, even with castle HP remaining; code comments describe towers as supporting defenses rather than an alternate win condition.
- **No confirmed combat implementation defect was established.** Measured W4/W5 hero deaths and healthy castles match the explicit hero-death defeat rule and observed targeting paths. The confirmed behavior is high hero-targeted pressure and a boss/add contribution at W5. The potential concern is balance pressure, not evidence that attacks are being assigned to the wrong target. Tower CP is included in campaign power (`castlePower` sums hero and tower levels); enemy HP/damage and, where rounding crosses a threshold, composition/count use that power. This makes a defensive tower contribute pressure as well as damage. The single tower improved W4 but did not reliably solve W5.
- Revival was source-traced but not simulated in these isolated battles: classless `reviveHero` charges `paidRevivalCost` (minimum 300 gold; 100 per level, capped at 2,000) and restores the configured revive fraction; periodic recovery is 8% max HP/hour and zero HP is not passively revived. This experiment has no between-wave recovery, free-life, paid revival, or affordability trajectory. The prior Section 49/50 sequential studies used explicit preparation-time assumptions; those should be considered separately.
- Important limitation: these 300 battles do not constitute sequential campaigns. Every snapshot resets hero/castle to the wave-start test values, purchases defenses anew, and starts a fresh tower with a full magazine. Paired strategies share RNG seeds, but tower campaign power changes `buildWave`'s generated enemy pressure, so the exact enemy packs are not identical across strategies. The auto-Shared-Strike policy tests the production ability API, but it does not measure TacticalMenu input, human movement/targeting, or Android behavior. Tower/hero “damage prevented” is not a causal attribution beyond paired outcome differences. No production profiles, backend, Android build, or live service was used.

### Validation and next step

- Temporary simulation command from `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true npm test -- --watchAll=false --runInBand --cacheDirectory=/tmp/demonanic-controlled-survival-7bf7151/.jest-cache --runTestsByPath src/game/ControlledDefenseComparison.tmp.test.js` — PASS, 1 suite / 1 test, 300 encounters, 20 common seeds per wave across A/B/C.
- Regression command from `frontend/`: `env LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib CI=true npm test -- --watchAll=false --runInBand --cacheDirectory=/tmp/demonanic-controlled-survival-7bf7151/.jest-cache --runTestsByPath src/game/engine.classless.test.js src/game/logic.wave-composition.test.js src/game/logic.classlessHero.test.js` — PASS, 3 suites / 52 tests. `git diff --check` — PASS. No production gameplay/configuration files changed; no build was run.
- The temporary test, dependency symlink, and Jest cache were removed after execution. This handoff section is the only change from the investigation; no gameplay/configuration files changed. Publication is limited to this documentation update.
- Recommended next evidence: a truly sequential, paired 20-seed campaign comparison using production completion, preparation, recovery, wave transitions, tower upkeep/ammunition and user-defined action timing. Track individual hero/castle/tower HP, attack targets, actual gross spending versus battle income, and each defeat/revival reason. Use this snapshot result to prioritize W4/W5 survivability investigation, not to change balance values. Continue to keep recruitment-market features and gameplay changes out of scope until the owner reviews the evidence.
- The exact phrase “work done” means ChatGPT should retrieve the latest published handoff, review the evidence, and report back.
