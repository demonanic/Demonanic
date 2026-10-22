# Demonanic — ChatGPT Development Handoff

Living handoff for repository review and continuation. Update this file after meaningful audits, implementation, debugging, architectural decisions, and verification. Preserve older decisions and label proposals separately from approved requirements. Do not include secrets or private account data.

## 1. Project status

### Project and architecture

Demonanic is an RPG/tower-defense game. The frontend is a React application under `frontend/src`; core game-state logic is in `frontend/src/game/logic.js`, combat simulation/rendering in `frontend/src/game/engine.js`, and profile lifecycle in `frontend/src/context/GameProvider.jsx`. The backend is a Python/FastAPI service in `backend/server.py` that stores a whole game-state object in MongoDB. The profile API currently uses `GET /game/state`, `POST /game/state`, and full-state `PUT /game/state`.

The game has hero XP/levels, AP perk progression, SP stat allocation, equipment, Academy stat training, Mage Library research/spellbooks, battle abilities, towers, castle buildings, and a shared Gold/Stone/Metal economy. The root `README.md` and `frontend/README.md` are Create React App boilerplate rather than current game architecture documentation.

### Repository checkpoint before handoff publication — 2026-10-22 03:09 UTC

- Branch: `review/mobile-working-copy` (verified; no branch switch performed).
- HEAD: `c18467c` — `Add mandatory collaboration workflow`.
- `AGENTS.md` is committed; the local branch was one commit ahead and zero behind `origin/review/mobile-working-copy` before the handoff-only commit.
- Pre-existing worktree changes before collaboration setup:
  - Modified: `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`.
  - Untracked: `frontend/src/components/PerkTree.test.jsx`.
- The changes add themed labels for the existing class-root branches and focused component coverage; the roadmap also records that work. They are user-owned, uncommitted, and were not altered by this task.
- No repository-root `AGENTS.md` existed. A dependency-local `frontend/node_modules/recharts/AGENTS.md` was found and is not a repository instruction.

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

The user has decided to replace fixed four-class progression with a classless, specialization-based system. New heroes should begin unclassified; branch investments, depth, and combinations determine abilities and dynamic titles. The current phase is architecture and migration design, before gameplay implementation. The immediate objective is to get approval on the architecture, classless starting combat baseline, legacy migration policy, and acceptance criteria. No classless implementation or data migration has begun.

The newest user direction supersedes earlier fixed-class hybrid/Cross-Training assumptions. Detailed branch examples and migration mechanisms below are recommendations from the audit, not approved implementation specifications.

The current task adds the permanent repository workflow in root `AGENTS.md` and updates this handoff. It does not change gameplay. The exact phrase `work done` is the user's signal for ChatGPT to review the latest handoff. This task's changes and publication state are recorded below; preserve the pre-existing perk-tree and roadmap work.

## 2. Architecture and audits

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

Potential branch families for review: Vanguard (physical offense), Warden (defense/support), Precision (range/critical/target setup), Shadowcraft (speed/evasion), Arcana (elemental/spell/healing), Tactics (traps/control), and Conjuration (summons). Potential recipes include Battle Mage (Arcana plus Vanguard/Warden depth), Bandit (Shadowcraft plus Tactics/Precision), Pyromancer (deep Ember/Arcana plus area synergy), and Summoner (deep Conjuration plus a supporting branch). Names, costs, depth gates, and effect handlers are proposals only.

### Legacy migration recommendation — pending approval

- Do not delete `cls`, existing perk IDs, or legacy gameplay data in the first migration.
- Add a versioned classless progression field and retain legacy class/perk identity as compatibility data until parity is demonstrated.
- Preserve saved stats as-is; they already contain class stat modifiers. Capture the remaining class-derived combat inputs (base HP, range, attack rate/scaling, magic/damage behavior, attack configuration, and free starter ability entitlement) in an explicit legacy combat profile or equivalent adapter. Do not assign Knight defaults to new unclassified heroes.
- Translate recognized legacy perk investments idempotently to equivalent branch nodes/effects without spending AP again, refunding points, or double-applying effects. Keep canonical `rouge_*` identifiers available for legacy reads and rollback. Dormant effects must remain dormant until separately specified and implemented.
- Migrate active heroes, bench heroes, Academy-held heroes, and heroes referenced by ongoing Library research. Preserve all equipment, spellbooks, affinities, research progress, stats, AP/SP, and unrelated profile state.
- Keep legacy class parsing/runtime adapters until each caller has moved to class-independent combat capabilities (for example melee/ranged/arcane tags or weapon/spell disciplines).
- New heroes need a separately balanced neutral combat baseline and initial attack/appearance rules. That choice is a prerequisite to classless creation and must be approved before implementation.

### Areas not yet inspected exhaustively

The class-dependency search was not a line-by-line review of all 103 hits or all UI files. No complete audit was performed for every backend consumer, all equipment item-generation compatibility, every combat class branch, full Academy migration edge cases, or all saved-profile variants. No classless branch/effect specification or level-build simulation exists yet. These remain implementation prerequisites.

## 3. Implementation log

Times are UTC. When conversation history did not preserve an exact time, that limitation is stated rather than guessed.

### 2026-10-22 03:07–03:09 UTC — Establish permanent Codex–ChatGPT collaboration workflow

- **Objective:** Add mandatory repository-level procedures for task kickoff, preserving work, verification, handoff updates/publication, and final reporting.
- **Files changed:** `AGENTS.md` (new) defines sections A–E, including the `work done` review signal and safe handoff-only publishing rules. `docs/CHATGPT_HANDOFF.md` updates this checkpoint and records the setup task.
- **Important APIs/data:** Documentation only; no gameplay code, profile data, or saved data changed.
- **Compatibility:** Pre-existing `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, and `frontend/src/game/perks.js` modifications and untracked `frontend/src/components/PerkTree.test.jsx` are preserved.
- **Inspection issue:** `rg --files` was attempted but `rg` is unavailable (`/bin/sh: 1: rg: not found`). `find . -name AGENTS.md -print` located only `frontend/node_modules/recharts/AGENTS.md` before the root file was created.
- **Tests/builds:** No tests, build, Android build, or device check were run; this is a documentation-only task. `git diff --check` passed before the AGENTS commit; it will be rerun for the final handoff diff.
- **Commit/publication:** `AGENTS.md` committed alone as `c18467c` (`Add mandatory collaboration workflow`). This handoff update is to be committed separately with only `docs/CHATGPT_HANDOFF.md`; record the handoff SHA and remote verification in the final task report.

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

No tests, build, Android build, or device check were run during the handoff creation or collaboration-procedure setup tasks. No claim is made that the current uncommitted state has been rebuilt or tested on a device. The current `ROADMAP.md` and prior session reports record earlier Android build/device statements; those are historical and must retain their evidence labels. For example, Android persistence success is user-reported in `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md`, not an independent database verification.

## 5. Decisions and requirements

### Approved constraints

- Preserve the current branch and all existing work. No branch switching, commit, push, merge, or deploy without explicit permission.
- Replace the fixed four-class progression model with classless, specialization-based progression. New heroes begin unclassified; titles describe builds and do not restrict them.
- Preserve existing combat, stats, equipment, Academy, Library research/spells, castle management, economy, accounts, and saved profiles wherever compatible.
- Migrate legacy Knight, Rouge, Mage, and Archer heroes without destructively resetting investments or effects.
- Do not modify gameplay or saved profiles until the architecture/migration design is reviewed and approved.

### Proposals, not approved decisions

- The distinct progression subsystem/module split and migration adapter described above.
- Proposed universal branches and signature recipes.
- Any costs, branch depth thresholds, new neutral combat baseline, or new combat/effect handlers.
- The previous fixed-class Cross-Training whitelist/cost proposal; superseded by the classless direction.

### Unresolved approval items

- What neutral HP/range/attack-rate/attack-type/appearance baseline should new unclassified heroes receive?
- Which universal branches, exact node effects, tier/depth gates, AP costs, and signature recipes should ship first?
- How should classless Arcana eligibility interact with Library access while preserving Mage-owned spells and in-progress research?
- How should equipment proficiency replace class-only secondary-weapon rules without invalidating equipped legacy items?
- What is the desired rollback window and should concurrent profile writes gain revision/CAS support before migration?
- Which formerly inert perk effects should remain dormant, be retired with preserved legacy data, or receive separately specified consumers?

## 6. Known issues and regressions

### Confirmed from inspected source/docs

- Multiple declared perk effects lack verified consumers: `reactionBonus`, `reactiveSpeedPct`, `reactiveSupport`, `aoe` metadata, `burn`, `lifebloom`, `markedDamagePct`, `damageReductionPct`, and `lowHpDefense`. `aoe` is redundant to the separately implemented Firestorm ability path; it is not a verified effect consumer.
- Earlier characterization/audit documentation also records behavior/description mismatches or unresolved behavior for Archer Execution thresholds, Multishot scope, Rogue Combo sequencing, Speed Rush attack-tempo wording, and Poison/Mind spell affinity handling. Consult `docs/dev-sessions/2026-10-18-combat-effect-audit.md`, `docs/dev-sessions/2026-10-18-perk-behavior-characterization.md`, and `docs/roadmaps/AP_PERK_TREE_AND_MARTIAL_TECHNIQUES_IMPLEMENTATION_ROADMAP.md` before changing these.
- The current `ROADMAP.md` still documents permanent class identity and class-specific AP trees. That conflicts with the newer approved classless direction and should be reconciled after architecture approval; it was not edited for this handoff task.
- Profile backend writes replace the entire state object without an observed revision check. A client migration must be idempotent and must not assume concurrent-write protection.

### Unverified or suspected

- All class-keyed runtime/UI dependencies may not have been captured by the broad source search. Perform a full reference audit before removing legacy fields.
- No parity test currently proves that a classless migrated hero reproduces all old class-derived combat behavior; no classless migration exists yet.
- New hero neutral combat balance and new signature abilities have not been specified or simulated.

## 7. Next steps

1. Review/approve the proposed architecture and choose the new hero baseline. No gameplay implementation should start before these choices are settled.
2. Produce a complete dependency inventory for all `cls`, `HERO_CLASSES`, `HERO_ORDER`, attack-config, equipment, spell, AI, and rendering callers.
3. Define typed universal branch nodes and exact recipes for Battle Mage, Bandit, Pyromancer, and Summoner. Each enabled ability must have a specified and testable runtime handler.
4. Build legacy fixtures for each class, including empty and fully invested trees, `rouge_*` IDs, equipment, Mage research/spells, reserves, and Academy-held heroes. Define snapshots for AP/SP/stats and combat behavior.
5. Implement versioned, idempotent migration with a legacy compatibility adapter. Do not delete old fields during the first rollout.
6. Add parity, invalid-input, duplicate/migration-idempotency, profile round-trip, equipment, Academy, spell, and classless-creation tests. Then run the full frontend suite and relevant backend tests.
7. Build Android and request on-device review only after the classless UI and save path are implemented and automated checks pass.

**Acceptance criteria:**

- New heroes have no fixed class and can build through universal branches; dynamic titles follow the current build and never gate eligibility.
- Existing classed heroes preserve AP/SP, stats, equipment, active combat behavior, class-granted baseline abilities, Academy work, Mage spellbooks/affinities/research, and unrelated profile/economy/account data.
- Migration is idempotent and preserves legacy identifiers, including `rouge_*`; no node/effect is double-applied or silently invented.
- Branch depth and signature combinations reject unknown IDs, missing prerequisites, duplicates, overspending, invalid ranks, and invalid combinations without partial mutation.
- Every live effect has an explicit consumer and focused tests. Combat uses the established target/range/immunity/cooldown/action lifecycle.
- Existing profiles load and save round-trip; rollback retains original fields until parity and device verification are accepted.

No step above has been started as implementation in the current task.

## 8. Handoff summary

At the pre-publication checkpoint, Demonanic is on `review/mobile-working-copy` at `c18467c`; the repository workflow was committed there and the handoff-only update was pending as a separate commit. The pre-existing `ROADMAP.md`, perk-tree source changes, and component test remain uncommitted and untouched. This setup changes documentation only, not gameplay or save data. No tests/builds were run; `git diff --check` passed for the workflow file, and the handoff diff is checked before commit. The prior focused perk tests passed 36 tests and the prior full frontend suite passed 208 tests. The approved classless direction still needs architecture and neutral-combat-baseline review before implementation. The exact phrase `work done` signals ChatGPT to review this handoff. The setup handoff update is intended to be published in its own handoff-only commit on this branch; check Git history/status for its final SHA and remote synchronization. Next development step: architecture approval, then a complete class-dependency inventory and legacy-save migration specification.
