# AP Perk Design-Decision Preparation

## Scope and safety

Preparation only: no gameplay code, tests, descriptions, balances, saved data,
perk IDs, or migrations were changed. Recommendations below are not approved
decisions.

Initial state: branch `feature/castle-management-first-pass`, HEAD
`7fb3d67 Fix tower placement position consistency`, dirty worktree with
pre-existing modifications and untracked files. Those changes were preserved.
No staging, commit, push, merge, deployment, branch change, or `main` change
occurred.

Sources read: the controlling AP/Martial Techniques roadmap, the Phase 0
report, the previous effect-planning report, the behavior-characterization
report, current perk/engine/logic source, and relevant frontend tests.

## Decision 1 — Archer Execution: 25% description vs 35% handler

**Current implementation and evidence**

- `frontend/src/game/perks.js:84`: `archer_execution` declares
  `lowHpDamagePct: 0.25` and describes +25% damage below **25%** enemy HP.
- `frontend/src/game/engine.js:471-482`, `_applyAbilityDamage`: applies the
  accumulated low-HP bonus to active-ability damage when
  `target.hp / max(1, target.maxHp) < 0.35`. The condition is strict, so
  exactly 35% does not qualify.
- `frontend/src/game/logic.js:64`: exposes the accumulated value as
  `lowHpDamage`.
- `frontend/src/game/engine.perk-characterization.test.js:61-88` characterizes
  Execution at 30% target HP and demonstrates the handler's 35% threshold.
  It tests `_applyAbilityDamage`, not ordinary Archer projectile damage.
- `docs/dev-sessions/2026-10-18-perk-effect-test-planning.md` records that the
  handler applies low-HP bonuses only to active abilities and that the
  Execution description says 25%. The roadmap's Phase 0/P0-C guidance says
  not to invent unclear behavior and to keep perk descriptions aligned with
  consumers; it does not choose 25% or 35%.

**Options**

| Option | Gameplay and compatibility consequences |
|---|---|
| A. Change the Execution consumer threshold to `<25%`. | Matches the node's explicit description; the purchased perk becomes less frequently active than today. Existing saved perk IDs and balances remain compatible, but combat output changes for existing owners in the 25–35% HP band. Other low-HP perks need a separate threshold contract; the shared accumulator currently cannot express per-perk thresholds. |
| B. Keep the `<35%` handler and change the description to 35%. | No runtime/balance change for existing saves; aligns the UI with the current shared handler. It discards the 25% value currently explicitly stated by the perk definition and still leaves the question of why Execution is not distinct from other low-HP effects. |
| C. Give Execution an independent 25% threshold while preserving the shared 35% effect for other nodes. | Preserves both descriptions/behaviors as separate contracts, but requires effect-model and combat-handler changes. It risks changing aggregation/stacking behavior and needs explicit migration-safe tests. |

**Recommendation (not approved):** Option A, because 25% is the node's specific
documented threshold. Keep the shared low-HP effect at its existing scope for
other perks; do not broaden ordinary attacks in this change.

**Tests after approval:** exact boundary cases below, at, and above 25%; prove
Execution adds 25% only below the approved threshold; compare with Focus Fire
and Knight Executioner; verify combined low-HP perk stacking; characterize
basic projectile, active ability, and Mage spell paths so no unintended path
changes. Include damage attribution and immune/dead target behavior.

## Decision 2 — `multiTarget`: basic projectiles, abilities, or both

**Current implementation and evidence**

- `frontend/src/game/perks.js:82`: `archer_multishot` declares
  `multiTarget: 2` and says “Abilities can hit additional targets.”
- `frontend/src/game/logic.js:68`: copies the aggregate into derived hero data.
- `frontend/src/game/engine.js:1431-1438`, `_applyHit`: applies the effect to
  projectile hits. It picks up to `multiTarget - 1` living nearby enemies
  within 55 units, ordered by distance, and recursively applies 55% of the
  original projectile damage once per secondary.
- Active abilities use `_applyAbilityDamage` directly. Some already select
  multiple targets themselves: Firestorm has an area radius
  (`engine.js:414-419`), Piercing Shot has up to two nearby targets
  (`engine.js:446-449`), and Focus Volley repeats hits on one target
  (`engine.js:453-456`). They do not read `multiTarget`.
- `frontend/src/game/engine.perk-characterization.test.js:91-117` proves the
  current basic-projectile secondary hit and no extra Focus Volley target.
- The catalog description is the source for intended “Abilities” scope; the
  planning report identifies the discrepancy. The roadmap requires avoiding
  unintended recursive/proc behavior but does not specify target count or
  secondary damage for this perk.

**Options**

| Option | Gameplay and compatibility consequences |
|---|---|
| A. Basic projectiles only. | Matches current combat and preserves existing perk value; description remains inaccurate unless separately revised. No ability damage/balance increase. |
| B. Active abilities only. | Matches the description literally, but removes the perk's current secondary projectile hit for existing owners. Raises questions for abilities that already hit multiple targets or repeat on one target. |
| C. Both basic projectiles and compatible active abilities. | Preserves current projectile behavior and gives the described ability bonus. It is the broadest effect; area/piercing abilities could become substantially stronger or double-count targets unless explicitly excluded. The saved perk ID is unchanged, but all existing owners receive the expanded power. |

**Recommendation (not approved):** Option C, with an approved compatibility
rule that active abilities with native area/multi-target behavior are not
expanded a second time. Reuse the existing secondary target selection and
damage policy only if the design explicitly accepts that 55-unit/55%-damage
rule for eligible abilities; do not silently assume it.

**Tests after approval:** basic projectile behavior remains as intended;
single-target ability gets the specified additional target(s); Firestorm and
Piercing Shot do not double-hit or exceed target limits; Focus Volley does not
turn repeated hits into extra targets unless specified; enforce living,
eligible targets, deterministic ordering, target count, secondary damage,
one-time chaining, and no recursive spread.

## Decision 3 — `abilityDamagePct`: active abilities vs Mage research spells

**Current implementation and evidence**

- `frontend/src/game/perks.js:22,41,60`: Shield Mastery, Rogue Combo, and Mage
  Overload all contribute to the same `abilityDamagePct` field, despite
  descriptions scoped respectively to shield abilities, successive strikes,
  and ability damage.
- `frontend/src/game/logic.js:58`: derives
  `abilityDamageMultiplier = 1 + perks.abilityDamagePct`.
- `frontend/src/game/engine.js:471-482`, `_applyAbilityDamage`: applies the
  multiplier to active ability damage.
- `frontend/src/game/engine.js:226-250`, `getHeroSpellStatus`, calculates
  researched spell damage independently; `castMageSpell` at `254-343` uses
  `status.damage` and element affinity, not `abilityDamageMultiplier`.
- `frontend/src/game/engine.perk-characterization.test.js:119-153` proves
  Mage Overload scales Firestorm and not the tested researched spell.
- The roadmap Phase 2 states Mage AP effects apply to combat casting, not
  Library discovery/research outcomes; it does not explicitly say whether
  researched spells consume this particular modifier. The perk description
  “Ability damage +20%” and the planning report flag this as unresolved.

**Options**

| Option | Gameplay and compatibility consequences |
|---|---|
| A. Active abilities only (current). | Preserves current research spell balance and formula; Arcane Overload does not affect learned spell casts. |
| B. Active abilities plus Mage combat spells, including researched spells. | Makes the general Mage “Ability damage” wording cover combat spell casts, without touching research success/duration. Existing Mage Overload owners get stronger spell damage. Starter and researched spell paths need consistent treatment. |
| C. All hero damage actions, including basic attacks. | Broadens all current class effects and contradicts the more specific Shield Mastery/Combo descriptions. Highest balance and scope risk; likely requires per-node handlers rather than a shared global multiplier. |

**Recommendation (not approved):** Option B for Mage Overload only, applying to
combat spell casts (starter and researched) while remaining entirely outside
Library discovery, research chance/duration, and basic attacks. Before coding,
separately decide whether Shield Mastery and Rogue Combo should remain global
active-ability modifiers or become ability-specific/sequence-tracked effects;
the current shared field cannot express their descriptions precisely.

**Tests after approval:** Mage Overload on/off matrix for active ability,
starter spell, researched single-target/area/time spell; same level,
intelligence, affinity, and target to isolate multiplier; research outcomes
unchanged; no effect on basic attacks; ensure damage attribution, cooldown,
mana, and save/profile data are unaffected. Add node-specific tests for
Shield Mastery and Combo once their scopes are approved.

## Decision 4 — Reactive Support target selection and `reactiveSupport`

**Current implementation and evidence**

- `frontend/src/game/perks.js:65`: Reactive Barrier declares
  `reactiveSupport: true` and says threatened allies receive support priority.
- `frontend/src/game/engine.js:847-858`, `update`: for any support-configured
  Mage, not just an owner of this perk, passes an active reactive ally into
  `_support`; the reactive ally is used when alive and within the support
  radius. Reactive movement also follows that ally.
- `frontend/src/game/engine.js:1575-1601`, `_support`: if a valid preferred
  ally is supplied, it selects that ally; otherwise it loops over living
  allies within 220 units and retains the lowest HP fraction. Thus the source
  implements reactive priority as a baseline behavior and ordinary weakest-
  ally selection in the direct helper.
- `frontend/src/game/engine.perk-characterization.test.js:154-180` compares
  preferred-target healing with and without the perk and finds no difference.
  Its no-alert test at lines 182-196 asserts that the first/higher-HP ally is
  healed. That assertion conflicts with `_support`'s lowest-HP selection
  logic. The test calls `engine.update(0.1)` and does not directly assert the
  helper selection, so it is not sufficient evidence for the normal target
  rule. Treat this test/report conclusion as unresolved, not as approval of
  “first eligible” behavior.
- The catalog description is the documented perk intent. The update comment
  in `engine.js:855` documents normal weakest-ally behavior and reactive
  endangered-ally behavior as squad baseline. The planning report and roadmap
  P0-C both call out that the flag has no consumer / target rule needs
  resolution.

**Options**

| Option | Gameplay and compatibility consequences |
|---|---|
| A. Gate threatened-ally priority on Reactive Barrier. | Makes the purchased perk meaningful and aligns the perk text, but removes reactive support targeting from non-owners. This is a behavior nerf for squads currently receiving baseline reactive support. |
| B. Keep reactive priority as baseline and treat the flag/perk as redundant metadata. | Preserves current source behavior and compatibility; perk purchase has no distinct combat benefit. A future catalog decision would need to remove, replace, or explicitly redefine that node without silently changing saved ownership. |
| C. Keep baseline priority and define a separate, explicit enhancement for the perk. | Avoids removing baseline support, but no additional effect is described. Choosing range, amount, frequency, or another bonus would invent mechanics and requires design approval. |

**Recommendation (not approved):** Option B for the immediate behavior contract:
preserve the existing baseline target selection and do not gate it. Treat the
perk's effect as unimplemented/redundant until a distinct enhancement is
approved. Do not silently delete or remap the saved perk ID.

**Tests after approval:** direct `_support` tests proving weakest eligible ally,
range boundary, full-health behavior, dead/self/out-of-range exclusion, and
barrier/heal target handling; update-path tests proving reactive target
priority with and without the perk, threat expiry, invalid/dead/out-of-range
preferred ally fallback, selected-hero behavior, and that support/movement do
not grant extra actions. Resolve the existing test/source disagreement first.

## Other declared effects without confirmed consumers

The four decisions above cover Execution, MultiShot, `abilityDamagePct`, and
Reactive Support. The remaining catalog effects without a confirmed runtime
consumer are grouped below. “Safe” means the description alone sufficiently
defines a consumer contract without inventing balance or lifecycle behavior.

### Safe to implement from existing documentation

**None confirmed.** Some descriptions include a number or short trigger, but
still leave material combat semantics unspecified (damage source, order with
Defense/shields, duration, targets, stacking, or movement trigger). The
roadmap explicitly says not to invent these details.

### Requires a gameplay design decision

| Effect | Declaration and documented intent | Why a decision is still needed |
|---|---|---|
| `cleave` | `perks.js:17`, Knight Cleave: melee attacks may strike a second nearby target. | It is not a registered output in `perkEffects` (`perks.js:156-169`) and has no consumer. “Nearby” range, secondary damage, eligibility, and interaction with `multiTarget` are unspecified. |
| `damageReductionPct` | `perks.js:25`, Fortress: reduce incoming damage by 8%. | No incoming-hit consumer. Specify ordering/stacking with Defense, dodge, shields, and all direct/projectile/area paths. |
| `lowHpDefense` | `perks.js:26`, Last Stand: below 35% HP gain +20% Defense. | No hit consumer. Define whether +20% is flat Defense, multiplicative Defense, or another mitigation modifier and how it interacts with derived Defense. |
| `reactionBonus` | `perks.js:21`, Guardian Instinct: respond longer to an ally/castle threat; value is 2. | No consumer; reaction handlers use fixed durations. Units and exactly which reaction windows/triggers are modified are unspecified. |
| `reactiveSpeedPct` | `perks.js:44`, Ghoststep: reactive movement is 25% faster. | No consumer. Define reactive movement triggers and interaction with general movement speed, attack approach, and Speed Rush. |
| `burn` | `perks.js:61`, Burning Sigil: area abilities apply a short damage-over-time effect. | No damage-over-time consumer. Damage, duration, eligible abilities, stacking/refresh, immunity, attribution, and death cleanup are undefined. |
| `lifebloom` | `perks.js:63`, Lifebloom: healing an ally below 35% also grants a small shield. | No consumer. Shield amount/cap, which healing paths trigger it, and refresh/stack rules are undefined. |
| `markedDamagePct` | `perks.js:85`, Marked Target: selected targets take +10% damage from the Archer. | No mark consumer/state. Define selection/lifetime, Archer ownership, eligible damage sources, refresh/retarget, and cleanup. |

### Possibly redundant or obsolete metadata

| Effect | Evidence and disposition question |
|---|---|
| `aoe` | `perks.js:55` declares Firestorm's `aoe: true`, but no combat code reads it. Firestorm unlock is separately represented by `mage_firestorm_ability.requires` at `perks.js:68`, and the area handler is in `engine.js:414-419`. It may be redundant metadata; confirm whether it is only descriptive/unlock annotation before removing or retaining it. |

`abilityDamagePct` and `multiTarget` are consumed but have scope mismatches,
so they are covered in the four decisions above rather than counted as
consumer-free metadata. `lowHpDamagePct` is consumed by active abilities; the
specific Archer Execution threshold disagreement is covered above.

## Minimal implementation order after approval

1. Resolve the four behavior contracts in this report, especially the
   Reactive Support source/test mismatch. Record choices before code changes.
2. Add boundary and cross-path tests for Archer Execution and the approved
   `abilityDamagePct`/`multiTarget` scopes.
3. Implement the narrowest approved consumer changes, preserving perk IDs and
   save compatibility; run focused then full frontend tests.
4. Consider only separately approved dormant effects, each with its own
   contract for targets, stacking, duration, attribution, and cleanup.
5. Decide whether `aoe` is metadata-only and whether its existing saved perk
   node should remain unchanged; do not migrate or delete IDs as part of a
   combat fix.

## Verification and final repository state

- `git diff --check`: passed after writing this report.
- No gameplay or test suite was run; this was a source/design review only.
- No device verification was performed.
- Final branch and HEAD remain `feature/castle-management-first-pass` and
  `7fb3d67 Fix tower placement position consistency`.
- Pre-existing modified and untracked work remains present; this report is the
  only file created by this pass. No file was staged.
- No commit, push, merge, deployment, branch switch, or `main` change occurred.
