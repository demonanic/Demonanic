# Demonanic — ChatGPT Development Handoff

Living handoff for repository review and continuation. Update this file after meaningful audits, implementation, debugging, architectural decisions, and verification. Preserve older decisions and label proposals separately from approved requirements. Do not include secrets or private account data.

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

The user has approved classless progression planning constraints: new heroes start unclassified on a shared-midline combat baseline, every new hero gets a shared single-target starter strike, universal progression is built before signatures, dynamic titles describe current builds and never determine eligibility, and existing heroes/progress/equipment/Academy/Mage research/accounts/profiles are preserved wherever compatible. This remains planning only; no classless implementation or data migration has begun.

The newest user direction supersedes earlier fixed-class hybrid/Cross-Training assumptions. Concrete branch/node values and migration mechanisms below are proposals, not approved implementation specifications, except for the decisions explicitly listed as approved in Section 5.

The repository workflow is in root `AGENTS.md`. This audit completes the requested classless dependency review and provides recommendations only; no gameplay or save changes are in scope. The exact phrase `work done` means ChatGPT must retrieve the latest published handoff, review it, and report back. Preserve the pre-existing perk-tree and roadmap work.

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

### 2026-10-22 04:32 UTC — Specify approved classless planning decisions

- **Objective:** Continue classless progression planning on the current authorized branch and expand the living handoff into an implementation-ready proposal, while remaining strictly within documentation scope.
- **Approved decisions recorded:** New heroes start unclassified with a shared-midline combat baseline; every new hero receives one shared single-target strike; universal progression is built first and signatures arrive gradually; dynamic titles describe the current build and never determine eligibility; preserve existing heroes, progress, equipment, Academy training, Mage spells/research, accounts, and profiles wherever compatible.
- **Files changed:** docs/CHATGPT_HANDOFF.md only. No gameplay source, tests, profile, save data, or migration changed.
- **Proposal added:** Seven branch tables with stable IDs/effects/AP/level/prerequisites/depth, hybrid/signature predicates and candidates, exact baseline/strike simulation matrix, class-independent combat and equipment model, additive legacy migration traversal, revision conflict/failure/rollback plan, phase-specific tests and exit criteria. Numeric values and architectural mechanisms are clearly marked pending approval.
- **Verified starting state:** Branch review/mobile-working-copy; HEAD 8940a3a (Record classless audit handoff publication). Pre-existing changes remain: modified ROADMAP.md, frontend/src/components/PerkTree.jsx, frontend/src/game/perks.js; untracked frontend/src/components/PerkTree.test.jsx. These are untouched.
- **Tests/builds/simulation:** None run. This is documentation-only planning; specified tests and combat simulation are future acceptance gates, not verified results.
- **Verification:** git diff --check passed. Diff and status review confirmed only this handoff file is task-edited; the other four worktree changes are pre-existing. No source tests/build/device checks are in scope.
- **Publication:** The handoff-only commit and remote verification outcome are recorded in the final task checkpoint below. No unrelated files are included.
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
- New heroes use a shared-midline combat baseline.
- Every new hero receives the same shared, single-target starter strike.
- Build and balance the universal progression foundation before adding signature builds gradually.
- Dynamic titles describe the current build and never determine eligibility.
- Preserve existing combat, stats, equipment, Academy, Library research/spells, castle management, economy, accounts, and saved profiles wherever compatible.
- Migrate legacy Knight, Rouge, Mage, and Archer heroes without destructively resetting investments or effects.
- This task is planning/documentation only: do not modify gameplay source, tests, profiles, save data, or migrations; do not switch branches, merge, or deploy.

### Proposals, not approved decisions

- The concrete values in “Concrete classless progression specification”: 250 HP, all stats 10, 1.05 s cooldown, 170 range, neutral physical type, damage formula, strike coefficient/cooldown, node IDs and effects, costs, gates, depth rule, two Tier III cap, signatures, and title tie-break.
- The distinct progression subsystem/module split, versioned migration schema, combat/equipment capability representation, Library access rule, server revision/CAS, rollback window, and migration safety gate.
- The proposed simulation thresholds and the use of legacy class squads as the benchmark.
- The previous fixed-class Cross-Training whitelist/cost proposal; superseded by the classless direction.

### Unresolved approval items

- Review and approve/revise the proposed numeric baseline and starter strike (including cosmetic policy) and simulation thresholds/benchmark.
- Approve/revise the seven branch catalog, exact node IDs/effects, AP costs, level gates, branch depth, two-Tier-III cap, and first signature recipes.
- Decide signature rollout order; recommend defer Summoner until lifecycle/cleanup is implemented.
- Approve/revise new Arcana Library eligibility while grandfathering existing Mage research and spell records.
- Decide how new equipment disciplines are granted while preserving currently equipped gear.
- Choose revision/CAS versus single-writer migration gate, rollback window, and conflict UX.
- Decide disposition of legacy perks without verified consumers: preserve dormant, implement consumers, or defer/reword.

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
- Migration is idempotent and preserves legacy identifiers, including `rouge_*`; no node/effect is double-applied or silently invented.
- Branch depth and signature combinations reject unknown IDs, missing prerequisites, duplicates, overspending, invalid ranks, and invalid combinations without partial mutation.
- Every live effect has an explicit consumer and focused tests. Combat uses the established target/range/immunity/cooldown/action lifecycle.
- Existing profiles load and save round-trip; rollback retains original fields until parity and device verification are accepted.

No step above has been started as implementation in the current task.

## 8. Handoff summary

At the 2026-10-22 04:32 UTC planning checkpoint, Demonanic remains on `review/mobile-working-copy`; the starting HEAD was `8940a3a`. The current working tree preserves pre-existing changes to `ROADMAP.md`, `frontend/src/components/PerkTree.jsx`, `frontend/src/game/perks.js`, and untracked `frontend/src/components/PerkTree.test.jsx`. The approved constraints and detailed proposal are documented in Sections 2 and 5. This task is documentation-only; no tests, builds, device checks, simulations, migrations, or profile writes were run. `git diff --check` passed. The handoff-only commit SHA and remote verification are recorded here after publication. No unrelated files were staged. Older design docs still contain permanent-class assumptions. The exact `work done` signal means ChatGPT retrieves the latest published handoff, reviews it, and reports back. Next step: approve or revise numeric baseline/strike and simulation thresholds, node catalog/costs/depth, signature recipes, Library/equipment policy, and profile conflict/rollback plan before implementation.
