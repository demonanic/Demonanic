# Demonanic: AP Perk Tree + Martial Techniques Implementation Roadmap

**Status:** Implementation plan / proposal-derived handoff. This file is not proof that any listed feature is implemented.
**Repository:** `demonanic/Demonanic`
**Intended working branch:** `feature/castle-management-first-pass`
**Planning source documents:** `Demonanic_Expanded_AP_Perk_Tree_Proposal.docx`, `Demonanic_Martial_Techniques_Custom_Attacks_Proposal.docx`, and `perkaudit.docx` supplied on 2026-10-18.
**Execution rule:** Work incrementally in the existing worktree. Preserve all pre-existing changes and saved-profile compatibility. Do not commit, push, merge, deploy, switch to `main`, or discard/reset changes unless the user explicitly authorizes it.

## 1. Mission and design boundaries

Build two connected but separate progression systems:

1. **Expanded AP Perk Tree:** permanent class specialization, passive effects, active ability unlocks/upgrades, and mastery.
2. **Martial Techniques:** learned components and customizable physical attacks for Knight, Rogue, and Archer, powered by a battle-only Focus resource.

They share hero progression and combat infrastructure but must not collapse into one currency or one generic ability system.

### Preserve class identity

- **Knight:** Combat Techniques emphasizing force, guard, control, and retaliation.
- **Rogue:** Exploits emphasizing positioning, sequence, precision, and risk.
- **Archer:** Special Shots emphasizing targeting, trajectory, range, and multi-projectile behavior.
- **Mage:** Retains the separate Library → discovery → research → spell ownership → loadout → casting loop. Mage does not migrate into Martial Techniques.

### Non-negotiable invariants

- Existing fixed class abilities continue to work and are not replaced by custom techniques.
- Existing recognized perk IDs remain valid. Preserve the legacy `rouge_*` identifiers unless a separately tested alias migration is explicitly approved.
- Do not silently remove perks, grant new permanent purchases, recalculate AP/SP from XP or level during migration, or change unrelated saved progression.
- Migration/normalization must be idempotent: normalizing the same profile twice must not produce extra grants or changes.
- Draft AP/SP selections may be undone before confirmation. Committed progression must not gain an unreviewed refund/respec path.
- Failed/cancelled target selection spends no Focus, starts no cooldown, and commits no action.
- Every combat action uses the existing source/target/range/immunity/death/cooldown validation and action commitment lifecycle. Custom attacks cannot bypass it.
- Focus and temporary combat state are runtime battle state, not permanent progression. Do not persist them unless resumable battles become an explicitly approved feature.
- No secrets, tokens, credentials, or user-specific data in reports or commits.

## 2. First-pass objective

**Do not implement both complete systems in one pass.** The first implementation pass is a source audit plus safe resolution of confirmed P0 defects. Do not add a large batch of new perks or the Training Grounds until the current combat formulas and effect consumers are trustworthy.

### First pass tasks

1. Inspect the actual worktree before touching files:
   - `git status --short`
   - `git branch --show-current`
   - `git log -1 --oneline`
   - inspect relevant diffs and existing tests.
2. Confirm the intended branch is `feature/castle-management-first-pass`. If not, stop and report; do not switch branches automatically.
3. Identify existing local changes and untracked files. Treat them as user-owned. Do not overwrite, stage, reset, stash, clean, or revert them.
4. Read the AP proposal, Martial Techniques proposal, current source, and current tests. If proposal documents are not in the repository, use the design decisions in this roadmap; do not search for a replacement or invent missing requirements.
5. Trace the P0 defects listed below to concrete code and tests. Fix only defects that can be demonstrated and safely isolated.
6. Add focused regression tests for every P0 fix.
7. Run the narrow tests, then the full frontend suite and relevant build checks if the environment supports them. Report skipped tests honestly.
8. Produce a report at `docs/dev-sessions/YYYY-MM-DD-ap-martial-first-pass.md` (use the actual local date), including initial/final branch and worktree status, files changed, exact commands and outcomes, unresolved items, and device-test limitations.
9. Stop after this first pass. Do not begin the full AP tree expansion or custom-attack framework until the first-pass findings and tests are reported.

## 3. P0 audit and blocking fixes

The proposal-derived audit identifies these blockers. Verify each against the current source; do not assume it remains broken merely because it appears in an older audit.

### P0-A — One authoritative Defense/mitigation calculation

Trace how Defense is derived from hero attributes, equipment, SP, perks, and enemy hit resolution. Find all places that calculate or consume mitigation. Establish one authoritative formula/derived value and ensure the same value is used consistently. Do not balance new Defense perks around a mismatch.

**Acceptance:** focused tests prove the derived Defense/mitigation value used in combat matches the documented authoritative calculation across baseline and modified heroes. Existing intended formulas remain unchanged except for the verified inconsistency.

### P0-B — Rogue `rouge_escape` NaN safety

Trace the existing Dodge/Escape perk data and all consumers. Ensure every supported numeric effect has a finite, correctly typed value and safe defaults. Preserve the legacy identifier.

**Acceptance:** tests show the perk and its effect remain finite for missing/legacy data, normalization, and normal combat; no NaN propagates into hit, damage, or state calculations.

### P0-C — Declared but unconsumed effects

Audit declared effects flagged by the source audit: `damageReductionPct`, `lowHpDefense`, `reactionBonus`, `reactiveSpeedPct`, `reactiveSupport`, `burn`, `lifebloom`, `markedDamagePct`, and `aoe`.

For each effect, classify it as:
- consumed correctly by a verified handler;
- declared but intentionally dormant/documentary;
- broken or missing a consumer.

Only implement a consumer in this first pass when the intended behavior is explicit in the existing source/design and the handler can be added without broad combat refactoring. Otherwise document it as a blocker for a later, separately scoped slice. Never silently invent damage values, durations, stack rules, trigger conditions, or new balance behavior.

**Acceptance:** each audited effect has a source-backed disposition and tests for every consumer changed. No perk description claims a gameplay effect that the engine does not apply.

### P1 items — Record, do not broaden the first pass

Track these for the appropriate later slice:
- ability-specific modifiers must not leak through unrestricted global ability bonuses;
- Speed Rush description must match its actual movement/tempo behavior;
- Mage Poison/Mind affinity needs an authoritative combat policy before elemental AP synergies are added.

## 4. Roadmap and phase gates

### Phase 0 — Source truth and combat safety (first pass)

Scope: branch/worktree audit, trace current perk and combat paths, resolve confirmed P0-A/P0-B defects and only safely isolated P0-C consumers, regression tests, report.

**Exit gate:** no unexplained change to existing progression; focused tests pass; all attempted checks and limitations are reported; user can review the report. If a P0 fix requires broad redesign, stop and propose a narrow follow-up rather than forcing it into this pass.

### Phase 1 — AP tree contract and progression tests

Before adding many nodes, verify the existing XP → level → AP/SP grant path and AP purchase/draft/confirm path. Build or strengthen tests for:
- AP/SP earned at each crossed level, including multi-level XP awards;
- exact balance, insufficient points, no negative balances;
- class ownership, level gate, prerequisite and prerequisite-rank checks;
- maximum rank, duplicate purchase, unknown ID, invalid class, stale source state;
- staged undo/cancel/confirm exactly once;
- descendant dependency integrity;
- profile normalize → save → load round-trip;
- legacy string/display-name perks and canonical IDs.

Design contract from the proposal:
- SP is used for permanent attributes; AP is used for class perks.
- Lifetime AP target: level 2 = 1; level 5 = 4; level 8 = 7; level 10 = 9; level 12 = 11; level 16 = 15; level 20 = 19.
- Preserve recognized purchased perk IDs and saved AP/SP balances during migration.
- Do not implement persistent respec in the first expanded-tree release. Draft undo is not a committed refund.
- Ranked nodes should support explicit rank data while rank-1 legacy IDs remain readable.

**Exit gate:** purchase/progression tests and profile round-trip tests pass. No new perk catalog expansion until the data model and compatibility behavior are understood.

### Phase 2 — Data-driven AP effect catalog

Implement new nodes as catalog data using shared, typed effect handlers rather than scattering one-off conditions throughout the engine.

Each node must declare:
- stable persisted ID and class key;
- branch, category, tier, and presentation metadata;
- max rank and cost per rank;
- minimum level and explicit prerequisite IDs/ranks;
- effect type and typed payload;
- stack group, source/recipient, cap, duration/refresh policy, target validity, and proc-recursion policy where applicable.

Shared handlers may include flat/percentage/conditional stats, damage and incoming-damage modifiers, cooldown/mana modifiers, shield/heal modifiers, event triggers, target/duration states, and ability upgrades. Implement only the handler types actually needed by the approved node slice.

Keep Mage AP effects on combat casting only. AP must not feed back into Library discovery or research success/duration. Intelligence/Library research bonuses must not be applied a second time through AP perks.

**Exit gate:** every newly enabled perk has tests for baseline vs exact effect, caps, invalid/dead targets, immunity, stacking, expiration/refresh, and no unintended recursive triggers.

### Phase 3 — AP tree content in small class slices

Add branches incrementally, with each slice data-only where possible and only the minimal new handler types needed. Proposed branch identities:
- Knight: Vanguard, Bulwark, Executioner.
- Rogue: Assassin, Flurry, Shadow.
- Mage: Destruction, Restoration, Arcane Control.
- Archer: Sniper, Volley, Skirmisher.

Do not add all four classes' full trees in one patch. Start with one class/branch, test its effects and sample builds, then reuse the pattern. Keep the existing 19-AP level-20 budget and validate representative level-5, level-12, and level-20 builds. New damage/status values are provisional until simulation and combat tests support them.

**Exit gate:** the slice is tested, effects are consumed by real combat paths, and sample builds remain within earned AP with no orphaned prerequisites.

### Phase 4 — Martial Techniques execution foundation

Build a shared, validated technique compiler/execution plan; keep class-specific component catalogs and behavior distinct.

Technique composition:
- **Form:** core behavior (e.g. heavy strike, sequence, sweep, pierce, counter).
- **Delivery:** target/spatial behavior (selected target, line, cone, area, chain).
- **Modifier:** tactical property (armor break, slow, mark, bleed, stagger, shield).
- **Finisher:** optional advanced enhancement (execute, crit, secondary target, refund).

First release deliberately excludes Finishers and Training Grounds acquisition complexity.

#### Initial scope (Phase 4A)

- One equipped custom technique slot per eligible Knight/Rogue/Archer.
- Grant starter components for testing; do not implement the Training Grounds yet.
- Two Forms per class, two Deliveries per class, and three Modifiers per class maximum for this prototype.
- Keep existing fixed abilities unchanged.
- Mage is excluded from martial migration.
- Add Focus as a battle-only resource: proposed maximum 100, starting at 25; basic techniques roughly 30–45 Focus and advanced techniques 50–70. Treat these as tuning proposals, not immutable balance facts.
- Class-specific Focus names/generation can follow the proposal: Knight Resolve, Rogue Edge, Archer Aim. Implement only after event hooks are traced and tested.
- Clamp Focus to 0–100; use explicit rate limits where specified.
- Do not generate Focus from DoT, secondary delivery hits, reflection, counters, or custom technique chains by default. Avoid recursive proc loops.

#### Required execution lifecycle

1. Open the hero action menu and select a technique.
2. Validate source, Focus, cooldown, and action availability.
3. Select a compatible target or area.
4. Preview cost, cooldown, target, range, and effects.
5. Permit cancellation with no spend.
6. Validate again at commit time, including current range and target state.
7. Commit exactly once; then spend Focus and start cooldown.
8. Resolve movement, direct hits, status/control, healing/shields, and finishers in a defined order.
9. Revalidate after movement before applying target-dependent effects.
10. Complete the action and reopen the tactical menu using the established action lifecycle.

If committed movement cannot resolve a valid action and no effect has occurred, cancel/refund unless the Form explicitly supports ground resolution. No timer-based UI reopening if an authoritative completion callback/state transition exists.

#### Compatibility and status policy

- Hide incompatible component choices in UI; reject invalid compositions in the domain layer too.
- Complexity budgets by hero level: level 3 = 3; 6 = 5; 9 = 6; 12 = 8; 15 = 9; 20 = 10.
- Counter Stance cannot use cone/area Delivery without a dedicated handler.
- Shadowstep must resolve safe movement paths.
- Arrow Rain cannot Ricochet.
- Multi-hit Forms apply one status instance by default.
- Mark, Expose, Bleed, Slow, vulnerability, and Counter must have explicit ownership, stacking/refresh, expiry, invalid-target, and death cleanup rules before release.
- Focus refund and cooldown refund cannot coexist on the same technique.

**Exit gate:** construction, cancellation, target/range revalidation, exactly-once commitment, Focus/cooldown, movement failure, and completion callback tests pass. Existing fixed abilities still pass regression tests.

### Phase 5 — Training Grounds and progression unlocks

Only after Phase 4A is stable:
- deterministic component acquisition/training using time and resources;
- class discipline selection;
- component ownership and customization;
- a second equipped technique slot and later Finisher support;
- custom technique names;
- unlock slots/Complexity capacity according to hero level;
- training-attribute qualification where explicitly designed.

Proposed progression: level 3 first slot; 6 first Modifier slot; 9 second equipped slot; 12 first Finisher slot; 15 advanced Forms; 18 second Modifier option (only one active); 20 Mastery choice. These are proposal values and must be verified against existing hero level and UI architecture before implementation.

**Exit gate:** acquisition and loadout round-trip; incompatible or unlearned components cannot be saved/equipped; no duplicate grants on repeat normalization.

### Phase 6 — AP and Martial Techniques synergy

Integrate only explicit synergy tags between AP branches and compatible technique families. AP changes combat behavior, not component ownership or Focus purchases. Avoid duplicate stat multiplication where attributes, equipment, AP, and technique effects intersect.

**Exit gate:** interaction matrix tests prove each source applies once in the intended path; no perk modifies Mage research outcomes; no technique bypasses validation or action commitment.

### Phase 7 — Simulation, device validation, and release readiness

- Simulate level-5, level-12, and level-20 builds for each class.
- Compare basic attacks, fixed abilities, custom techniques, Focus generation, cooldown uptime, and AP specialization value.
- Test boss and wave-clear scenarios, invalid/dead/immune/out-of-range targets, death/revival, and battle completion.
- Test profile round-trip using existing and newly created profiles; verify migration idempotence.
- Run frontend tests, backend tests if dependencies/environment permit, production frontend build, Android configuration tests, Capacitor sync, and Android debug build where toolchain is available.
- Physical-device test is a separate result: do not claim it passed from unit tests or a successful APK build.
- Keep the Android backend URL/preflight protections intact. Do not deploy.

**Exit gate:** no unresolved P0 defects, documented balance results, verified persistence compatibility, test/build report, and explicit user approval before any commit/push/merge/deployment.

## 5. Cross-system regression matrix

Every applicable slice must cover:

### Progression and persistence
- Legacy profile with existing AP/SP, perks, XP/level, attributes, equipment, and Mage research data.
- New profile and missing/legacy optional fields.
- Normalize twice; compare semantic state.
- Save/load round-trip for learned components, custom techniques, equipped IDs, perk IDs/ranks, and schema version.
- Runtime Focus, cooldowns, marks, Bleeds, counters, and temporary states do not leak into permanent progression.
- Failed or cancelled operations do not partially save/commit.

### Combat
- Valid, invalid, dead, out-of-range, immune, and moving targets.
- Dead source, insufficient Focus/mana, cooldown, action unavailable, cancellation, and stale state.
- Exactly-once action commitment and resource spend.
- Revalidate target after movement and immediately before applying damage.
- Correct damage, mitigation, status stacking/refresh/expiry, shield/heal caps, death cleanup, and action completion.
- No Focus/proc recursion from DoT, reflection, counters, or secondary hits unless explicitly authorized by a tested component.

### AP tree UI
- Purchase enabled only when class, level, prerequisites/ranks, and AP balance are valid.
- Draft preview, undo, cancel, confirm once, stale-state rejection, and no negative balances.
- Descriptions match actual effect handlers; dormant effects must not be presented as active.

## 6. Required Copilot working protocol

Before every implementation slice:

1. Read this file completely.
2. Inspect branch, HEAD, status, diffs, existing docs, code, and tests.
3. Write down the exact files/behavior in scope and identify protected pre-existing changes.
4. Trace existing architecture and reuse the established domain/API/action lifecycle. Do not invent a parallel system before checking existing helpers.
5. Add or update focused tests alongside the smallest implementation change.
6. Run focused tests first; then the full relevant suite and build checks when practical.
7. Review `git diff --check`, the full diff, and final `git status --short`.
8. Update the development-session report with actual commands/results and what remains unverified.
9. Stop at the phase exit gate and report; do not silently advance to the next phase.

### Git and safety restrictions

- Work only on `feature/castle-management-first-pass` for application code.
- Do not switch branches automatically.
- Do not use `git reset`, `git clean`, `git checkout --`, destructive restore, stash, or broad formatting/rewrite commands.
- Do not overwrite existing files or revert unrelated work.
- Do not stage or commit unless explicitly asked.
- Do not push, merge, deploy, or alter `main`.
- If the required document is available only on another branch, fetch/read that exact path and copy it into the working tree without changing branches or merging. Confirm the destination file does not already exist before writing it.
- If a build script refuses to run because the worktree is dirty, do not bypass its safety check. Use an already established local-only builder only if its behavior is inspected and it preserves Git state.
- Never claim a test/build/device check succeeded unless the command actually ran and its result was observed.
- Do not expose secrets in output, logs, or reports.

## 7. Report format

Each phase report must include:
- objective and phase/exit gate;
- initial branch, HEAD, and clean/dirty status (summarize; do not dump sensitive data);
- protected pre-existing changes and confirmation they were preserved;
- findings with source file and symbol/function references;
- changed files and why;
- exact tests/build commands and pass/fail counts;
- skipped checks and why;
- persistence/migration risks and device verification status;
- final branch, HEAD, and worktree status;
- unresolved issues and recommended next phase.

A successful build is not proof of correct gameplay. Unit tests are not physical-device verification. A design proposal is not proof of implementation.

## 8. Definition of done for the first pass

The first pass is done only when:
- the worktree was inspected before edits and all pre-existing changes were preserved;
- each P0 issue was verified and either safely fixed with regression tests or documented with evidence and a reason it was deferred;
- relevant tests and `git diff --check` were run;
- the phase report accurately records actual outcomes;
- no unrelated phase was started;
- no commit, push, merge, deployment, or main-branch change occurred.
