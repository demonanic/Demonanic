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
- Code/test commit `15ac382` (`Test classless battle lifecycle composition`) contains only the new lifecycle harness and the TacticalMenu test. It is being published separately from this handoff after verifying the current remote and outgoing commit list. Unrelated user changes remain unstaged. The final published SHA will be recorded after verification. `work done` means ChatGPT should retrieve and review the latest published handoff.
