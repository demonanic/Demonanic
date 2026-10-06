import * as C from './constants.js';
import { loadEquipment, aggregateGearStats } from './equipment.js';

const HERO_CLASS_ORDER = ['Knight', 'Rouge', 'Mage', 'Archer'];
const TOWER_TYPE_CYCLE = ['Archer', 'Catapult', 'Wizard', 'Ballista'];
const BALANCED_HERO_CP_FRACTION = 0.5;
const BALANCED_TOWER_COUNT_FN = (cap) => Math.max(1, Math.ceil(cap / 2));

export function slotCapacity(cp) {
  let cap = 1;
  for (let i = 1; i < C.SLOT_THRESHOLDS.length; i++)
    if (cp >= C.SLOT_THRESHOLDS[i]) cap = i + 1;
  return cap;
}

export function stateFamilyToLevels(cp, family) {
  if (!Number.isInteger(cp) || cp < C.HERO_COUNT * C.HERO_MIN_LEVEL)
    throw new Error(`cp ${cp} too low for ${C.HERO_COUNT} heroes at min level ${C.HERO_MIN_LEVEL}`);

  const cap = slotCapacity(cp);

  switch (family) {
    case 'hero-heavy': {
      const heroLevels = distributeEvenly(cp, C.HERO_COUNT);
      const towerLevels = [];
      assertCP(cp, heroLevels, towerLevels);
      assertTowerCap(cp, towerLevels);
      return { heroLevels, towerLevels };
    }
    case 'balanced': {
      const towerCount = BALANCED_TOWER_COUNT_FN(cap);
      const heroCP = Math.floor(cp * BALANCED_HERO_CP_FRACTION);
      const towerCP = cp - heroCP;
      const heroLevels = distributeEvenly(heroCP, C.HERO_COUNT);
      const towerLevels = distributeEvenly(towerCP, towerCount);
      assertCP(cp, heroLevels, towerLevels);
      assertTowerCap(cp, towerLevels);
      return { heroLevels, towerLevels };
    }
    case 'tower-heavy': {
      const towerCount = cap;
      const heroCP = C.HERO_COUNT * C.HERO_MIN_LEVEL;
      const towerCP = cp - heroCP;
      const heroLevels = new Array(C.HERO_COUNT).fill(C.HERO_MIN_LEVEL);
      const towerLevels = distributeEvenly(towerCP, towerCount);
      assertCP(cp, heroLevels, towerLevels);
      assertTowerCap(cp, towerLevels);
      return { heroLevels, towerLevels };
    }
    default:
      throw new Error(`unknown family: ${family}`);
  }
}

export function deterministicComposition(cp, family) {
  const { towerLevels } = stateFamilyToLevels(cp, family);
  return towerLevels.map((_, i) => TOWER_TYPE_CYCLE[i % TOWER_TYPE_CYCLE.length]);
}

export function constructPlayerState({ cp, family, equipmentScenario, towerComposition, spPolicy, rangedMode }) {
  const { heroLevels, towerLevels } = stateFamilyToLevels(cp, family);

  const heroes = heroLevels.map((level, i) => {
    const cls = HERO_CLASS_ORDER[i];
    const equipmentPackage = loadEquipment(equipmentScenario, cls);
    return buildHero(cls, level, spPolicy, equipmentPackage);
  });

  const towers = towerLevels.map((level, i) =>
    buildTower(towerComposition[i], level, i)
  );

  return {
    meta: { cp, family, equipmentScenario, rangedMode },
    heroes,
    towers,
  };
}

function buildHero(cls, level, spPolicy, equipmentPackage) {
  const base = C.HERO_BASE_STATS[cls];
  if (!base) throw new Error(`unknown hero class: ${cls}`);
  if (!Number.isInteger(level) || level < 1)
    throw new Error(`invalid hero level: ${level}`);

  const sp = allocateSP(cls, level, spPolicy);
  const gear = aggregateGearStats(equipmentPackage);

  const attack = base.attack + sp.attack + gear.attack;
  const defense = base.defense + sp.defense + gear.defense;
  const agility = base.agility + sp.agility + gear.agility;
  const intelligence = base.intelligence + sp.intelligence + gear.intelligence;
  const maxHP = deriveHP(cls, level, defense) + gear.maxHP;

  return {
    cls,
    level,
    base: { ...base },
    stats: { attack, defense, agility, intelligence },
    sp: {
      available: Math.max(0, level - 1),
      attack: sp.attack,
      defense: sp.defense,
      agility: sp.agility,
      intelligence: sp.intelligence,
    },
    gear: equipmentPackage ?? {},
    maxHP,
    hp: maxHP,
    attack: deriveAttack(cls, level, attack),
    range: C.HERO_CLASSES[cls].attackRange,
    rate: C.HERO_CLASSES[cls].attackRate,
    magic: !!C.HERO_CLASSES[cls].magic,
    equipmentCritChance: gear.critChance,
    equipmentCritDamage: gear.critDamage,
    equipmentMaxHP: gear.maxHP,
  };
}

function deriveHP(cls, level, defense) {
  return Math.round(C.HERO_BASE_HP[cls] + (level - 1) * 28 + defense * 3);
}

function deriveAttack(cls, level, attackStat) {
  return attackStat + (cls === 'Archer' ? level * 2 : level);
}

function allocateSP(cls, level, policy) {
  const available = Math.max(0, level - 1);
  const out = { attack: 0, defense: 0, agility: 0, intelligence: 0 };
  if (policy === 'neutral') return out;

  if (policy === 'offensive') {
    out[{ Knight:'attack', Rouge:'attack', Mage:'intelligence', Archer:'attack' }[cls]] = available;
    return out;
  }
  if (policy === 'defensive') {
    out[{ Knight:'defense', Rouge:'agility', Mage:'defense', Archer:'defense' }[cls]] = available;
    return out;
  }
  throw new Error(`unknown SP policy: ${policy}`);
}

function buildTower(type, level, slotIndex) {
  const key = type.toLowerCase();
  const base = C.TOWERS[key];
  const resource = C.TOWER_RESOURCE[key];
  if (!base) throw new Error(`unknown tower type: ${type}`);
  if (!resource) throw new Error(`missing tower resource: ${type}`);
  if (!Number.isInteger(level) || level < 1)
    throw new Error(`invalid tower level: ${level}`);

  const combatMul = Math.pow(1 + C.TOWER_UPGRADE.damageMult, level - 1);
  const hpMul = Math.pow(1 + C.TOWER_UPGRADE.hpMult, level - 1);
  const resourceMul = Math.pow(1 + C.TOWER_UPGRADE.resourceMult, level - 1);

  const maxHP = Math.round(base.baseHp * hpMul);
  const maxAmmo = resource.kind === 'ammo' ? Math.round(resource.max * resourceMul) : 0;
  const maxMana = resource.kind === 'mana' ? Math.round(resource.max * resourceMul) : 0;

  return {
    type: key,
    level,
    slotIndex,
    maxHP,
    hp: maxHP,
    damage: base.damage * combatMul,
    fireRate: base.fireRate,
    range: base.range,
    damageType: base.damageType,
    magic: !!base.magic,
    splash: base.splash ?? 0,
    resourceKind: resource.kind,
    resourceLabel: resource.label,
    shotCost: resource.shotCost,
    maxAmmo,
    ammo: maxAmmo,
    maxMana,
    mana: maxMana,
    underfunded: false,
  };
}

function distributeEvenly(total, count) {
  if (count <= 0) throw new Error(`count must be > 0 (got ${count})`);
  if (total < count) throw new Error(`cannot distribute ${total} across ${count} buckets (min 1 each)`);
  const base = Math.floor(total / count);
  const rem = total - base * count;
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = base + (i < rem ? 1 : 0);
  return out;
}

function assertCP(intended, heroLevels, towerLevels) {
  const sum = heroLevels.reduce((a, b) => a + b, 0) +
              towerLevels.reduce((a, b) => a + b, 0);
  if (sum !== intended)
    throw new Error(`CP mismatch: intended ${intended}, constructed ${sum}`);
}

function assertTowerCap(cp, towerLevels) {
  const cap = slotCapacity(cp);
  if (towerLevels.length > cap)
    throw new Error(`tower cap violated: cp ${cp} allows ${cap}, got ${towerLevels.length}`);
}
