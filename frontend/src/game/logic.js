// Pure game-state logic. No React, no rendering. Data-driven from config.js.
import * as C from "./config";
import { aggregateEquipmentStats, emptyEquipmentState, equipItem as equipStoredItem, unequipItem as unequipStoredItem } from "./equipment";

let _heroSeq = 0;
export function createHero(classKey) {
  const cls = C.HERO_CLASSES[classKey];
  const stats = { ...C.BASE_STATS };
  for (const k in cls.mods) stats[k] += cls.mods[k];
  const maxHp = heroMaxHp(cls, 1, stats);
  return {
    id: `${classKey}-${Date.now().toString(36)}-${_heroSeq++}`,
    key: classKey, name: cls.name, cls: classKey,
    level: 1, xp: 0, sp: 0, ap: 0,
    stats, perks: [], attackConfig: C.ATTACK_CONFIGS[classKey][0],
    equipment: {},
    quickSlots: [null, null, null],
    hp: maxHp, maxHp,
  };
}

export function heroMaxHp(cls, level, stats) {
  return Math.round(cls.baseHp + (level - 1) * 28 + stats.defense * 3);
}

export function heroDerived(hero) {
  const cls = C.HERO_CLASSES[hero.cls];
  const gear = aggregateEquipmentStats(hero.equipment);
  const effectiveStats = {
    attack: hero.stats.attack + gear.attack,
    defense: hero.stats.defense + gear.defense,
    agility: hero.stats.agility + gear.agility,
    intelligence: hero.stats.intelligence + gear.intelligence,
  };
  const maxHp = heroMaxHp(cls, hero.level, effectiveStats) + gear.maxHP;
  return {
    maxHp,
    attack: effectiveStats.attack + (hero.cls === "archer" ? hero.level * 2 : hero.level),
    range: cls.attackRange,
    rate: cls.attackRate,
    magic: !!cls.magic,
    defense: effectiveStats.defense,
    agility: effectiveStats.agility,
    intelligence: effectiveStats.intelligence,
    critChance: C.BASE_CRIT + (gear.critChance / 100),
    critMult: C.CRIT_MULT + (gear.critDamage / 100),
    critDmgBonus: Math.floor(effectiveStats.attack / 10) * 0.01 + (gear.critDamage / 100),
    dodge: C.dodgeChance(effectiveStats.agility),
    healPower: 1 + effectiveStats.intelligence / 100,
    color: cls.color,
    gear,
  };
}

let _towerSeq = 0;
export function createTower(type, x, y) {
  const t = C.TOWERS[type];
  const r = C.TOWER_RESOURCE[type];
  return {
    id: `tw-${Date.now().toString(36)}-${_towerSeq++}`,
    type, x, y, level: 1, xp: 0, hp: t.baseHp, maxHp: t.baseHp,
    ammo: r.kind === "ammo" ? r.max : 0,
    maxAmmo: r.kind === "ammo" ? r.max : 0,
    mana: r.kind === "mana" ? r.max : 0,
    maxMana: r.kind === "mana" ? r.max : 0,
    choices: [], pending: 0, underfunded: false,
  };
}

export function towerDerived(tower) {
  const t = C.TOWERS[tower.type];
  const lvl = Math.max(1, tower.level || 1);
  const combatMul = Math.pow(1 + C.TOWER_UPGRADE.damageMult, lvl - 1);
  const hpMul = Math.pow(1 + C.TOWER_UPGRADE.hpMult, lvl - 1);
  const resourceMul = Math.pow(1 + C.TOWER_UPGRADE.resourceMult, lvl - 1);
  let dmg = t.damage * combatMul;
  let rate = t.fireRate;
  if (tower.underfunded) { dmg *= C.UNDERFUNDED.damageMult; rate *= C.UNDERFUNDED.fireRateMult; }
  const r = C.TOWER_RESOURCE[tower.type];
  return {
    ...t, damage: dmg, fireRate: rate,
    maxHp: Math.round(t.baseHp * hpMul),
    resourceKind: r.kind, resourceLabel: r.label, shotCost: r.shotCost,
    maxAmmo: r.kind === "ammo" ? Math.round(r.max * resourceMul) : 0,
    maxMana: r.kind === "mana" ? Math.round(r.max * resourceMul) : 0,
  };
}

export function createNewState(squadClasses) {
  const heroes = squadClasses ? squadClasses.map(createHero) : [];
  const barricades = Array.from({ length: C.BARRICADE.positions }, () => ({ hp: 0, maxHp: 0 }));
  const castleMaxHp = C.castleMaxHp(0);
  return {
    gold: C.STARTING.gold, food: C.STARTING.food, stone: C.STARTING.stone,
    workers: C.STARTING.workers, workersGold: C.STARTING.workersGold,
    workersStone: C.STARTING.workersStone, farmers: C.STARTING.farmers,
    morale: C.MORALE.base,
    castleHp: castleMaxHp, castleMaxHp,
    wave: 1, highestWaveCleared: 0, freeLifeUsed: false,
    surrenderTaxRate: 0, surrenderDebtWave: 0,
    heroes, bench: [], needsSquad: !squadClasses,
    vault: [],
    shoppe: { inventory: [], nextRefreshAt: 0, lastRefreshAt: 0 },
    towers: [],
    barricades,
    scoutKnowledge: 0,
    kills: { total: 0, byType: {} },
    bests: { highestWave: 0, totalKills: 0 },
    lastSeen: new Date().toISOString(),
  };
}

// choose the initial 4-hero squad (any combination, duplicates allowed)
export function setSquad(state, classKeys) {
  state.heroes = classKeys.map(createHero);
  state.bench = state.bench || [];
  state.needsSquad = false;
  emptyEquipmentState(state);
}

// recruit a new hero (Gold). Fills empty squad slots first, else goes to bench.
export function recruitHero(state, classKey) {
  const owned = state.heroes.length + (state.bench ? state.bench.length : 0);
  const cost = C.recruitCost(owned);
  if (state.gold < cost) return false;
  state.gold -= cost;
  const h = createHero(classKey);
  if (state.heroes.length < 4) state.heroes.push(h);
  else { state.bench = state.bench || []; state.bench.push(h); }
  return true;
}

// swap a bench hero into an active squad slot
export function swapHero(state, benchIndex, squadIndex) {
  if (!state.bench || !state.bench[benchIndex]) return false;
  if (squadIndex < 0 || squadIndex >= state.heroes.length) return false;
  const b = state.bench[benchIndex];
  state.bench[benchIndex] = state.heroes[squadIndex];
  state.heroes[squadIndex] = b;
  return true;
}

export function renameHero(state, list, idx, name) {
  const arr = list === "bench" ? state.bench : state.heroes;
  if (!arr || !arr[idx]) return false;
  const clean = (name || "").trim().slice(0, 18);
  arr[idx].name = clean || C.HERO_CLASSES[arr[idx].cls].name;
  return true;
}
export function retireHero(state, benchIdx) {
  if (!state.bench || !state.bench[benchIdx]) return false;
  state.bench.splice(benchIdx, 1);
  return true;
}

export function castlePower(state) {
  let cp = 0;
  for (const h of state.heroes) cp += h.level;
  for (const t of state.towers) if (t) cp += t.level;
  return cp;
}

export function deployedTowers(state) { return state.towers.filter(Boolean); }
export function slotCap(state) { return C.slotCapacity(castlePower(state)); }

// ---- economy ----
export function canAfford(state, cost) {
  return (state.gold >= (cost.gold || 0)) && (state.stone >= (cost.stone || 0)) && (state.food >= (cost.food || 0));
}
export function spend(state, cost) {
  state.gold -= (cost.gold || 0); state.stone -= (cost.stone || 0); state.food -= (cost.food || 0);
}

// continuous production: returns delta resources for dt seconds
export function recoverOverTime(state, dtSeconds) {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
  const hours = dtSeconds / 3600;

  // Morale recovers while the castle is resting. This is deliberately separate
  // from the morale multiplier so recovery itself never creates a runaway loop.
  state.morale = Math.min(100, state.morale + C.RECOVERY.moralePerHour * hours);

  // Wounded heroes recover over time, but defeated heroes remain defeated until
  // the player explicitly revives them. This preserves a meaningful prep decision.
  const hpFrac = (C.RECOVERY.heroHpPercentPerHour / 100) * hours;
  for (const h of state.heroes || []) {
    const maxHp = heroDerived(h).maxHp;
    if (h.hp > 0 && h.hp < maxHp) h.hp = Math.min(maxHp, h.hp + maxHp * hpFrac);
  }
  for (const h of state.bench || []) {
    const maxHp = heroDerived(h).maxHp;
    if (h.hp > 0 && h.hp < maxHp) h.hp = Math.min(maxHp, h.hp + maxHp * hpFrac);
  }
}

export function produce(state, dtSeconds) {
  recoverOverTime(state, dtSeconds);
  const moraleMul = C.moraleMultiplier(state.morale / 100);
  const castleEff = C.castleEfficiency(state.castleHp / state.castleMaxHp);
  const mul = moraleMul * castleEff * (dtSeconds / 60);
  state.gold += C.workforceOutput(C.PRODUCTION.goldPerWorkerMin, state.workersGold) * mul;
  state.stone += C.workforceOutput(C.PRODUCTION.stonePerWorkerMin, state.workersStone) * mul;
  state.food += C.workforceOutput(C.PRODUCTION.foodPerFarmerMin, state.farmers) * mul;
}

export function productionRates(state) {
  const moraleMul = C.moraleMultiplier(state.morale / 100);
  const castleEff = C.castleEfficiency(state.castleHp / state.castleMaxHp);
  const mul = moraleMul * castleEff;
  return {
    gold: C.workforceOutput(C.PRODUCTION.goldPerWorkerMin, state.workersGold) * mul,
    stone: C.workforceOutput(C.PRODUCTION.stonePerWorkerMin, state.workersStone) * mul,
    food: C.workforceOutput(C.PRODUCTION.foodPerFarmerMin, state.farmers) * mul,
    moraleMul, castleEff,
  };
}

// ---- workforce ----
export function buyFarmer(state) {
  const cost = C.farmerCost(state.farmers);
  if (state.gold < cost) return false;
  state.gold -= cost; state.farmers += 1; return true;
}
export function buyWorker(state, allocateTo) {
  const cost = C.workerCost(state.workers);
  if (state.gold < cost) return false;
  state.gold -= cost; state.workers += 1;
  if (allocateTo === "stone") state.workersStone += 1; else state.workersGold += 1;
  return true;
}

// ---- towers (free placement anywhere on the field, up to slot capacity) ----
export function buildTower(state, type, x, y) {
  const cost = C.TOWERS[type].construction;
  if (!canAfford(state, cost)) return false;
  if (state.towers.length >= slotCap(state)) return false;
  spend(state, cost);
  state.towers.push(createTower(type, x, y));
  return true;
}
export function repositionTower(state, index, x, y) {
  const t = state.towers[index];
  if (!t) return false;
  t.x = x; t.y = y; return true;
}
export function dismantleTower(state, index) {
  const tw = state.towers[index];
  if (!tw) return false;
  const cost = C.TOWERS[tw.type].construction;
  state.gold += Math.floor(cost.gold * 0.3);
  state.stone += Math.floor(cost.stone * 0.3);
  state.towers.splice(index, 1);
  return true;
}
export function addTowerXp(tower, xp) {
  tower.xp += xp;
  const nl = C.towerLevelForXp(tower.xp);
  while (tower.level + (tower.pending || 0) < nl) tower.pending = (tower.pending || 0) + 1;
}
export function upgradeTower(state, slot) {
  const tw = state.towers[slot];
  if (!tw || !(tw.pending > 0)) return false;
  const cost = C.towerUpgradeCost(tw);
  if (state.gold < cost.gold || state.stone < cost.stone) return false;
  state.gold -= cost.gold; state.stone -= cost.stone;
  tw.pending -= 1; tw.level += 1;
  tw.choices = [...(tw.choices || []), `Lv${tw.level}`];
  const d = towerDerived(tw);
  tw.maxHp = d.maxHp; tw.hp = Math.min(d.maxHp, tw.hp + Math.round(d.maxHp * 0.10));
  if (d.resourceKind === "ammo") { tw.maxAmmo = d.maxAmmo; tw.ammo = d.maxAmmo; }
  else { tw.maxMana = d.maxMana; tw.mana = d.maxMana; }
  return true;
}
export function repairTower(state, slot) {
  const tw = state.towers[slot];
  if (!tw) return false;
  const d = towerDerived(tw);
  const missing = d.maxHp - tw.hp;
  if (missing <= 0) return false;
  const cost = C.repairFoodCost(missing);
  if (state.food < cost) return false;
  state.food -= cost; tw.hp = d.maxHp; return true;
}
export function resupplyTower(state, slot) {
  const tw = state.towers[slot];
  if (!tw) return false;
  const d = towerDerived(tw), r = C.TOWER_RESOURCE[tw.type];
  const current = r.kind === "ammo" ? (tw.ammo || 0) : (tw.mana || 0);
  const max = r.kind === "ammo" ? d.maxAmmo : d.maxMana;
  const missing = Math.max(0, max - current);
  if (missing <= 0) return false;
  const gold = Math.ceil(missing * r.resupplyGold);
  const stone = Math.ceil(missing * r.resupplyStone);
  if (state.gold < gold || state.stone < stone) return false;
  state.gold -= gold; state.stone -= stone;
  if (r.kind === "ammo") tw.ammo = max; else tw.mana = max;
  return true;
}
// charged at wave start
export function chargeUpkeep(state) {
  for (const tw of state.towers) {
    if (!tw) continue;
    const up = C.TOWERS[tw.type].upkeep;
    const scale = 1 + Math.max(0, (tw.level || 1) - 1) * 0.15;
    const gold = Math.ceil(up.gold * scale), stone = Math.ceil(up.stone * scale);
    if (state.gold >= gold && state.stone >= stone) {
      state.gold -= gold; state.stone -= stone; tw.underfunded = false;
    } else tw.underfunded = true;
  }
}

// ---- barricades ----
export function buyBarricade(state, pos, goldAmt) {
  goldAmt = Math.max(C.BARRICADE.minGold, Math.min(C.BARRICADE.maxGold, goldAmt));
  if (state.gold < goldAmt) return false;
  const addHp = goldAmt * C.BARRICADE.goldToHp;
  const b = state.barricades[pos];
  if (b.maxHp + addHp > C.BARRICADE.maxHp) return false;
  state.gold -= goldAmt; b.maxHp += addHp; b.hp += addHp;
  return true;
}
export function repairBarricade(state, pos) {
  const b = state.barricades[pos];
  const missing = b.maxHp - b.hp;
  if (missing <= 0) return false;
  const cost = C.repairFoodCost(missing);
  if (state.food < cost) return false;
  state.food -= cost; b.hp = b.maxHp; return true;
}

// ---- hero progression ----
export function addHeroXp(hero, xp) {
  hero.xp += xp;
  const newLvl = C.heroLevelForXp(hero.xp);
  while (hero.level < newLvl) { hero.level += 1; hero.sp += 1; hero.ap += 1; }
}
export function allocateSp(hero, stat) {
  if (hero.sp <= 0) return false;
  hero.sp -= 1; hero.stats[stat] += 1;
  return true;
}
export function buyPerk(hero, perk, tier = 1) {
  const cost = C.AP_COST[tier];
  if (hero.ap < cost || hero.perks.includes(perk)) return false;
  hero.ap -= cost; hero.perks.push(perk); return true;
}

// ---- recovery / morale ----
export function addMorale(state, delta) {
  state.morale = Math.max(0, Math.min(100, state.morale + delta));
}

export function healHero(state, hero) {
  if (!hero || hero.hp <= 0) return false;
  const maxHp = heroDerived(hero).maxHp;
  const missing = maxHp - hero.hp;
  if (missing <= 0) return false;
  const cost = Math.ceil(missing / 10) * C.HERO_HEAL_FOOD_PER_10HP;
  if (state.food < cost) return false;
  state.food -= cost;
  hero.hp = maxHp;
  return true;
}

export function reviveHero(state, hero) {
  if (!hero || hero.hp > 0) return false;
  const cost = C.paidRevivalCost(hero.level);
  if (state.gold < cost) return false;
  const maxHp = heroDerived(hero).maxHp;
  state.gold -= cost;
  hero.hp = Math.max(1, Math.round(maxHp * (C.RECOVERY.reviveHpPercent / 100)));
  return true;
}

export function recoverAllWounded(state) {
  recoverOverTime(state, 3600);
}

// ---- castle repair (prep) ----
export function repairCastle(state) {
  const missing = state.castleMaxHp - state.castleHp;
  if (missing <= 0) return false;
  const cost = C.repairFoodCost(missing);
  if (state.food < cost) return false;
  state.food -= cost; state.castleHp = state.castleMaxHp; return true;
}

// ---- wave composition ----
export function buildWave(state, seedRand = Math.random) {
  const cp = castlePower(state);
  const count = state.wave <= 3
    ? C.earlyWaveEnemyCount(state.wave, cp)
    : Math.max(6, C.targetEnemyCount(state.wave, cp));
  const earlyScale = C.earlyWaveCombatScale(state.wave);
  const hpS = C.enemyHpScale(state.wave, cp) * earlyScale;
  const dmgS = C.enemyDmgScale(state.wave, cp) * earlyScale;
  const groups = Math.min(5, Math.max(2, 2 + Math.floor(state.wave / 3)));
  const weights = C.GROUP_WEIGHTS.slice(0, groups);
  const wsum = weights.reduce((a, b) => a + b, 0);
  // Fresh-player opening: W1 is basic-only; specialists are introduced
  // gradually instead of arriving at full pressure immediately.
  const specCap = state.wave === 1
    ? 0
    : state.wave === 2
      ? 0.10
      : state.wave === 3
        ? 0.15
        : state.wave <= 5
          ? 0.20
          : Math.min(0.5, 0.2 + cp * 0.01);
  const objectives = ["castle", "towers", "resources", "castle", "squad"];

  const enemies = [];
  let idCounter = 0;
  const bossWave = state.wave % 5 === 0;

  for (let g = 0; g < groups; g++) {
    const gCount = Math.max(1, Math.round(count * (weights[g] / wsum)));
    const objective = objectives[g % objectives.length];
    for (let i = 0; i < gCount; i++) {
      const earlyPool = C.EARLY_WAVE_POOLS[state.wave];
      const pool = earlyPool || (seedRand() < specCap ? C.SPEC_POOL : C.BASIC_POOL);
      const poolKey = pool[Math.floor(seedRand() * pool.length)];
      const base = C.ENEMIES[poolKey];
      enemies.push(makeEnemy(idCounter++, base, hpS, dmgS, g, objective));
    }
  }
  // Introduce the first lieutenant after the three-wave onboarding
  // window; W1-W3 remain focused on learning the basic combat loop.
  if (state.wave >= 4) {
    const elites = 1 + Math.floor(state.wave / 5);
    for (let i = 0; i < elites; i++)
      enemies.push(makeEnemy(idCounter++, C.ENEMIES.lieutenant, hpS, dmgS, 0, "squad"));
  }
  if (bossWave) {
    const bossCycle = ["demon", "imperialNecromancer", "nuclearBehemoth"];
    const bossKey = bossCycle[(Math.floor(state.wave / 5) - 1) % bossCycle.length];
    enemies.push(makeEnemy(idCounter++, C.ENEMIES[bossKey], hpS, dmgS, 0, "castle"));
  }

  return { enemies, total: enemies.length, groups, hasBoss: bossWave };
}

function makeEnemy(id, base, hpS, dmgS, group, objective) {
  const maxHp = Math.round(base.hp * hpS);
  return {
    id, type: base.key, name: base.name, tier: base.tier,
    hp: maxHp, maxHp, speed: base.speed, damage: base.damage * dmgS,
    color: base.color, floats: !!base.floats, magicImmune: !!base.magicImmune,
    boss: !!base.boss, group, objective,
    affinities: { ...(base.affinities || {}) },
  };
}

// single enemy for debug spawning, scaled to current wave/CP
export function makeSingleEnemy(state, typeKey) {
  const cp = castlePower(state);
  const base = C.ENEMIES[typeKey] || C.ENEMIES.ghost;
  return makeEnemy(Date.now() + Math.random(), base, C.enemyHpScale(state.wave, cp), C.enemyDmgScale(state.wave, cp), 0, "castle");
}

// ---- wave results & failure ----
export function freeLife(state) {
  state.gold = Math.floor(state.gold * C.FREE_LIFE.keepResourceFrac);
  state.food = Math.floor(state.food * C.FREE_LIFE.keepResourceFrac);
  state.stone = Math.floor(state.stone * C.FREE_LIFE.keepResourceFrac);
  for (const h of state.heroes) { const d = heroDerived(h); h.hp = d.maxHp; }
  for (const t of state.towers) if (t) {
    const d = towerDerived(t);
    t.hp = d.maxHp;
    if (d.resourceKind === "ammo") { t.maxAmmo = d.maxAmmo; t.ammo = d.maxAmmo; }
    else { t.maxMana = d.maxMana; t.mana = d.maxMana; }
  }
  state.castleHp = state.castleMaxHp;
  state.morale = C.FREE_LIFE.moraleReset;
  state.freeLifeUsed = true;
}

export function surrender(state) {
  state.surrenderTaxRate = C.surrenderTaxRate(state.wave);
  state.surrenderDebtWave = state.wave;
  addMorale(state, C.MORALE.surrender);
}

export function completeWave(state) {
  state.highestWaveCleared = Math.max(state.highestWaveCleared, state.wave);
  state.castleMaxHp = C.castleMaxHp(state.highestWaveCleared);
  addMorale(state, C.MORALE.waveComplete);
  state.bests.highestWave = Math.max(state.bests.highestWave, state.highestWaveCleared);
  if (state.surrenderDebtWave && state.wave >= state.surrenderDebtWave) {
    state.surrenderTaxRate = 0; state.surrenderDebtWave = 0;
  }
  state.wave += 1;
}


export function reconcileEquipmentHp(state, hero) {
  if (!hero) return;
  const d = heroDerived(hero);
  if (hero.hp > 0) hero.hp = Math.min(hero.hp, d.maxHp);
  hero.maxHp = d.maxHp;
}

export function equipHeroItem(state, heroIndex, itemId, targetSlot = null) {
  const hero = state.heroes?.[heroIndex];
  if (!hero) return false;
  if (!equipStoredItem(state, heroIndex, itemId, targetSlot)) return false;
  const afterMax = heroDerived(hero).maxHp;

  // Equipment changes modify the hero's maximum HP, but do not heal them.
  // Preserve current HP and only clamp it if the new maximum is lower.
  if (hero.hp > 0) hero.hp = Math.min(hero.hp, afterMax);
  hero.maxHp = afterMax;
  return true;
}

export function unequipHeroItem(state, heroIndex, slot) {
  const hero = state.heroes?.[heroIndex];
  if (!hero) return false;
  if (!unequipStoredItem(state, heroIndex, slot)) return false;
  reconcileEquipmentHp(state, hero);
  return true;
}
