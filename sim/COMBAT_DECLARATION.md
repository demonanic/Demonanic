# Demonanic Combat Formula Declaration v0.2

Status: FROZEN CONTRACT — v0.2 balance update  
Branch: `feature/capacitor-android`  
Scope: Combat simulation only  
Construction layer: FROZEN — 72/72 validation PASS  
Source baseline: current `feature/capacitor-android` engine/config/logic files  
Combat simulator: NOT YET IMPLEMENTED

> This document is the contract for `simulateCombat()`. The simulator must not silently introduce formulas or behavior that are absent here. If the live engine changes, this declaration must be reviewed and versioned before the simulator is changed.

---

## 1. Contract layers

### ENGINE

What Demonanic does today, as extracted from the live engine.

### EQUIPMENT MODEL

A simulator projection that applies the verified equipment stat package to an equivalent hero-derived function. This does **not** claim that the current live game already applies E1–E5 equipment during combat.

### TUNING / MODELING

Explicit assumptions, sensitivity parameters, or proposed behavior that is not currently implemented by the live engine.

The simulator must label these separately from engine-faithful results.

---

## 2. Equipment integration boundary

### E0

**Integration status: ENGINE-FAITHFUL**

E0 represents the current live combat formulas without equipment-derived combat bonuses.

### E1–E5

**Integration status: PROJECTION**

E1–E5 are equipment projections. The simulator applies the validated equipment stat package to an equivalent simulator-side hero-derived function.

The simulator is **not** claiming:

> "This is what the live game currently does with E5 equipped."

It is claiming:

> "This is what a hero carrying the E5 stat package would do when evaluated against the verified combat formulas."



Required output metadata:

```
E0: integrationStatus = "ENGINE-FAITHFUL"
E1-E5: integrationStatus = "PROJECTION"
```

---

## 3. Geometry fidelity boundary

The primary combat model uses engine geometry where the engine exposes deterministic spatial rules. It does **not** claim that a 1.0 geometry factor means perfect physical reproduction.

| Spatial factor | Modeled? | Primary treatment | Sensitivity parameter if incomplete |
|---|---|---|---|
| Enemy pathing and lane selection | YES, approximate | Five lanes; engine-style least-resistance lane selection using barricade HP + nearby tower threat, with randomized tie pressure | Randomized lane choice remains an engine approximation |
| Projectile travel time | YES | Projectile speed and elapsed travel are modeled | None |
| Projectile miss/hit on moving targets | NO | Current engine stores target coordinates at fire time; hit resolves against the target object when projectile arrives, without re-solving impact position | `geometrySensitivity` may be used only for aggregate unmodeled spatial effects |
| Hero positioning and aggro range | YES | Hero positions, movement, range checks, manual/rally/retreat behavior, and target search ranges are modeled at the formula level | None for represented rules |
| Tower range check timing | YES | Target pool is evaluated at tower fire time using current positions | None |
| Splash hit geometry | YES | Napalm and Catapult splash use Euclidean distance/radius checks; napalm uses distance falloff | None |
| Enemy clumping and collision | PARTIAL | Clumping affects Catapult cluster targeting and physical proximity checks; there is no generic enemy collision/occupancy solver | `geometrySensitivity` |
| Barricade interaction | YES | Lane-specific barricade HP, collision damage, and barricade blocking are represented | None for represented rules |

### Geometry sensitivity

The old 82% factor is **not** part of the primary model.

The primary model uses:

```
geometrySensitivity = 1.0
```

for the aggregate spatial effects that cannot be reproduced exactly.

This parameter belongs to the **MODELING / SENSITIVITY** layer, not the ENGINE layer.

Recommended sensitivity runs:

- 1.00 — primary
- 0.90 — moderate spatial-efficiency penalty
- 0.82 — historical screening comparison only

The 0.82 run must never be presented as engine truth.

---

## 4. Hero derived combat formulas

Source: `frontend/src/game/logic.js :: heroDerived()` (lines 23–35).

For a hero:

```
maxHP = heroMaxHp(class, level, stats)

attack =
  stats.attack + level
  except Archer:
  stats.attack + (level * 2)

range = class.attackRange
rate  = class.attackRate
magic = class.magic

critDmgBonus =
  floor(stats.attack / 10) * 0.01

dodge = dodgeChance(stats.agility)

healPower =
  1 + stats.intelligence / 100
```

Class combat ranges/rates are source-derived from `frontend/src/game/config.js :: HERO_CLASSES` (line 189):

| Class | Range | Attack rate |
|---|---:|---:|
| Knight | 70 | 1.1 |
| Rouge | 90 | 0.5 |
| Mage | 300 | 1.6 |
| Archer | 340 | 1.0 |

Melee classification in the engine:

```
melee = range < 130
```

Therefore Knight and Rouge are melee; Mage and Archer are ranged.

---

## 5. Crit behavior

Source: `frontend/src/game/engine.js :: _applyHit()` (line 413), constants in `frontend/src/game/config.js` lines 223–224.

```
BASE_CRIT = 0.05
CRIT_MULT = 1.75

critRoll = random() < BASE_CRIT

if crit:
    damage *= CRIT_MULT
```

Therefore:

- Base crit chance = **5%**
- Crit multiplier = **1.75×**
- Crit is a separate roll.
- Equipment Crit Chance/Crit Damage are **not currently consumed by the live engine**.

Equipment crit remains a simulator projection only until live combat integration is implemented.

---

## 6. Hero damage → enemy

Source: `frontend/src/game/engine.js :: _fire()` (line 301) and `_applyHit()` (line 413).

Projectile damage is:

```
projectileDamage = derivedHeroDamage
```

Then:

```
affinity = affinityMultiplier(enemy, damageType)

if affinity <= 0:
    damage = 0
else:
    damage = projectileDamage * affinity
    if crit:
        damage *= 1.75
```

Hero → enemy damage does **not** use the defense formula.

---

## 7. Affinity multipliers

Source: `frontend/src/game/config.js :: AFFINITY_MULTIPLIERS` (line 57).

| Affinity | Multiplier |
|---|---:|
| susceptible | 1.25 |
| normal | 1.00 |
| tolerant | 0.60 |
| resistant | 0.30 |
| immune | 0.00 |

Unlisted damage-type affinities are **normal (1.00×)** because `affinityMultiplier()` defaults to `"normal"`.

### Enemy affinity matrix

The engine uses explicit damage types rather than one generic "physical" type. Therefore the simulator must preserve the actual class/tower damage types.

| Enemy | Knight melee | Rouge melee | Archer ranged | Arcane | Fire | Lightning | Frost | Dark Soul |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ghost | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.60 |
| Slime | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 | 0.30 | 1.00 | 0.30 |
| Goblin | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Skeleton | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Orc | 1.00 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | 1.25 | 1.00 |
| Reaper | 0.60 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 0.30 |
| Dark Elf | 1.00 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 1.25 |
| Warlock | 1.00 | 1.00 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | 0.30 |
| Lieutenant | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Three-Headed Demon | 1.00 | 1.00 | 1.00 | 0.60 | 0.30 | 1.00 | 1.00 | 0.60 |
| Imperial Necromancer | 1.25 | 1.00 | 1.00 | 0.60 | 1.00 | 0.60 | 0.60 | 0.30 |
| Nuclear Behemoth | 1.00 | 1.00 | 1.25 | 0.30 | 1.00 | 0.30 | 0.30 | 0.30 |

Source: `frontend/src/game/config.js :: ENEMIES` (line 258), `BOSS_AFFINITIES` (lines 71–94).

Important: "physical" is **not** a single engine damage type. Knight, Rouge, and Archer use distinct identifiers.

---

## 8. Enemy → hero damage

Source: `frontend/src/game/config.js :: damageAfterDefense()` (line 223) and `frontend/src/game/engine.js :: _enemyAttack()` (line 488).

Defense formula:

```
damageAfterDefense(raw, def)
    = raw * 100 / (100 + def)
```

Enemy attack sequence:

1. Select defender.
2. Roll hero dodge.
3. If dodged: 0 damage.
4. Apply defense formula.
5. Consume hero shield.
6. Apply remaining HP damage.
7. If hero HP reaches 0, mark hero defeated.

---

## 9. Hero dodge

Source: `frontend/src/game/config.js :: dodgeChance()` (line 226).

```
dodgeChance(agi)
    = max(0, min(0.35, 0.005 * agi))
```

Therefore:

- 0.5% dodge per point of Agility
- 35% hard cap

---

## 10. Enemy → tower damage

Source: `frontend/src/game/engine.js :: _enemyAttack()` (line 488).

Default:

```
towerDamage = enemyDamage
```

Dark Elf:

```
towerDamage = enemyDamage * 1.15
```

No tower-defense reduction formula is applied.

---

## 11. Hero targeting priority

Source: `frontend/src/game/engine.js :: _selectTarget()` (line 372).

Target pool:

- Melee heroes: enemies within 220 px.
- Ranged heroes: enemies within the hero's class range.

Attack configuration:

| Hero configuration | Priority |
|---|---|
| Offensive Heavy / default | Nearest |
| Defensive Guard | Closest-to-keep / greatest Y |
| Assassinate Weakest | Lowest current HP |
| Sniper (strongest) | Highest max HP |
| Mage | Highest applicable Arcane affinity, then lower HP |
| Closest Enemy | Nearest |

Mage filters out targets with zero Arcane affinity.

The simulator must preserve these targeting modes.

---

## 12. Tower default targeting modes

Source: `frontend/src/game/config.js :: TOWERS` (line 130) and `frontend/src/game/engine.js :: _selectTowerTarget()` (line 294).

| Tower | Default targeting mode | Configurable? |
|---|---|---|
| Archer | nearest | YES in engine through tower-derived config |
| Catapult | cluster | YES in engine through tower-derived config |
| Wizard | vulnerable | YES in engine through tower-derived config |
| Ballista | elite_boss | YES in engine through tower-derived config |

For the first simulator pass, the simulator pins the **current config defaults** above. It must not invent player-selected alternative targeting behavior.

Targeting definitions:

- `nearest`: nearest enemy in tower range.
- `elite_boss`: Boss > Elite > Basic; ties favor higher max HP.
- `vulnerable`: highest positive affinity for tower damage type; ties favor lower HP.
- `cluster`: highest number of nearby enemies within splash radius.

---

## 13. Tower attack timing and resource consumption

Source: `frontend/src/game/engine.js :: update()` tower-fire block and `_fire()`; tower derived values from `frontend/src/game/logic.js :: towerDerived()` (line 52).

At each tower firing opportunity:

1. Decrease cooldown.
2. Find target in range.
3. Read current AMMO/MANA.
4. Require current resource >= shot cost.
5. Consume resource **before firing**.
6. Fire projectile.
7. Set cooldown:

```
cooldown = 1 / fireRate
```

Tower projectile speeds:

- Physical: 460 px/s
- Magic: 340 px/s

Tower damage is the derived tower damage value, including the current underfunded modifier when applicable.

---

## 14. Ammo / mana resupply

Source: `frontend/src/game/logic.js :: resupplyTower()` (line 263).

The engine does **not** automatically refill towers merely because a wave ended.

Resupply is a player/economy action that fills the tower to maximum when purchased.

For missing resource:

```
gold = ceil(missing * resupplyGold)
stone = ceil(missing * resupplyStone)
```

If affordable, the engine sets AMMO/MANA to maximum.

Therefore:

**Resupply mode = between-wave/prep manual resupply, economy-funded, full refill.**

During a wave there is no automatic resupply mechanism in the verified engine.

This means resource exhaustion is a legitimate **within-wave** failure mode.

The simulator must model each wave's finite starting resource and, between waves, apply the declared resupply policy rather than silently granting free refills.

### Upkeep distinction

Source: `frontend/src/game/logic.js :: chargeUpkeep()` (line 279).

At wave start, tower upkeep is charged:

```
scale = 1 + 0.15 * (level - 1)

gold = ceil(baseGoldUpkeep * scale)
stone = ceil(baseStoneUpkeep * scale)
```

If the player cannot pay both, the tower becomes `underfunded`.

Underfunded tower penalties:

Source: `frontend/src/game/config.js :: UNDERFUNDED`.

- Damage ×0.65
- Fire rate ×1.25 (slower)
- HP drains at 4% of max HP per minute

The simulator must distinguish **resource resupply** from **upkeep**.

---

## 15. Enemy movement and lane selection

Source: `frontend/src/game/engine.js :: pickLane()` and `_updateEnemy()`.

There are five lanes.

Lane selection is approximately:

```
cost =
    barricade HP
    + sum(nearby tower damage * 3)
    + random(0, 40)
```

The lowest-cost lane is selected.

Floating enemies ignore barricade HP in lane selection.

Enemy movement is updated continuously using speed × dt, with tactical speed modifiers documented in the engine.

---

## 16. Projectile geometry

Source: `frontend/src/game/engine.js :: update()` projectile loop.

Projectiles have:

- current position
- target snapshot coordinates
- target object
- projectile speed
- elapsed time

Travel is modeled continuously.

However, the target coordinates are not continuously recomputed while the target moves. Therefore projectile interception against moving targets is an **incomplete geometry reproduction**.

The simulator must document this as an approximation rather than adding a fictional hit/miss rule.

---

## 17. Splash geometry

### Catapult

Tower configuration provides:

```
splash = 55 px
```

Cluster targeting counts nearby enemies within this radius.

### Boss napalm

Source: `frontend/src/game/engine.js :: _throwNapalm()` and `_explodeNapalm()`.

Default:

```
baseDamage = bossDamage * 1.3
splashRadius = 68
projectileSpeed = 250
```

Distance falloff:

```
falloff = 1 - 0.45 * (distance / splashRadius)
damage = baseDamage * falloff
```

Heroes then receive the defense formula and shield handling.

Towers receive the resulting direct damage.

---

## 18. Boss behavior

Source: `frontend/src/game/engine.js :: _updateEnemy()`, `_throwNapalm()`, `_explodeNapalm()`.

Current shared boss behavior:

- Boss ability initial cooldown: 5 seconds.
- Subsequent ability cooldown: 6 seconds.
- Default attack range: 420 px.
- Two Skeletons are spawned when the boss ability triggers.
- Napalm is launched at the nearest defender within range.
- Napalm speed: 250 px/s.
- Napalm damage: boss damage × 1.3.
- Splash radius: 68 px unless configured otherwise.

### Boss lifesteal implementation

Current engine code applies:

```
bossHP += heroDamageTaken * 0.5
```

when a boss performs a normal attack against a hero.

The code condition is `e.boss`, so this is currently implemented as a generic boss behavior even though the design comment associates it with Demon Lord.

The simulator must reproduce the **current implementation** unless a later engine change explicitly narrows it.

---

## 19. Castle damage

Source: `frontend/src/game/engine.js :: _damageCastle()` (line 475) and `_updateEnemy()`.

When an enemy reaches the castle:

```
castleDamage = enemyDamage * 4
```

Castle maximum HP:

Source: `frontend/src/game/config.js :: castleMaxHp()` (line 248).

```
castleMaxHP = 1000 + 50 * highestWaveCleared
```

Castle damage also changes morale according to the current morale configuration.

---

## 20. Enemy scaling and wave composition

Source: `frontend/src/game/config.js` lines 252–254 and the wave construction logic.

```
targetEnemyCount(wave, cp)
    = round(12 + 2.5 * wave + 0.75 * cp)

enemyHpScale(wave, cp)
    = 1 + 0.045 * (wave - 1) + 0.02 * cp

enemyDmgScale(wave, cp)
    = 1 + 0.035 * (wave - 1) + 0.015 * cp
```

These are engine/config formulas and are not replaced by simulator tuning.

---

## 21. Hero abilities and passives

### Inclusion rule

The combat simulator models **combat behavior that the current engine actually executes through `attackConfig`, support, healing, barrier, targeting, and derived stats. It does not invent unimplemented active ability/perk mechanics.**

Currently verified engine-executed support behavior includes:

- Mage Support / Heal configuration.
- Mage Defensive Barrier configuration.

Source: `frontend/src/game/engine.js :: update()` support branch and `_support()`.

### Explicitly excluded from combat simulation unless later implemented in the engine

The simulator does **not** invent mechanics for:

- Knight "Shield Bash"
- Rouge "Blitz Strike"
- Archer "Piercing Shot"
- Mage "Arcane Bolt" as a separate active ability
- Knight "Bulwark"
- Knight "Cleave"
- Knight "Iron Wall"
- Rouge "Flurry"
- Rouge "Backstab"
- Rouge "Evasion"
- Mage "Firestorm"
- Archer "Eagle Eye"
- Archer "Rapid Draw"
- Archer "Focus Fire"

These names exist in configuration, but the current combat engine does not execute them as separate active/passive combat systems.

The simulator may use the currently implemented attack configurations (for example Assassinate Weakest or Sniper Strongest), because those affect actual target selection.

---

## 22. XP attribution

Source: `frontend/src/game/engine.js :: _killEnemy()` (line 510).

### Normal / specialized / elite

- Highest damage source receives the full enemy-tier XP.
- Living heroes each receive an additional 35% of tier XP.
- Morale changes according to enemy tier and kill source.

### Boss

Boss XP is distributed by proportional damage share.

Boss tier XP:

```
600 XP
```

The simulator must report damage contribution and XP attribution separately.

---

## 23. Ranged enemy status

Current engine status:

### Dark Elf

**Not a normal ranged attacker.**

Its tactical targeting may seek towers within 300 px, but its actual tactical attack range is 38 px.

### Warlock

**Not a normal ranged attacker.**

It has:

- tower resource drain
- 300 px tower search range
- 18% maximum-resource drain
- 3-second tower damage debuff

Mode B — ranged Dark Elf / Warlock projectiles — remains **TUNING / PROPOSED**, not engine behavior.

The first simulator pass must use **Mode A** unless a separate Mode B experiment is explicitly requested.

---

## 24. Primary combat model rule

The first combat simulator must prioritize:

1. Verified engine formulas.
2. Verified engine targeting.
3. Verified engine resource behavior.
4. Verified engine wave composition.
5. Explicit equipment projection.
6. Explicit geometry approximation.
7. Clearly labeled sensitivity testing.

It must **not** use the historical 82% factor as an unexplained universal damage multiplier.

---

## 25. Output labeling contract

Every combat result must identify:

- CP
- state family
- hero levels
- tower composition and levels
- wave
- equipment scenario
- equipment integration status
- geometry sensitivity
- enemy behavior mode
- victory/defeat
- duration
- hero deaths
- tower deaths
- castle HP remaining
- hero damage
- tower damage
- damage share
- enemy kills
- resource consumption
- primary failure cause

Equipment status:

```
E0 -> ENGINE-FAITHFUL
E1-E5 -> PROJECTION
```

Any result using Mode B ranged enemies must be labeled:

```
enemyBehaviorMode = "MODE_B_PROPOSED"
```

---

## 26. Verification provenance

| Formula / rule | Source |
|---|---|
| Hero derived attack/range/rate | `frontend/src/game/logic.js :: heroDerived()` lines 23–35 |
| Hero class stats | `frontend/src/game/config.js :: HERO_CLASSES` line 189 |
| Hero attack configs | `frontend/src/game/config.js :: ATTACK_CONFIGS` line 214 |
| Damage vs defense | `frontend/src/game/config.js :: damageAfterDefense()` line 223 |
| Crit multiplier/base chance | `frontend/src/game/config.js :: CRIT_MULT / BASE_CRIT` lines 224–225 |
| Dodge | `frontend/src/game/config.js :: dodgeChance()` line 226 |
| Affinity multipliers | `frontend/src/game/config.js :: AFFINITY_MULTIPLIERS` line 57 |
| Enemy affinities/archetypes | `frontend/src/game/config.js :: ENEMIES` line 258 |
| Boss affinity definitions | `frontend/src/game/config.js :: BOSS_AFFINITIES` lines 71–94 |
| Tower resource definitions | `frontend/src/game/config.js :: TOWER_RESOURCE` line 105 |
| Tower targeting defaults/stats | `frontend/src/game/config.js :: TOWERS` line 130 |
| Tower derived damage/resource capacity | `frontend/src/game/logic.js :: towerDerived()` line 52 |
| Hero target selection | `frontend/src/game/engine.js :: _selectTarget()` line 372 |
| Tower target selection | `frontend/src/game/engine.js :: _selectTowerTarget()` line 294 |
| Projectile construction | `frontend/src/game/engine.js :: _fire()` line 301 |
| Projectile hit/crit/affinity | `frontend/src/game/engine.js :: _applyHit()` line 413 |
| Enemy attack | `frontend/src/game/engine.js :: _enemyAttack()` line 488 |
| Enemy tactical update | `frontend/src/game/engine.js :: _updateEnemy()` line 285 |
| Enemy tactical target selection | `frontend/src/game/engine.js :: _selectEnemyTacticalTarget()` line 453 |
| Boss napalm launch | `frontend/src/game/engine.js :: _throwNapalm()` line 443 |
| Boss napalm splash/falloff | `frontend/src/game/engine.js :: _explodeNapalm()` line 411 |
| Enemy death/reward/XP | `frontend/src/game/engine.js :: _killEnemy()` line 510 |
| End conditions | `frontend/src/game/engine.js :: _checkEnd()` line 427 |
| Tower resupply | `frontend/src/game/logic.js :: resupplyTower()` line 263 |
| Wave-start tower upkeep | `frontend/src/game/logic.js :: chargeUpkeep()` line 279 |
| Enemy count scaling | `frontend/src/game/config.js :: targetEnemyCount()` line 252 |
| Enemy HP scaling | `frontend/src/game/config.js :: enemyHpScale()` line 253 |
| Enemy damage scaling | `frontend/src/game/config.js :: enemyDmgScale()` line 254 |

Line numbers refer to the current `feature/capacitor-android` snapshot used to create this declaration. A source change requires re-verification.

---

## 27. Explicit unresolved items

These remain intentionally outside the frozen engine contract:

1. Final live-game integration of E1–E5 equipment.
2. Secondary identity modifiers and weapon-pairing combat effects remain unresolved; numeric values are not invented.
3. Class-specific secondary identity stats; current simulator uses the documented shield-stat proxy.
4. Mode B ranged Dark Elf/Warlock behavior.
5. Exact reproduction of moving-target projectile interception.
6. Generic enemy collision/occupancy physics.
7. Any future implementation of named hero actives/passives listed above.

These are not to be silently resolved inside `simulateCombat()`.

---

## 28. Contract rule for simulateCombat()

`simulateCombat()` is a translation of this document, not a new design surface.

If implementation and this document disagree:

**The simulator implementation is wrong until the declaration is deliberately versioned.**

No combat balance conclusions should be drawn from the simulator until its implementation is validated against this declaration.
