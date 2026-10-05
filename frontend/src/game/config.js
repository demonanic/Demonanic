// Demonanic — v139 numerical baseline (data-driven config).
// The AUTHORITATIVE implementation reference. Tune here, not in UI code.
// OPEN placeholders are marked; smallest reversible values used.

export const TIME = {
  scoutCountdown: 5,        // s, pre-wave scout phase (LOCKED)
  tacticalSlowdown: 10,     // s, card-open slowdown (LOCKED)
  slowdownFactor: 0.2,      // gameplay speed during slowdown
  offlineCapHours: 12,      // LOCKED baseline
};

// Section B — starting economy & workforce
export const STARTING = {
  gold: 500, food: 300, stone: 150,
  farmers: 2, workers: 2, workersGold: 1, workersStone: 1,
};
export const PRODUCTION = {
  goldPerWorkerMin: 8, stonePerWorkerMin: 3, foodPerFarmerMin: 10,
};

export function workforceOutput(baseRate, n) {
  if (n <= 0) return 0;
  return baseRate * n * (1 + 0.05 * (n - 1)); // per minute
}
export function moraleMultiplier(moraleFrac) {
  return Math.max(0.5, Math.min(1.25, 0.5 + 0.75 * moraleFrac));
}
export function castleEfficiency(hpFrac) {
  return Math.max(0.4, 1 - 0.6 * (1 - hpFrac));
}

// Section C — workforce purchase curves
export function farmerCost(owned) { return Math.ceil(50 * Math.pow(1.18, owned)); }
export function workerCost(owned) { return Math.ceil(75 * Math.pow(1.20, owned)); }

// Section E — combat damage affinities and towers
export const DAMAGE_TYPES = {
  KNIGHT_MELEE: "knight_melee",
  ROUGE_MELEE: "rouge_melee",
  ARCHER_RANGED: "archer_ranged",
  ARCANE: "arcane",
  FIRE: "fire",
  LIGHTNING: "lightning",
  FROST: "frost",
  DARK_SOUL: "dark_soul",
};

export const AFFINITY_MULTIPLIERS = {
  susceptible: 1.25,
  normal: 1,
  tolerant: 0.6,
  resistant: 0.3,
  immune: 0,
};

export function affinityMultiplier(target, damageType) {
  return AFFINITY_MULTIPLIERS[target?.affinities?.[damageType] || "normal"] ?? 1;
}

const NORMAL_AFFINITIES = {
  [DAMAGE_TYPES.KNIGHT_MELEE]: "normal",
  [DAMAGE_TYPES.ROUGE_MELEE]: "normal",
  [DAMAGE_TYPES.ARCHER_RANGED]: "normal",
  [DAMAGE_TYPES.ARCANE]: "normal",
  [DAMAGE_TYPES.FIRE]: "normal",
  [DAMAGE_TYPES.LIGHTNING]: "normal",
  [DAMAGE_TYPES.FROST]: "normal",
  [DAMAGE_TYPES.DARK_SOUL]: "normal",
};

export const BOSS_AFFINITIES = {
  threeHeadedDemon: {
    ...NORMAL_AFFINITIES,
    [DAMAGE_TYPES.ARCANE]: "tolerant",
    [DAMAGE_TYPES.FIRE]: "resistant",
    [DAMAGE_TYPES.DARK_SOUL]: "tolerant",
  },
  imperialNecromancer: {
    ...NORMAL_AFFINITIES,
    [DAMAGE_TYPES.KNIGHT_MELEE]: "susceptible",
    [DAMAGE_TYPES.ARCANE]: "tolerant",
    [DAMAGE_TYPES.LIGHTNING]: "tolerant",
    [DAMAGE_TYPES.FROST]: "tolerant",
    [DAMAGE_TYPES.DARK_SOUL]: "resistant",
  },
  nuclearBehemoth: {
    ...NORMAL_AFFINITIES,
    [DAMAGE_TYPES.ARCHER_RANGED]: "susceptible",
    [DAMAGE_TYPES.ARCANE]: "resistant",
    [DAMAGE_TYPES.LIGHTNING]: "resistant",
    [DAMAGE_TYPES.FROST]: "resistant",
    [DAMAGE_TYPES.DARK_SOUL]: "resistant",
  },
};

export const TOWERS = {
  archer:   { key: "archer",   name: "Archer Tower", icon: "bow",
    construction: { gold: 100, stone: 20, food: 20 }, upkeep: { gold: 8, stone: 2 },
    role: "sustained_single_target", targetPriority: "nearest", damageType: DAMAGE_TYPES.ARCHER_RANGED, baseHp: 500, range: 260, fireRate: 0.9, damage: 22, spyBonus: 5, color: "#39FF14" },
  catapult: { key: "catapult", name: "Catapult", icon: "axe",
    construction: { gold: 150, stone: 35, food: 30 }, upkeep: { gold: 12, stone: 3 },
    role: "group_control", targetPriority: "cluster", damageType: DAMAGE_TYPES.KNIGHT_MELEE, baseHp: 650, range: 320, fireRate: 2.2, damage: 70, splash: 55, spyBonus: 0, color: "#FF6600" },
  wizard:   { key: "wizard",   name: "Wizard Tower", icon: "sun",
    construction: { gold: 175, stone: 30, food: 35 }, upkeep: { gold: 14, stone: 3 },
    role: "magic", targetPriority: "vulnerable", damageType: DAMAGE_TYPES.ARCANE, baseHp: 575, range: 240, fireRate: 1.4, damage: 40, magic: true, spyBonus: 10, color: "#A855F7" },
  ballista: { key: "ballista", name: "Ballista / Tower 4", icon: "gear",
    construction: { gold: 225, stone: 50, food: 40 }, upkeep: { gold: 18, stone: 5 },
    role: "elite_boss_hunter", targetPriority: "elite_boss", damageType: DAMAGE_TYPES.ARCHER_RANGED, baseHp: 700, range: 380, fireRate: 1.7, damage: 95, spyBonus: 0, color: "#00F3FF" },
};
export const TOWER_ORDER = ["archer", "catapult", "wizard", "ballista"];

// underfunded state penalties
export const UNDERFUNDED = { damageMult: 0.65, fireRateMult: 1.25, hpLossPerMin: 0.04 };

// Towers gain XP from kills and level up (player picks stat vs ability on level-up).
export function towerLevelForXp(xp) {
  let lvl = 1;
  while (lvl < 30 && xp >= 150 * lvl * (lvl + 1) / 2) lvl++;
  return lvl;
}
export const TOWER_UPGRADE_CHOICES = {
  stat: { key: "stat", label: "+Combat Stat", desc: "+12% damage & HP this level." },
  ability: { key: "ability", label: "Ability Unlock", desc: "Unlock/boost tower ability." },
};

// Repair: 1 Food per 10 missing HP
export const REPAIR_FOOD_PER_10HP = 1;
export function repairFoodCost(missingHp) { return Math.ceil(missingHp / 10); }

// Section F — tower slot progression (CP thresholds)
export const SLOT_THRESHOLDS = [0, 8, 15, 24, 36]; // slot 1..5
export function slotCapacity(cp) {
  let cap = 1;
  for (let i = 1; i < SLOT_THRESHOLDS.length; i++) if (cp >= SLOT_THRESHOLDS[i]) cap = i + 1;
  return cap;
}

// Section G — barricades (5 positions)
export const BARRICADE = {
  positions: 5, goldToHp: 2, minGold: 25, maxGold: 500, maxHp: 1000,
  collisionDamage: 8, // OPEN: collision damage/sec placeholder
};

// Section H — hero progression
export const HERO_XP = [0,150,360,650,1030,1500,2070,2760,3550,4450,5450,6600,7900,9350,10950,12700,14600,16700,19050,21600];
export function heroLevelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < HERO_XP.length; i++) if (xp >= HERO_XP[i]) lvl = i + 1;
  return lvl;
}
export const AP_COST = { 1: 1, 2: 2, 3: 3 };

export const HERO_CLASSES = {
  knight: { key: "knight", name: "Knight", role: "Offensive Heavy", color: "#00F3FF",
    mods: { defense: 3 }, baseHp: 320, attackRange: 70, attackRate: 1.1,
    ability: { name: "Shield Bash", desc: "Stuns and deals bonus melee damage." },
    perks: ["Bulwark (+DEF)", "Cleave (hit 2 targets)", "Iron Wall (+15% max HP)"] },
  rouge: { key: "rouge", name: "Rouge", role: "Blitz", color: "#39FF14",
    mods: { agility: 3 }, baseHp: 240, attackRange: 90, attackRate: 0.5,
    ability: { name: "Blitz Strike", desc: "Rapid multi-hit on nearest enemy." },
    perks: ["Flurry (+atk speed)", "Backstab (+crit)", "Evasion (+dodge)"] },
  mage: { key: "mage", name: "Mage", role: "Configurable Spell", color: "#A855F7",
    mods: { intelligence: 3 }, baseHp: 210, attackRange: 300, attackRate: 1.6, magic: true,
    ability: { name: "Arcane Bolt", desc: "Magic damage; configurable to heal/buff." },
    perks: ["Firestorm (AoE)", "Mend (heal squad)", "Barrier (shield)"] },
  archer: { key: "archer", name: "Archer", role: "Sniper / Targeting", color: "#FFE600",
    mods: { attack: 3 }, baseHp: 230, attackRange: 340, attackRate: 1.0,
    ability: { name: "Piercing Shot", desc: "Long-range shot; can snipe a type." },
    perks: ["Eagle Eye (+range)", "Rapid Draw (+atk speed)", "Focus Fire (+dmg vs low HP)"] },
};
export const HERO_ORDER = ["knight", "rouge", "mage", "archer"];
// OPEN: recruitment pricing placeholder. Exponential from the 4-hero baseline.
export function recruitCost(ownedHeroes) {
  const over = Math.max(0, ownedHeroes - 3);
  return Math.ceil(200 * Math.pow(1.6, over - 1));
}
export const BASE_STATS = { attack: 10, defense: 10, agility: 10, intelligence: 10 };
export const ATTACK_CONFIGS = {
  knight: ["Offensive Heavy", "Defensive Guard"],
  rouge: ["Blitz Nearest", "Assassinate Weakest"],
  mage: ["Offensive Spells", "Support / Heal", "Defensive Barrier"],
  archer: ["Sniper (strongest)", "Closest Enemy"],
};
export const EQUIP_SLOTS = ["Helm", "Armor", "Weapon", "Cloak", "Ring"];

// Section I — combat math
export function damageAfterDefense(raw, def) { return raw * 100 / (100 + def); }
export const CRIT_MULT = 1.75;
export const BASE_CRIT = 0.05;
export function dodgeChance(agi) { return Math.max(0, Math.min(0.35, 0.005 * agi)); }
export const REVIVE_PROTECT_S = 5;

// Section J — morale
export const MORALE = {
  base: 50, freeLifeReset: 20,
  waveComplete: 3, heroKill: 2, specialistKill: 1, eliteKill: 3, bossKill: 10,
  heroDefeat: -12, towerDestroyed: -8, surrender: -25,
  castleLossPerPct: -0.5,
};
export function healRateMultiplier(moraleFrac) {
  return Math.min(1.25, 0.5 + 0.75 * moraleFrac);
}

// Section K — castle
export function castleMaxHp(highestWaveCleared) { return 1000 + 50 * highestWaveCleared; }

// Section L — enemy XP & rewards
export const ENEMY_TIERS = {
  basic:       { xp: 10, gold: 4 },
  specialized: { xp: 20, gold: 7 },
  elite:       { xp: 60, gold: 20 },
  boss:        { xp: 600, gold: 150 },
};

// Section M — wave scaling
export function targetEnemyCount(wave, cp) { return Math.round(12 + 2.5 * wave + 0.75 * cp); }
export function enemyHpScale(wave, cp) { return 1 + 0.045 * (wave - 1) + 0.02 * cp; }
export function enemyDmgScale(wave, cp) { return 1 + 0.035 * (wave - 1) + 0.015 * cp; }
export const GROUP_WEIGHTS = [0.25, 0.20, 0.20, 0.15, 0.20];

// Enemy archetypes (base stats; scaled at spawn). Neon roster from reference art.
export const ENEMIES = {
  ghost:    { key: "ghost", name: "Ghost", tier: "basic", hp: 40, speed: 34, damage: 6, color: "#FF007F", floats: true, affinities: { [DAMAGE_TYPES.DARK_SOUL]: "tolerant" } },
  slime:    { key: "slime", name: "Slime", tier: "basic", hp: 55, speed: 22, damage: 8, color: "#39FF14", magicImmune: true, affinities: { [DAMAGE_TYPES.ARCANE]: "immune", [DAMAGE_TYPES.LIGHTNING]: "resistant", [DAMAGE_TYPES.DARK_SOUL]: "resistant" } },
  goblin:   { key: "goblin",   name: "Goblin",   tier: "basic",       hp: 45,  speed: 40, damage: 7,  color: "#FFE600" },
  skeleton: { key: "skeleton", name: "Skeleton", tier: "specialized", hp: 70,  speed: 30, damage: 12, color: "#E2E8F0" },
  orc:      { key: "orc", name: "Orc", tier: "specialized", hp: 120, speed: 24, damage: 18, color: "#FF6600", affinities: { [DAMAGE_TYPES.ARCHER_RANGED]: "tolerant", [DAMAGE_TYPES.FROST]: "susceptible" } },
  reaper:   { key: "reaper", name: "Reaper", tier: "specialized", hp: 90, speed: 32, damage: 15, color: "#A855F7", floats: true, affinities: { [DAMAGE_TYPES.KNIGHT_MELEE]: "tolerant", [DAMAGE_TYPES.ARCHER_RANGED]: "tolerant", [DAMAGE_TYPES.DARK_SOUL]: "resistant" } },
  lieutenant:{ key: "lieutenant", name: "Lieutenant", tier: "elite",  hp: 300, speed: 26, damage: 30, color: "#FF3366" },
  demon: { key: "demon", name: "Three-Headed Demon", tier: "boss", hp: 2600, speed: 20, damage: 55, color: "#FF0055", boss: true, attackFx: "napalm", attackRange: 420, splashRadius: 68, affinities: BOSS_AFFINITIES.threeHeadedDemon },
imperialNecromancer: { key: "imperialNecromancer", name: "Imperial Necromancer", tier: "boss", hp: 3000, speed: 18, damage: 48, color: "#8B5CF6", boss: true, affinities: BOSS_AFFINITIES.imperialNecromancer },
nuclearBehemoth: { key: "nuclearBehemoth", name: "Nuclear Behemoth", tier: "boss", hp: 3400, speed: 16, damage: 60, color: "#84CC16", boss: true, affinities: BOSS_AFFINITIES.nuclearBehemoth },
};
export const BASIC_POOL = ["ghost", "slime", "goblin"];
export const SPEC_POOL = ["skeleton", "orc", "reaper"];

// Section O — surrender / revival
export function surrenderTaxRate(wave) { return Math.min(0.25, 0.05 + 0.02 * Math.floor(wave / 5)); }
export function paidRevivalCost(heroLevel) { return Math.min(2000, 100 * heroLevel); }
export const FREE_LIFE = { keepResourceFrac: 0.30, moraleReset: 20 };

// Scout knowledge (Section N)
export const SCOUT = { successAdd: 20, decayPerWave: 0.15, towerSpyBase: 0.15, cancelFrac: 0.5, maxCancel: 0.75 };

export const CP_NOTE = "CP = sum(hero levels) + sum(deployed tower levels).";
