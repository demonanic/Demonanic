// Authoritative starting combat profile for newly created classless heroes.
// Appearance and progression are deliberately separate from combat identity.
export const HERO_BASELINE = Object.freeze({
  hp: 300,
  stats: Object.freeze({ attack: 10, defense: 10, agility: 10, intelligence: 10 }),
  basicAttack: Object.freeze({
    damage: 16,
    intervalSeconds: 1.05,
    range: 220,
    rangeMode: "midline",
    movementSpeed: 155,
    targetPolicy: "nearest_valid_retain_reacquire",
    targetTieBreak: "stable_spawn_order",
    criticalChance: 0.05,
    criticalDamageMultiplier: 1.5,
    dodgeChance: 0.05,
  }),
  sharedStrike: Object.freeze({
    id: "shared_strike",
    damageMultiplier: 1.5,
    damageCategory: "weapon",
    targetMode: "single_valid_target",
    cooldownSeconds: 12,
    resourceCost: 0,
    effects: Object.freeze({
      stun: false,
      slow: false,
      healing: false,
      areaDamage: false,
      summon: false,
      damageTypeConversion: false,
    }),
  }),
});

let heroSequence = 0;

function newHeroId() {
  heroSequence += 1;
  return `hero-${Date.now().toString(36)}-${heroSequence.toString(36)}`;
}

export function createHeroModel(options = {}) {
  options = options && typeof options === "object" ? options : {};
  const id = typeof options.id === "string" && options.id.trim() ? options.id.trim() : newHeroId();
  const name = typeof options.name === "string" && options.name.trim() ? options.name.trim() : "Hero";
  const appearanceId = typeof options.appearanceId === "string" && options.appearanceId.trim()
    ? options.appearanceId.trim()
    : null;

  return {
    identity: { id, name },
    appearance: { id: appearanceId },
    combat: {
      hp: HERO_BASELINE.hp,
      maxHp: HERO_BASELINE.hp,
      stats: { ...HERO_BASELINE.stats },
      basicAttack: { ...HERO_BASELINE.basicAttack },
      capabilities: {
        sharedStrike: {
          ...HERO_BASELINE.sharedStrike,
          effects: { ...HERO_BASELINE.sharedStrike.effects },
        },
      },
    },
    progression: {
      level: 1,
      xp: 0,
      ap: 0,
      sp: 0,
      ownedNodeIds: [],
    },
  };
}

// Pure update: a rejected appearance change never mutates or partially copies
// the supplied hero. Null clears the configurable appearance selection.
export function withHeroAppearance(hero, appearanceId) {
  if (!hero || typeof hero !== "object" || !hero.identity || !hero.combat || !hero.progression) {
    return { ok: false, reason: "invalid_hero" };
  }
  if (appearanceId !== null && (typeof appearanceId !== "string" || !appearanceId.trim())) {
    return { ok: false, reason: "invalid_appearance" };
  }
  return {
    ok: true,
    hero: { ...hero, appearance: { ...(hero.appearance || {}), id: appearanceId?.trim() || null } },
  };
}
