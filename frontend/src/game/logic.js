// Pure game-state logic. No React, no rendering. Data-driven from config.js.
import * as C from "./config";

export function createHero(classKey) {
  const cls = C.HERO_CLASSES[classKey];
  const stats = { ...C.BASE_STATS };
  for (const k in cls.mods) stats[k] += cls.mods[k];
  const maxHp = heroMaxHp(cls, 1, stats);
  return {
    key: classKey, name: cls.name, cls: classKey,
    level: 1, xp: 0, sp: 0, ap: 0,
    stats, perks: [], attackConfig: C.ATTACK_CONFIGS[classKey][0],
    equipment: {}, hp: maxHp, maxHp,
  };
}

export function heroMaxHp(cls, level, stats) {
  return Math.round(cls.baseHp + (level - 1) * 28 + stats.defense * 3);
}

export function heroDerived(hero) {
  const cls = C.HERO_CLASSES[hero.cls];
  const maxHp = heroMaxHp(cls, hero.level, hero.stats);
  return {
    maxHp,
    attack: hero.stats.attack + (hero.cls === "archer" ? hero.level * 2 : hero.level),
    range: cls.attackRange, rate: cls.attackRate, magic: !!cls.magic,
    critDmgBonus: Math.floor(hero.stats.attack / 10) * 0.01,
    dodge: C.dodgeChance(hero.stats.agility),
    healPower: 1 + hero.stats.intelligence / 100,
    color: cls.color,
  };
}

export function createTower(type, slot) {
  const t = C.TOWERS[type];
  return {
    slot, type, level: 1, xp: 0, hp: t.baseHp, maxHp: t.baseHp,
    choices: [], pending: 0, underfunded: false,
  };
}

export function towerDerived(tower) {
  const t = C.TOWERS[tower.type];
  const lvlMul = 1 + (tower.level - 1) * 0.12;
  let dmg = t.damage * lvlMul;
  let rate = t.fireRate;
  if (tower.underfunded) { dmg *= C.UNDERFUNDED.damageMult; rate *= C.UNDERFUNDED.fireRateMult; }
  return {
    ...t, damage: dmg, fireRate: rate,
    maxHp: Math.round(t.baseHp * (1 + (tower.level - 1) * 0.08)),
  };
}

export function createNewState() {
  const heroes = C.HERO_ORDER.map(createHero);
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
    heroes,
    towers: Array.from({ length: 5 }, () => null),
    barricades,
    scoutKnowledge: 0,
    kills: { total: 0, byType: {} },
    bests: { highestWave: 0, totalKills: 0 },
    lastSeen: new Date().toISOString(),
  };
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
export function produce(state, dtSeconds) {
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

// ---- towers ----
export function buildTower(state, type, slot) {
  const cost = C.TOWERS[type].construction;
  if (!canAfford(state, cost)) return false;
  if (slot >= slotCap(state)) return false;
  if (state.towers[slot]) return false;
  spend(state, cost);
  state.towers[slot] = createTower(type, slot);
  return true;
}
export function dismantleTower(state, slot) {
  const tw = state.towers[slot];
  if (!tw) return false;
  // refund 30% of construction gold/stone
  const cost = C.TOWERS[tw.type].construction;
  state.gold += Math.floor(cost.gold * 0.3);
  state.stone += Math.floor(cost.stone * 0.3);
  state.towers[slot] = null;
  return true;
}
export function addTowerXp(tower, xp) {
  tower.xp += xp;
  const nl = C.towerLevelForXp(tower.xp);
  while (tower.level < nl) { tower.level += 1; tower.pending = (tower.pending || 0) + 1; }
  tower.maxHp = towerDerived(tower).maxHp;
}
export function applyTowerUpgrade(state, slot, choice) {
  const tw = state.towers[slot];
  if (!tw || !(tw.pending > 0)) return false;
  tw.pending -= 1; tw.choices.push(choice);
  tw.maxHp = towerDerived(tw).maxHp;
  return true;
}
export function repairTower(state, slot) {
  const tw = state.towers[slot];
  if (!tw) return false;
  const d = towerDerived(tw);
  const missing = d.maxHp - tw.hp;
  if (missing <= 0) return false;
  const cost = C.repairFoodCost(missing);
  if (state.food < cost) {
    const afford = Math.floor(state.food) * 10;
    if (afford <= 0) return false;
    state.food -= C.repairFoodCost(afford);
    tw.hp = Math.min(d.maxHp, tw.hp + afford);
    return true;
  }
  state.food -= cost; tw.hp = d.maxHp; return true;
}
// charged at wave start
export function chargeUpkeep(state) {
  for (const tw of state.towers) {
    if (!tw) continue;
    const up = C.TOWERS[tw.type].upkeep;
    if (state.gold >= up.gold && state.stone >= up.stone) {
      state.gold -= up.gold; state.stone -= up.stone; tw.underfunded = false;
    } else { tw.underfunded = true; }
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

// ---- morale ----
export function addMorale(state, delta) {
  state.morale = Math.max(0, Math.min(100, state.morale + delta));
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
  const count = Math.max(6, C.targetEnemyCount(state.wave, cp));
  const hpS = C.enemyHpScale(state.wave, cp);
  const dmgS = C.enemyDmgScale(state.wave, cp);
  const groups = Math.min(5, Math.max(2, 2 + Math.floor(state.wave / 3)));
  const weights = C.GROUP_WEIGHTS.slice(0, groups);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const specCap = state.wave <= 5 ? 0.2 : Math.min(0.5, 0.2 + cp * 0.01);
  const objectives = ["castle", "towers", "resources", "castle", "squad"];

  const enemies = [];
  let idCounter = 0;
  const bossWave = state.wave % 5 === 0;

  for (let g = 0; g < groups; g++) {
    const gCount = Math.max(1, Math.round(count * (weights[g] / wsum)));
    const objective = objectives[g % objectives.length];
    for (let i = 0; i < gCount; i++) {
      const isSpec = seedRand() < specCap;
      const poolKey = isSpec
        ? C.SPEC_POOL[Math.floor(seedRand() * C.SPEC_POOL.length)]
        : C.BASIC_POOL[Math.floor(seedRand() * C.BASIC_POOL.length)];
      const base = C.ENEMIES[poolKey];
      enemies.push(makeEnemy(idCounter++, base, hpS, dmgS, g, objective));
    }
  }
  // elites on every wave >=3
  if (state.wave >= 3) {
    const elites = 1 + Math.floor(state.wave / 5);
    for (let i = 0; i < elites; i++)
      enemies.push(makeEnemy(idCounter++, C.ENEMIES.lieutenant, hpS, dmgS, 0, "squad"));
  }
  if (bossWave) enemies.push(makeEnemy(idCounter++, C.ENEMIES.demon, hpS, dmgS, 0, "castle"));

  return { enemies, total: enemies.length, groups, hasBoss: bossWave };
}

function makeEnemy(id, base, hpS, dmgS, group, objective) {
  const maxHp = Math.round(base.hp * hpS);
  return {
    id, type: base.key, name: base.name, tier: base.tier,
    hp: maxHp, maxHp, speed: base.speed, damage: base.damage * dmgS,
    color: base.color, floats: !!base.floats, magicImmune: !!base.magicImmune,
    boss: !!base.boss, group, objective,
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
  for (const t of state.towers) if (t) t.hp = towerDerived(t).maxHp;
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
