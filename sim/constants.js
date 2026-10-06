// ============================================================
// Extracted engine constants.
// Values marked [VERIFY] are sourced from frontend/src/game/
// config.js / logic.js. Nothing here is new game design.
// ============================================================

export const SLOT_THRESHOLDS = [0, 8, 15, 24, 36];

export const HERO_BASE_HP = {
  Knight: 320,
  Rouge: 240,
  Mage: 210,
  Archer: 230,
};

export const HERO_BASE_STATS = {
  Knight: { attack: 10, defense: 13, agility: 10, intelligence: 10 },
  Rouge:  { attack: 10, defense: 10, agility: 13, intelligence: 10 },
  Mage:   { attack: 10, defense: 10, agility: 10, intelligence: 13 },
  Archer: { attack: 13, defense: 10, agility: 10, intelligence: 10 },
};

export const XP_THRESHOLDS = {
  1: 0, 2: 150, 3: 360, 4: 650, 5: 1030,
  6: 1500, 7: 2070, 8: 2760, 9: 3550, 10: 4450,
  11: 5450, 12: 6600, 13: 7900, 14: 9350, 15: 10950,
  16: 12700, 17: 14600, 18: 16700, 19: 19050, 20: 21600,
};

export const HERO_CLASSES = {
  Knight: { attackRange: 70,  attackRate: 1.1, magic: false },
  Rouge:  { attackRange: 90,  attackRate: 0.5, magic: false },
  Mage:   { attackRange: 300, attackRate: 1.6, magic: true },
  Archer: { attackRange: 340, attackRate: 1.0, magic: false },
};

export const ENEMY_SCALING = {
  hpMultiplier:     (wave, cp) => 1 + 0.05 * (wave - 1) + 0.02 * cp,
  damageMultiplier: (wave, cp) => 1 + 0.032 * (wave - 1) + 0.015 * cp,
  enemyCount:       (wave, cp) => Math.max(6, Math.round(12 + 2.5 * wave + 0.75 * cp)),
};

export const BOSS_BASE = {
  ThreeHeadedDemon:    { wave: 5, hp: 2800, damage: 55 },
  ImperialNecromancer: { wave: 10, hp: 3300, damage: 48 },
  NuclearBehemoth:     { wave: 15, hp: 3800, damage: 60 },
};

export const TOWERS = {
  archer:   { damage: 22, fireRate: 0.9, range: 260, baseHp: 500, damageType: 'archer_ranged', magic: false, splash: 0 },
  catapult: { damage: 70, fireRate: 2.2, range: 320, baseHp: 650, damageType: 'knight_melee', magic: false, splash: 55 },
  wizard:   { damage: 40, fireRate: 1.4, range: 240, baseHp: 575, damageType: 'arcane', magic: true, splash: 0 },
  ballista: { damage: 95, fireRate: 1.7, range: 380, baseHp: 700, damageType: 'archer_ranged', magic: false, splash: 0 },
};

export const TOWER_RESOURCE = {
  archer:   { kind: 'ammo', label: 'AMMO', max: 120, shotCost: 1 },
  catapult: { kind: 'ammo', label: 'AMMO', max: 30, shotCost: 3 },
  wizard:   { kind: 'mana', label: 'MANA', max: 100, shotCost: 8 },
  ballista: { kind: 'ammo', label: 'BOLTS', max: 40, shotCost: 2 },
};

export const TOWER_UPGRADE = {
  damageMult: 0.10,
  hpMult: 0.10,
  resourceMult: 0.12,
};

export const QUICK_SLOT_COUNT = 3;

export const TEST_CPS = [8, 15, 24, 36];
export const TEST_WAVES = [1, 3, 5, 7, 10, 12, 15];
export const STATE_FAMILIES = ['hero-heavy', 'balanced', 'tower-heavy'];
export const EQUIPMENT_SCENARIOS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'];
export const DAMAGE_FACTOR_SENSITIVITY = [0.82, 0.90, 1.00];

export const HERO_COUNT = 4;
export const HERO_MIN_LEVEL = 1;
