# DEMONANIC — PERK & ABILITY DESIGN BIBLE v1.0

Status: Approved. This document is the single source of truth for the perk and ability system.
Purpose: This handoff exists so that no one downstream — human or LLM — has to invent gameplay details. If a behavior is not written here, it is not designed yet, and it must be raised as a question rather than filled in during implementation.
What is final: structure, node list, prerequisites, tiers, costs, AP economy, caps, stacking rules, phase gates, signatures.
What is provisional: every numeric value. Numbers are locked for implementation but not for release — they must pass simulation before launch. Do not change them unilaterally; flag them with data.

---

## 0. How to use this document

The receiving LLM is expected to:

1. Hold scope. Answer questions about this system using only what is written here. If a question is not answered here, say so explicitly and propose a decision for human approval — do not pick a default and present it as settled.
2. Review against the doc. When implementation is described, check it against Sections 2–8 and the acceptance tests in Section 9. Report mismatches by node ID and test number.
3. Never extend. Do not add nodes, signatures, branches, caps, or synergies that are not in this catalog. New content goes through the design process and lands in a new version.
4. Distinguish certainty levels. "Designed but untested" (numbers), "deferred" (Phase 2), and "undesigned" (respec) are different states. Keep them separate in every answer.

---

## 1. Design intent

Premise. Every hero begins unclassified with a shared combat baseline and one shared starter strike. Identity is not chosen at creation; it is earned by spending points in a universal tree.

Structural commitments:

- Seven core branches (Vanguard, Warden, Precision, Shadowcraft, Arcana, Tactics, Conjuration) plus four expansion branches (Hemomancy, Fortune, Wilds, Illusion).
- Three tiers per branch. Tier I costs 1 AP, Tier II costs 2 AP, Tier III costs 3 AP.
- Tier II requires its Tier I parent and level 5. Tier III requires any Tier II node in the same branch and level 10.
- Branches have both a core path and an alternate path, so two heroes investing in the same branch can look different.
- Hybrids are legal from the beginning. Deep investment produces signature builds.
- Titles are derived labels. They are cosmetic. Eligibility and combat behavior are checked against owned node IDs and level, never against title text.

Anti-goals:

- No class system, no locked archetypes, no "you are a mage now."
- No hidden synergies. Every interaction that matters is documented or gated.
- No dead AP sinks. Content that cannot function is not purchasable.

---

## 2. Progression economy

- Hero level grants 1 AP and 1 SP per level (SP governs a separate stat system, out of scope here).
- Tier I: 1 AP. Tier II: 2 AP. Tier III: 3 AP.
- Maximum two Tier III nodes per hero, counted across all branches and including alternates.
- A fully mastered single branch (all six nodes, core and alternate) costs 11 AP.
- A complete three-node core path costs 6 AP.
- At roughly level 20 a hero has ~19 AP: one full branch mastery plus supporting tiers, or two Tier III masteries with their prerequisites.
- No respec. No node may be sold, refunded, or retrained. Respec is a future system requiring its own refund and cost design.
- Signature abilities are granted automatically when their requirements are met. They cost 0 AP and do not count toward the two-Tier-III cap.

---

## 3. Locked global rules

These are the contract. Every node, signature, and future addition obeys them.

### 3.1 Damage pipeline

```
final = base
      × (1 + Σ situational bonuses)
      × (1 + Σ weapon bonuses)
      × (1 + Σ elemental bonuses)
      × crit multiplier
      × (1 − mitigation)
```

- Bonuses are additive within a category and multiplicative across categories.
- Each category is capped independently.
- Two +10% situational bonuses produce +20%, not +21%. A +10% weapon bonus and a +10% situational bonus multiply to +21% combined — this is intended and is the reward for diversifying.

### 3.2 Caps

| Category | Cap | Notes |
|---|---:|---|
| Weapon damage bonus | +50% | Additive within category |
| Situational damage bonus | +50% | Additive within category |
| Crit chance | 50% | Percentage points; guaranteed-crit effects bypass this |
| Crit damage | 250% | Base 150% + up to 100pp from bonuses |
| Attack speed | +20% | |
| Cooldown reduction | 30% | Applied to base cooldown; global cap applied last |
| Progression damage reduction | 30% | Warden, Tactics, and any future mitigation share this pool |
| Progression sustain | 4% max HP/sec | Combined lifesteal + regen from all progression sources |
| Enemy slow | 50% | |

### 3.3 Critical hits

- Base crit multiplier: 150%.
- Crit-damage bonuses add percentage points (Lucky Edge +15pp, Deadeye +20pp).
- Guaranteed-crit effects (Jackpot, Gambler, Archon, Phantom) bypass the 50% crit-chance cap. They do not bypass the 250% crit-damage cap.

### 3.4 Cooldowns

- Cooldown reduction applies to active ability cooldowns only.
- It does not apply to internal cooldowns or proc rates: Disrupt (8s), Echo (10s), Loaded Dice, Mirror Image ICD (15s), Last Stand ICD (60s), Ensnaring Roots (12s), Verdant Vigor tick.
- CDR modifies the base cooldown; the 30% global cap is applied last.
- All signature abilities share an 8-second signature lockout: while one signature has fired within the last 8 seconds, no other signature can fire.

### 3.5 Elements

- Arcana's element (Fire / Ice / Poison / Mind) is chosen during preparation, freely changeable between waves, locked at wave start, no AP cost.
- Changing element does not refund, reset, or alter any purchased node.
- Phase 1 ships Arcane only. Fire, Ice, Poison, and Mind are selectable but their damage types and resistances require the elemental resistance system to exist; until then Elementalism's +10% applies to the labeled element and the label is displayed.

### 3.6 Lethal damage resolution

Strict order:

1. Damage reduction applied.
2. Shields absorb.
3. Survival clause evaluated (Crimson Covenant's "cannot drop below 1 HP").
4. Death check.

Only one survival clause may fire per 60-second window, globally per hero. Crimson Covenant's own 60s timer and this global clause are the same timer — do not double-count.

### 3.7 Untargetable state

A shared flag, used by Smoke Bomb and Vanish.

- Untargetable units cannot be selected by direct attacks or single-target abilities.
- Area attacks still hit.
- Existing damage-over-time effects continue ticking.
- Enemy AI retargets to the nearest valid target within the same frame.
- Untargetability does not cleanse, dispel, or pause anything.

### 3.8 Control, marks, shields, auras

- Control: a target is controlled by a hero while affected by that hero's slow, root, or stun. Control windows are evaluated over a 4-second lookback for eligibility (Opening, Conjuration Focus).
- Marks: a target holds one mark per source. Mark, Echo, and Ensnaring Roots are independent and expire on their own timers. They do not overwrite each other.
- Shields: absorb damage before HP, are credited to the granter, and expire on combat end.
- Auras: same-type auras do not stack. The highest value applies per target. Different aura types stack normally.

---

## 4. Node catalog

Format: ID · Name — Tier · AP · Level · Prereq — Effect (tags)

Tags map to the damage pipeline categories and to shared systems. They exist so eligibility checks are mechanical, not narrative.

### Vanguard — weapon offense

- V1 · Edge Training — T1 · 1 · Lv1 · — +8% direct weapon damage. (weapon)
- V2 · Follow-Through — T2 · 2 · Lv5 · V1 — +10% damage to an enemy you hit within the previous 4s. (situational)
- V2a · Momentum — T2 · 2 · Lv5 · V1 — Consecutive hits on the same target grant +4% damage per stack, max 5 (+20%). Resets on target change or 4s without a hit. (situational)
- V3 · Cleaving Strike — T3 · 3 · Lv10 · any Vanguard T2 — Active, 20s CD. 160% weapon damage to one target, 40% to one adjacent enemy. (weapon, ability)
- V3a · War Cry — T3 · 3 · Lv10 · any Vanguard T2 — Active, 30s CD. Allies within 8 units gain +15% attack speed for 6s. (aura, speed, ability)

### Warden — survival and protection

- W1 · Vitality — T1 · 1 · Lv1 · — +8% maximum HP.
- W2 · Guard — T2 · 2 · Lv5 · W1 — −6% incoming damage. Shares the 30% progression reduction cap. (mitigation)
- W2a · Regeneration — T2 · 2 · Lv5 · W1 — Heal 1.5% max HP/sec while below 50% HP. Shares the 4%/sec sustain cap. (sustain)
- W3 · Interpose — T3 · 3 · Lv10 · any Warden T2 — Active, 24s CD. For 5s, the lowest-HP allied hero in range takes 25% less damage. Self if no ally qualifies. (mitigation, ability)
- W3a · Last Stand — T3 · 3 · Lv10 · any Warden T2 — On dropping below 25% HP, gain +25% damage reduction for 5s. 60s internal cooldown. Shares the 30% reduction cap. (mitigation)

### Precision — critical hits and execution

- P1 · Focus — T1 · 1 · Lv1 · — +8 percentage points crit chance. (crit)
- P2 · Mark — T2 · 2 · Lv5 · P1 — Your first hit on a new target marks it for 5s; you deal +10% damage to that target while marked. (mark, situational)
- P2a · Deadeye — T2 · 2 · Lv5 · P1 — +20 percentage points crit damage. (crit)
- P3 · Execution — T3 · 3 · Lv10 · any Precision T2 — Active, 22s CD. 180% weapon damage; increased by 25% if the target is below 35% HP. (weapon, ability)
- P3a · Killshot — T3 · 3 · Lv10 · any Precision T2 — Active, 18s CD. 200% weapon damage to a target below 40% HP. Cooldown refunded on kill. (weapon, ability)

### Shadowcraft — mobility and ambush

- S1 · Quickstep — T1 · 1 · Lv1 · — +5% attack speed. 20% cap. (speed)
- S2 · Evasion — T2 · 2 · Lv5 · S1 — 8% chance to evade a direct attack. Does not evade area attacks or status effects. (defense)
- S2a · Smoke Bomb — T2 · 2 · Lv5 · S1 — Active, 20s CD. Untargetable for 1.5s. Does not cleanse; area attacks still hit. (untargetable, ability)
- S3 · Ambush — T3 · 3 · Lv10 · any Shadowcraft T2 — Your first hit after 3s without dealing damage gains +25% damage. Once per target per combat. (situational)
- S3a · Vanish — T3 · 3 · Lv10 · any Shadowcraft T2 — Active, 25s CD. Untargetable for 3s; your next hit deals +80% damage. (untargetable, situational, ability)

### Arcana — elemental and magical power

- A1 · Arcane Spark — T1 · 1 · Lv1 · — Unlocks the Arcane damage capability; +8% Arcane damage. Does not grant Library research access. (elemental)
- A2 · Elementalism — T2 · 2 · Lv5 · A1 — Choose Fire, Ice, Poison, or Mind during preparation; +10% damage of that element. (elemental)
- A2a · Chain Spark — T2 · 2 · Lv5 · A1 — Your elemental direct hits jump to up to 2 additional targets for 40% damage. (elemental)
- A3 · Arcane Channel — T3 · 3 · Lv10 · any Arcana T2 — Active, 20s CD. Single-target Arcane bolt for 175% Arcane damage. Magic-immunity rules apply. (elemental, ability)
- A3a · Meteor — T3 · 3 · Lv10 · any Arcana T2 — Active, 25s CD. 2s telegraph, then 180% Arcane damage in radius 4, up to 5 targets. Magic-immunity rules apply. (elemental, area, ability)

### Tactics — disruption and team support

- T1 · Readiness — T1 · 1 · Lv1 · — +5% cooldown recovery. 30% cap. (cdr)
- T2 · Disrupt — T2 · 2 · Lv5 · T1 — The first direct hit every 8s slows the enemy's movement and attack speed by 15% for 3s. Bosses receive 5%. (control)
- T2a · Rally — T2 · 2 · Lv5 · T1 — Active, 22s CD. Allies within 8 units heal 10% max HP. (sustain, ability)
- T3 · Opening — T3 · 3 · Lv10 · any Tactics T2 — Allies deal +8% damage to an enemy controlled by this hero. (situational, control)
- T3a · Formation — T3 · 3 · Lv10 · any Tactics T2 — Allies within 5 units take 5% less damage. Shares the 30% reduction cap. (mitigation, aura)

### Conjuration — constructs and ability synergy

- C1 · Conjuration Focus — T1 · 1 · Lv1 · — +8% damage to targets affected by your active ability. 4s window. (situational)
- C2 · Echo — T2 · 2 · Lv5 · C1 — Your first ability hit every 10s applies an echo mark for 4s. The next allied hit adds bonus damage equal to 20% of your attack damage, credited to you. (mark, ability)
- C2a · Ward — T2 · 2 · Lv5 · C1 — Active, 18s CD. Absorb the next 80 damage dealt to the lowest-HP ally in range. (shield, ability)
- C3 · Construct — T3 · 3 · Lv10 · any Conjuration T2 — PHASE 2 GATE. Stationary construct, 6s lifetime. (summon)
- C3a · Familiar — T3 · 3 · Lv10 · any Conjuration T2 — PHASE 2 GATE. Companion attacks your target for 8% of your attack damage every 3s. (summon)

### Hemomancy — health as a resource

- H1 · Sanguine Edge — T1 · 1 · Lv1 · — Direct weapon hits restore 2% of damage dealt as HP. Abilities and area damage do not trigger it. (sustain)
- H2 · Blood Price — T2 · 2 · Lv5 · H1 — Active abilities cost 5% of current HP but deal +12% more damage. Cannot trigger if it would leave you below 1 HP. (risk, ability)
- H3 · Crimson Covenant — T3 · 3 · Lv10 · any Hemomancy T2 — Active, 30s CD. For 6s, lifesteal is doubled and you cannot drop below 1 HP. Survival clause is once per 60s. (survival, sustain, ability)

### Fortune — variance and crit damage

- F1 · Lucky Edge — T1 · 1 · Lv1 · — +15 percentage points crit damage. (crit)
- F2 · Loaded Dice — T2 · 2 · Lv5 · F1 — Each direct hit has a 10% chance to deal 150% damage and a 10% chance to deal 75% damage. Expected value is neutral by design. (variance)
- F3 · Jackpot — T3 · 3 · Lv10 · any Fortune T2 — Active, 35s CD. Your next 3 direct hits are guaranteed critical hits. Bypasses the crit-chance cap, not the crit-damage cap. (crit, ability)

### Wilds — terrain and regeneration

- N1 · Verdant Vigor — T1 · 1 · Lv1 · — Regenerate 1% max HP every 3s after 5s without taking damage. Shares the sustain cap. (sustain)
- N2 · Ensnaring Roots — T2 · 2 · Lv5 · N1 — Every 12s, your next direct hit roots the target for 1.5s. Bosses: 0.5s. Counts as control for Opening. (control)
- N3 · Primal Bond — T3 · 3 · Lv10 · any Wilds T2 — PHASE 2 GATE. Summon a spirit beast for 8s that attacks your current target. (summon)

### Illusion — misdirection

- I1 · Fade — T1 · 1 · Lv1 · — Gain 8% evasion while at full HP. (defense)
- I2 · Mirror Image — T2 · 2 · Lv5 · I1 — When you take damage, 15% chance to spawn a decoy that absorbs the next hit. 15s internal cooldown. Decoy cleans up on combat end. (defense)
- I3 · Phantom Strike — T3 · 3 · Lv10 · any Illusion T2 — Active, 22s CD. Teleport behind the target and deal 150% weapon damage; +50% if the target was not targeting you. (mobility, ability)

Catalog totals: 47 nodes across 11 branches. 43 Phase 1, 4 gated.

---

## 5. Shared starter ability

Shared Strike — no AP, available at hero creation.
150% direct-hit weapon damage to one valid target. Cooldown 12s.

It cannot stun, slow, heal, deal area damage, summon, or convert its damage type. It is an ability for tagging purposes (so Blood Price, Echo, and Conjuration Focus treat it as one) and a weapon attack for category purposes. Coefficient and cooldown are provisional pending simulation.

---

## 6. Signature abilities

Granted automatically at no AP when requirements are met. Do not count toward the two-Tier-III cap. All share the 8-second signature lockout.

"T2+ in branch X" means owning at least one Tier II or Tier III node in X.

| Signature | Requirements | Ability | CD | Phase |
|---|---|---|---:|---:|
| Battle Mage | Arcane Channel + T2+ Vanguard or Warden | Arcane Infusion: next 3 direct hits gain +20% Arcane damage | 24s | 1 |
| Bandit | Ambush + (Disrupt or Mark) | 150% weapon-damage opener that applies Mark and Disrupt's slow for 4s, ignoring their internal cooldowns | 15s | 1 |
| Pyromancer | Fire Elementalism + Arcane Channel + Disrupt | Fire area technique, up to 3 targets, 4s burn at 8% of attack damage per second, non-stacking, refreshable | 20s | 1.5 |
| Summoner | Construct + T2+ Warden or Tactics | Deferred | — | 2 |
| Blood Knight | Crimson Covenant + T2+ Vanguard | +40% damage for 4s at a cost of 15% max HP; lifesteal doubled during 30s | — | 1 |
| Gambler | Jackpot + T2+ Shadowcraft | Next hit is a guaranteed crit with +50pp crit damage | 20s | 1 |
| Beastmaster | Primal Bond + T2+ Conjuration | Deferred | — | 2 |
| Phantom | Phantom Strike + T2+ Precision | Teleport strike that always crits if the target was not targeting you | 25s | 1 |
| Archon | Any Arcana T3 + T2+ Fortune | Next spell is a guaranteed crit | 20s | 1 |

Pyromancer note: requires a verified damage-over-time/burn handler. Burn is non-stacking and refreshable, dealing 8% of attack damage per second, credited to the Pyromancer. Until the handler exists, the signature is not granted.

---

## 7. Shared systems and archetypes

Five archetypes are in active use. Build support for exactly these; do not build the reserved ones.

In use: Aura (War Cry, Formation) · Mark (Mark, Echo, Ensnaring Roots) · Shield (Ward) · Untargetable (Smoke Bomb, Vanish) · Control (Disrupt, Ensnaring Roots, Opening eligibility).

Reserved — not in Phase 1, do not build support: Stance, Counter, Channel.

---

## 8. Phase gates

Phase 1 — ships now: all nodes and signatures except those listed below.

Phase 1.5 — Pyromancer: ships when the burn/DoT handler exists.

Phase 2 — companion lifecycle: Construct (C3), Familiar (C3a), Primal Bond (N3), Summoner, Beastmaster. Requires, at minimum: target selection policy, health and death handling, ownership and attribution, guaranteed cleanup on expiry and on combat end, and interaction rules with untargetable and control states.

Behavior of gated content: renders as Unavailable — system pending. AP cannot be spent on it. It is not a dead AP sink because purchase is refused. No partial behavior may leak: a gated node must not grant its tags, its prerequisites, or any passive fragment of its effect.

---

## 9. Acceptance tests

### Progression

1. Tier II purchase requires its Tier I parent and level 5; Tier III requires any Tier II in the branch and level 10. Invalid purchases are rejected with a specific reason.
2. A third Tier III node is rejected with an explicit mastery-cap message.
3. Titles derive from owned node IDs. Renaming or reordering titles never changes eligibility or combat behavior.
4. Gated nodes reject purchase and display the pending-system label.

### Damage and stacking

5. Follow-Through + Mark at +10% each produce +20%, not +21%. A weapon bonus and a situational bonus multiply.
6. Every cap in Section 3.2 clamps independently and is observable in the combat log.
7. Loaded Dice averages +2.5% over 10,000 samples within tolerance.

### Crit

8. Base crit deals 150%. Focus + Deadeye + Lucky Edge yields 185% crit damage, clamped at 250%. Jackpot bypasses the crit-chance cap but not the crit-damage cap.

### Cooldowns

9. Readiness reduces active cooldowns only. Disrupt's 8s internal cooldown and Echo's 10s internal cooldown are unchanged at 30% CDR.
10. A second signature cannot fire during the 8s signature lockout.

### Control and marks

11. Opening grants allies +8% only against an enemy the owner currently controls; the bonus ends 4s after control expires.
12. Mark, Echo, and Ensnaring Roots coexist on one target and expire independently.
13. Bosses receive 5% slow from Disrupt and 0.5s root from Ensnaring Roots.

### Sustain and survival

14. Lifesteal from Sanguine Edge, Crimson Covenant, and Regeneration combined never exceed 4% max HP/sec.
15. Lethal damage resolves reduction → shield → survival clause → death. Crimson Covenant fires once per 60s and never leaves the hero at 0 HP.
16. Blood Price refuses the ability rather than clipping the cost when activation would drop the hero below 1 HP.

### Untargetability

17. During Smoke Bomb and Vanish, direct attacks and single-target abilities cannot select the hero; area attacks land; existing DoTs continue; enemies retarget within the same frame.

### Conjuration

18. Echo bonus damage is attributed to the Conjurer and consumes the mark on the next allied hit.
19. Conjuration Focus's +8% applies only within 4s of the owner's active ability affecting the target.

### Gates

20. Construct, Familiar, Primal Bond, Summoner, and Beastmaster are non-purchasable and non-executable; no partial behavior leaks.

---

## 10. Explicitly undecided — do not invent

Raise these as questions; do not resolve them during implementation.

- Respec. Not designed. No refunds, no resale, no partial recovery. Do not add a "free respec" or a gold-cost respec.
- Simulation tuning. All coefficients and cooldowns are provisional. Changes require data, and changes to caps require a document revision.
- Elemental resistance system. Fire/Ice/Poison/Mind are selectable but their damage types, resistances, and immunities are not designed here.
- Companion lifecycle. Fully deferred; no partial specification exists.
- Multiple stances, counters, or channels. Reserved archetypes with no Phase 1 nodes. Do not build support speculatively.
- Stat points (SP). Out of scope for this document entirely.
- Library research access. Arcane Spark explicitly does not grant it. How research unlocks is a separate system.
- PvP balance. Not addressed anywhere in this document. Do not assume PvP symmetry.

---

## 11. Document control

- Version 1.0. Approved. Supersedes all prior perk and ability discussions.
- Change process: any change to structure, nodes, caps, stacking, or phases requires a new version. Numeric tuning within existing categories may be tracked separately with simulation data attached.
- Canonical IDs: node IDs (V1, W2a, C3, etc.) are permanent. Do not renumber, reuse, or recycle an ID.
- Authority: where this document and an implementation disagree, this document governs until it is formally revised.
