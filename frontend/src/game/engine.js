// Real-time side-view combat engine + neon canvas renderer.
// Logical portrait resolution; enemies advance TOP -> DOWN to heroes at BOTTOM.
// Simulation is separate from React; mutates a cloned `sim` fragment and
// accumulates XP gains, returned to the UI at wave end.
import * as C from "./config";
import { heroDerived, towerDerived, makeSingleEnemy } from "./logic";
import { rollEquipmentDrop } from "./equipment";
import { unlockedAbilities, getAbility, MAGE_SPELLS } from "./perks";
import { logicalTowerPosition } from "./towerPlacement";
import { HERO_BASELINE } from "./heroModel";
import { classlessCombatEffects, classlessMaxHp } from "./classlessCombatEffects";
import { getUnlockedClasslessAbilities, validateClasslessAbilityUse } from "./classlessAbilities";
import { HERO_SPRITE_ATLAS, selectHeroSpriteFrame } from "./heroSprite";

let classlessSpriteImage = null;
function getClasslessSpriteImage() {
  if (classlessSpriteImage || typeof Image === "undefined") return classlessSpriteImage;
  classlessSpriteImage = new Image();
  classlessSpriteImage.src = `${process.env.PUBLIC_URL || ""}${HERO_SPRITE_ATLAS.path}`;
  return classlessSpriteImage;
}

const MAX_COMBAT_EFFECTS = 180;
const MAX_COMBAT_FLOATERS = 120;

export const W = 420, H = 760;
const WALL_Y = 0.30 * H;   // yellow outer boundary
const GATE_Y = 0.60 * H;   // hot-red inner gate line
const HERO_Y = 0.85 * H;   // heroes line
const CASTLE_Y = H - 6;    // keep
// The bible does not specify a Phantom Strike placement offset. Reuse the
// existing 30-unit hero/defender interaction radius as the reversible offset.
const PHANTOM_STRIKE_BEHIND_OFFSET = 30;

function isClasslessHero(hero) {
  return !!hero && !hero.cls && !!hero.combat?.basicAttack;
}

function classlessHeroRef(hero) {
  return {
    get id() { return hero.identity?.id; },
    get name() { return hero.identity?.name || "Hero"; },
    get level() { return hero.progression?.level || 1; },
    get hp() { return hero.combat.hp; },
    set hp(value) { hero.combat.hp = value; },
    get maxHp() { return hero.combat.maxHp; },
    get stats() { return hero.combat.stats; },
    get shield() { return Number(hero.combat.shield) || 0; },
    set shield(value) { hero.combat.shield = value; },
    get manual() { return !!hero.manual; },
    set manual(value) { hero.manual = !!value; },
  };
}

function classlessHeroDerived(hero) {
  const combat = hero.combat;
  const attack = combat.basicAttack;
  const stats = combat.stats;
  const effects = classlessCombatEffects(hero.progression?.ownedNodeIds);
  const attackDamage = attack.damage + ((Number(stats.attack) || 10) - HERO_BASELINE.stats.attack);
  return {
    maxHp: classlessMaxHp(hero),
    // Baseline attack stat 10 maps to the approved 16 weapon damage; each
    // allocated Attack point adds one weapon damage, matching legacy stat scaling.
    attack: attackDamage,
    damage: attackDamage,
    range: attack.range,
    rangeMode: attack.rangeMode,
    rate: attack.intervalSeconds / (1 + effects.attackSpeed),
    movementSpeed: attack.movementSpeed,
    magic: false,
    damageType: null,
    defense: stats.defense,
    agility: stats.agility,
    intelligence: stats.intelligence,
    critChance: Math.min(0.5, attack.criticalChance + effects.critChance),
    critMult: Math.min(2.5, attack.criticalDamageMultiplier + effects.critDamage),
    dodge: C.dodgeChance(stats.agility),
    lowHpDodge: 0,
    moveSpeedMultiplier: 1,
    abilityDamageMultiplier: 1,
    perkEffects: {},
    cooldownMultiplier: 1 - effects.cooldownReduction,
    damageReduction: effects.damageReduction,
    regeneration: effects.regeneration,
    regenerationBelowHalf: effects.regenerationBelowHalf,
    evasion: effects.evasion,
    fullHpEvasion: effects.fullHpEvasion,
    lastStand: effects.lastStand,
    lifesteal: effects.lifesteal,
    decoyChance: effects.decoyChance,
    classlessEffects: effects,
    bloodPriceBonus: effects.bloodPriceBonus,
    bloodPriceCost: effects.bloodPriceCost,
    color: "#22D3EE",
    classless: true,
  };
}

function heroMovementSpeed(hero, legacyBase, currentTime, applyLegacyModifiers = false) {
  if (hero.classless) return hero.d.movementSpeed;
  const modifier = applyLegacyModifiers
    ? hero.d.moveSpeedMultiplier * (hero.speedRushUntil > currentTime ? 1.5 : 1)
    : 1;
  return legacyBase * modifier;
}

const LANES = 5;
function laneX(i) { return (W / LANES) * (i + 0.5); }

// tower slot positions (mid-field, alternating sides)
const SLOT_POS = [
  { x: 60, y: WALL_Y - 46 },
  { x: W - 60, y: WALL_Y - 46 },
  { x: 60, y: (WALL_Y + GATE_Y) / 2 },
  { x: W - 60, y: (WALL_Y + GATE_Y) / 2 },
  { x: W / 2, y: WALL_Y + 24 },
];

export function slotPositions() { return SLOT_POS; }
export const LAYOUT = { W, H, WALL_Y, GATE_Y, HERO_Y, CASTLE_Y };

export class Engine {
  constructor(canvas, sim, wave, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sim = sim;              // cloned fragment (mutated)
    this.wave = wave;           // {enemies,total,...}
    this.cb = callbacks;
    this.speed = 1;
    this.running = false;
    this.last = 0;
    this.spawnQueue = [...wave.enemies];
    this.spawnTimer = 0;
    this.active = [];           // live enemies
    this.projectiles = [];
    this.actionCompletions = [];
    this.floaters = [];
    this.effects = [];
    this.killed = 0;
    this.castleEscaped = 0;
    this.xpGains = { heroes: {}, towers: {} };
    this.sim.vault = Array.isArray(this.sim.vault) ? this.sim.vault : [];
    this.time = 0;
    this.ended = false;
    this.selectedHero = null;
    this.targetingHero = null;
    this.castleThreatUntil = 0;

    // hero runtime
    const n = sim.heroes.length || 1;
    this.heroes = sim.heroes.map((h, i) => {
      const classless = isClasslessHero(h);
      const ref = classless ? classlessHeroRef(h) : h;
      const d = classless ? classlessHeroDerived(h) : heroDerived(h);
      const x = W * ((i + 0.5) / n);
      return {
        i,
        ref,
        model: h,
        classless,
        x,
        y: HERO_Y,
        home: { x, y: HERO_Y },
        d,
        cd: 0,
        alive: ref.hp > 0,
        protect: 0,
        manual: !!h.manual,
        manualTarget: null,
        manualPoint: null,
        rallyPoint: null,
        rallyHold: false,
        retreating: false,
        reactiveUntil: 0,
        reactiveAlly: null,
        reactiveReason: null,
        abilityCooldowns: {},
        spellCooldowns: {},
        visualActionKind: null,
        visualActionStartedAt: 0,
        visualActionUntil: 0,
        hitUntil: 0,
        lastDrawPosition: { x, y: HERO_Y },
        warCryUntil: 0,
        warCryAttackSpeedBonus: 0,
        interposeUntil: 0,
        interposeReduction: 0,
        interposeTarget: null,
        untargetableUntil: 0,
        maxMana: classless ? 0 : Math.round(70 + (h.level || 1) * 5 + (d.intelligence || 10) * 1.5),
        mana: classless ? 0 : Math.round(70 + (h.level || 1) * 5 + (d.intelligence || 10) * 1.5),
        currentTarget: null,
        speedRushUntil: 0,
        classlessCombatState: classless ? { lastDamageAt: 0, sustainSecond: -1, sustainRestored: 0,
          nextRegenAt: 5, lastStandUntil: 0, lastStandReadyAt: 0, survivalUntil: 0,
          survivalReadyAt: 0, covenantUntil: 0, decoy: false, mirrorReadyAt: 0,
          nextDisruptAt: 0, nextRootAt: 0, lastDealtAt: 0, momentumTarget: null,
          momentumStacks: 0, ambushTargets: new Set(), vanishDamagePending: 0,
          echoReadyAt: 0 } : null,
      };
    });

    // tower runtime (free placement: use each tower's own x,y)
    // State may contain empty/null tower slots. The prep/economy layer
    // intentionally supports sparse tower arrays, so never dereference a
    // missing slot while constructing the battle runtime.
    // Personal short-range turrets belong to buildings and scale only with building level.
    this.buildingTurrets = this._kingdomSites().reduce((acc, site) => {
      const ref = this.sim.buildings?.[site.id];
      if (!ref) return acc;
      const level = Math.max(1, Number(ref.level) || 1);
      const maxAmmo = 18 + (level - 1) * 4;
      ref.turretMaxAmmo = maxAmmo;
      if (!Number.isFinite(Number(ref.turretAmmo))) ref.turretAmmo = maxAmmo;
      ref.turretAmmo = Math.max(0, Math.min(maxAmmo, Number(ref.turretAmmo)));
      acc.push({ id: site.id, x: site.x, y: site.y - 18, color: site.color,
        ref, level, maxAmmo, damage: 7 + (level - 1) * 3, range: 68, fireRate: 1.35, cd: 0 });
      return acc;
    }, []);

    this.towers = (Array.isArray(sim.towers) ? sim.towers : []).reduce((acc, t, idx) => {
      if (!t || !C.TOWERS[t.type] || !C.TOWER_RESOURCE[t.type]) return acc;
      const d = towerDerived(t);
      const r = C.TOWER_RESOURCE[t.type];
      if (r.kind === "ammo" && t.ammo == null) t.ammo = d.maxAmmo;
      if (r.kind === "ammo" && t.maxAmmo == null) t.maxAmmo = d.maxAmmo;
      if (r.kind === "mana" && t.mana == null) t.mana = d.maxMana;
      if (r.kind === "mana" && t.maxMana == null) t.maxMana = d.maxMana;
      const position = logicalTowerPosition(t);
      acc.push({ slot: idx, ref: t, x: position.x, y: position.y, d, cd: 0 });
      return acc;
    }, []);

    this.barricades = (Array.isArray(sim.barricades) ? sim.barricades : [])
      .map((b, lane) => ({ lane, ref: b, x: laneX(lane), y: WALL_Y }));
  }

  start() {
    this.running = true;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; }
  setSpeed(s) { this.speed = s; }

  setSelectedHero(index) {
    this.selectedHero = Number.isInteger(index) ? index : null;
    return true;
  }

  setTargetSelection(index) {
    const h = this.heroes[index];
    this.targetingHero = h?.alive && (h.classless ? h.d.rangeMode === "midline" : h.d.range >= 130) ? index : null;
    return this.targetingHero !== null;
  }

  getRangedTargetStatus(index) {
    const h = this.heroes[index];
    if (!h?.alive || !(h.classless ? h.d.rangeMode === "midline" : h.d.range >= 130)) return null;
    const damageType = h.classless ? null : h.ref.cls === "mage" ? C.DAMAGE_TYPES.ARCANE
      : h.ref.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED
      : h.ref.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE
      : C.DAMAGE_TYPES.KNIGHT_MELEE;
    const targets = this.active
      .filter((enemy) => h.classless ? this._isValidClasslessTarget(h, enemy) : this._isValidRangedTarget(h, enemy, damageType))
      .map((enemy) => ({
        type: enemy.type,
        name: enemy.name || enemy.type,
        hp: Math.max(0, Math.round(enemy.hp)),
        maxHp: Math.max(1, Math.round(enemy.maxHp)),
        distance: Math.round(Math.hypot(enemy.x - h.x, enemy.y - h.y)),
        enemy,
      }));
    return { heroName: h.ref.name, range: Math.round(h.d.range), targets };
  }

  _isValidRangedTarget(h, enemy, damageType) {
    return enemy?.hp > 0 &&
      Math.hypot(enemy.x - h.x, enemy.y - h.y) <= h.d.range &&
      C.affinityMultiplier(enemy, damageType) > 0 &&
      !(h.d.magic && enemy.magicImmune);
  }

  _isValidClasslessTarget(h, enemy) {
    return !!h?.classless && !!enemy && enemy.hp > 0 && this.active.includes(enemy) &&
      Math.hypot(enemy.x - h.x, enemy.y - h.y) <= h.d.range;
  }

  _isHeroUntargetable(hero) {
    return !!hero && hero.untargetableUntil > this.time;
  }

  getRangedTargetAt(index, x, y) {
    const status = this.getRangedTargetStatus(index);
    if (!status) return null;
    return status.targets
      .filter((target) => Math.hypot(target.enemy.x - x, target.enemy.y - y) <= 80)
      .sort((a, b) => Math.hypot(a.enemy.x - x, a.enemy.y - y) - Math.hypot(b.enemy.x - x, b.enemy.y - y))[0] || null;
  }

  getHeroAbilityStatus(index) {
    const h = this.heroes[index];
    if (!h) return [];
    if (h.classless) {
      const capability = HERO_BASELINE.sharedStrike;
      const cooldown = Math.max(0, h.abilityCooldowns[capability.id] || 0);
      const target = this._selectTarget(h);
      const baselineDamage = Math.round(h.d.attack * capability.damageMultiplier * (1 + h.d.classlessEffects.weaponDamage));
      const sharedStrike = { id: capability.id, name: "Shared Strike",
        desc: `${baselineDamage} raw direct-hit weapon damage at baseline (150%); 12s cooldown; no resource cost.`,
        damage: baselineDamage, cooldownSeconds: capability.cooldownSeconds * h.d.cooldownMultiplier,
        resourceCost: capability.resourceCost, color: h.d.color,
        cooldown, available: h.alive && cooldown <= 0 && !!target && this._classlessCanPayActiveCost(h), targetMode: "enemy", range: h.d.range,
        reason: !h.alive ? "unavailable" : cooldown > 0 ? "cooldown" : !this._classlessCanPayActiveCost(h) ? "health_cost" : target ? null : "no_target" };
      return [sharedStrike, ...getUnlockedClasslessAbilities(h.model).map((definition) => {
        const abilityCooldown = Math.max(0, h.abilityCooldowns[definition.id] || 0);
        const inRangeTargets = definition.requiresTarget
          ? this.active.filter((enemy) => this._isValidClasslessTarget(h, enemy)) : [];
        const validTargets = inRangeTargets.filter((enemy) => !Number.isFinite(definition.conditionalTargetHpBelow) ||
          enemy.hp / Math.max(1, enemy.maxHp) < definition.conditionalTargetHpBelow);
        const validationTarget = validTargets[0] || inRangeTargets[0] || null;
        const validation = validateClasslessAbilityUse({ hero: { ...h.model, alive: h.alive, protect: h.protect, retreating: h.retreating },
          abilityId: definition.id, cooldown: abilityCooldown, battleActive: !this.ended,
          target: validationTarget, targetValid: !definition.requiresTarget || !!validationTarget });
        const cooldownSeconds = definition.cooldownSeconds * h.d.cooldownMultiplier;
        const activeRemaining = definition.effect === "attack_speed_aura"
          ? Math.max(0, h.warCryUntil - this.time)
          : definition.effect === "interpose" ? Math.max(0, h.interposeTarget?.interposeUntil - this.time)
            : definition.effect === "crimson_covenant" ? Math.max(0, h.classlessCombatState.covenantUntil - this.time)
              : ["untargetable", "vanish"].includes(definition.effect) ? Math.max(0, h.untargetableUntil - this.time) : 0;
        const damage = Number.isFinite(definition.damageMultiplier)
          ? Math.round(h.d.attack * definition.damageMultiplier) : undefined;
        const canPayHealthCost = this._classlessCanPayActiveCost(h);
        return { id: definition.id, name: definition.name, desc: definition.description,
          cooldown: abilityCooldown, cooldownSeconds, resourceCost: definition.resourceCost,
          damage, color: h.d.color, active: activeRemaining > 0, activeRemaining,
          available: validation.ok && canPayHealthCost, targetMode: definition.targetMode,
          range: definition.rangeMode === "hero_attack_range" ? h.d.range : definition.range,
          radius: definition.adjacentRadius, reason: !canPayHealthCost ? "health_cost" : validation.reason };
      })];
    }
    return unlockedAbilities(h.ref).map((a) => {
      const cooldown = Math.max(0, h.abilityCooldowns[a.id] || 0);
      const hasTarget = h.alive && this._hasAbilityTarget(h, a);
      return {
        id: a.id,
        name: a.name,
        desc: a.desc,
        color: a.color,
        cooldown,
        available: h.alive && cooldown <= 0 && hasTarget,
        targetMode: ["shield_bash", "backstab", "life_steal", "piercing_shot", "focus_volley"].includes(a.effect)
          ? "enemy" : a.effect === "firestorm" ? "area" : null,
        range: a.effect === "shield_bash" ? 190
          : ["backstab", "life_steal"].includes(a.effect) ? 300 : Math.round(h.d.range),
        radius: a.effect === "firestorm" ? 70 : null,
        reason: !h.alive ? "unavailable" : cooldown > 0 ? "cooldown" : hasTarget ? null : "no_target",
      };
    });
  }

  _classlessCanPayActiveCost(hero) {
    if (!hero?.classless || !(hero.d.bloodPriceCost > 0)) return true;
    return hero.ref.hp - hero.ref.hp * hero.d.bloodPriceCost >= 1;
  }

  _chargeClasslessActiveCost(hero, hpBefore) {
    const cost = hero.d.bloodPriceCost > 0 ? hpBefore * hero.d.bloodPriceCost : 0;
    if (cost > 0) {
      hero.ref.hp = Math.max(1, hero.ref.hp - cost);
      this._float(hero.x, hero.y - 20, `-${Math.round(cost)} HP`, "#DC2626");
      this.effects.push({ kind: "blood_price", x: hero.x, y: hero.y, r: 20, life: 0.42, color: "#DC2626" });
    }
  }

  getHeroAbilityTargets(index, abilityId) {
    const status = this.getHeroAbilityStatus(index).find((item) => item.id === abilityId);
    const h = this.heroes[index];
    if (!status || !h || status.targetMode !== "enemy") return [];
    if (h.classless) {
      const ability = abilityId === HERO_BASELINE.sharedStrike.id ? null :
        getUnlockedClasslessAbilities(h.model).find((item) => item.id === abilityId);
      return this.active.filter((enemy) => this._isValidClasslessTarget(h, enemy) &&
        (!ability || !Number.isFinite(ability.conditionalTargetHpBelow) ||
          enemy.hp / Math.max(1, enemy.maxHp) < ability.conditionalTargetHpBelow)).map((enemy) => ({
        type: enemy.type, name: enemy.name || enemy.type, hp: Math.max(0, Math.round(enemy.hp)),
        maxHp: Math.max(1, Math.round(enemy.maxHp)), distance: Math.round(Math.hypot(enemy.x - h.x, enemy.y - h.y)), enemy,
      }));
    }
    const damageType = h.ref.cls === "knight" ? C.DAMAGE_TYPES.KNIGHT_MELEE
      : h.ref.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE
      : h.ref.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED
      : C.DAMAGE_TYPES.ARCANE;
    return this.active.filter((enemy) =>
      enemy?.hp > 0 &&
      Math.hypot(enemy.x - h.x, enemy.y - h.y) <= status.range &&
      C.affinityMultiplier(enemy, damageType) > 0 &&
      !(h.d.magic && enemy.magicImmune)
    ).map((enemy) => ({
      type: enemy.type,
      name: enemy.name || enemy.type,
      hp: Math.max(0, Math.round(enemy.hp)),
      maxHp: Math.max(1, Math.round(enemy.maxHp)),
      distance: Math.round(Math.hypot(enemy.x - h.x, enemy.y - h.y)),
      enemy,
    }));
  }

  getHeroAbilityTargetAt(index, abilityId, x, y) {
    return this.getHeroAbilityTargets(index, abilityId)
      .filter((target) => Math.hypot(target.enemy.x - x, target.enemy.y - y) <= 80)
      .sort((a, b) => Math.hypot(a.enemy.x - x, a.enemy.y - y) - Math.hypot(b.enemy.x - x, b.enemy.y - y))[0] || null;
  }

  getHeroAbilityAreaPreview(index, abilityId, x, y) {
    const status = this.getHeroAbilityStatus(index).find((item) => item.id === abilityId);
    const h = this.heroes[index];
    if (!status || status.targetMode !== "area" || !h || Math.hypot(x - h.x, y - h.y) > status.range) {
      return { valid: false, targets: [] };
    }
    const damageType = h.ref.cls === "mage" ? C.DAMAGE_TYPES.ARCANE : C.DAMAGE_TYPES.KNIGHT_MELEE;
    const targets = this.active.filter((enemy) => enemy.hp > 0 &&
      Math.hypot(enemy.x - x, enemy.y - y) <= status.radius &&
      C.affinityMultiplier(enemy, damageType) > 0 &&
      !(h.d.magic && enemy.magicImmune));
    return { valid: targets.length > 0, targets };
  }

  _hasAbilityTarget(h, ability) {
    const damageType = h.ref.cls === "knight" ? C.DAMAGE_TYPES.KNIGHT_MELEE
      : h.ref.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE
      : h.ref.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED
      : C.DAMAGE_TYPES.ARCANE;
    const canDamage = (enemy) => enemy?.hp > 0 && C.affinityMultiplier(enemy, damageType) > 0;
    switch (ability.effect) {
      case "shield_bash":
        return canDamage(this._nearestEnemy(h.x, h.y, 190));
      case "backstab":
        return canDamage(this._selectTarget(h) || this._nearestEnemy(h.x, h.y, 300));
      case "life_steal":
        return canDamage(this._nearestEnemy(h.x, h.y, 300));
      case "firestorm": {
        const target = this._nearestEnemy(h.x, h.y, h.d.range);
        return !!target && this.active.some((enemy) => canDamage(enemy) && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 70);
      }
      case "mend":
        return this.heroes.some((ally) => ally.alive && ally !== h && ally.ref.hp < ally.d.maxHp);
      case "piercing_shot": {
        const target = this._selectTarget(h);
        return !!target && [target, ...this.active.filter((enemy) => enemy !== target && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 48).slice(0, 2)].some(canDamage);
      }
      case "focus_volley":
        return canDamage(this._selectTarget(h));
      default:
        return true;
    }
  }

  getHeroSpellStatus(index) {
    const h = this.heroes[index];
    if (!h || h.ref.cls !== "mage") return [];
    const level = Math.max(1, Number(h.ref.level) || 1);
    const intelligence = Math.max(0, Number(h.d.intelligence) || 0);
    const equippedIds = Array.isArray(h.ref.equippedSpells) ? h.ref.equippedSpells : [];
    const learned = (h.ref.spellbook || []).filter((spell) => equippedIds.includes(spell.id)).map((spell) => ({
      ...spell, researched: true, short: String(spell.name || "SPELL").toUpperCase(),
      color: ({ fire: "#FF6600", ice: "#00F3FF", poison: "#39FF14", electric: "#FFE600", mind: "#A855F7" })[spell.element] || "#E879F9",
      mana: Number(spell.manaCost || spell.baseMana) || 15,
      cooldown: 7, range: 340, power: Number(spell.strength || spell.basePower) || 0.8,
    }));
    const spells = learned.length ? learned : MAGE_SPELLS;
    return spells.map((spell) => {
      const cost = Math.max(8, Math.round((spell.mana || spell.manaCost || spell.baseMana || 15) * (1 - Math.min(0.25, Math.max(0, level - 1) * 0.01))));
      const cooldown = Math.max(0, h.spellCooldowns[spell.id] || 0);
      return { ...spell, cost, cooldown, mana: Math.round(h.mana), maxMana: h.maxMana,
        level, damage: Math.round((h.d.attack || 0) * (spell.power || spell.strength || spell.basePower || 1) * (1 + Math.max(0, level - 1) * 0.06 + intelligence * 0.012)),
        targetMode: spell.effect === "area" ? "area"
          : spell.researched || ["fireball", "chain_lightning"].includes(spell.id) ? "enemy" : null,
        available: h.alive && cooldown <= 0 && h.mana >= cost };
    });
  }

  getMageSpellTargets(index, spellId) {
    const h = this.heroes[index];
    const spell = this.getHeroSpellStatus(index).find((item) => item.id === spellId);
    if (!h || !spell || spell.targetMode !== "enemy") return [];
    const damageType = ({ fire: C.DAMAGE_TYPES.FIRE, ice: C.DAMAGE_TYPES.FROST, electric: C.DAMAGE_TYPES.LIGHTNING, poison: C.DAMAGE_TYPES.POISON })[spell.element]
      || C.DAMAGE_TYPES.ARCANE;
    return this.active.filter((enemy) => enemy?.hp > 0 &&
      Math.hypot(enemy.x - h.x, enemy.y - h.y) <= spell.range &&
      C.affinityMultiplier(enemy, damageType) > 0 &&
      !(h.d.magic && enemy.magicImmune)
    ).map((enemy) => ({
      type: enemy.type,
      name: enemy.name || enemy.type,
      hp: Math.max(0, Math.round(enemy.hp)),
      maxHp: Math.max(1, Math.round(enemy.maxHp)),
      distance: Math.round(Math.hypot(enemy.x - h.x, enemy.y - h.y)),
      enemy,
    }));
  }

  getMageSpellTargetAt(index, spellId, x, y) {
    return this.getMageSpellTargets(index, spellId)
      .filter((target) => Math.hypot(target.enemy.x - x, target.enemy.y - y) <= 80)
      .sort((a, b) => Math.hypot(a.enemy.x - x, a.enemy.y - y) - Math.hypot(b.enemy.x - x, b.enemy.y - y))[0] || null;
  }

  getMageSpellAreaPreview(index, spellId, x, y) {
    const h = this.heroes[index];
    const spell = this.getHeroSpellStatus(index).find((item) => item.id === spellId);
    if (!h || !spell || spell.targetMode !== "area" || Math.hypot(x - h.x, y - h.y) > spell.range) {
      return { valid: false, targets: [] };
    }
    const radius = spell.researched ? 95 : spell.radius;
    const damageType = ({ fire: C.DAMAGE_TYPES.FIRE, ice: C.DAMAGE_TYPES.FROST, electric: C.DAMAGE_TYPES.LIGHTNING, poison: C.DAMAGE_TYPES.POISON })[spell.element];
    const targets = this.active.filter((enemy) => enemy.hp > 0 &&
      Math.hypot(enemy.x - x, enemy.y - y) <= radius &&
      (!damageType || C.affinityMultiplier(enemy, damageType) > 0) &&
      !(h.d.magic && enemy.magicImmune));
    return { valid: targets.length > 0, targets, radius };
  }

  castMageSpell(index, spellId, targetOrPoint = null) {
    const h = this.heroes[index];
    const customSpell = (h?.ref?.equippedSpells || []).includes(spellId) ? (h.ref.spellbook || []).find((item) => item.id === spellId) : null;
    const spell = customSpell ? { ...customSpell, researched: true, short: String(customSpell.name || "SPELL").toUpperCase(), color: ({ fire: "#FF6600", ice: "#00F3FF", poison: "#39FF14", electric: "#FFE600", mind: "#A855F7" })[customSpell.element] || "#E879F9", mana: Number(customSpell.manaCost || customSpell.baseMana) || 15, cooldown: 7, range: 340, power: Number(customSpell.strength || customSpell.basePower) || 0.8 } : MAGE_SPELLS.find((item) => item.id === spellId);
    if (!h || !h.alive || h.ref.cls !== "mage" || !spell) return false;
    const status = this.getHeroSpellStatus(index).find((item) => item.id === spellId);
    if (!status || !status.available) return false;
    if (targetOrPoint?.enemy && !this.getMageSpellTargets(index, spellId).some((item) => item.enemy === targetOrPoint.enemy)) return false;
    if (spell.effect === "area" && targetOrPoint && Number.isFinite(targetOrPoint.x) &&
      !this.getMageSpellAreaPreview(index, spellId, targetOrPoint.x, targetOrPoint.y).valid) return false;
    const target = targetOrPoint?.enemy || this._nearestEnemy(h.x, h.y, spell.range);
    if (spell.id !== "arcane_ward" && !target && !(spell.effect === "area" && targetOrPoint && Number.isFinite(targetOrPoint.x))) return false;
    const effectStart = this.effects.length;
    let used = false;
    if (spell.researched) {
      const elementType = ({ fire: C.DAMAGE_TYPES.FIRE, ice: C.DAMAGE_TYPES.FROST, electric: C.DAMAGE_TYPES.LIGHTNING, poison: C.DAMAGE_TYPES.POISON })[spell.element];
      const victims = spell.effect === "area"
        ? this.active.filter((enemy) => enemy.hp > 0 && target &&
          Math.hypot(enemy.x - (targetOrPoint && Number.isFinite(targetOrPoint.x) ? targetOrPoint.x : target.x),
            enemy.y - (targetOrPoint && Number.isFinite(targetOrPoint.y) ? targetOrPoint.y : target.y)) <= 95)
        : [target];
      for (const enemy of victims) {
        const scale = spell.effect === "area" ? 0.72 : spell.effect === "time" ? 0.82 : 1;
        const affinity = elementType ? C.affinityMultiplier(enemy, elementType) : 1;
        const damage = Math.max(0, status.damage * scale * h.d.abilityDamageMultiplier * affinity);
        if (damage > 0) {
          enemy.hp = Math.max(0, enemy.hp - damage);
          enemy.dmgBy["H" + h.i] = (enemy.dmgBy["H" + h.i] || 0) + damage;
          if (spell.effect === "time") {
            enemy.slowUntil = Math.max(enemy.slowUntil || 0, this.time + 2.5);
            enemy.slowMultiplier = spell.element === "ice" ? 0.45 : 0.75;
          }
          this._float(enemy.x, enemy.y - 5, spell.name.toUpperCase() + " " + Math.round(damage), spell.color);
          this.effects.push({ kind: "hit", x: enemy.x, y: enemy.y, r: spell.effect === "area" ? 20 : 14, life: 0.45, color: spell.color, crit: false });
          if (enemy.hp <= 0) this._killEnemy(enemy, "H" + h.i);
          used = true;
        }
      }
    } else if (spell.id === "fireball") {
      const damage = status.damage * h.d.abilityDamageMultiplier * C.affinityMultiplier(target, C.DAMAGE_TYPES.FIRE);
      if (damage > 0) {
        target.hp = Math.max(0, target.hp - damage);
        target.dmgBy["H" + h.i] = (target.dmgBy["H" + h.i] || 0) + damage;
        this._float(target.x, target.y - 5, "FIREBALL " + Math.round(damage), spell.color);
        this.effects.push({ kind: "hit", x: target.x, y: target.y, r: 25, life: 0.45, color: spell.color, crit: false });
        if (target.hp <= 0) this._killEnemy(target, "H" + h.i);
        used = true;
      } else this._float(target.x, target.y - 5, "IMMUNE", "#39FF14");
    } else if (spell.id === "frost_nova") {
      const victims = this.active.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - h.x, enemy.y - h.y) <= spell.radius);
      for (const enemy of victims) {
        const damage = status.damage * h.d.abilityDamageMultiplier * C.affinityMultiplier(enemy, C.DAMAGE_TYPES.FROST);
        if (damage > 0) {
          enemy.hp = Math.max(0, enemy.hp - damage);
          enemy.dmgBy["H" + h.i] = (enemy.dmgBy["H" + h.i] || 0) + damage;
          enemy.slowUntil = Math.max(enemy.slowUntil || 0, this.time + spell.slow);
          enemy.slowMultiplier = 0.45;
          this._float(enemy.x, enemy.y - 4, "FROST " + Math.round(damage), spell.color);
          if (enemy.hp <= 0) this._killEnemy(enemy, "H" + h.i);
          used = true;
        }
      }
      if (used) this.effects.push({ x: h.x, y: h.y, r: spell.radius, life: 0.65, color: spell.color });
    } else if (spell.id === "chain_lightning") {
      let current = target;
      const hit = new Set();
      for (let jump = 0; jump < spell.jumps && current; jump++) {
        hit.add(current);
        const damage = status.damage * Math.pow(0.72, jump) * h.d.abilityDamageMultiplier * C.affinityMultiplier(current, C.DAMAGE_TYPES.LIGHTNING);
        if (damage > 0) {
          current.hp = Math.max(0, current.hp - damage);
          current.dmgBy["H" + h.i] = (current.dmgBy["H" + h.i] || 0) + damage;
          this._float(current.x, current.y - 4, "ARC " + Math.round(damage), spell.color);
          if (current.hp <= 0) this._killEnemy(current, "H" + h.i);
          used = true;
        }
        this.effects.push({ x: current.x, y: current.y, r: 19, life: 0.35, color: spell.color });
        const from = current;
        current = this.active.filter((enemy) => enemy.hp > 0 && !hit.has(enemy))
          .sort((a, b) => Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))
          .find((enemy) => Math.hypot(enemy.x-from.x, enemy.y-from.y) <= 105) || null;
      }
    } else if (spell.id === "arcane_ward") {
      const allies = this.heroes.filter((ally) => ally.alive && Math.hypot(ally.x-h.x, ally.y-h.y) <= spell.range)
        .sort((a,b) => (a.ref.hp/a.d.maxHp)-(b.ref.hp/b.d.maxHp)).slice(0,2);
      if (!allies.some((ally) => ally === h)) allies.unshift(h);
      for (const ally of allies.slice(0,2)) {
        const amount = Math.round(ally.d.maxHp * Math.min(0.38, spell.power + Math.max(0, status.level - 1) * 0.008));
        ally.ref.shield = Math.min(ally.d.maxHp * 0.45, (ally.ref.shield || 0) + amount);
        this._float(ally.x, ally.y - 20, "+" + amount + " WARD", spell.color);
        this.effects.push({ x: ally.x, y: ally.y, r: 24, life: 0.5, color: spell.color });
      }
      used = true;
    }
    if (!used) return false;
    h.mana = Math.max(0, h.mana - status.cost);
    h.spellCooldowns[spell.id] = Math.max(2, spell.cooldown * (1 - Math.min(0.2, Math.max(0, status.level - 1) * 0.008)));
    this._float(h.x, h.y - 28, spell.short, spell.color);
    this.actionCompletions.push({
      index,
      result: "completed",
      effects: this.effects.slice(effectStart),
    });
    return true;
  }

  useHeroAbility(index, abilityId, targetOrPoint = null) {
    const h = this.heroes[index];
    if (h?.classless) return abilityId === HERO_BASELINE.sharedStrike.id
      ? this.useSharedStrike(index, targetOrPoint?.enemy || targetOrPoint)
      : this.executeClasslessAbility(index, abilityId, targetOrPoint);
    const ability = getAbility(h?.ref, abilityId);
    if (!h || !h.alive || !ability) return false;
    const remaining = h.abilityCooldowns[ability.id] || 0;
    if (remaining > 0 || !this._hasAbilityTarget(h, ability)) return false;
    const target = targetOrPoint?.enemy || null;
    if (target && !this.getHeroAbilityTargets(index, abilityId).some((item) => item.enemy === target)) return false;
    if (ability.effect === "firestorm" && targetOrPoint && Number.isFinite(targetOrPoint.x) &&
      !this.getHeroAbilityAreaPreview(index, abilityId, targetOrPoint.x, targetOrPoint.y).valid) return false;

    let used = false;
    switch (ability.effect) {
      case "shield_bash": {
        const victim = target || this._nearestEnemy(h.x, h.y, 190);
        if (victim) {
          used = this._applyAbilityDamage(h, victim, 2.0 * h.d.shieldAbilityDamageMultiplier, "SHIELD BASH", 2);
        }
        break;
      }
      case "fortress_pulse": {
        for (const ally of this.heroes) {
          if (!ally.alive) continue;
          const dist = Math.hypot(ally.x - h.x, ally.y - h.y);
          if (dist <= 150) {
            const cap = ally.d.maxHp * 0.30 * ally.d.barrierMultiplier;
            ally.ref.shield = Math.min(cap, (ally.ref.shield || 0) + ally.d.maxHp * 0.20);
            this._float(ally.x, ally.y - 22, "+FORTIFY", "#00F3FF");
            this.effects.push({ x: ally.x, y: ally.y, r: 24, life: 0.45, color: "#00F3FF" });
          }
        }
        used = true;
        break;
      }
      case "speed_rush": {
        h.speedRushUntil = this.time + 5;
        const target = this._nearestEnemy(h.x, h.y, 340);
        if (target) {
          h.manualTarget = target;
          h.manual = true;
          h.ref.manual = true;
        }
        this._float(h.x, h.y - 24, "SPEED RUSH", "#FF007F");
        this.effects.push({ x: h.x, y: h.y, r: 28, life: 0.6, color: "#FF007F" });
        used = true;
        break;
      }
      case "backstab": {
        const victim = target || this._selectTarget(h) || this._nearestEnemy(h.x, h.y, 300);
        if (victim) {
          used = this._applyAbilityDamage(h, victim, 2.4, "BACKSTAB", 0);
        }
        break;
      }
      case "life_steal": {
        const victim = target || this._nearestEnemy(h.x, h.y, 300);
        if (victim) {
          const before = victim.hp;
          used = this._applyAbilityDamage(h, victim, 1.8, "LIFE STEAL", 0);
          if (!used) break;
          const dealt = Math.max(0, before - victim.hp);
          h.ref.hp = Math.min(h.d.maxHp, h.ref.hp + dealt * 0.45);
          this._float(h.x, h.y - 24, "+" + Math.round(dealt * 0.45), "#39FF14");
        }
        break;
      }
      case "firestorm": {
        const center = targetOrPoint && Number.isFinite(targetOrPoint.x)
          ? targetOrPoint
          : this._nearestEnemy(h.x, h.y, h.d.range);
        if (center) {
          const victims = this.active.filter((e) => e.hp > 0 && Math.hypot(e.x - center.x, e.y - center.y) <= 70);
          for (const e of victims) used = this._applyAbilityDamage(h, e, 1.35, "FIRESTORM", 0) || used;
          if (used) this.effects.push({ kind: "napalm", x: center.x, y: center.y, r: 18, life: 0.8, color: "#A855F7" });
        }
        break;
      }
      case "mend": {
        const ally = this.heroes.filter((x) => x.alive && x !== h).sort((a, b) => (a.ref.hp / a.d.maxHp) - (b.ref.hp / b.d.maxHp))[0];
        if (ally && ally.ref.hp < ally.d.maxHp) {
          const heal = ally.d.maxHp * 0.30 * h.d.healPower;
          ally.ref.hp = Math.min(ally.d.maxHp, ally.ref.hp + heal);
          this._float(ally.x, ally.y - 22, "+" + Math.round(heal), "#39FF14");
          this.effects.push({ x: ally.x, y: ally.y, r: 24, life: 0.45, color: "#39FF14" });
          used = true;
        }
        break;
      }
      case "barrier": {
        for (const ally of this.heroes) {
          if (!ally.alive) continue;
          const cap = ally.d.maxHp * 0.25 * h.d.barrierMultiplier;
          ally.ref.shield = Math.min(cap, (ally.ref.shield || 0) + ally.d.maxHp * 0.18 * h.d.barrierMultiplier);
          this._float(ally.x, ally.y - 22, "+BARRIER", "#00F3FF");
        }
        used = true;
        break;
      }
      case "piercing_shot": {
        const victim = target || this._selectTarget(h);
        if (victim) {
          const targets = [victim, ...this.active.filter((e) => e !== victim && e.hp > 0 && Math.hypot(e.x - victim.x, e.y - victim.y) <= 48).slice(0, 2)];
          targets.forEach((e, i) => { used = this._applyAbilityDamage(h, e, i === 0 ? 2.0 : 0.75, "PIERCE", 0) || used; });
        }
        break;
      }
      case "focus_volley": {
        const victim = target || this._selectTarget(h);
        if (victim) {
          for (let i = 0; i < 3 && victim.hp > 0; i++) used = this._applyAbilityDamage(h, victim, 0.75, "FOCUS", 0) || used;
        }
        break;
      }
      default:
        break;
    }

    if (used) {
      h.abilityCooldowns[ability.id] = ability.cooldown * h.d.cooldownMultiplier;
      this.actionCompletions.push({ index, result: "completed" });
      return true;
    }
    return false;
  }

  executeClasslessAbility(index, abilityId, targetOrPoint = null) {
    const h = this.heroes[index];
    const definition = getUnlockedClasslessAbilities(h?.model).find((item) => item.id === abilityId);
    if (!definition) return { ok: false, reason: "locked", abilityId };
    const target = definition.requiresTarget
      ? targetOrPoint?.enemy || targetOrPoint || this.active
        .filter((enemy) => this._isValidClasslessTarget(h, enemy) &&
          (!Number.isFinite(definition.conditionalTargetHpBelow) ||
            enemy.hp / Math.max(1, enemy.maxHp) < definition.conditionalTargetHpBelow))
        .reduce((nearest, enemy) => !nearest || Math.hypot(enemy.x - h.x, enemy.y - h.y) < Math.hypot(nearest.x - h.x, nearest.y - h.y) ? enemy : nearest, null)
      : null;
    const validation = validateClasslessAbilityUse({
      hero: h ? { ...h.model, alive: h.alive, protect: h.protect, retreating: h.retreating } : null,
      abilityId,
      cooldown: Math.max(0, h?.abilityCooldowns?.[abilityId] || 0),
      battleActive: !!h && !this.ended,
      target,
      targetValid: !definition.requiresTarget || (!!h && this._isValidClasslessTarget(h, target)),
    });
    if (!validation.ok) return validation;
    if (!this._classlessCanPayActiveCost(h)) return { ok: false, reason: "health_cost", abilityId };
    const hpBeforeAbility = h.ref.hp;

    let affectedTargets = [];
    let killedTarget = false;
    if (definition.effect === "weapon_strike" || definition.effect === "weapon_cleave") {
      const secondaryTarget = definition.effect === "weapon_cleave"
        ? this._multiTargetTargets(target, 2, definition.adjacentRadius)[0] || null : null;
      const targetWasAlive = target.hp > 0;
      const hit = this._applyHit({ sourceId: `H${h.i}`, target, dmg: h.d.attack * definition.damageMultiplier,
        magic: false, damageType: null, critChance: h.d.critChance, critMult: h.d.critMult,
        classless: true, heroIndex: h.i, ability: true, damageCategory: "weapon",
        situationalBonus: Number.isFinite(definition.conditionalTargetHpBelow) &&
          target.hp / Math.max(1, target.maxHp) < definition.conditionalTargetHpBelow
          ? definition.conditionalDamageBonus : 0 });
      if (!hit) return { ok: false, reason: "no_target", abilityId };
      killedTarget = targetWasAlive && target.hp <= 0;
      affectedTargets.push(target);
      if (secondaryTarget) {
        if (this._applyHit({ sourceId: `H${h.i}`, target: secondaryTarget,
          dmg: h.d.attack * definition.adjacentDamageMultiplier, magic: false, damageType: null,
          critChance: h.d.critChance, critMult: h.d.critMult, classless: true, heroIndex: h.i,
          ability: true, damageCategory: "weapon" })) affectedTargets.push(secondaryTarget);
      }
    } else if (definition.effect === "attack_speed_aura") {
      const allies = this.heroes.filter((ally) => ally.alive &&
        Math.hypot(ally.x - h.x, ally.y - h.y) <= definition.range);
      if (!allies.includes(h)) return { ok: false, reason: "unavailable", abilityId };
      const expiresAt = this.time + definition.durationSeconds;
      for (const ally of allies) {
        ally.warCryUntil = Math.max(ally.warCryUntil || 0, expiresAt);
        ally.warCryAttackSpeedBonus = Math.max(ally.warCryAttackSpeedBonus || 0, definition.attackSpeedBonus);
        this._float(ally.x, ally.y - 20, "WAR CRY", "#F59E0B");
      }
      affectedTargets = allies;
    } else if (definition.effect === "rally") {
      const allies = this.heroes.filter((ally) => ally.alive &&
        Math.hypot(ally.x - h.x, ally.y - h.y) <= definition.range);
      if (!allies.includes(h)) return { ok: false, reason: "unavailable", abilityId };
      for (const ally of allies) {
        const maxHp = Math.max(1, ally.d.maxHp || ally.ref.maxHp || ally.ref.hp);
        const before = ally.ref.hp;
        ally.ref.hp = Math.min(maxHp, ally.ref.hp + maxHp * definition.healMaxHpFraction);
        const restored = ally.ref.hp - before;
        if (restored > 0) {
          this._float(ally.x, ally.y - 20, `+${Math.round(restored)} HP`, "#22C55E");
          this.effects.push({ kind: "heal", x: ally.x, y: ally.y, r: 18, life: 0.4, color: "#22C55E" });
        }
      }
      affectedTargets = allies;
    } else if (definition.effect === "interpose") {
      // The design names an in-range ally but leaves the radius unspecified.
      // Use the Engine's established 150-unit allied-support radius.
      const allies = this.heroes.filter((ally) => ally !== h && ally.alive &&
        Math.hypot(ally.x - h.x, ally.y - h.y) <= definition.range);
      const protectedHero = allies.sort((a, b) => a.ref.hp - b.ref.hp || a.i - b.i)[0] || h;
      protectedHero.interposeUntil = this.time + definition.durationSeconds;
      protectedHero.interposeReduction = definition.damageReduction;
      h.interposeTarget = protectedHero;
      this._float(protectedHero.x, protectedHero.y - 22, "INTERPOSE", "#22D3EE");
      this.effects.push({ kind: "shield", x: protectedHero.x, y: protectedHero.y, r: 22, life: 0.5, color: "#22D3EE" });
      affectedTargets = [protectedHero];
    } else if (definition.effect === "crimson_covenant") {
      const state = h.classlessCombatState;
      state.covenantUntil = this.time + definition.durationSeconds;
      if (state.survivalReadyAt <= this.time) state.survivalUntil = this.time + definition.durationSeconds;
      this._float(h.x, h.y - 22, "CRIMSON COVENANT", "#DC2626");
      this.effects.push({ kind: "covenant", x: h.x, y: h.y, r: 24, life: 0.55, color: "#DC2626" });
      affectedTargets = [h];
    } else if (definition.effect === "untargetable" || definition.effect === "vanish") {
      h.untargetableUntil = Math.max(h.untargetableUntil, this.time + definition.durationSeconds);
      if (definition.effect === "vanish") {
        h.classlessCombatState.vanishDamagePending = definition.nextHitDamageBonus;
      }
      this._float(h.x, h.y - 22, definition.name.toUpperCase(), "#A78BFA");
      this.effects.push({ kind: "smoke", x: h.x, y: h.y, r: 16, life: 0.6, color: "#A78BFA" });
      affectedTargets = [h];
    } else if (definition.effect === "phantom_strike") {
      const targetWasTargetingHero = this._enemyTargetsHero(target, h);
      const previousPosition = { x: h.x, y: h.y };
      // Enemies advance toward increasing y, so their rear is the smaller-y
      // side. The placement distance reuses the established 30-unit body radius.
      h.x = target.x;
      h.y = target.y - PHANTOM_STRIKE_BEHIND_OFFSET;
      const hit = this._applyHit({ sourceId: `H${h.i}`, target,
        dmg: h.d.attack * definition.damageMultiplier, magic: false, damageType: null,
        critChance: h.d.critChance, critMult: h.d.critMult, classless: true,
        heroIndex: h.i, ability: true, damageCategory: "weapon",
        situationalBonus: targetWasTargetingHero ? 0 : definition.conditionalDamageBonus });
      if (!hit) {
        h.x = previousPosition.x;
        h.y = previousPosition.y;
        return { ok: false, reason: "no_target", abilityId };
      }
      this.effects.push({ kind: "trail", x: previousPosition.x, y: previousPosition.y, toX: h.x, toY: h.y, r: 10, life: 0.38, color: "#22D3EE" });
      killedTarget = target.hp <= 0;
      affectedTargets = [target];
      this._float(h.x, h.y - 22, "PHANTOM STRIKE", "#A78BFA");
    } else {
      return { ok: false, reason: "unavailable", abilityId };
    }

    this._chargeClasslessActiveCost(h, hpBeforeAbility);
    const cooldown = definition.refundCooldownOnKill && killedTarget ? 0 : definition.cooldownSeconds * h.d.cooldownMultiplier;
    h.abilityCooldowns[definition.id] = cooldown;
    h.visualActionKind = definition.effect === "weapon_strike" || definition.effect === "weapon_cleave" || definition.effect === "phantom_strike" ? "attack" : null;
    h.visualActionStartedAt = this.time;
    h.visualActionUntil = this.time + 0.42;
    this.actionCompletions.push({ index, result: "completed", abilityId: definition.id });
    return { ok: true, reason: null, abilityId: definition.id, target, affectedTargets,
      cooldownRemaining: cooldown, killedTarget };
  }

  useSharedStrike(index, targetOrNull = null) {
    const h = this.heroes[index];
    if (!h?.classless || !h.alive) return false;
    if ((h.abilityCooldowns[HERO_BASELINE.sharedStrike.id] || 0) > 0) return false;
    const target = targetOrNull || this._selectTarget(h);
    if (!this._isValidClasslessTarget(h, target)) return false;
    if (!this._classlessCanPayActiveCost(h)) return false;
    const hpBeforeAbility = h.ref.hp;

    this._applyHit({
      sourceId: `H${h.i}`,
      target,
      dmg: h.d.attack * HERO_BASELINE.sharedStrike.damageMultiplier,
      magic: false,
      damageType: null,
      critChance: h.d.critChance,
      critMult: h.d.critMult,
      perkData: null,
      sharedStrike: true,
      classless: true,
      heroIndex: h.i,
      ability: true,
      damageCategory: "weapon",
    });
    this._chargeClasslessActiveCost(h, hpBeforeAbility);
    h.abilityCooldowns[HERO_BASELINE.sharedStrike.id] = HERO_BASELINE.sharedStrike.cooldownSeconds * h.d.cooldownMultiplier;
    this.actionCompletions.push({ index, result: "completed" });
    return true;
  }

  _applyAbilityDamage(h, target, multiplier, label, stunSeconds = 0) {
    if (!target || target.hp <= 0) return false;
    const damageType = h.ref.cls === "knight" ? C.DAMAGE_TYPES.KNIGHT_MELEE : h.ref.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE : h.ref.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED : C.DAMAGE_TYPES.ARCANE;
    const affinity = C.affinityMultiplier(target, damageType);
    if (affinity <= 0) {
      this._float(target.x, target.y - 4, "IMMUNE", "#39FF14");
      return false;
    }
    const echoMarks = this._takeClasslessEchoMarks(target, `H${h.i}`);
    let dmg = (h.d.attack || 0) * multiplier * h.d.abilityDamageMultiplier * affinity;
    const targetHpFraction = target.hp / Math.max(1, target.maxHp);
    const lowHpBonus = targetHpFraction < 0.35 ? h.d.lowHpDamage : 0;
    const executionBonus = targetHpFraction < 0.25 ? h.d.executionDamage : 0;
    dmg *= 1 + lowHpBonus + executionBonus;
    if (targetHpFraction > 0.70) dmg *= 1 + h.d.highHpDamage;
    dmg *= 1 + this._classlessOpeningBonus(target);
    target.hp = Math.max(0, target.hp - dmg);
    target.dmgBy["H" + h.i] = (target.dmgBy["H" + h.i] || 0) + dmg;
    let killSourceId = `H${h.i}`;
    for (const echo of echoMarks) {
      if (target.hp > 0 && echo.damage >= target.hp) killSourceId = echo.sourceId;
      target.hp = Math.max(0, target.hp - echo.damage);
      target.dmgBy[echo.sourceId] = (target.dmgBy[echo.sourceId] || 0) + echo.damage;
      this._float(target.x, target.y - 18, `ECHO ${Math.round(echo.damage)}`, "#A78BFA");
    }
    if (stunSeconds > 0) target.stunUntil = Math.max(target.stunUntil || 0, this.time + stunSeconds);
    this._float(target.x, target.y - 4, label + " " + Math.round(dmg), h.d.color);
    this.effects.push({ kind: "hit", x: target.x, y: target.y, r: 16, life: 0.3, color: h.d.color, crit: false });
    if (target.hp <= 0) this._killEnemy(target, killSourceId);
    return true;
  }

  setHeroManual(index, manual) {
    const h = this.heroes[index];
    if (!h) return false;
    this._completeTacticalAction(index, "cancelled");
    h.manual = !!manual;
    h.ref.manual = !!manual;
    if (!h.manual) {
      h.manualTarget = null;
      h.manualPoint = null;
    }
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = false;
    this.selectedHero = index;
    return true;
  }

  commandHeroAttack(index, target) {
    const h = this.heroes[index];
    if (!h || !h.alive || !target || target.hp <= 0) return false;
    if (h.classless && !this._isValidClasslessTarget(h, target)) return false;
    if (!h.classless && h.d.range >= 130 && (!this.active.includes(target) ||
      !this._isValidRangedTarget(h, target, h.ref.cls === "mage" ? C.DAMAGE_TYPES.ARCANE : C.DAMAGE_TYPES.ARCHER_RANGED))) return false;
    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = target;
    h.pendingTacticalAction = "attack";
    h.manualPoint = null;
    h.rallyPoint = null;
    h.rallyHold = false;
    this.selectedHero = index;
    return true;
  }

  retreatHero(index) {
    const h = this.heroes[index];
    if (!h || !h.alive) return false;
    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = null;
    h.manualPoint = null;
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = true;
    h.pendingTacticalAction = "retreat";
    this.selectedHero = index;
    return true;
  }

  rallyHeroes(index) {
    const leader = this.heroes[index];
    if (!leader || !leader.alive) return false;

    // The hero issuing RALLY is the rally anchor. Everyone else moves to
    // that hero's current position; the caller itself must NOT fall back
    // to its original home position after issuing the command.
    const point = { x: leader.x, y: leader.y };

    for (const h of this.heroes) {
      if (!h.alive) continue;
      h.retreating = false;
      h.manualTarget = null;
      h.manualPoint = null;
      h.rallyHold = h === leader;
      h.rallyPoint = h === leader ? null : { ...point };
    }
    leader.pendingTacticalAction = "rally";

    return true;
  }

  reviveHero(index) {
    const h = this.heroes[index];
    if (!h || h.alive || h.ref.hp > 0) return false;
    const cost = C.paidRevivalCost(h.ref.level);
    if (this.sim.gold < cost) return false;

    this.sim.gold -= cost;
    h.ref.hp = Math.max(1, Math.round(h.d.maxHp * (C.RECOVERY.reviveHpPercent / 100)));
    h.alive = true;
    h.protect = C.REVIVE_PROTECT_S;
    h.manual = false;
    h.ref.manual = false;
    h.manualTarget = null;
    h.manualPoint = null;
    h.rallyPoint = null;
    h.retreating = false;
    h.x = h.home.x;
    h.y = h.home.y;
    return true;
  }

  getFallenHeroRevivalOffer() {
    if (this.ended || this.heroes.filter((hero) => hero.alive).length !== 1) return null;
    const fallen = this.heroes.filter((hero) => !hero.alive && hero.ref.hp <= 0);
    if (!fallen.length) return null;
    return {
      cost: fallen.reduce((total, hero) => total + C.paidRevivalCost(hero.ref.level), 0),
      heroIds: fallen.map((hero) => hero.ref.id),
    };
  }

  reviveFallenHeroes() {
    const offer = this.getFallenHeroRevivalOffer();
    if (!offer || this.sim.gold < offer.cost) return false;
    const fallenIds = new Set(offer.heroIds);
    this.sim.gold -= offer.cost;
    for (const hero of this.heroes) {
      if (!fallenIds.has(hero.ref.id)) continue;
      hero.ref.hp = Math.max(1, Math.round(hero.d.maxHp * (C.RECOVERY.reviveHpPercent / 100)));
      hero.alive = true;
      hero.protect = C.REVIVE_PROTECT_S;
      hero.manual = false;
      hero.ref.manual = false;
      hero.manualTarget = null;
      hero.manualPoint = null;
      hero.rallyPoint = null;
      hero.retreating = false;
      hero.x = hero.home.x;
      hero.y = hero.home.y;
    }
    return { ...offer };
  }

  commandHeroMoveTo(index, x, y) {
    const h = this.heroes[index];
    if (!h || !h.alive) return false;

    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = null;
    h.manualPoint = {
      x: Math.max(12, Math.min(W - 12, x)),
      y: Math.max(12, Math.min(CASTLE_Y - 12, y)),
    };
    h.pendingTacticalAction = "move";
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = false;
    this.selectedHero = index;
    return true;
  }

  cancelTacticalAction(index) {
    const h = this.heroes[index];
    if (!h) return false;
    if (h.pendingTacticalAction === "rally") {
      for (const ally of this.heroes) {
        ally.rallyPoint = null;
        ally.rallyHold = false;
      }
    }
    h.manualPoint = null;
    h.manualTarget = null;
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = false;
    return this._completeTacticalAction(index, "cancelled");
  }

  _completeTacticalAction(index, result) {
    const h = this.heroes[index];
    if (!h?.pendingTacticalAction) return false;
    h.pendingTacticalAction = null;
    this.actionCompletions.push({ index, result });
    return true;
  }

  _flushActionCompletions() {
    const pending = [];
    for (const completion of this.actionCompletions) {
      if (completion.effects?.some((effect) => this.effects.includes(effect))) {
        pending.push(completion);
      } else {
        this.cb.onActionResolved?.({ index: completion.index, result: completion.result });
      }
    }
    this.actionCompletions = pending;
  }

  commandHeroAttackAt(index, x, y) {
    const hero = this.heroes[index];
    if (!hero?.alive) return false;
    if (hero.d.range >= 130) {
      const target = this.getRangedTargetAt(index, x, y);
      return target ? this.commandHeroAttack(index, target.enemy) : false;
    }

    const target = this.active.reduce((best, e) => {
      if (e.hp <= 0) return best;
      const d = Math.hypot(e.x - x, e.y - y);
      // Give phone taps a generous target radius without making distant
      // enemies accidentally selectable.
      if (d > 80) return best;
      if (!best) return e;
      return d < Math.hypot(best.x - x, best.y - y) ? e : best;
    }, null);

    // TARGET mode is intentionally target-only. Tapping empty ground does not
    // silently turn into a MOVE command.
    return target ? this.commandHeroAttack(index, target) : false;
  }

  injectEnemy(e) {
    e.x = laneX(pickLane(this, e)); e.y = 12;
    e.lane = Math.round(e.x / (W / LANES) - 0.5);
    e.dmgBy = {}; e.atkCd = 0; e.state = "advance";
    this.active.push(e);
    this.wave.total += 1;
  }
  forceDefeat() { this.sim.castleHp = 0; }
  forceWin() { this.spawnQueue = []; this.active = []; }

  _loop(now) {
    if (!this.running) return;
    try {
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
      this.update(dt * this.speed);
      this.render();
      if (!this.ended) requestAnimationFrame(this._loop);
    } catch (err) {
      // Never let one malformed runtime object silently kill the RAF chain.
      // Keep the UI alive and expose the real failure through logcat/console.
      this.running = false;
      console.error("DemonanicEngine LOOP CRASH:", err?.message || err, err?.stack || "");
      if (this.cb.onError) this.cb.onError(err);
    }
  }

  update(dt) {
    this.time += dt;

    // spawn: release enemies gradually (group release proxy)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length) {
      // Keep the battlefield readable: limit concurrent enemies to roughly half a wave.
      const capInZone = Math.max(4, this.wave.total * 0.5);
      if (this.active.length < capInZone) {
        const e = this.spawnQueue.shift();
        e.x = laneX(pickLane(this, e)); e.y = 10 + Math.random() * 20;
        e.lane = Math.round(e.x / (W / LANES) - 0.5);
        e.dmgBy = {}; e.atkCd = 0; e.state = "advance";
        this.active.push(e);
      }
      // Wider spacing prevents large clumps while preserving steady wave pressure.
      this.spawnTimer = this.wave.hasBoss && this.spawnQueue.length === 0 ? 0 : 0.75;
    }

    // enemies
    // Lieutenant command auras are recalculated every frame so the battlefield
    // visibly behaves like a living formation rather than a stack of stat bags.
    for (const e of this.active) e._commanderBoost = 1;
    for (const e of this.active) {
      if (e.type !== "lieutenant" || e.hp <= 0) continue;
      for (const other of this.active) {
        if (other === e || other.hp <= 0) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) <= 105) {
          other._commanderBoost = Math.max(other._commanderBoost || 1, 1.15);
        }
      }
    }
    for (const e of this.active) this._updateEnemy(e, dt);
    this.active = this.active.filter((e) => e.hp > 0);

    // towers fire
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      t.cd -= dt;
      if (t.ref.warlockDebuff > 0) t.ref.warlockDebuff = Math.max(0, t.ref.warlockDebuff - dt);
      if (t.cd <= 0) {
        const target = this._selectTowerTarget(t);
        const r = C.TOWER_RESOURCE[t.ref.type];
        const current = r.kind === "ammo" ? (t.ref.ammo || 0) : (t.ref.mana || 0);
        if (target && current >= r.shotCost) {
          if (r.kind === "ammo") t.ref.ammo = current - r.shotCost;
          else t.ref.mana = current - r.shotCost;
          const fireData = t.ref.warlockDebuff > 0 ? { ...t.d, damage: t.d.damage * 0.8 } : t.d;
          this._fire("T" + t.slot, t, target, fireData);
          t.cd = 1 / t.d.fireRate;
        } else if (!target) {
          t.cd = 0.1;
        }
      }
      if (t.ref.underfunded) t.ref.hp = Math.max(0, t.ref.hp - t.d.maxHp * C.UNDERFUNDED.hpLossPerMin * dt / 60);
    }

    // heroes: outer defenses are attrition; the Castle Squad ENGAGES once the
    // enemy breaches the gate line. Melee heroes advance to attack; ranged fire in place.
    const breached = this.active.some((e) => e.y > GATE_Y);
    for (const h of this.heroes) {
      if (!h.alive) {
        this._completeTacticalAction(h.i, "cancelled");
        h.rallyPoint = null;
        continue;
      }
      if (h.protect > 0) { h.protect -= dt; continue; }
      for (const id of Object.keys(h.abilityCooldowns)) h.abilityCooldowns[id] = Math.max(0, h.abilityCooldowns[id] - dt);
      this._tickClasslessSustain(h, dt);
      for (const id of Object.keys(h.spellCooldowns)) h.spellCooldowns[id] = Math.max(0, h.spellCooldowns[id] - dt);
      h.mana = Math.min(h.maxMana, h.mana + (2 + Math.max(0, h.d.intelligence || 0) * 0.04) * dt);
      const cfg = h.ref.attackConfig || "";
      const melee = h.classless ? h.d.rangeMode !== "midline" : h.d.range < 130;
      const support = h.d.magic && /Support|Heal|Barrier/i.test(cfg);
      const baseAttackSpeed = h.classless ? h.d.classlessEffects.attackSpeed : 0;
      const activeAttackSpeedBonus = h.warCryUntil > this.time ? h.warCryAttackSpeedBonus : 0;
      const cappedAttackSpeed = Math.min(0.20, baseAttackSpeed + activeAttackSpeedBonus);
      const attackSpeedMultiplier = (1 + cappedAttackSpeed) / (1 + baseAttackSpeed);
      h.cd -= dt * (!support && activeAttackSpeedBonus > 0 ? attackSpeedMultiplier : 1);

      if (h.retreating) {
        this._returnHome(h, dt);
        if (Math.hypot(h.x - h.home.x, h.y - h.home.y) < 8) {
          h.retreating = false;
          this._completeTacticalAction(h.i, "completed");
        }
        continue;
      }

      if (h.rallyPoint) {
        const rd = Math.hypot(h.rallyPoint.x - h.x, h.rallyPoint.y - h.y);
        if (rd > 24) {
          const spd = heroMovementSpeed(h, 185, this.time) * dt;
          h.x += ((h.rallyPoint.x - h.x) / rd) * Math.min(spd, rd);
          h.y += ((h.rallyPoint.y - h.y) / rd) * Math.min(spd, rd);
          continue;
        }
        h.rallyPoint = null;
      }

      // Manual ground command: move to the exact tapped position and then
      // hold there. This persists until another manual command or RETREAT.
      if (h.manualPoint) {
        const md = Math.hypot(h.manualPoint.x - h.x, h.manualPoint.y - h.y);
        if (md > 8) {
          const spd = heroMovementSpeed(h, 155, this.time) * dt;
          h.x += ((h.manualPoint.x - h.x) / md) * Math.min(spd, md);
          h.y += ((h.manualPoint.y - h.y) / md) * Math.min(spd, md);
          continue;
        }
        h.x = h.manualPoint.x;
        h.y = h.manualPoint.y;
        h.manualPoint = null;
        this._completeTacticalAction(h.i, "completed");
        continue;
      }

      // A rally caller is the anchor of the regroup. Keep that hero at the
      // rally location instead of sending it back to its starting position.
      if (h.rallyHold && !h.manualTarget) {
        const nearbyRallyTarget = this._nearestEnemy(h.x, h.y, 220);
        if (nearbyRallyTarget) {
          h.manualTarget = nearbyRallyTarget;
        } else {
          continue;
        }
      }
      // Reactive combat keeps the Castle Squad alive without taking away
      // deliberate player control. A selected hero remains fully manual;
      // unselected heroes can temporarily answer a nearby ally under attack
      // or a castle breach, then return to their configured behavior.
      const reactiveActive = h.reactiveUntil > this.time && this.selectedHero !== h.i;
      if (h.reactiveUntil && !reactiveActive) {
        h.reactiveUntil = 0;
        h.reactiveAlly = null;
        h.reactiveReason = null;
      }

      // Mage support/barrier config: support the endangered ally when a
      // reactive alert exists; otherwise use the normal weakest-ally logic.
      if (support) {
        if (h.cd <= 0 && this._support(h, cfg, reactiveActive ? h.reactiveAlly : null)) h.cd = h.d.rate;
        if (reactiveActive && h.reactiveAlly?.alive) {
          const ally = h.reactiveAlly;
          const dist = Math.hypot(ally.x - h.x, ally.y - h.y);
          if (dist > 190) {
            const spd = heroMovementSpeed(h, 155, this.time, true) * dt;
            h.x += ((ally.x - h.x) / Math.max(1, dist)) * Math.min(spd, dist);
            h.y += ((ally.y - h.y) / Math.max(1, dist)) * Math.min(spd, dist);
          }
        } else if (!h.manual) {
          // AUTO support mages regroup at home between support actions.
          // A player-controlled mage must hold its commanded position instead
          // of being pulled home by its support configuration.
          this._returnHome(h, dt);
        }
        continue;
      }

      const alertEnemy = this._nearestEnemy(h.x, h.y, 300);
      const nearbyAutoTarget = this._nearestEnemy(h.x, h.y, 220);
      const shouldReactToCastle = reactiveActive && h.reactiveReason === "castle";
      if (!h.manual && alertEnemy && !nearbyAutoTarget && !reactiveActive) {
        // An approaching/offensive enemy is enough to wake an AUTO hero.
        // The hero will close distance until its normal attack range applies.
        h.reactiveUntil = this.time + 1;
        h.reactiveReason = "enemy";
      }
      if (!breached && !h.manual && !nearbyAutoTarget && !reactiveActive && !alertEnemy && !shouldReactToCastle) {
        this._returnHome(h, dt); continue;
      }
      let target = h.classless ? this._selectTarget(h) : h.manual && !reactiveActive ? h.manualTarget : this._selectTarget(h);

      if (target && target.hp <= 0) {
        h.manualTarget = null;
        this._completeTacticalAction(h.i, "cancelled");
        target = h.manual ? null : this._selectTarget(h);
      }
      if (target && h.pendingTacticalAction === "attack" && (h.classless ? h.d.rangeMode === "midline" : h.d.range >= 130) &&
        !(h.classless ? this._isValidClasslessTarget(h, target) : this._isValidRangedTarget(h, target, h.ref.cls === "mage" ? C.DAMAGE_TYPES.ARCANE : C.DAMAGE_TYPES.ARCHER_RANGED))) {
        h.manualTarget = null;
        this._completeTacticalAction(h.i, "cancelled");
        target = null;
      }

      // Manual heroes hold their current position when they have no target.
      // They return home only through the explicit RETREAT command.
      if (h.manual && !target && !reactiveActive) {
        continue;
      }

      if (melee) {
        if (target) {
          const dist = Math.hypot(target.x - h.x, target.y - h.y) || 1;
          if (dist > h.d.range - 6) {
            const spd = heroMovementSpeed(h, 155, this.time, true) * dt;
            h.x += ((target.x - h.x) / dist) * Math.min(spd, dist);
            h.y += ((target.y - h.y) / dist) * Math.min(spd, dist);
          } else if (h.cd <= 0) {
            this._fire("H" + h.i, h, target, h.d, true);
            h.cd = h.d.rate;
          }
        } else if (!h.manual) this._returnHome(h, dt);
      } else if (h.cd <= 0 && target && Math.hypot(target.x - h.x, target.y - h.y) <= h.d.range) {
        this._fire("H" + h.i, h, target, h.d, true);
        h.cd = h.d.rate;
      }
    }
    for (const h of this.heroes) {
      if (h.pendingTacticalAction === "rally" && !this.heroes.some((ally) => ally.rallyPoint)) {
        this._completeTacticalAction(h.i, "completed");
      }
    }

    // Resolve body collisions after movement so living units cannot occupy the same space.
    this._resolveUnitCollisions();

    // Building turrets fire only at enemies inside their short local range.
    for (const turret of this.buildingTurrets || []) {
      if (turret.ref.hp <= 0) continue;
      turret.cd = Math.max(0, turret.cd - dt);
      if (turret.ref.turretAmmo <= 0 || turret.cd > 0) continue;
      const target = this.active
        .filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - turret.x, enemy.y - turret.y) <= turret.range)
        .sort((a, b) => Math.hypot(a.x - turret.x, a.y - turret.y) - Math.hypot(b.x - turret.x, b.y - turret.y))[0];
      if (!target) continue;
      turret.ref.turretAmmo = Math.max(0, turret.ref.turretAmmo - 1);
      turret.cd = turret.fireRate;
      this.projectiles.push({
        sourceId: "B" + turret.id, x: turret.x, y: turret.y,
        tx: target.x, ty: target.y, target, spd: 390,
        dmg: turret.damage, magic: false, damageType: C.DAMAGE_TYPES.ARCHER_RANGED,
        critChance: C.BASE_CRIT, critMult: C.CRIT_MULT, color: turret.color, t: 0,
      });
      this.effects.push({ x: turret.x, y: turret.y, r: 5, life: 0.16, color: turret.color, ring: true });
    }

    // projectiles
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.kind === "enemyBolt" && p.targetKind === "hero" && this._isHeroUntargetable(p.target?.obj)) {
        const replacement = this._nearestDefender(p.launchX, p.launchY, p.targetSearchRange);
        if (!replacement) {
          p.dead = true;
          continue;
        }
        p.target = replacement;
        p.targetKind = replacement.kind;
        p.tx = replacement.obj.x;
        p.ty = replacement.obj.y;
      }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.spd * dt;
      if (p.kind === "enemyBolt") {
        const obj = p.target?.obj;
        const alive = p.targetKind === "hero"
          ? !!obj?.alive && obj.ref?.hp > 0
          : !!obj && obj.ref?.hp > 0;
        if (dist <= step || !alive) {
          if (alive) this._resolveEnemyBolt(p);
          p.dead = true;
        } else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
        continue;
      }
      if (dist <= step || !p.target || p.target.hp <= 0) {
        if (p.kind === "napalm") {
          this._explodeNapalm(p.x, p.y, p);
        } else if (p.target && p.target.hp > 0) {
          this._applyHit(p);
        }
        if (Number.isInteger(p.heroActionIndex)) this._completeTacticalAction(p.heroActionIndex, "completed");
        p.dead = true;
      } else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // floaters
    for (const f of this.floaters) { f.y -= 20 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((f) => f.life > 0);
    if (this.floaters.length > MAX_COMBAT_FLOATERS) this.floaters.splice(0, this.floaters.length - MAX_COMBAT_FLOATERS);
    if (this.effects.length > MAX_COMBAT_EFFECTS) this.effects.splice(0, this.effects.length - MAX_COMBAT_EFFECTS);

    this._hud();
    this._checkEnd();
    this._flushActionCompletions();
  }

  _updateEnemy(e, dt) {
    e.atkCd -= dt * (e.attackSlowUntil > this.time ? (e.attackSlowMultiplier || 1) : 1);
    if (e.stunUntil && e.stunUntil > this.time) return;
    const laneBarricade = this.barricades[e.lane];
    if (Number(this.sim.guildBlockadeActiveUntil) > Date.now() &&
      laneBarricade?.ref?.hp > 0 &&
      Math.abs(e.y - WALL_Y) < 16 && e.y < WALL_Y + 4) return;
    // Boss special: a targeted, proximity-based napalm bottle.
    // It no longer damages every hero simultaneously. The target is the nearest
    // living hero or tower inside the boss's configured attack range.
    if (e.boss) {
      e.abilityCd = (e.abilityCd == null ? 5 : e.abilityCd) - dt;
      if (e.abilityCd <= 0) {
        const range = e.attackRange || 420;
        const target = this._nearestDefender(e.x, e.y, range);
        if (target) {
          e.abilityCd = 6;
          for (let k = 0; k < 2; k++) this.injectEnemy(makeSingleEnemy(this.sim, "skeleton"));
          this._throwNapalm(e, target);
        } else {
          e.abilityCd = 1;
        }
      }
    }
    // Enemy archetypes get a small tactical identity on top of their
    // existing stats/objectives. These are intentionally readable rules:
    // fast raiders rush, brutes hunt structures, reapers hunt wounded heroes,
    // and lieutenants reinforce nearby attackers.
    const tactical = this._selectEnemyTacticalTarget(e);
    const commanderBoost = e._commanderBoost || 1;
    if (e.type === "warlock") {
      e.abilityCd = (e.abilityCd == null ? 3 : e.abilityCd) - dt;
      if (e.abilityCd <= 0) {
        // Warlocks are Mage Hunters: Mage first, then any living hero, then
        // tower fallback. This gives the archetype a clear battlefield role
        // and prevents the old tower-wrapper dereference crash.
        const target =
          this._nearestMageEntity(e.x, e.y, 300) ||
          this._nearestHeroEntity(e.x, e.y, 300) ||
          this._nearestTower(e.x, e.y, 300);

        if (target?.kind === "hero") {
          this._enemyAttack(e, target);
          if (target.obj?.ref?.type === "mage") {
            this._float(target.obj.x, target.obj.y - 22, "MAGE HUNT", e.color);
          }
          e.abilityCd = 4.5;
        } else if (target?.kind === "tower") {
          // _nearestTower() returns { kind, obj }; obj.ref is the persisted
          // tower. The previous implementation incorrectly read target.ref.
          const tower = target.obj;
          const r = C.TOWER_RESOURCE[tower.ref.type];
          const current = r.kind === "ammo" ? (tower.ref.ammo || 0) : (tower.ref.mana || 0);
          const max = r.kind === "ammo" ? tower.d.maxAmmo : tower.d.maxMana;
          const drain = Math.min(current, Math.max(5, Math.ceil(max * 0.18)));
          if (r.kind === "ammo") tower.ref.ammo = Math.max(0, current - drain);
          else tower.ref.mana = Math.max(0, current - drain);
          tower.ref.warlockDebuff = 3;
          this._float(tower.x, tower.y - 22, "DRAIN -" + drain, e.color);
          this.effects.push({ kind: "immune", x: tower.x, y: tower.y, r: 15, life: 0.45, color: e.color });
          e.abilityCd = 4.5;
        } else {
          e.abilityCd = 1;
        }
      }
    }
    const baseMoveSpeed =
      e.type === "goblin" ? e.speed * 1.18 * commanderBoost :
      e.type === "darkElf" ? e.speed * 1.08 * commanderBoost :
      e.type === "slime" ? e.speed * 0.92 * commanderBoost :
      e.type === "reaper" ? e.speed * 1.05 * commanderBoost :
      e.speed * commanderBoost;
    if (e.rootUntil > this.time) return;
    const moveSpeed = baseMoveSpeed * (e.slowUntil > this.time ? (e.slowMultiplier || 1) : 1);

    // Floating enemies bypass barricades, preserving their distinct identity.
    // Reapers and lieutenants can peel toward heroes; orcs pressure towers.
    if (tactical && (e.type === "reaper" || e.type === "orc" || e.type === "lieutenant" || e.type === "ghost" || e.type === "darkElf" || e.type === "warlock")) {
      const target = tactical.obj;
      const dist = Math.hypot(target.x - e.x, target.y - e.y) || 1;
      // Dark Elves are ranged tower hunters; Warlocks cast ranged bolts while
      // retaining their separate Mage-Hunter drain ability above.
      const ranged = e.type === "darkElf" || e.type === "warlock";
      const attackRange = e.type === "darkElf" ? 245 : e.type === "warlock" ? 225 : e.type === "reaper" ? 34 : 30;
      if (ranged && dist <= attackRange) {
        if (e.atkCd <= 0) {
          this._throwEnemyBolt(e, tactical, e.type === "darkElf" ? e.damage * 1.15 : e.damage, e.type === "darkElf" ? "#F43F5E" : "#C026D3", e.type === "warlock");
          e.atkCd = e.type === "darkElf" ? 1.35 : 1.65;
        }
        return;
      }
      if (!ranged && dist <= attackRange) {
        if (e.atkCd <= 0) {
          this._enemyAttack(e, tactical);
          e.atkCd = e.type === "reaper" ? 0.72 : e.type === "orc" ? 1.15 : 0.9;
        }
        return;
      }
      // Ranged enemies hold a firing lane; melee specialists peel toward
      // nearby targets but resume advancing if the target escapes.
      const peelRange = e.type === "reaper" ? 260 : ranged ? 300 : 150;
      if (dist <= peelRange) {
        if (ranged && dist < attackRange * 0.55) {
          e.x -= ((target.x - e.x) / dist) * moveSpeed * dt;
          e.y -= ((target.y - e.y) / dist) * moveSpeed * dt;
        } else {
          e.x += ((target.x - e.x) / dist) * moveSpeed * dt;
          e.y += ((target.y - e.y) / dist) * moveSpeed * dt;
        }
        return;
      }
    }

    // barricade in lane?
    const bar = this.barricades[e.lane];
    if (!e.floats && bar && bar.ref.hp > 0 && Math.abs(e.y - WALL_Y) < 16 && e.y < WALL_Y + 4) {
      if (e.atkCd <= 0) {
        bar.ref.hp = Math.max(0, bar.ref.hp - e.damage);
        e.hp = Math.max(0, e.hp - C.BARRICADE.collisionDamage);
        e.atkCd = e.type === "orc" ? 1.15 : e.type === "goblin" ? 0.65 : 0.8;
        if (e.hp <= 0) { this._killEnemy(e, null); return; }
      }
      return;
    }

    // Existing wave objectives still matter when an enemy reaches a defender.
    let blocker = null;
    if (e.objective === "towers") blocker = this._nearestTower(e.x, e.y, 46);
    if (!blocker) blocker = this._nearestHeroEntity(e.x, e.y, 30);
    if (blocker) {
      if (e.atkCd <= 0) {
        this._enemyAttack(e, blocker);
        e.atkCd = e.type === "reaper" ? 0.72 : e.type === "goblin" ? 0.65 : e.type === "orc" ? 1.15 : 1.0;
      }
      return;
    }
    // Raiders can stop at and attack physical kingdom buildings near the castle line.
    // They resume advancing once the target is destroyed.
    const buildingTarget = this._nearestBuilding(e.x, e.y, 32);
    if (buildingTarget && e.y >= H - 125) {
      if (e.atkCd <= 0) {
        const damage = Math.max(1, e.damage * (e.type === "orc" ? 1.45 : 1));
        buildingTarget.ref.hp = Math.max(0, buildingTarget.ref.hp - damage);
        buildingTarget.ref.activity = buildingTarget.ref.hp <= 0 ? "Destroyed" : "Under attack";
        this._float(buildingTarget.x, buildingTarget.y - 22, "-" + Math.round(damage), "#FF0055");
        this.effects.push({ kind: "hit", x: buildingTarget.x, y: buildingTarget.y, r: 18, life: 0.35, color: "#FF0055" });
        e.atkCd = e.type === "orc" ? 0.9 : 1.15;
      }
      return;
    }

    // advance downward
    e.y += moveSpeed * dt;
    if (e.y >= CASTLE_Y) {
      // Reaching the castle is a permanent breach. Track every escaped enemy
      // so a wave cannot be won simply because the remaining defenders died.
      this.castleEscaped += 1;
      this._damageCastle(e.damage * 4, e);
      this._killEnemy(e, null, true);
    }
  }

  _nearestDefender(x, y, range) {
    let best = null;
    let bd = range;
    for (const h of this.heroes) {
      if (!h.alive || this._isHeroUntargetable(h)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) {
        bd = d;
        best = { kind: "hero", obj: h };
      }
    }
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bd) {
        bd = d;
        best = { kind: "tower", obj: t };
      }
    }
    return best;
  }

  _throwNapalm(e, target) {
    const obj = target.obj;
    const d = obj.kind === "tower" ? obj.y : obj.y;
    this.projectiles.push({
      kind: "napalm",
      sourceId: "E" + e.type,
      x: e.x,
      y: e.y,
      tx: obj.x,
      ty: d,
      target: obj,
      targetKind: target.kind,
      spd: 250,
      dmg: e.damage * 1.3,
      splash: e.splashRadius || 68,
      color: "#FF6600",
      t: 0,
    });
    // Short launch/charge flash at the boss.
    this.effects.push({ kind: "charge", x: e.x, y: e.y, r: 28, life: 0.45, color: "#FF6600" });
  }

  _explodeNapalm(x, y, p) {
    const splash = p.splash || 68;
    const victims = [];

    for (const h of this.heroes) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= splash) victims.push({ kind: "hero", obj: h, dist: d });
    }
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= splash) victims.push({ kind: "tower", obj: t, dist: d });
    }

    // A bottle is a local area attack: only defenders standing in the
    // impact radius are hit. Spacing the squad therefore matters.
    for (const v of victims) {
      const falloff = 1 - 0.45 * (v.dist / splash);
      let dmg = p.dmg * falloff;
      if (v.kind === "hero") {
        const h = v.obj;
        if (Math.random() < this._heroDodgeChance(h, true)) {
          this._float(h.x, h.y - 20, "DODGE", "#00F3FF");
          continue;
        }
        dmg = h.classless ? this._classlessReducedDamage(h, dmg) : this._legacyInterposedDamage(h, dmg);
        if (h.ref.shield > 0) {
          const ab = Math.min(h.ref.shield, dmg);
          h.ref.shield -= ab;
          dmg -= ab;
        }
        if (h.classless) this._resolveClasslessHeroDamage(h, dmg);
        else h.ref.hp = Math.max(0, h.ref.hp - dmg);
        this._float(h.x, h.y - 20, "-" + Math.round(dmg), "#FF6600");
        if (!h.classless && h.ref.hp <= 0 && h.alive) {
          h.alive = false;
          this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
        }
      } else {
        const t = v.obj;
        dmg *= 0.8; // soften enemy area damage against defensive structures
        t.ref.hp = Math.max(0, t.ref.hp - dmg);
        if (t.ref.hp <= 0) {
          this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
          this.effects.push({ x: t.x, y: t.y, r: 30, life: 0.4, color: t.d.color });
        }
        this._float(t.x, t.y - 20, "-" + Math.round(dmg), "#FF6600");
      }

      // Persistent short fire-over-time visual on the actual victim.
      this.effects.push({
        kind: "fire",
        x: v.obj.x,
        y: v.obj.y,
        life: 1.0,
        color: "#FF6600",
        target: v.obj,
        targetKind: v.kind,
      });
    }

    // Bottle shatters where it lands: flash + expanding fire ring.
    this.effects.push({ kind: "napalm", x, y, r: 16, life: 0.9, color: "#FF6600" });
    this.effects.push({ kind: "impact", x, y, r: 10, life: 0.35, color: "#FFE600" });
  }

  _triggerHeroReaction(victim, reason) {
    if (!victim) return;
    for (const h of this.heroes) {
      if (!h.alive || h === victim || h.i === this.selectedHero) continue;
      // Do not interrupt an active move/rally/retreat/explicit target.
      if (h.manualPoint || h.rallyPoint || h.rallyHold || h.retreating || h.manualTarget) continue;
      h.reactiveUntil = Math.max(h.reactiveUntil || 0, this.time + (reason === "castle" ? 5 : 3));
      h.reactiveAlly = reason === "ally" ? victim : null;
      h.reactiveReason = reason;
    }
  }

  _heroDodgeChance(hero, area = false) {
    const derived = hero?.d;
    if (!derived || !Number.isFinite(derived.maxHp) || derived.maxHp <= 0) return 0;
    const hpRatio = hero.ref.hp / derived.maxHp;
    const lowHpBonus = hpRatio < 0.35 && Number.isFinite(derived.lowHpDodge)
      ? derived.lowHpDodge
      : 0;
    const baseDodge = Number.isFinite(derived.dodge) ? derived.dodge : 0;
    const classlessBonus = hero.classless && !area
      ? derived.evasion + (hpRatio >= 1 && derived.fullHpEvasion ? derived.fullHpEvasion : 0)
      : 0;
    return Math.min(0.5, Math.max(0, baseDodge + lowHpBonus + classlessBonus));
  }

  _classlessReducedDamage(hero, rawDamage) {
    const state = hero.classlessCombatState;
    const lastStand = state?.lastStandUntil > this.time ? hero.d.lastStand : 0;
    const interpose = hero.interposeUntil > this.time ? hero.interposeReduction : 0;
    const formation = this._classlessFormationReduction(hero);
    const reduction = Math.min(0.30, Math.max(0, hero.d.damageReduction + lastStand + interpose + formation));
    return C.damageAfterDefense(rawDamage, hero.d.defense) * (1 - reduction);
  }

  _classlessFormationReduction(hero) {
    return this.heroes.reduce((highest, owner) => {
      const bonus = owner.classless && owner.alive ? owner.d.classlessEffects.formationMitigation : 0;
      return bonus > 0 && Math.hypot(owner.x - hero.x, owner.y - hero.y) <= 5
        ? Math.max(highest, bonus) : highest;
    }, 0);
  }

  _classlessOpeningBonus(target) {
    const controlledUntilBy = target?.classlessControlledUntilBy || {};
    const total = this.heroes.reduce((sum, owner) => {
      const controlUntil = controlledUntilBy[owner.i] || 0;
      return owner.classless && owner.alive && owner.d.classlessEffects.openingDamage > 0 &&
        controlUntil + 4 > this.time
        ? sum + owner.d.classlessEffects.openingDamage : sum;
    }, 0);
    return Math.min(0.5, total);
  }

  _recordClasslessControl(target, hero, expiresAt) {
    target.classlessControlledUntilBy ||= {};
    target.classlessControlledUntilBy[hero.i] = Math.max(
      target.classlessControlledUntilBy[hero.i] || 0,
      expiresAt,
    );
  }

  _takeClasslessEchoMarks(target, sourceId) {
    const heroMatch = /^H(\d+)$/.exec(String(sourceId || ""));
    if (!heroMatch || !target?.classlessEchoMarks) return [];
    const entries = [];
    for (const [ownerId, mark] of Object.entries(target.classlessEchoMarks)) {
      const owner = this.heroes[Number(ownerId)];
      const fraction = owner?.d?.classlessEffects?.echoDamageFraction || 0;
      if (mark.expiresAt <= this.time || !owner?.alive || fraction <= 0) {
        delete target.classlessEchoMarks[ownerId];
        continue;
      }
      entries.push({ sourceId: `H${owner.i}`, ownerIndex: owner.i,
        damage: owner.d.attack * fraction });
      delete target.classlessEchoMarks[ownerId];
    }
    if (Object.keys(target.classlessEchoMarks).length === 0) delete target.classlessEchoMarks;
    return entries;
  }

  _legacyInterposedDamage(hero, rawDamage) {
    const reduction = hero?.interposeUntil > this.time ? hero.interposeReduction : 0;
    const formation = this._classlessFormationReduction(hero);
    return C.damageAfterDefense(rawDamage, hero.d.defense) *
      (1 - Math.min(0.30, Math.max(0, reduction + formation)));
  }

  _resolveClasslessHeroDamage(hero, damage) {
    const state = hero.classlessCombatState;
    if (state?.decoy) {
      state.decoy = false;
      this._float(hero.x, hero.y - 20, "DECOY", "#A78BFA");
      return 0;
    }
    const remaining = Math.max(0, damage);
    if (remaining > 0) hero.hitUntil = this.time + 0.24;
    if (remaining > 0 && hero.d.decoyChance > 0 && state.mirrorReadyAt <= this.time && Math.random() < hero.d.decoyChance) {
      state.decoy = true;
      state.mirrorReadyAt = this.time + 15;
      this.effects.push({ kind: "shield", x: hero.x, y: hero.y, r: 18, life: 0.45, color: "#A78BFA" });
    }
    hero.ref.hp = Math.max(0, hero.ref.hp - remaining);
    if (remaining > 0) {
      state.lastDamageAt = this.time;
      state.nextRegenAt = this.time + 5;
    }
    if (hero.ref.hp / Math.max(1, hero.d.maxHp) < 0.25 && state.lastStandReadyAt <= this.time && hero.d.lastStand > 0) {
      state.lastStandUntil = this.time + 5;
      state.lastStandReadyAt = this.time + 60;
      this.effects.push({ kind: "guard", x: hero.x, y: hero.y, r: 22, life: 0.45, color: "#F59E0B" });
    }
    if (hero.ref.hp <= 0 && state.survivalUntil > this.time && state.survivalReadyAt <= this.time) {
      hero.ref.hp = 1;
      state.survivalReadyAt = this.time + 60;
      this._float(hero.x, hero.y - 22, "SURVIVE", "#DC2626");
      this.effects.push({ kind: "guard", x: hero.x, y: hero.y, r: 26, life: 0.65, color: "#DC2626" });
    }
    if (hero.ref.hp <= 0 && hero.alive) {
      hero.alive = false;
      this.effects.push({ kind: "death", x: hero.x, y: hero.y, r: 12, life: 0.55, color: "#F02DCA" });
      this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
    }
    return remaining;
  }

  _classlessHeal(hero, requested) {
    const state = hero.classlessCombatState;
    const second = Math.floor(this.time);
    if (state.sustainSecond !== second) {
      state.sustainSecond = second;
      state.sustainRestored = 0;
    }
    const cap = hero.d.maxHp * 0.04;
    const amount = Math.max(0, Math.min(requested, cap - state.sustainRestored, hero.d.maxHp - hero.ref.hp));
    if (amount <= 0) return 0;
    state.sustainRestored += amount;
    hero.ref.hp += amount;
    return amount;
  }

  _tickClasslessSustain(hero, dt) {
    if (!hero.classless || !hero.alive) return;
    const state = hero.classlessCombatState;
    if (hero.d.regenerationBelowHalf && hero.ref.hp / hero.d.maxHp < 0.5) {
      this._classlessHeal(hero, hero.d.maxHp * hero.d.regenerationBelowHalf * dt);
    }
    if (hero.d.regeneration && this.time - state.lastDamageAt >= 5 && this.time >= state.nextRegenAt) {
      this._classlessHeal(hero, hero.d.maxHp * hero.d.regeneration);
      state.nextRegenAt = this.time + 3;
    }
  }

  _throwEnemyBolt(e, target, damage, color, magic = false) {
    const obj = target?.obj;
    if (!obj) return;
    this.projectiles.push({
      kind: "enemyBolt",
      sourceId: "E" + e.type,
      x: e.x,
      y: e.y,
      launchX: e.x,
      launchY: e.y,
      targetSearchRange: e.type === "darkElf" ? 245 : e.type === "warlock" ? 225
        : Math.hypot(obj.x - e.x, obj.y - e.y),
      tx: obj.x,
      ty: obj.y,
      target,
      targetKind: target.kind,
      spd: magic ? 300 : 390,
      dmg: damage,
      magic,
      color,
      t: 0,
    });
    this.effects.push({ kind: "charge", x: e.x, y: e.y, r: 12, life: 0.2, color });
  }

  _resolveEnemyBolt(p) {
    if (p.targetKind === "hero" && this._isHeroUntargetable(p.target?.obj)) {
      // A projectile already in flight retargets on impact rather than
      // damaging a hero who became untargetable after it was launched.
      const replacement = this._nearestDefender(p.launchX, p.launchY, p.targetSearchRange);
      if (!replacement) return;
      p.target = replacement;
      p.targetKind = replacement.kind;
    }
    const obj = p.target?.obj;
    if (!obj) return;
    if (p.targetKind === "hero") {
      const h = obj;
      if (!h.alive || h.ref?.hp <= 0) return;
      if (Math.random() < this._heroDodgeChance(h)) {
        this._float(h.x, h.y - 20, "DODGE", "#00F3FF");
        return;
      }
      let damage = h.classless ? this._classlessReducedDamage(h, p.dmg) : this._legacyInterposedDamage(h, p.dmg);
      if (h.ref.shield > 0) {
        const absorbed = Math.min(h.ref.shield, damage);
        h.ref.shield -= absorbed;
        damage -= absorbed;
      }
      if (h.classless) this._resolveClasslessHeroDamage(h, damage);
      else h.ref.hp = Math.max(0, h.ref.hp - damage);
      this._float(h.x, h.y - 20, "-" + Math.round(damage), p.color);
      if (damage > 0) this._triggerHeroReaction(h, "ally");
      if (!h.classless && h.ref.hp <= 0 && h.alive) {
        h.alive = false;
        this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
      }
    } else if (p.targetKind === "tower") {
      const tower = obj;
      if (tower.ref.hp <= 0) return;
      const damage = p.dmg * 0.8;
      tower.ref.hp = Math.max(0, tower.ref.hp - damage);
      this._float(tower.x, tower.y - 20, "-" + Math.round(damage), p.color);
      if (tower.ref.hp <= 0) {
        this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
        this.effects.push({ x: tower.x, y: tower.y, r: 30, life: 0.4, color: tower.d.color });
      }
    }
    this.effects.push({ kind: "impact", x: obj.x, y: obj.y, r: 9, life: 0.22, color: p.color });
  }

  _enemyAttack(e, blocker) {
    if (blocker?.kind === "hero" && this._isHeroUntargetable(blocker.obj)) {
      // Re-evaluate in the same update so a direct attack never stalls on a
      // target that became untargetable after AI selection.
      const attackRange = Math.hypot(blocker.obj.x - e.x, blocker.obj.y - e.y);
      blocker = this._nearestDefender(e.x, e.y, attackRange);
      if (!blocker) return;
    }
    if (blocker.kind === "tower") {
      const t = blocker.obj;
      const rawDamage = e.type === "darkElf" ? e.damage * 1.15 : e.damage;
      const damage = rawDamage * 0.8; // towers take 20% less direct enemy damage
      t.ref.hp = Math.max(0, t.ref.hp - damage);
      if (t.ref.hp <= 0) {
        this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
        this.effects.push({ x: t.x, y: t.y, r: 30, life: 0.4, color: t.d.color });
      }
    } else {
      const h = blocker.obj;
      if (e.type === "warlock") {
        h.ref.shield = 0;
      }
      if (Math.random() < this._heroDodgeChance(h)) { this._float(h.x, h.y - 20, "DODGE", "#00F3FF"); return; }
      let dmg = h.classless ? this._classlessReducedDamage(h, e.damage) : this._legacyInterposedDamage(h, e.damage);
      if (h.ref.shield > 0) { const ab = Math.min(h.ref.shield, dmg); h.ref.shield -= ab; dmg -= ab; }
      if (h.classless) this._resolveClasslessHeroDamage(h, dmg);
      else h.ref.hp = Math.max(0, h.ref.hp - dmg);
      if (dmg > 0) this._triggerHeroReaction(h, "ally");
      if (e.boss) e.hp = Math.min(e.maxHp, e.hp + dmg * 0.5); // Demon Lord lifesteal
      this._float(h.x, h.y - 20, "-" + Math.round(dmg), "#FF3366");
      if (!h.classless && h.ref.hp <= 0 && h.alive) {
        h.alive = false;
        this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
      }
    }
  }

  _fire(sourceId, src, target, d, isHero) {
    if (isHero && src.classless) {
      src.visualActionKind = "attack";
      src.visualActionStartedAt = this.time;
      src.visualActionUntil = this.time + 0.36;
      src.facingTarget = target;
    }
    this.projectiles.push({
      sourceId, x: src.x, y: src.y, tx: target.x, ty: target.y, target,
      heroActionIndex: isHero && src.pendingTacticalAction === "attack" && src.manualTarget === target ? src.i : null,
      spd: d.magic ? 340 : 460, dmg: d.damage || d.attack, magic: !!d.magic,
      critChance: isHero ? (d.critChance ?? C.BASE_CRIT) : C.BASE_CRIT,
      critMult: isHero ? (d.critMult ?? C.CRIT_MULT) : C.CRIT_MULT,
      perkData: isHero && !src.classless ? d : null,
      classless: isHero && !!src.classless,
      heroIndex: isHero && src.classless ? src.i : null,
      damageCategory: isHero && src.classless ? "weapon" : null,
      damageType: Object.prototype.hasOwnProperty.call(d, "damageType") ? d.damageType : (src.ref?.cls === "knight" ? C.DAMAGE_TYPES.KNIGHT_MELEE
        : src.ref?.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE
        : src.ref?.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED
        : d.magic ? C.DAMAGE_TYPES.ARCANE : C.DAMAGE_TYPES.ARCHER_RANGED),
      color: isHero ? d.color : d.color, t: 0,
    });
    if (isHero && src.classless) {
      this.effects.push({ kind: "weapon_swing", x: src.x, y: src.y - 7, r: 15, life: 0.22, color: "#19E8F7" });
    }
    this.effects.push({ x: src.x, y: src.y, r: 8, life: 0.18, color: d.color, ring: true });
  }

  _applyHit(p) {
    if (p.classless) return this._applyClasslessHit(p);
    const e = p.target;
    const affinity = C.affinityMultiplier(e, p.damageType);
    if (affinity <= 0 || (p.magic && e.magicImmune)) {
      this._float(e.x, e.y - 4, "IMMUNE", "#39FF14");
      this.effects.push({ kind: "immune", x: e.x, y: e.y, r: 12, life: 0.32, color: "#39FF14" });
      return;
    }
    e.hitUntil = this.time + 0.18;

    const echoMarks = this._takeClasslessEchoMarks(e, p.sourceId);
    let dmg = p.dmg * affinity;
    const openingBonus = /^H\d+$/.test(String(p.sourceId || "")) ? this._classlessOpeningBonus(e) : 0;
    if (openingBonus > 0) {
      dmg *= 1 + openingBonus;
      this.effects.push({ kind: "opening", x: e.x, y: e.y, r: 18, life: 0.32, color: "#F59E0B" });
    }
    if (String(p.sourceId || "").startsWith("T")) {
      const slot = Number(String(p.sourceId).slice(1));
      const tower = this.towers.find((item) => item.slot === slot);
      if (tower?.ref?.type === "ballista" && e.boss) dmg *= 1 + (tower.d.bossDamagePct || 0);
    }
    const crit = Math.random() < (p.critChance ?? C.BASE_CRIT);
    if (crit) dmg *= (p.critMult ?? C.CRIT_MULT);

    e.hp = Math.max(0, e.hp - dmg);
    e.dmgBy[p.sourceId] = (e.dmgBy[p.sourceId] || 0) + dmg;
    let killSourceId = p.sourceId;
    for (const echo of echoMarks) {
      if (e.hp > 0 && echo.damage >= e.hp) killSourceId = echo.sourceId;
      e.hp = Math.max(0, e.hp - echo.damage);
      e.dmgBy[echo.sourceId] = (e.dmgBy[echo.sourceId] || 0) + echo.damage;
      this._float(e.x, e.y - 18, `ECHO ${Math.round(echo.damage)}`, "#A78BFA");
    }

    const affinityColor =
      affinity >= 1.25 ? "#FF66CC" :
      affinity <= 0.3 ? "#FF8A00" :
      affinity <= 0.6 ? "#00F3FF" :
      "#FFFFFF";

    const label = crit ? "CRIT " + Math.round(dmg) : Math.round(dmg);
    this._float(e.x, e.y - 4, label, crit ? "#FFE600" : affinityColor);
    this.effects.push({
      kind: "hit",
      x: e.x,
      y: e.y,
      r: crit ? 15 : 10,
      life: crit ? 0.32 : 0.22,
      color: crit ? "#FFE600" : affinityColor,
      crit,
    });

    if (p.perkData?.critHealPct && crit) {
      const hero = this.heroes.find((h) => "H" + h.i === p.sourceId);
      if (hero?.alive) hero.ref.hp = Math.min(hero.d.maxHp, hero.ref.hp + dmg * p.perkData.critHealPct);
    }
    if (
      p.perkData?.perkEffects?.cleave > 1
      && p.damageType === C.DAMAGE_TYPES.KNIGHT_MELEE
      && !p.cleaveApplied
    ) {
      const [secondary] = this._multiTargetTargets(e, p.perkData.perkEffects.cleave);
      if (secondary) this._applyHit({ ...p, target: secondary, cleaveApplied: true });
    }
    if (p.perkData?.multiTarget > 1 && !p.cleaveApplied) {
      const extra = this._multiTargetTargets(e, p.perkData.multiTarget);
      for (const other of extra) {
        this._applyHit({ ...p, target: other, dmg: p.dmg * 0.55, cleaveApplied: true });
      }
    }
    if (e.hp <= 0) this._killEnemy(e, killSourceId);
  }

  _applyClasslessHit(p) {
    const target = p.target;
    const hero = this.heroes[p.heroIndex];
    if (!target || target.hp <= 0 || !hero?.classless || !this._isValidClasslessTarget(hero, target)) return false;
    const effects = hero.d.classlessEffects;
    const affinity = p.damageType ? C.affinityMultiplier(target, p.damageType) : 1;
    if (affinity <= 0 || (p.magic && target.magicImmune)) {
      this._float(target.x, target.y - 4, "IMMUNE", "#39FF14");
      return false;
    }
    target.hitUntil = this.time + 0.18;
    const echoMarks = this._takeClasslessEchoMarks(target, p.sourceId);
    let damage = p.dmg * affinity;
    if (p.damageCategory === "weapon") damage *= 1 + effects.weaponDamage;
    if (p.damageType === C.DAMAGE_TYPES.ARCANE) damage *= 1 + (effects.arcaneDamage || 0);
    let situationalBonus = p.situationalBonus || 0;
    if (p.ability) situationalBonus += hero.d.bloodPriceBonus || 0;
    const state = hero.classlessCombatState;
    if (effects.followThroughDamage > 0 && target.classlessLastHitBy?.[hero.i] > this.time) {
      situationalBonus += effects.followThroughDamage;
    }
    if (p.damageCategory === "weapon" && effects.markDamage > 0) {
      target.classlessMarks ||= {};
      const mark = target.classlessMarks[hero.i];
      if (mark?.expiresAt > this.time) situationalBonus += effects.markDamage;
      else target.classlessMarks[hero.i] = { expiresAt: this.time + 5, source: hero.i };
    }
    if (effects.activeTargetDamage > 0 && target.classlessActiveHitUntil > this.time &&
      target.classlessActiveHitBy === hero.i) situationalBonus += effects.activeTargetDamage;
    const openingBonus = this._classlessOpeningBonus(target);
    situationalBonus += openingBonus;
    if (p.damageCategory === "weapon" && effects.momentumDamagePerStack > 0) {
      if (state.momentumTarget !== target || this.time - state.lastDealtAt > 4) {
        state.momentumTarget = target;
        state.momentumStacks = 0;
      }
      situationalBonus += state.momentumStacks * effects.momentumDamagePerStack;
    }
    if (p.damageCategory === "weapon" && effects.ambushDamage > 0 && this.time - state.lastDealtAt >= 3 &&
      !state.ambushTargets.has(target)) situationalBonus += effects.ambushDamage;
    const consumesVanish = p.area !== true && p.damageOverTime !== true && state.vanishDamagePending > 0;
    if (consumesVanish) situationalBonus += state.vanishDamagePending;
    damage *= 1 + Math.min(0.5, situationalBonus);
    if (p.elementalBonus) damage *= 1 + Math.min(0.5, p.elementalBonus);
    // Vanish's next-hit bonus belongs to the shared situational category and
    // therefore obeys its canonical +50% cap in the damage pipeline.
    const crit = p.guaranteedCrit || Math.random() < hero.d.critChance;
    if (crit) damage *= hero.d.critMult;
    target.hp = Math.max(0, target.hp - damage);
    if (consumesVanish) state.vanishDamagePending = 0;
    target.dmgBy[p.sourceId] = (target.dmgBy[p.sourceId] || 0) + damage;
    let killSourceId = p.sourceId;
    for (const echo of echoMarks) {
      if (target.hp > 0 && echo.damage >= target.hp) killSourceId = echo.sourceId;
      target.hp = Math.max(0, target.hp - echo.damage);
      target.dmgBy[echo.sourceId] = (target.dmgBy[echo.sourceId] || 0) + echo.damage;
      this._float(target.x, target.y - 18, `ECHO ${Math.round(echo.damage)}`, "#A78BFA");
    }
    target.classlessLastHitBy ||= {};
    target.classlessLastHitBy[hero.i] = this.time + 4;
    state.lastDealtAt = this.time;
    if (p.damageCategory === "weapon" && effects.momentumDamagePerStack > 0) {
      state.momentumStacks = Math.min(5, state.momentumStacks + 1);
      state.momentumTarget = target;
    }
    if (p.damageCategory === "weapon" && effects.ambushDamage > 0) state.ambushTargets.add(target);
    const label = crit ? `CRIT ${Math.round(damage)}` : `${Math.round(damage)}`;
    this._float(target.x, target.y - 4, label, crit ? "#FFE600" : hero.d.color);
    this.effects.push({ kind: "hit", x: target.x, y: target.y, r: crit ? 15 : 10, life: 0.25, color: crit ? "#FFE600" : hero.d.color, crit });
    if (p.sharedStrike) {
      hero.visualActionKind = "sharedStrike";
      hero.visualActionStartedAt = this.time;
      hero.visualActionUntil = this.time + 0.52;
      this.effects.push({ kind: "shared_strike", x: target.x, y: target.y, r: 22, life: 0.48, color: "#22D3EE" });
    }
    if (openingBonus > 0) this.effects.push({ kind: "opening", x: target.x, y: target.y, r: 18, life: 0.32, color: "#F59E0B" });
    if (echoMarks.length) this.effects.push({ kind: "echo_hit", x: target.x, y: target.y, r: 16, life: 0.4, color: "#A78BFA" });
    if (!p.ability && !p.area && hero.d.lifesteal > 0 && damage > 0) {
      const lifestealMultiplier = state.covenantUntil > this.time ? 2 : 1;
      const heal = this._classlessHeal(hero, damage * hero.d.lifesteal * lifestealMultiplier);
      if (heal > 0) this._float(hero.x, hero.y - 20, `+${Math.round(heal)}`, "#39FF14");
    }
    if (p.ability) {
      target.classlessActiveHitUntil = Math.max(target.classlessActiveHitUntil || 0, this.time + 4);
      target.classlessActiveHitBy = hero.i;
      if (effects.echoDamageFraction > 0 && state.echoReadyAt <= this.time) {
        state.echoReadyAt = this.time + effects.echoCooldownSeconds;
        if (target.hp > 0) {
          target.classlessEchoMarks ||= {};
          target.classlessEchoMarks[hero.i] = { expiresAt: this.time + effects.echoDurationSeconds };
          this.effects.push({ kind: "echo_mark", x: target.x, y: target.y, r: 18, life: Math.min(0.7, effects.echoDurationSeconds), color: "#A78BFA" });
        }
      }
    }
    if (p.damageCategory === "weapon" && effects.disruptSlow > 0 && state.nextDisruptAt <= this.time) {
      const slow = target.boss ? effects.disruptSlow / 3 : effects.disruptSlow;
      target.slowUntil = Math.max(target.slowUntil || 0, this.time + 3);
      target.slowMultiplier = Math.min(target.slowMultiplier || 1, 1 - slow);
      target.attackSlowUntil = Math.max(target.attackSlowUntil || 0, this.time + 3);
      target.attackSlowMultiplier = Math.min(target.attackSlowMultiplier || 1, 1 - slow);
      if (target.hp > 0) this._recordClasslessControl(target, hero, this.time + 3);
      state.nextDisruptAt = this.time + 8;
    }
    if (p.damageCategory === "weapon" && effects.rootEverySeconds > 0 && state.nextRootAt <= this.time) {
      const rootUntil = this.time + (target.boss ? 0.5 : 1.5);
      target.rootUntil = Math.max(target.rootUntil || 0, rootUntil);
      target.rootedBy = hero.i;
      if (target.hp > 0) this._recordClasslessControl(target, hero, rootUntil);
      state.nextRootAt = this.time + effects.rootEverySeconds;
    }
    if (target.hp <= 0) this._killEnemy(target, killSourceId);
    return true;
  }

  _multiTargetTargets(target, multiTarget, radius = 55) {
    return this.active
      .filter((other) => other !== target && other.hp > 0 && Math.hypot(other.x - target.x, other.y - target.y) <= radius)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, multiTarget - 1);
  }

  _killEnemy(e, sourceId, silent) {
    if (e._dead) return;
    e._dead = true; e.hp = 0;
    if (!silent) this.effects.push({ kind: "death", x: e.x, y: e.y, r: e.boss ? 22 : 13, life: 0.48, color: e.color || "#FF3366" });
    this.killed += 1;
    this.sim.kills.total += 1;
    this.sim.kills.byType[e.type] = (this.sim.kills.byType[e.type] || 0) + 1;

    // reward gold continuously
    const tier = C.ENEMY_TIERS[e.tier] || C.ENEMY_TIERS.basic;
    this.sim.gold += tier.gold;

    // Equipment drops are deposited directly into the community Vault.
    // The drop/rarity economy is tuned separately from the verified gear stats.
    const drop = rollEquipmentDrop(e, this.sim.wave || 1);
    if (drop) this.sim.vault.push(drop);

    // XP attribution
    if (e.boss) {
      const totalDmg = Object.values(e.dmgBy).reduce((a, b) => a + b, 0) || 1;
      for (const sid in e.dmgBy) {
        const share = (e.dmgBy[sid] / totalDmg) * tier.xp;
        this._awardXp(sid, share);
      }
      this.sim.morale = clamp(this.sim.morale + C.MORALE.bossKill);
    } else {
      let best = null, bestDmg = -1;
      for (const sid in e.dmgBy) if (e.dmgBy[sid] > bestDmg) { bestDmg = e.dmgBy[sid]; best = sid; }
      for (let i = 0; i < this.heroes.length; i++) {
        if (this.heroes[i].alive) this._awardXp("H" + i, Math.round(tier.xp * 0.35));
      }
      if (best) this._awardXp(best, tier.xp);
      const m = e.tier === "elite" ? C.MORALE.eliteKill : e.tier === "specialized" ? C.MORALE.specialistKill : C.MORALE.heroKill;
      if (best && best[0] === "H") this.sim.morale = clamp(this.sim.morale + m);
    }
    if (!silent) this.effects.push({ x: e.x, y: e.y, r: e.boss ? 60 : 20, life: 0.4, color: e.color });
    if (this.cb.onKill) this.cb.onKill();
  }

  _awardXp(sid, xp) {
    if (sid[0] === "H") {
      const i = +sid.slice(1);
      this.xpGains.heroes[i] = (this.xpGains.heroes[i] || 0) + xp;
    } else if (sid[0] === "T") {
      const slot = +sid.slice(1);
      this.xpGains.towers[slot] = (this.xpGains.towers[slot] || 0) + xp;
    }
  }

  _damageCastle(dmg, sourceEnemy = null) {
    const before = this.sim.castleHp;
    this.castleThreatUntil = this.time + 5;
    for (const h of this.heroes) {
      if (!h.alive || h.i === this.selectedHero) continue;
      if (h.manualPoint || h.rallyPoint || h.rallyHold || h.retreating || h.manualTarget) continue;
      h.reactiveUntil = Math.max(h.reactiveUntil || 0, this.castleThreatUntil);
      h.reactiveAlly = null;
      h.reactiveReason = "castle";
    }
    this.sim.castleHp = Math.max(0, this.sim.castleHp - dmg);
    const pctLost = (before - this.sim.castleHp) / this.sim.castleMaxHp * 100;
    this.sim.morale = clamp(this.sim.morale + Math.round(C.MORALE.castleLossPerPct * pctLost));
    this.effects.push({ x: W / 2, y: CASTLE_Y - 10, r: 40, life: 0.3, color: "#FF0055" });
  }

  _nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.active) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  }
  _selectTowerTarget(tower) {
    const cfg = tower.d;
    const pool = this.active.filter((e) => Math.hypot(e.x - tower.x, e.y - tower.y) <= cfg.range);
    if (!pool.length) return null;
    if (cfg.targetPriority === "elite_boss") {
      return pool.reduce((best, e) => {
        if (!best) return e;
        const rank = e.boss ? 3 : e.tier === "elite" ? 2 : 1;
        const bestRank = best.boss ? 3 : best.tier === "elite" ? 2 : 1;
        return rank > bestRank || (rank === bestRank && e.maxHp > best.maxHp) ? e : best;
      }, null);
    }
    if (cfg.targetPriority === "vulnerable") {
      const viable = pool.filter((e) => C.affinityMultiplier(e, cfg.damageType) > 0);
      if (!viable.length) return null;
      return viable.reduce((best, e) => {
        if (!best) return e;
        const score = C.affinityMultiplier(e, cfg.damageType);
        const bestScore = C.affinityMultiplier(best, cfg.damageType);
        if (score !== bestScore) return score > bestScore ? e : best;
        return e.hp < best.hp ? e : best;
      }, null);
    }
    if (cfg.targetPriority === "cluster") {
      return pool.reduce((best, e) => {
        const radius = cfg.splash || 55;
        const score = this.active.filter((other) => other !== e && Math.hypot(other.x - e.x, other.y - e.y) <= radius).length;
        const bestScore = best ? this.active.filter((other) => other !== best && Math.hypot(other.x - best.x, other.y - best.y) <= radius).length : -1;
        return score > bestScore ? e : best;
      }, null);
    }
    return pool.reduce((best, e) => !best || Math.hypot(e.x - tower.x, e.y - tower.y) < Math.hypot(best.x - tower.x, best.y - tower.y) ? e : best, null);
  }

  // targeting tactics driven by the hero's attack configuration
  _selectTarget(h) {
    if (h.classless) {
      if (this._isValidClasslessTarget(h, h.currentTarget)) return h.currentTarget;
      h.currentTarget = null;
      let nearest = null;
      let nearestDistance = Infinity;
      // Active order is the stable spawn order, so equal-distance ties are repeatable.
      for (const enemy of this.active) {
        if (!this._isValidClasslessTarget(h, enemy)) continue;
        const distance = Math.hypot(enemy.x - h.x, enemy.y - h.y);
        if (distance < nearestDistance) {
          nearest = enemy;
          nearestDistance = distance;
        }
      }
      h.currentTarget = nearest;
      return nearest;
    }
    const cfg = h.ref.attackConfig || "";
    const melee = h.d.range < 130;
    const pool = melee
      ? this.active.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) <= 300)
      : this.active.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) <= h.d.range);
    if (!pool.length) return null;
    const pick = (fn, dir) => pool.reduce((a, b) => (fn(b) * dir > fn(a) * dir ? b : a));
    if (/Weakest|Assassinate/i.test(cfg)) return pick((e) => e.hp, -1);       // lowest HP
    if (/Sniper|strongest/i.test(cfg)) return pick((e) => e.maxHp, 1);        // toughest
    if (/Guard|Defensive/i.test(cfg)) return pick((e) => e.y, 1);            // closest to keep
    if (h.ref.cls === "mage") {
      const viable = pool.filter((e) => C.affinityMultiplier(e, C.DAMAGE_TYPES.ARCANE) > 0);
      if (viable.length) {
        return viable.reduce((best, e) => {
          if (!best) return e;
          const score = C.affinityMultiplier(e, C.DAMAGE_TYPES.ARCANE);
          const bestScore = C.affinityMultiplier(best, C.DAMAGE_TYPES.ARCANE);
          return score > bestScore || (score === bestScore && e.hp < best.hp) ? e : best;
        }, null);
      }
      return null;
    }
    return pick((e) => Math.hypot(e.x - h.x, e.y - h.y), -1);                // nearest (default)
  }
  _support(h, cfg, preferredAlly = null) {
    const barrier = /Barrier/i.test(cfg);
    let preferredIsValid = false;
    if (preferredAlly?.alive && preferredAlly !== h) {
      const dist = Math.hypot(preferredAlly.x - h.x, preferredAlly.y - h.y);
      preferredIsValid = dist <= 220;
    }
    let ally = preferredIsValid ? preferredAlly : null, worst = Infinity;
    for (const a of this.heroes) {
      if (!a.alive || a === h) continue;
      const dist = Math.hypot(a.x - h.x, a.y - h.y);
      if (dist > 220) continue;
      const frac = a.ref.hp / a.d.maxHp;
      if (!preferredIsValid && frac < worst) { worst = frac; ally = a; }
    }
    if (!ally) return false;
    if (barrier) {
      const cap = ally.d.maxHp * 0.25;
      ally.ref.shield = Math.min(cap, (ally.ref.shield || 0) + 28 * h.d.healPower);
      this._float(ally.x, ally.y - 22, "+SHIELD", "#00F3FF");
      this.effects.push({ x: ally.x, y: ally.y, r: 24, life: 0.4, color: "#00F3FF" });
    } else {
      if (ally.ref.hp >= ally.d.maxHp) return false;
      const heal = 34 * h.d.healPower;
      ally.ref.hp = Math.min(ally.d.maxHp, ally.ref.hp + heal);
      this._float(ally.x, ally.y - 22, "+" + Math.round(heal), "#39FF14");
      this.effects.push({ x: ally.x, y: ally.y, r: 22, life: 0.4, color: "#39FF14" });
    }
    return true;
  }
  _nearestTower(x, y, r) {
    let best = null, bd = r;
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bd) { bd = d; best = t; }
    }
    return best ? { kind: "tower", obj: best } : null;
  }
  _nearestHeroEntity(x, y, r) {
    let best = null, bd = r;
    for (const h of this.heroes) if (h.alive && !this._isHeroUntargetable(h)) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) { bd = d; best = h; }
    }
    return best ? { kind: "hero", obj: best } : null;
  }

  _nearestMageEntity(x, y, r) {
    let best = null, bd = r;
    for (const h of this.heroes) {
      if (!h.alive || this._isHeroUntargetable(h) || h.ref?.type !== "mage") continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) { bd = d; best = h; }
    }
    return best ? { kind: "hero", obj: best } : null;
  }

  _selectEnemyTacticalTarget(e) {
    if (e.type === "reaper") {
      let best = null, worst = Infinity;
      for (const h of this.heroes) {
        if (!h.alive || this._isHeroUntargetable(h)) continue;
        const d = Math.hypot(h.x - e.x, h.y - e.y);
        if (d > 260) continue;
        const frac = h.ref.hp / Math.max(1, h.d.maxHp);
        if (frac < worst) { worst = frac; best = h; }
      }
      return best ? { kind: "hero", obj: best } : null;
    }

    if (e.type === "orc") {
      return this._nearestTower(e.x, e.y, 150) || this._nearestHeroEntity(e.x, e.y, 110);
    }

    if (e.type === "lieutenant") {
      return this._nearestHeroEntity(e.x, e.y, 150) || this._nearestTower(e.x, e.y, 120);
    }

    if (e.type === "ghost") {
      return this._nearestHeroEntity(e.x, e.y, 120) || this._nearestTower(e.x, e.y, 120);
    }

    if (e.type === "darkElf") {
      return this._nearestTower(e.x, e.y, 300) || this._nearestHeroEntity(e.x, e.y, 140);
    }

    if (e.type === "warlock") {
      return this._nearestMageEntity(e.x, e.y, 300)
        || this._nearestHeroEntity(e.x, e.y, 300)
        || this._nearestTower(e.x, e.y, 300);
    }

    return null;
  }

  _enemyTargetsHero(enemy, hero) {
    if (!enemy || !hero || this._isHeroUntargetable(hero)) return false;
    const tactical = this._selectEnemyTacticalTarget(enemy);
    if (tactical) return tactical.kind === "hero" && tactical.obj === hero;
    if (enemy.boss) return this._nearestDefender(enemy.x, enemy.y, enemy.attackRange || 420)?.obj === hero;
    return this._nearestHeroEntity(enemy.x, enemy.y, 30) === hero;
  }

  _resolveUnitCollisions() {
    // These are gameplay body radii, not the full glow/weapon-art bounds.
    // Bosses and elites need more room than basic units.
    const heroRadius = 15;
    const enemyRadius = (e) => e.boss ? 29 : e.tier === "elite" ? 20 : 14;
    const livingHeroes = this.heroes.filter((h) => h.alive);
    const livingEnemies = this.active.filter((e) => e.hp > 0);

    // A few short passes handle crowded groups without making collision
    // resolution expensive or changing the existing attack/target rules.
    for (let pass = 0; pass < 3; pass++) {
      const separate = (a, b, minDist, aWeight = 0.5, bWeight = 0.5) => {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) return;
        // Deterministic fallback for units that spawn at exactly the same point.
        if (dist < 0.001) {
          const seed = ((a.i ?? 0) + 1) * 17 + ((b.i ?? 0) + 1) * 31 + pass * 13;
          const angle = (seed % 360) * Math.PI / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap * aWeight;
        a.y -= ny * overlap * aWeight;
        b.x += nx * overlap * bWeight;
        b.y += ny * overlap * bWeight;
      };

      // Keep heroes from stacking while allowing them to regroup and move.
      for (let i = 0; i < livingHeroes.length; i++) {
        for (let j = i + 1; j < livingHeroes.length; j++) {
          separate(livingHeroes[i], livingHeroes[j], heroRadius * 2, 0.5, 0.5);
        }
      }

      // Enemy formations spread naturally instead of becoming a single pile.
      for (let i = 0; i < livingEnemies.length; i++) {
        for (let j = i + 1; j < livingEnemies.length; j++) {
          const a = livingEnemies[i], b = livingEnemies[j];
          separate(a, b, enemyRadius(a) + enemyRadius(b), 0.5, 0.5);
        }
      }

      // Heroes and enemies can still engage and attack at close range, but
      // their bodies stop at a readable contact distance rather than merging.
      for (const h of livingHeroes) {
        for (const e of livingEnemies) {
          separate(h, e, heroRadius + enemyRadius(e), 0.5, 0.5);
        }
      }

      for (const h of livingHeroes) {
        h.x = Math.max(heroRadius, Math.min(W - heroRadius, h.x));
        h.y = Math.max(18, Math.min(CASTLE_Y - 8, h.y));
      }
      for (const e of livingEnemies) {
        const r = enemyRadius(e);
        e.x = Math.max(r, Math.min(W - r, e.x));
      }
    }
  }


  _returnHome(h, dt) {
    const dx = h.home.x - h.x, dy = h.home.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    const spd = heroMovementSpeed(h, 150, this.time) * dt;
    h.x += (dx / d) * Math.min(spd, d);
    h.y += (dy / d) * Math.min(spd, d);
  }

  _float(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 0.7 }); }

  _hud() {
    if (!this.cb.onHud) return;
    this.cb.onHud({
      total: this.wave.total, killed: this.killed,
      remaining: this.active.length + this.spawnQueue.length,
      castleEscaped: this.castleEscaped,
      castleEscapeLimit: Math.floor(this.wave.total / 2) + 1,
      castleHp: this.sim.castleHp, castleMaxHp: this.sim.castleMaxHp,
      morale: this.sim.morale, gold: this.sim.gold, metal: this.sim.metal, stone: this.sim.stone,
      heroes: this.heroes.map((h) => ({ name: h.ref.name, hp: h.ref.hp, maxHp: h.d.maxHp, alive: h.alive, shield: h.ref.shield || 0 })),
      heroAbilities: this.heroes.map((h) => this.getHeroAbilityStatus(h.i)),
      heroSpells: this.heroes.map((h) => this.getHeroSpellStatus(h.i)),
      boss: (() => { const b = this.active.find((e) => e.boss); return b ? { name: b.name, hp: b.hp, maxHp: b.maxHp } : null; })(),
    });
  }

  _checkEnd() {
    if (this.ended) return;

    // Absolute defeat conditions. Towers are supporting defenses, but they are
    // not themselves a victory condition: once the entire hero squad is dead,
    // the wave is lost even if some towers remain.
    const anyHero = this.heroes.some((h) => h.alive);
    if (!anyHero) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "heroes",
        xpGains: this.xpGains,
        killed: this.killed,
      });
      return;
    }

    // The castle is lost either by HP depletion or by a strict majority of the
    // wave reaching it. Example: 10 enemies -> 6 breaches required; 9 -> 5.
    const castleEscapeLimit = Math.floor(this.wave.total / 2) + 1;
    if (this.sim.castleHp <= 0) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "castle",
        xpGains: this.xpGains,
        killed: this.killed,
      });
      return;
    }

    if (this.castleEscaped >= castleEscapeLimit) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "breach",
        xpGains: this.xpGains,
        killed: this.killed,
        castleEscaped: this.castleEscaped,
        castleEscapeLimit,
      });
      return;
    }

    // Victory requires the entire wave to be resolved while at least one hero
    // is still alive and the castle has not crossed either defeat threshold.
    if (this.spawnQueue.length === 0 && this.active.length === 0) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: true,
        reason: "cleared",
        xpGains: this.xpGains,
        killed: this.killed,
      });
    }
  }

  // Return a building hit when the player taps one of the visible kingdom assets.
  _kingdomSites() {
    const ids = ["mine", "quarry", "academy", "guild", "tavern", "shoppe", "library", "vault"];
    return ids.map((id, i) => ({
      id,
      x: W * ((i + 0.5) / ids.length),
      y: H - 64,
      color: ({ mine: "#FFE600", quarry: "#00F3FF", academy: "#39FF14", guild: "#FF6600", tavern: "#FF007F", shoppe: "#A855F7", library: "#B66CFF", vault: "#00F3FF" })[id],
      label: id.toUpperCase(),
      shape: id,
    }));
  }

  getBuildingAt(x, y) {
    for (const site of this._kingdomSites()) {
      if (Math.abs(x - site.x) <= 24 && Math.abs(y - site.y) <= 26) return site.id;
    }
    return null;
  }

  _nearestBuilding(x, y, range = 34) {
    let best = null;
    let bestDistance = range;
    for (const site of this._kingdomSites()) {
      const building = this.sim.buildings?.[site.id];
      if (!building || building.hp <= 0) continue;
      const distance = Math.hypot(site.x - x, site.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { kind: "building", id: site.id, x: site.x, y: site.y, ref: building, distance };
      }
    }
    return best;
  }

  // ---------------- rendering ----------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    // field
    ctx.fillStyle = "#12131A"; ctx.fillRect(0, 0, W, H);
    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 42) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 42) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    this._neonLine(0, WALL_Y, W, WALL_Y, "#FFE600", 3);
    this._neonLine(0, GATE_Y, W, GATE_Y, "#FF2A5F", 3);

    // castle keep
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = "#FF2A5F";
    ctx.strokeStyle = "#FF2A5F"; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 70, CASTLE_Y - 26, 140, 26);
    ctx.restore();

    // barricades
    this.barricades.forEach((b) => {
      if (b.ref.maxHp <= 0) return;
      const w = (W / LANES) * 0.8, x = b.x - w / 2;
      const frac = Math.max(0, b.ref.hp / b.ref.maxHp);
      const blockadeActive = Number(this.sim.guildBlockadeActiveUntil) > Date.now() && b.ref.hp > 0;
      this._drawBarricade(x, WALL_Y - 7, w, 14, frac, blockadeActive);
    });

    // Physical kingdom buildings occupy the bottom defensive line, not a side menu.
    for (const b of this._kingdomSites()) {
      const saved = this.sim.buildings?.[b.id];
      if (!saved) continue;
      const unlocked = saved.unlocked !== false;
      const hp = Math.max(0, Number(saved.hp) || 0);
      const maxHp = Math.max(1, Number(saved.maxHp) || 1);
      const level = Math.max(1, Number(saved.level) || 1);
      const intact = hp > 0;
      const color = intact ? b.color : "#FF0055";
      const w = 34, h = 28, left = b.x - w / 2, top = b.y - h / 2;
      ctx.save();
      ctx.globalAlpha = unlocked ? (intact ? 1 : 0.48) : 0.22;
      ctx.shadowBlur = unlocked && intact ? 12 : 0;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.fillStyle = "#111827";
      ctx.lineWidth = 1.8;
      if (b.id === "mine") {
        ctx.beginPath(); ctx.moveTo(left, top + h); ctx.lineTo(left + 5, top + 9); ctx.lineTo(b.x - 7, top + 2); ctx.lineTo(b.x + 7, top + 2); ctx.lineTo(left + w - 5, top + 9); ctx.lineTo(left + w, top + h); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeRect(b.x - 4, top + 13, 8, 15);
      } else if (b.id === "quarry") {
        ctx.beginPath(); ctx.moveTo(left, top + h); ctx.lineTo(left + 5, top + 10); ctx.lineTo(left + 12, top + 15); ctx.lineTo(b.x, top + 1); ctx.lineTo(left + 24, top + 13); ctx.lineTo(left + w - 4, top + 7); ctx.lineTo(left + w, top + h); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (b.id === "vault") {
        ctx.strokeRect(left + 2, top + 3, w - 4, h - 4); ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.moveTo(b.x - 6, b.y); ctx.lineTo(b.x + 6, b.y); ctx.moveTo(b.x, b.y - 6); ctx.lineTo(b.x, b.y + 6); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(left + 1, top + h); ctx.lineTo(left + 1, top + 9); ctx.lineTo(b.x, top + 1); ctx.lineTo(left + w - 1, top + 9); ctx.lineTo(left + w - 1, top + h); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeRect(b.x - 4, top + 16, 8, 12);
        if (b.id === "academy" || b.id === "library") {
          ctx.beginPath(); ctx.moveTo(b.x - 10, top + 8); ctx.lineTo(b.x - 10, top + 1); ctx.lineTo(b.x - 3, top + 1); ctx.moveTo(b.x + 3, top + 1); ctx.lineTo(b.x + 10, top + 1); ctx.lineTo(b.x + 10, top + 8); ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = "bold 6px monospace";
      ctx.textAlign = "center";
      ctx.fillText(unlocked ? b.label : "LOCKED", b.x, top - 14);
      ctx.font = "bold 6px monospace";
      ctx.fillText("L" + level, b.x, top + h + 8);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(b.x - 15, top + h + 11, 30, 3);
      ctx.fillStyle = intact ? color : "#FF0055";
      ctx.fillRect(b.x - 15, top + h + 11, 30 * Math.max(0, Math.min(1, hp / maxHp)), 3);
      if (!intact) {
        ctx.strokeStyle = "#FF0055"; ctx.beginPath(); ctx.moveTo(left + 5, top + 5); ctx.lineTo(left + w - 5, top + h - 3); ctx.moveTo(left + w - 5, top + 5); ctx.lineTo(left + 5, top + h - 3); ctx.stroke();
      }
      ctx.restore();
    }

    // Tiny personal turrets are visibly mounted on each physical building.
    for (const turret of this.buildingTurrets || []) {
      const enabled = turret.ref.hp > 0;
      ctx.save();
      ctx.globalAlpha = enabled ? 1 : 0.25;
      ctx.shadowBlur = enabled ? 7 : 0;
      ctx.shadowColor = turret.color;
      ctx.strokeStyle = turret.color;
      ctx.fillStyle = "#080D16";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(turret.x, turret.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(turret.x, turret.y); ctx.lineTo(turret.x, turret.y - 7); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = turret.ref.turretAmmo > 0 ? "#FFE600" : "#FF0055";
      ctx.fillRect(turret.x - 5, turret.y + 6, 10 * (turret.maxAmmo ? turret.ref.turretAmmo / turret.maxAmmo : 0), 2);
      ctx.restore();
    }

    // towers — compact top-down gameplay sprites, weapon direction points UP toward enemies.
    for (const t of this.towers) {
      this._drawTowerSprite(t);
      this._bar(t.x - 18, t.y + 17, 36, 3, t.ref.hp / t.d.maxHp, t.d.color);
      const tr = C.TOWER_RESOURCE[t.ref.type];
      const cur = tr.kind === "ammo" ? (t.ref.ammo || 0) : (t.ref.mana || 0);
      const max = tr.kind === "ammo" ? t.d.maxAmmo : t.d.maxMana;
      this._bar(t.x - 18, t.y + 22, 36, 2, max > 0 ? cur / max : 0, "#FFE600");
    }

    const targetHighlights = new Set(
      this.targetingHero == null
        ? []
        : (this.getRangedTargetStatus(this.targetingHero)?.targets || []).map((target) => target.enemy)
    );

    // enemies — top-down sprites face DOWN toward the player/castle.
    for (const e of this.active) {
      const r = e.boss ? 25 : e.tier === "elite" ? 16 : 11;
      this._drawEnemySprite(e);
      this._bar(e.x - r, e.y - r - 7, r * 2, 3, e.hp / e.maxHp, e.color);
      if (targetHighlights.has(e)) {
        ctx.save();
        ctx.strokeStyle = "#39FF14";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#39FF14";
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (e.type === "reaper" && e.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#A855F7";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#A855F7";
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 4 + 2 * Math.sin(this.time * 6), 0, 7);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === "darkElf" && e.hp > 0) {
        ctx.save(); ctx.strokeStyle = "#F43F5E"; ctx.lineWidth = 1.4; ctx.shadowBlur = 10; ctx.shadowColor = "#F43F5E";
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 5 + 2 * Math.sin(this.time * 8), 0, 7); ctx.stroke(); ctx.restore();
      } else if (e.type === "warlock" && e.hp > 0) {
        ctx.save(); ctx.strokeStyle = "#C026D3"; ctx.lineWidth = 1.4; ctx.shadowBlur = 10; ctx.shadowColor = "#C026D3"; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 6, 0, 7); ctx.stroke(); ctx.restore();
      } else if (e.type === "lieutenant" && e.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#00F3FF";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 105, 0, 7);
        ctx.stroke();
        ctx.restore();
      }
      if (this.heroes.some((h) => h.manual && h.manualTarget === e)) {
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 7, 0, 7);
        ctx.stroke();
        ctx.restore();
      }
    }

    // heroes — top-down sprites face UP toward incoming enemies.
    for (const h of this.heroes) {
      if (h.i === this.selectedHero && h.alive) {
        ctx.save();
        ctx.strokeStyle = h.manual ? "#F0ABFC" : h.d.color;
        ctx.lineWidth = h.manual ? 2 : 1.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = h.manual ? "#D946EF" : h.d.color;
        ctx.beginPath();
        ctx.arc(h.x, h.y + 2, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      this._drawHeroSprite(h);
      this._bar(h.x - 18, h.y + 20, 36, 4, Math.max(0, h.ref.hp) / h.d.maxHp, h.d.color);
    }

    // Manual command markers make every battlefield command visually verifiable.
    for (const h of this.heroes) {
      if (!h.manual || !h.alive) continue;
      if (h.manualPoint) {
        ctx.save();
        ctx.strokeStyle = "#00F3FF";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00F3FF";
        ctx.beginPath();
        ctx.arc(h.manualPoint.x, h.manualPoint.y, 9 + 2 * Math.sin(this.time * 8), 0, Math.PI * 2);
        ctx.moveTo(h.manualPoint.x - 14, h.manualPoint.y); ctx.lineTo(h.manualPoint.x + 14, h.manualPoint.y);
        ctx.moveTo(h.manualPoint.x, h.manualPoint.y - 14); ctx.lineTo(h.manualPoint.x, h.manualPoint.y + 14);
        ctx.stroke();
        ctx.restore();
      }
      if (h.manualTarget && h.manualTarget.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#FFE600";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#FFE600";
        ctx.beginPath();
        ctx.arc(h.manualTarget.x, h.manualTarget.y, 18 + 2 * Math.sin(this.time * 9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      ctx.save();
      if (p.kind === "napalm") {
        ctx.shadowBlur = 18; ctx.shadowColor = "#FF6600";
        ctx.fillStyle = "#FF6600";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath();
        ctx.arc(p.x - 2, p.y - 2, 2.5, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,102,0,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y + 5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.magic) {
        // Arcane shots are diamonds so they remain visually distinct from arrows.
        ctx.shadowBlur = 14; ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 0.8; ctx.stroke();
      } else {
        // Physical shots get a short directional streak.
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 7, p.y - uy * 7);
        ctx.lineTo(p.x + ux * 3, p.y + uy * 3);
        ctx.stroke();
      }
      ctx.restore();
    }
    // effects
    for (const fx of this.effects) {
      const alpha = Math.max(0, Math.min(1, fx.life * 2.2));
      ctx.save();

      if (fx.kind === "shared_strike") {
        const radius = fx.r + (1 - fx.life) * 26;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#22D3EE";
        ctx.strokeStyle = "#22D3EE";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, radius, -2.2, 0.55); ctx.stroke();
        ctx.shadowColor = "#F02DCA";
        ctx.strokeStyle = "#F02DCA";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, radius - 5, -2.05, 0.35); ctx.stroke();
      } else if (fx.kind === "weapon_swing") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2.2;
        ctx.shadowBlur = 13; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * 9;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, radius, -2.4, -0.2); ctx.stroke();
      } else if (fx.kind === "trail") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 4;
        ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.quadraticCurveTo((fx.x + fx.toX) / 2 - 8, (fx.y + fx.toY) / 2, fx.toX, fx.toY); ctx.stroke();
      } else if (fx.kind === "smoke") {
        ctx.globalAlpha = alpha * 0.75;
        ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
        for (let i = 0; i < 3; i += 1) {
          ctx.strokeStyle = i % 2 ? "#F02DCA" : fx.color;
          ctx.lineWidth = 3 - i * 0.5;
          ctx.beginPath(); ctx.arc(fx.x + (i - 1) * 4, fx.y - i * 3, fx.r * (0.45 + i * 0.16) + (1 - fx.life) * 9, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (fx.kind === "echo_mark" || fx.kind === "echo_hit" || fx.kind === "opening") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = fx.kind === "opening" ? 2.8 : 2;
        ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * 15;
        ctx.beginPath();
        if (fx.kind === "opening") {
          for (let i = 0; i < 6; i += 1) {
            const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const x = fx.x + Math.cos(a) * radius, y = fx.y + Math.sin(a) * radius;
            if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
        } else ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === "guard" || fx.kind === "covenant" || fx.kind === "blood_price") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = fx.kind === "blood_price" ? 3 : 2.5;
        ctx.shadowBlur = 16; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * 12;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, radius, fx.kind === "blood_price" ? -2.4 : 0, fx.kind === "blood_price" ? 0.5 : Math.PI * 2); ctx.stroke();
        if (fx.kind === "covenant") {
          ctx.strokeStyle = "#F9A8D4"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, radius - 5, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (fx.kind === "death") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
        ctx.shadowBlur = 14; ctx.shadowColor = fx.color;
        for (let i = 0; i < 5; i += 1) {
          const a = i * (Math.PI * 2 / 5);
          const r1 = 4 + (1 - fx.life) * 7, r2 = 13 + (1 - fx.life) * 23;
          ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
          ctx.lineTo(fx.x + Math.cos(a) * r2, fx.y + Math.sin(a) * r2); ctx.stroke();
        }
      } else if (fx.kind === "fire") {
        const pulse = 1 + 0.12 * Math.sin(this.time * 24 + fx.x);
        const base = 13 * pulse;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 22; ctx.shadowColor = "#FF6600";
        ctx.fillStyle = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, base, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x - 2, fx.y - 4, base * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(fx.x - 3, fx.y - 6, base * 0.2, 0, 7); ctx.fill();
        // small rising flame tongues
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 7;
          const rise = 7 + ((this.time * 22 + i * 9) % 12);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = i === 1 ? "#FFE600" : "#FF6600";
          ctx.beginPath();
          ctx.arc(fx.x + ox, fx.y - rise, 4 - i * 0.5, 0, 7);
          ctx.fill();
        }
      } else if (fx.kind === "napalm") {
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 28; ctx.shadowColor = "#FF6600";
        ctx.strokeStyle = "#FF6600"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r + (1 - fx.life) * 54, 0, 7); ctx.stroke();
        ctx.fillStyle = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 10 + (1 - fx.life) * 18, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + (1 - fx.life) * 9, 0, 7); ctx.fill();
      } else if (fx.kind === "charge") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#FF6600"; ctx.lineWidth = 3;
        ctx.shadowBlur = 20; ctx.shadowColor = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r + (1 - fx.life) * 18, 0, 7); ctx.stroke();
        ctx.strokeStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + (1 - fx.life) * 10, 0, 7); ctx.stroke();
      } else if (fx.kind === "hit") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.crit ? 2.5 : 1.8;
        ctx.shadowBlur = 14; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * (fx.crit ? 12 : 8);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx.x - radius * 0.8, fx.y);
        ctx.lineTo(fx.x + radius * 0.8, fx.y);
        ctx.moveTo(fx.x, fx.y - radius * 0.8);
        ctx.lineTo(fx.x, fx.y + radius * 0.8);
        ctx.stroke();
      } else if (fx.kind === "immune") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * 10;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, 7);
        ctx.moveTo(fx.x - radius, fx.y);
        ctx.lineTo(fx.x + radius, fx.y);
        ctx.moveTo(fx.x, fx.y - radius);
        ctx.lineTo(fx.x, fx.y + radius);
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - fx.life), 0, 7); ctx.stroke();
      }
      ctx.restore();
    }
    // floaters
    ctx.textAlign = "center"; ctx.font = "bold 11px JetBrains Mono, monospace";
    for (const f of this.floaters) {
      ctx.save(); ctx.globalAlpha = Math.max(0, f.life * 1.4);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); ctx.restore();
    }
  }

  _drawHeroSprite(h) {
    const ctx = this.ctx;
    if (h.classless || !h.ref.cls) {
      const previous = h.lastDrawPosition || { x: h.x, y: h.y };
      const dx = h.x - previous.x, dy = h.y - previous.y;
      const moving = dx * dx + dy * dy > 0.12;
      const target = [h.facingTarget, h.manualTarget, h.currentTarget]
        .find((candidate) => candidate && candidate.hp > 0);
      const facingX = target ? target.x - h.x : moving ? dx : 0;
      const facingY = target ? target.y - h.y : moving ? dy : -1;
      const facing = Math.atan2(facingX, -facingY);
      const action = h.visualActionUntil > this.time ? h.visualActionKind : null;
      const frame = selectHeroSpriteFrame({
        alive: h.alive,
        hit: h.hitUntil > this.time,
        moving,
        running: h.retreating || !!h.manualPoint,
        action,
      }, action ? this.time - h.visualActionStartedAt : this.time);
      const alpha = h.alive ? (h.protect > 0 ? 0.58 : 1) : 0.52;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.globalAlpha = alpha;
      // Directional facing is provided by rotating the same eagle-eye frame.
      ctx.rotate(facing);
      const image = getClasslessSpriteImage();
      if (image?.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, -24, -44, 48, 48);
      } else {
        // Keep battles readable while the lightweight public SVG loads or if
        // an offline WebView cannot decode it.
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowBlur = 12;
        ctx.shadowColor = h.hitUntil > this.time ? "#F02DCA" : "#19E8F7";
        ctx.fillStyle = "#050912";
        ctx.strokeStyle = h.hitUntil > this.time ? "#F02DCA" : "#19E8F7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 10); ctx.lineTo(-7, -8); ctx.lineTo(0, -17);
        ctx.lineTo(7, -8); ctx.lineTo(9, 10); ctx.lineTo(0, 15); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#F02DCA";
        ctx.beginPath(); ctx.moveTo(7, 5); ctx.lineTo(11, -14); ctx.stroke();
      }
      ctx.restore();

      const formation = h.d.classlessEffects?.formationMitigation || 0;
      const allyNearby = this.heroes.some((ally) => ally !== h && ally.alive && Math.hypot(ally.x - h.x, ally.y - h.y) <= 5);
      if (formation > 0 && allyNearby) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "#22D3EE";
        ctx.lineWidth = 1.5;
        ctx.setLineDash?.([3, 3]);
        ctx.beginPath(); ctx.arc(h.x, h.y - 3, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      h.lastDrawPosition.x = h.x;
      h.lastDrawPosition.y = h.y;
      return;
    }
    const color = h.d.color;
    const alive = h.alive;
    const alpha = alive ? (h.protect > 0 ? 0.5 : 1) : 0.2;
    const cls = h.ref.cls;

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    const stroke = () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };
    const fill = () => {
      ctx.fillStyle = color;
      ctx.fill();
    };

    if (cls === "knight") {
      // Back-facing helmet, cape, shield and sword all point toward the enemy lane (UP).
      ctx.beginPath();
      ctx.moveTo(-10, 9); ctx.lineTo(-8, -7); ctx.lineTo(0, -13);
      ctx.lineTo(8, -7); ctx.lineTo(10, 9); ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14); ctx.closePath(); fill(); stroke();

      ctx.fillStyle = "#07111A";
      ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.stroke();

      ctx.fillStyle = "#101820";
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-7, 4); ctx.lineTo(-6, 13); ctx.lineTo(-13, 15); ctx.closePath();
      ctx.fill(); stroke();

      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(12, -13); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(12, -17); ctx.lineTo(14, -13); ctx.stroke();
    } else if (cls === "rouge") {
      // Hooded back silhouette with twin blades angled forward.
      ctx.beginPath();
      ctx.moveTo(-10, 12); ctx.lineTo(-8, -6); ctx.lineTo(0, -14);
      ctx.lineTo(8, -6); ctx.lineTo(10, 12); ctx.lineTo(0, 16); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#09020D";
      ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-7, 6); ctx.lineTo(-15, -12); ctx.moveTo(7, 6); ctx.lineTo(15, -12); ctx.stroke();
    } else if (cls === "mage") {
      // Robed back silhouette, staff and arcane orb pointed toward the enemy.
      ctx.beginPath();
      ctx.moveTo(-12, 13); ctx.lineTo(-8, -4); ctx.lineTo(0, -12);
      ctx.lineTo(8, -4); ctx.lineTo(12, 13); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#090313";
      ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(9, 13); ctx.lineTo(12, -12); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(12, -15, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, -13, 2.2, 0, Math.PI * 2); ctx.fill();
    } else {
      // Archer: hood/back silhouette, bow on the side, arrow aimed UP.
      ctx.beginPath();
      ctx.moveTo(-9, 13); ctx.lineTo(-8, -5); ctx.lineTo(0, -13);
      ctx.lineTo(8, -5); ctx.lineTo(9, 13); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#071305";
      ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, 0, 10, -1.15, 1.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(10, 10); ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(1, -3); ctx.lineTo(1, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, -16); ctx.lineTo(-1, -12); ctx.moveTo(1, -16); ctx.lineTo(3, -12); ctx.stroke();
    }

    if (!alive) {
      ctx.strokeStyle = "#FF0055";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
    }
    ctx.restore();
  }

  _drawTowerSprite(t) {
    const ctx = this.ctx;
    const color = t.d.color;
    const active = t.ref.hp > 0;
    const alpha = active ? (t.ref.underfunded ? 0.45 : 1) : 0.18;

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    // Common tower base: every tower now reads as the same neon-defense family.
    ctx.fillStyle = "#111720";
    ctx.beginPath(); ctx.arc(0, 5, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const mount = () => {
      ctx.fillStyle = "#1C2430";
      ctx.beginPath(); ctx.arc(0, 3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.stroke();
    };
    const barrel = (width = 3) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -21); ctx.stroke();
    };

    if (t.ref.type === "archer") {
      // Twin-arrow tower.
      mount(); barrel(2.5);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(0, -20); ctx.lineTo(7, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -15); ctx.lineTo(-4, -23); ctx.moveTo(4, -15); ctx.lineTo(4, -23); ctx.stroke();
    } else if (t.ref.type === "catapult") {
      // Heavy siege frame and scoop.
      ctx.fillStyle = "#30251C";
      ctx.fillRect(-11, -1, 22, 10); ctx.strokeRect(-11, -1, 22, 10);
      ctx.strokeStyle = color; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -19); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -19, 5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "#080A0F"; ctx.beginPath(); ctx.arc(0, -19, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (t.ref.type === "wizard") {
      // Arcane crystal tower, intentionally distinct from physical weapons.
      ctx.fillStyle = "#1D1630";
      ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-8, -8); ctx.lineTo(0, -17);
      ctx.lineTo(8, -8); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, -4); ctx.lineTo(0, 4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 1); ctx.stroke();
    } else {
      // Ballista: heavier, longer weapon profile for elite/boss hunting.
      ctx.fillStyle = "#25161A";
      ctx.fillRect(-12, -2, 24, 11); ctx.strokeRect(-12, -2, 24, 11);
      barrel(3.5);
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(10, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(5, -20); ctx.stroke();
    }

    if (t.ref.underfunded && active) {
      ctx.strokeStyle = "#FFE600"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 5, 19, 0, Math.PI * 2); ctx.stroke();
    }

    if (!active) {
      ctx.strokeStyle = "#FF0055";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(11, 11); ctx.moveTo(11, -11); ctx.lineTo(-11, 11); ctx.stroke();
    }
    ctx.restore();
  }
  _drawEnemySprite(e) {
    const ctx = this.ctx;
    const color = e.color;
    const boss = !!e.boss;
    const elite = e.tier === "elite";
    const s = boss ? 1.85 : elite ? 1.35 : 1;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = boss ? 18 : elite ? 13 : 9;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    const outline = () => { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke(); };
    const neon = (width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowBlur = 8; ctx.shadowColor = color; };
    const eye = (x, y, r = 2) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };

    if (e.type === "ghost") {
      // Floating sheet silhouette with a clear face and trailing tail.
      ctx.fillStyle = "#10131D";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.bezierCurveTo(-10, -12, -12, -3, -10, 6);
      ctx.lineTo(-7, 12); ctx.lineTo(-3, 7); ctx.lineTo(0, 13);
      ctx.lineTo(4, 7); ctx.lineTo(8, 12); ctx.lineTo(10, 5);
      ctx.bezierCurveTo(12, -5, 9, -12, 0, -14);
      ctx.closePath(); ctx.fill(); outline();
      eye(-3, 0, 2.2); eye(3, 0, 2.2);
      neon(1.4); ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(0, 9); ctx.lineTo(3, 7); ctx.stroke();
    } else if (e.type === "slime") {
      // Low, translucent-looking toxic blob with crown-like drips.
      ctx.fillStyle = "#102016";
      ctx.beginPath();
      ctx.moveTo(-13, 8); ctx.quadraticCurveTo(-12, -5, -7, -9);
      ctx.quadraticCurveTo(0, -14, 7, -9); ctx.quadraticCurveTo(12, -5, 13, 8);
      ctx.lineTo(8, 11); ctx.lineTo(4, 8); ctx.lineTo(0, 13);
      ctx.lineTo(-4, 8); ctx.lineTo(-9, 11); ctx.closePath();
      ctx.fill(); outline();
      eye(-4, 0, 2); eye(4, 0, 2);
      neon(1.4); ctx.beginPath(); ctx.moveTo(-6, 5); ctx.quadraticCurveTo(0, 8, 6, 5); ctx.stroke();
    } else if (e.type === "goblin") {
      // Small angular raider: ears, brow, torso and a short blade.
      ctx.fillStyle = "#152016";
      ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-8, -7); ctx.lineTo(0, -11);
      ctx.lineTo(8, -7); ctx.lineTo(7, 1); ctx.lineTo(5, 8); ctx.lineTo(-5, 8); ctx.closePath();
      ctx.fill(); outline();
      ctx.fillStyle = "#17261A";
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-16, -11); ctx.lineTo(-10, 1); ctx.closePath();
      ctx.moveTo(7, -5); ctx.lineTo(16, -11); ctx.lineTo(10, 1); ctx.closePath(); ctx.fill(); outline();
      eye(-3, 0, 1.8); eye(3, 0, 1.8);
      neon(2.3); ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(16, -5); ctx.stroke();
    } else if (e.type === "gnome") {
      // Same family as goblin, but with the distinctive tall neon cap.
      ctx.fillStyle = "#172019";
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = "#10171D";
      ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(0, -20); ctx.lineTo(9, -5); ctx.closePath(); ctx.fill(); outline();
      neon(1.2); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -6); ctx.stroke();
      eye(-3, 3, 1.8); eye(3, 3, 1.8);
      neon(2); ctx.beginPath(); ctx.moveTo(7, 7); ctx.lineTo(14, -3); ctx.stroke();
    } else if (e.type === "skeleton") {
      // Minimal skull/ribcage silhouette — intentionally readable at small size.
      ctx.fillStyle = "#111922";
      ctx.beginPath(); ctx.arc(0, -5, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-3, -5, 2, 0, Math.PI * 2); ctx.arc(3, -5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111922";
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(7, 3); ctx.lineTo(6, 12); ctx.lineTo(0, 15); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill();
      neon(1.4);
      for (let y = 5; y <= 11; y += 3) { ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y); ctx.stroke(); }
      neon(2); ctx.beginPath(); ctx.moveTo(8, 9); ctx.lineTo(15, -8); ctx.stroke();
    } else if (e.type === "zombie") {
      // Slumped humanoid silhouette with a torn shoulder and reaching arm.
      ctx.fillStyle = "#171429";
      ctx.beginPath(); ctx.arc(0, -6, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = "#0E1420";
      ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(7, 1); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill(); outline();
      eye(-3, -5, 2); eye(3, -3, 1.2);
      neon(2.3); ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(16, 1); ctx.lineTo(19, 6); ctx.stroke();
      neon(1.2); ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-10, 10); ctx.stroke();
    } else if (e.type === "orc") {
      // Broad armored brute with tusks and a heavy axe.
      ctx.fillStyle = "#101A16";
      ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-8, -11); ctx.lineTo(0, -14);
      ctx.lineTo(8, -11); ctx.lineTo(11, -3); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fill(); outline();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-9, 11); ctx.lineTo(-2, 9);
      ctx.moveTo(5, 5); ctx.lineTo(9, 11); ctx.lineTo(2, 9); ctx.fill();
      eye(-3, -1, 2); eye(3, -1, 2);
      neon(2.8); ctx.beginPath(); ctx.moveTo(9, 7); ctx.lineTo(16, -10); ctx.stroke();
      neon(2); ctx.beginPath(); ctx.moveTo(13, -14); ctx.lineTo(20, -10); ctx.stroke();
    } else if (e.type === "darkElf") {
      ctx.fillStyle = "#160A16";
      ctx.beginPath(); ctx.moveTo(-9, 11); ctx.lineTo(-8, -6); ctx.lineTo(0, -14); ctx.lineTo(8, -6); ctx.lineTo(9, 11); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05050A"; ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -3, 2); eye(3, -3, 2);
      neon(2.3); ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-16, -7); ctx.moveTo(7, 7); ctx.lineTo(16, -7); ctx.stroke();
      neon(1.4); ctx.beginPath(); ctx.moveTo(-8, -7); ctx.lineTo(-15, -13); ctx.moveTo(8, -7); ctx.lineTo(15, -13); ctx.stroke();
    } else if (e.type === "warlock") {
      ctx.fillStyle = "#16091A";
      ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(-9, -4); ctx.lineTo(0, -15); ctx.lineTo(9, -4); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05030A"; ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -5, 1.8); eye(3, -5, 1.8);
      neon(2); ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(13, -15); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(14, -18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === "reaper") {
      // Hooded elite with scythe — deliberately different from the lieutenant.
      ctx.fillStyle = "#12081B";
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-9, -6); ctx.lineTo(0, -16);
      ctx.lineTo(9, -6); ctx.lineTo(10, 10); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05050A";
      ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -2, 1.8); eye(3, -2, 1.8);
      neon(2.4); ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(17, -14); ctx.stroke();
      ctx.beginPath(); ctx.arc(19, -14, 7, Math.PI * 0.9, Math.PI * 1.8); ctx.stroke();
    } else if (e.type === "lieutenant") {
      // Armored elite commander with a ringed shoulder and spear.
      ctx.fillStyle = "#101923";
      ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-9, -7); ctx.lineTo(0, -15);
      ctx.lineTo(9, -7); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-3, -2, 1.8, 0, Math.PI * 2); ctx.arc(3, -2, 1.8, 0, Math.PI * 2); ctx.fill();
      neon(2.2); ctx.beginPath(); ctx.moveTo(8, 9); ctx.lineTo(14, -17); ctx.stroke();
      neon(1.6); ctx.beginPath(); ctx.arc(-12, 7, 6, 0, Math.PI * 2); ctx.stroke();
    } else {
      // Boss silhouettes keep a common Demonanic frame but have unique crowns.
      ctx.fillStyle = "#170A14";
      ctx.beginPath();
      ctx.moveTo(-21, 12); ctx.lineTo(-19, -5); ctx.lineTo(-30, -14);
      ctx.lineTo(-13, -12); ctx.lineTo(0, -20); ctx.lineTo(13, -12);
      ctx.lineTo(30, -14); ctx.lineTo(19, -5); ctx.lineTo(21, 12);
      ctx.lineTo(0, 20); ctx.closePath(); ctx.fill(); outline();
      eye(-9, 2, 2.8); eye(9, 2, 2.8);

      if (e.type === "demon") {
        neon(2.7);
        ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-23, -25);
        ctx.moveTo(12, -10); ctx.lineTo(23, -25); ctx.stroke();
        ctx.fillStyle = "#080309"; ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === "imperialNecromancer") {
        neon(1.7);
        ctx.beginPath(); ctx.arc(0, -7, 6, 0, Math.PI * 2);
        ctx.moveTo(-20, 3); ctx.lineTo(-13, -4); ctx.moveTo(20, 3); ctx.lineTo(13, -4); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -7, 3, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === "nuclearBehemoth") {
        ctx.fillStyle = "#0A1710";
        ctx.beginPath(); ctx.arc(-11, 5, 6, 0, Math.PI * 2); ctx.arc(11, 5, 6, 0, Math.PI * 2); ctx.fill();
        neon(2.4);
        ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-22, -20); ctx.moveTo(14, -10); ctx.lineTo(22, -20); ctx.stroke();
      }
    }

    if (e.hitUntil > this.time) {
      ctx.globalAlpha = Math.min(0.45, (e.hitUntil - this.time) * 2.2);
      ctx.fillStyle = "#F8F7FF";
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#F02DCA";
      ctx.beginPath(); ctx.arc(0, 0, boss ? 24 : elite ? 17 : 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }
  _neonLine(x1, y1, x2, y2, color, w) {
    const ctx = this.ctx;
    ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = color;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  _glowShape(x, y, r, color, alpha = 1, diamond) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowBlur = 14; ctx.shadowColor = color;
    ctx.fillStyle = color; ctx.beginPath();
    if (diamond) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, 7);
    ctx.fill(); ctx.restore();
  }
  _bar(x, y, w, h, frac, color) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }
  _bracketSquare(cx, cy, s, color) {
    const ctx = this.ctx; const h = s / 2, len = 9;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 6; ctx.shadowColor = color;
    const corners = [[-h, -h, 1, 1], [h, -h, -1, 1], [-h, h, 1, -1], [h, h, -1, -1]];
    for (const [dx, dy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx + sx * len, cy + dy);
      ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx, cy + dy + sy * len);
      ctx.stroke();
    }
    ctx.restore();
  }
  _hazardBar(x, y, w, h, frac) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "#12131A"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FFE600";
    for (let i = -h; i < w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.lineTo(x + i + h + 6, y); ctx.lineTo(x + i + 6, y + h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = `rgba(255,230,0,${0.4 + 0.6 * frac})`; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = "#FFE600";
    ctx.strokeRect(x, y, w, h); ctx.restore();
  }
  _drawBarricade(x, y, w, h, frac, blockadeActive) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#090B16";
    ctx.strokeStyle = frac > 0 ? "#00F3FF" : "#FF2A5F";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = frac > 0 ? 8 : 0;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h); ctx.lineTo(x + 6, y + 2);
    ctx.lineTo(x + w - 6, y + 2); ctx.lineTo(x + w - 3, y + h);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (frac > 0) {
      ctx.fillStyle = "rgba(0,243,255,0.65)";
      ctx.fillRect(x + 7, y + h - 3, (w - 14) * Math.max(0, Math.min(1, frac)), 2);
      ctx.strokeStyle = "rgba(217,70,239,0.75)";
      ctx.beginPath(); ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 14, y + h - 3);
      ctx.moveTo(x + w - 10, y + 2); ctx.lineTo(x + w - 14, y + h - 3); ctx.stroke();
      if (blockadeActive) {
        ctx.strokeStyle = "#A855F7"; ctx.shadowBlur = 13; ctx.shadowColor = "#A855F7";
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 2, y - 3); ctx.lineTo(x + w + 2, y - 3); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#FF2A5F"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 9, y + 3); ctx.lineTo(x + w * 0.42, y + h - 2);
      ctx.moveTo(x + w - 9, y + 3); ctx.lineTo(x + w * 0.58, y + h - 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function pickLane(engine, e) {
  // path of least resistance: lowest (barricade hp + tower threat) lane, floats ignore barricades
  let best = 0, bestCost = Infinity;
  for (let l = 0; l < LANES; l++) {
    const bar = engine.barricades[l];
    let cost = e.floats ? 0 : (bar ? bar.ref.hp : 0);
    for (const t of engine.towers) if (t.ref.hp > 0 && Math.abs(t.x - laneX(l)) < 90) cost += t.d.damage * 3;
    cost += Math.random() * 40;
    if (cost < bestCost) { bestCost = cost; best = l; }
  }
  return best;
}
function clamp(v) { return Math.max(0, Math.min(100, v)); }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
