// Demonanic PRK / Ability system.
// PRKs are persistent hero build nodes. AP unlocks nodes through parent
// dependencies. Intersections of PRK paths unlock battlefield abilities.
// This is the first hardcoded implementation of the handwritten PRK design.

const TREE = {
  knight: {
    roots: [
      { id: "knight_bulwark", name: "Bulwark", cost: 1, category: "STAT", desc: "+2 DEF. Improves the Knight's defensive foundation.", effect: { defense: 2 } },
      { id: "knight_cleave", name: "Cleave", cost: 1, category: "ITEM", desc: "Melee attacks can strike a second nearby target.", effect: { cleave: 2 } },
      { id: "knight_iron_wall", name: "Iron Wall", cost: 1, category: "STAT", desc: "+15% maximum HP.", effect: { maxHpPct: 0.15 } },
    ],
    children: [
      { id: "knight_guardian", parent: "knight_bulwark", name: "Guardian Instinct", cost: 1, category: "ENEMY", desc: "Responds longer when an ally or castle is threatened.", effect: { reactionBonus: 2 } },
      { id: "knight_shield_mastery", parent: "knight_bulwark", name: "Shield Mastery", cost: 2, category: "ITEM", desc: "Shield-based abilities deal +20% damage.", effect: { abilityDamagePct: 0.20 } },
      { id: "knight_executioner", parent: "knight_cleave", name: "Executioner", cost: 2, category: "ENEMY", desc: "+25% damage against enemies below 35% HP.", effect: { lowHpDamagePct: 0.25 } },
      { id: "knight_counterweight", parent: "knight_cleave", name: "Counterweight", cost: 1, category: "STAT", desc: "+8% melee attack speed.", effect: { attackRatePct: 0.08 } },
      { id: "knight_fortress", parent: "knight_iron_wall", name: "Fortress", cost: 2, category: "STAT", desc: "Reduces incoming damage by 8%.", effect: { damageReductionPct: 0.08 } },
      { id: "knight_last_stand", parent: "knight_iron_wall", name: "Last Stand", cost: 1, category: "ENEMY", desc: "Below 35% HP, gain +20% defense.", effect: { lowHpDefense: 0.20 } },
    ],
    abilities: [
      { id: "knight_shield_bash", name: "Shield Bash", desc: "Stuns the nearest enemy and deals heavy melee damage.", requires: ["knight_bulwark", "knight_cleave"], cooldown: 10, color: "#00F3FF", effect: "shield_bash" },
      { id: "knight_fortress_pulse", name: "Fortress Pulse", desc: "Temporarily shields nearby allies and reinforces the Knight.", requires: ["knight_bulwark", "knight_iron_wall"], cooldown: 14, color: "#00F3FF", effect: "fortress_pulse" },
    ],
  },
  rouge: {
    roots: [
      { id: "rouge_flurry", name: "Flurry", cost: 1, category: "STAT", desc: "+10% attack speed.", effect: { attackRatePct: 0.10 } },
      { id: "rouge_backstab", name: "Backstab", cost: 1, category: "ENEMY", desc: "+10% critical chance.", effect: { critChancePct: 0.10 } },
      { id: "rouge_evasion", name: "Evasion", cost: 1, category: "STAT", desc: "+5% dodge chance.", effect: { dodgePct: 0.05 } },
    ],
    children: [
      { id: "rouge_speedstep", parent: "rouge_flurry", name: "Speed Step", cost: 1, category: "STAT", desc: "Movement speed +15%.", effect: { moveSpeedPct: 0.15 } },
      { id: "rouge_combo", parent: "rouge_flurry", name: "Combo Chain", cost: 2, category: "ITEM", desc: "Successive strikes gain +15% ability damage.", effect: { abilityDamagePct: 0.15 } },
      { id: "rouge_ambush", parent: "rouge_backstab", name: "Ambush", cost: 2, category: "ENEMY", desc: "+25% damage against enemies above 70% HP.", effect: { highHpDamagePct: 0.25 } },
      { id: "rouge_shadowblade", parent: "rouge_backstab", name: "Shadowblade", cost: 1, category: "ITEM", desc: "Critical hits heal the Rouge for a small amount.", effect: { critHealPct: 0.10 } },
      { id: "rouge_ghoststep", parent: "rouge_evasion", name: "Ghoststep", cost: 2, category: "STAT", desc: "Reactive movement is 25% faster.", effect: { reactiveSpeedPct: 0.25 } },
      { id: "rouge_escape", parent: "rouge_evasion", name: "Escape Artist", cost: 1, category: "ENEMY", desc: "When below 35% HP, dodge chance gains +10%.", effect: { lowHpDodgePct: 0.10 } },
    ],
    abilities: [
      { id: "rouge_speed_rush", name: "Speed Rush", desc: "Surge forward, gaining speed and attack tempo for 5 seconds.", requires: ["rouge_flurry", "rouge_evasion"], cooldown: 10, color: "#FF007F", effect: "speed_rush" },
      { id: "rouge_backstab_ability", name: "Backstab", desc: "Strike a vulnerable enemy for massive bonus damage.", requires: ["rouge_backstab", "rouge_ambush"], cooldown: 8, color: "#FF007F", effect: "backstab" },
      { id: "rouge_life_steal", name: "Life Steal", desc: "Strike the nearest enemy and recover part of the damage dealt.", requires: ["rouge_backstab", "rouge_shadowblade"], cooldown: 14, color: "#FF007F", effect: "life_steal" },
    ],
  },
  mage: {
    roots: [
      { id: "mage_firestorm", name: "Firestorm", cost: 1, category: "ENEMY", desc: "Unlocks area-focused arcane damage.", effect: { aoe: true } },
      { id: "mage_mend", name: "Mend", cost: 1, category: "STAT", desc: "Improves healing output by 20%.", effect: { healPct: 0.20 } },
      { id: "mage_barrier", name: "Barrier", cost: 1, category: "ITEM", desc: "Support barriers gain +20% capacity.", effect: { barrierPct: 0.20 } },
    ],
    children: [
      { id: "mage_overload", parent: "mage_firestorm", name: "Arcane Overload", cost: 2, category: "STAT", desc: "Ability damage +20%.", effect: { abilityDamagePct: 0.20 } },
      { id: "mage_burn", parent: "mage_firestorm", name: "Burning Sigil", cost: 1, category: "ENEMY", desc: "Area abilities apply a short damage-over-time effect.", effect: { burn: true } },
      { id: "mage_surge", parent: "mage_mend", name: "Mana Surge", cost: 2, category: "STAT", desc: "Healing and ability cooldowns improve by 15%.", effect: { healPct: 0.15, cooldownPct: 0.15 } },
      { id: "mage_lifebloom", parent: "mage_mend", name: "Lifebloom", cost: 1, category: "ENEMY", desc: "Healing an ally below 35% HP also grants a small shield.", effect: { lifebloom: true } },
      { id: "mage_aegis", parent: "mage_barrier", name: "Aegis", cost: 2, category: "ITEM", desc: "Barrier capacity gains another +20%.", effect: { barrierPct: 0.20 } },
      { id: "mage_reactive_barrier", parent: "mage_barrier", name: "Reactive Barrier", cost: 1, category: "ENEMY", desc: "Threatened allies receive priority for support.", effect: { reactiveSupport: true } },
    ],
    abilities: [
      { id: "mage_firestorm_ability", name: "Firestorm", desc: "Blast a target area for arcane damage.", requires: ["mage_firestorm", "mage_overload"], cooldown: 12, color: "#A855F7", effect: "firestorm" },
      { id: "mage_mend_ability", name: "Mend", desc: "Restore HP to the most wounded ally.", requires: ["mage_mend", "mage_lifebloom"], cooldown: 10, color: "#A855F7", effect: "mend" },
      { id: "mage_barrier_ability", name: "Barrier", desc: "Surround nearby allies with temporary shields.", requires: ["mage_barrier", "mage_aegis"], cooldown: 14, color: "#A855F7", effect: "barrier" },
    ],
  },
  archer: {
    roots: [
      { id: "archer_eagle_eye", name: "Eagle Eye", cost: 1, category: "STAT", desc: "+30 attack range.", effect: { range: 30 } },
      { id: "archer_rapid_draw", name: "Rapid Draw", cost: 1, category: "ITEM", desc: "+10% attack speed.", effect: { attackRatePct: 0.10 } },
      { id: "archer_focus_fire", name: "Focus Fire", cost: 1, category: "ENEMY", desc: "+20% damage against low-HP enemies.", effect: { lowHpDamagePct: 0.20 } },
    ],
    children: [
      { id: "archer_longshot", parent: "archer_eagle_eye", name: "Longshot", cost: 2, category: "ENEMY", desc: "Targets can be acquired from farther away.", effect: { range: 45 } },
      { id: "archer_hawkeye", parent: "archer_eagle_eye", name: "Hawkeye", cost: 1, category: "STAT", desc: "+5% critical chance.", effect: { critChancePct: 0.05 } },
      { id: "archer_multishot", parent: "archer_rapid_draw", name: "Multishot", cost: 2, category: "ITEM", desc: "Abilities can hit additional targets.", effect: { multiTarget: 2 } },
      { id: "archer_quickstep", parent: "archer_rapid_draw", name: "Quickstep", cost: 1, category: "STAT", desc: "+15% movement speed.", effect: { moveSpeedPct: 0.15 } },
      { id: "archer_execution", parent: "archer_focus_fire", name: "Execution", cost: 2, category: "ENEMY", desc: "+25% damage against enemies below 25% HP.", effect: { lowHpDamagePct: 0.25 } },
      { id: "archer_marked_target", parent: "archer_focus_fire", name: "Marked Target", cost: 1, category: "ENEMY", desc: "Selected targets take +10% damage from the Archer.", effect: { markedDamagePct: 0.10 } },
    ],
    abilities: [
      { id: "archer_piercing_shot", name: "Piercing Shot", desc: "Fire a high-damage shot through a short enemy line.", requires: ["archer_eagle_eye", "archer_multishot"], cooldown: 10, color: "#39FF14", effect: "piercing_shot" },
      { id: "archer_focus_volley", name: "Focus Volley", desc: "Rapidly strike the strongest visible target.", requires: ["archer_rapid_draw", "archer_focus_fire"], cooldown: 9, color: "#39FF14", effect: "focus_volley" },
    ],
  },
};

const LEGACY = {
  knight: {
    "Bulwark (+DEF)": "knight_bulwark",
    "Cleave (hit 2 targets)": "knight_cleave",
    "Iron Wall (+15% max HP)": "knight_iron_wall",
  },
  rouge: {
    "Flurry (+atk speed)": "rouge_flurry",
    "Backstab (+crit)": "rouge_backstab",
    "Evasion (+dodge)": "rouge_evasion",
  },
  mage: {
    "Firestorm (AoE)": "mage_firestorm",
    "Mend (heal squad)": "mage_mend",
    "Barrier (shield)": "mage_barrier",
  },
  archer: {
    "Eagle Eye (+range)": "archer_eagle_eye",
    "Rapid Draw (+atk speed)": "archer_rapid_draw",
    "Focus Fire (+dmg vs low HP)": "archer_focus_fire",
  },
};

export function getPerkTree(cls) {
  return TREE[cls] || { roots: [], children: [], abilities: [] };
}

export function allPerks(cls) {
  const t = getPerkTree(cls);
  return [...t.roots, ...t.children];
}

export function getPerk(cls, id) {
  return allPerks(cls).find((p) => p.id === id) || null;
}

export function normalizePerks(cls, perks) {
  const source = Array.isArray(perks) ? perks : [];
  const mapped = source.map((p) => LEGACY[cls]?.[p] || p).filter(Boolean);
  return [...new Set(mapped.filter((id) => !!getPerk(cls, id)))];
}

export function canUnlockPerk(hero, cls, id) {
  const perk = getPerk(cls, id);
  if (!perk) return false;
  const owned = normalizePerks(cls, hero?.perks);
  if (owned.includes(id)) return false;
  if (Number(hero?.ap || 0) < perk.cost) return false;
  if (perk.parent && !owned.includes(perk.parent)) return false;
  return true;
}

export function unlockedAbilities(hero) {
  const tree = getPerkTree(hero?.cls);
  const owned = normalizePerks(hero?.cls, hero?.perks);
  return tree.abilities.filter((a) => a.requires.every((id) => owned.includes(id)));
}

export function getAbility(hero, id) {
  return unlockedAbilities(hero).find((a) => a.id === id) || null;
}

export function perkEffects(hero) {
  const effects = {
    defense: 0, maxHpPct: 0, attackRatePct: 0, abilityDamagePct: 0,
    lowHpDamagePct: 0, highHpDamagePct: 0, critChancePct: 0, dodgePct: 0,
    range: 0, moveSpeedPct: 0, damageReductionPct: 0, lowHpDefense: 0,
    critHealPct: 0, healPct: 0, barrierPct: 0, cooldownPct: 0,
    reactiveSpeedPct: 0, reactionBonus: 0, multiTarget: 0,
    aoe: false, burn: false, lifebloom: false, reactiveSupport: false,
    markedDamagePct: 0,
  };
  for (const p of allPerks(hero?.cls)) {
    if (!normalizePerks(hero?.cls, hero?.perks).includes(p.id)) continue;
    for (const [key, value] of Object.entries(p.effect || {})) {
      if (typeof value === "boolean") effects[key] = effects[key] || value;
      else effects[key] += Number(value) || 0;
    }
  }
  return effects;
}
