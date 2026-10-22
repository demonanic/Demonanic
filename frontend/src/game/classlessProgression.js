import * as C from "./config";
import { IMPLEMENTED_CLASSLESS_PASSIVES } from "./classlessCombatEffects";

// Bible v1.0 purchase metadata. Effect execution is owned by combat consumers.
const BRANCHES = [
  ["Vanguard", [["V1", 1], ["V2", 2], ["V2a", 2], ["V3", 3], ["V3a", 3]]],
  ["Warden", [["W1", 1], ["W2", 2], ["W2a", 2], ["W3", 3], ["W3a", 3]]],
  ["Precision", [["P1", 1], ["P2", 2], ["P2a", 2], ["P3", 3], ["P3a", 3]]],
  ["Shadowcraft", [["S1", 1], ["S2", 2], ["S2a", 2], ["S3", 3], ["S3a", 3]]],
  ["Arcana", [["A1", 1], ["A2", 2], ["A2a", 2], ["A3", 3], ["A3a", 3]]],
  ["Tactics", [["T1", 1], ["T2", 2], ["T2a", 2], ["T3", 3], ["T3a", 3]]],
  ["Conjuration", [["C1", 1], ["C2", 2], ["C2a", 2], ["C3", 3], ["C3a", 3]]],
  ["Hemomancy", [["H1", 1], ["H2", 2], ["H3", 3]]],
  ["Fortune", [["F1", 1], ["F2", 2], ["F3", 3]]],
  ["Wilds", [["N1", 1], ["N2", 2], ["N3", 3]]],
  ["Illusion", [["I1", 1], ["I2", 2], ["I3", 3]]],
];

const PHASE_2_NODES = new Set(["C3", "C3a", "N3"]);

export const CANONICAL_NODES = Object.freeze(BRANCHES.flatMap(([branch, entries]) => entries.map(([id, tier]) => {
  const tierTwoIds = entries.filter(([, nodeTier]) => nodeTier === 2).map(([nodeId]) => nodeId);
  const prerequisites = tier === 1
    ? []
    : tier === 2
      ? [entries[0][0]]
      : tierTwoIds;

  return Object.freeze({
    id,
    branch,
    tier,
    apCost: tier,
    minLevel: tier === 1 ? 1 : tier === 2 ? 5 : 10,
    prerequisites: Object.freeze(prerequisites),
    gated: PHASE_2_NODES.has(id),
  });
})));

const NODE_BY_ID = new Map(CANONICAL_NODES.map((node) => [node.id, node]));

export function getCanonicalNode(nodeId) {
  return NODE_BY_ID.get(nodeId) || null;
}

function validateProgressionShape(progression) {
  if (!progression || typeof progression !== "object" ||
    !Number.isInteger(progression.level) || progression.level < 1 ||
    !Number.isInteger(progression.ap) || progression.ap < 0 ||
    !Array.isArray(progression.ownedNodeIds)) {
    return "invalid_progression";
  }

  const seen = new Set();
  for (const ownedId of progression.ownedNodeIds) {
    const ownedNode = NODE_BY_ID.get(ownedId);
    if (!ownedNode || ownedNode.gated || seen.has(ownedId) || progression.level < ownedNode.minLevel) {
      return "invalid_progression";
    }
    seen.add(ownedId);
  }

  if (CANONICAL_NODES.filter((node) => node.tier === 3 && seen.has(node.id)).length > 2) {
    return "invalid_progression";
  }
  for (const ownedId of seen) {
    const ownedNode = NODE_BY_ID.get(ownedId);
    const hasPrerequisite = ownedNode.tier === 3
      ? ownedNode.prerequisites.some((id) => seen.has(id))
      : ownedNode.prerequisites.every((id) => seen.has(id));
    if (!hasPrerequisite) return "invalid_progression";
  }
  return null;
}

/**
 * Validate one purchase without mutating the supplied progression. On success,
 * returns a new progression value; on failure, returns a stable reason code.
 */
export function purchaseNode(progression, nodeId) {
  const shapeError = validateProgressionShape(progression);
  if (shapeError) return { ok: false, reason: shapeError };

  const node = NODE_BY_ID.get(nodeId);
  if (!node) return { ok: false, reason: "unknown_node" };
  if (progression.ownedNodeIds.includes(nodeId)) return { ok: false, reason: "already_owned" };
  if (node.gated) return { ok: false, reason: "phase_gated" };
  if (progression.level < node.minLevel) return { ok: false, reason: "level_required" };

  const ownsPrerequisite = node.tier === 3
    ? node.prerequisites.some((id) => progression.ownedNodeIds.includes(id))
    : node.prerequisites.every((id) => progression.ownedNodeIds.includes(id));
  if (!ownsPrerequisite) return { ok: false, reason: "prerequisite_required" };

  if (node.tier === 3 && CANONICAL_NODES.filter((ownedNode) =>
    ownedNode.tier === 3 && progression.ownedNodeIds.includes(ownedNode.id)).length >= 2) {
    return { ok: false, reason: "tier_iii_mastery_cap" };
  }
  if (progression.ap < node.apCost) return { ok: false, reason: "insufficient_ap" };
  return {
    ok: true,
    progression: {
      ...progression,
      ap: progression.ap - node.apCost,
      ownedNodeIds: [...progression.ownedNodeIds, nodeId],
    },
  };
}

// Classless purchase adapter. It returns only the replacement progression so
// callers can install it after validation without changing identity, combat,
// appearance, or unrelated profile fields. This records ownership only; it
// does not activate catalog effects in combat.
export function purchaseClasslessNode(hero, nodeId) {
  if (!hero || typeof hero !== "object" || hero.cls || !hero.identity?.id || !hero.combat) {
    return { ok: false, reason: "not_classless_hero" };
  }
  const result = purchaseNode(hero.progression, nodeId);
  if (!result.ok) return result;
  if (!IMPLEMENTED_CLASSLESS_PASSIVES.includes(nodeId)) return { ok: false, reason: "effect_pending" };
  return result;
}
// The legacy progression curve is the only approved XP threshold schedule in
// the repository. Classless heroes use it without legacy class perks/fields.
export function awardClasslessXp(progression, amount) {
  if (!progression || !Number.isInteger(progression.level) || progression.level < 1 ||
    progression.level > C.HERO_XP.length || !Number.isFinite(progression.xp) || progression.xp < 0 ||
    !Number.isInteger(progression.ap) || progression.ap < 0 ||
    !Number.isInteger(progression.sp) || progression.sp < 0 ||
    !Array.isArray(progression.ownedNodeIds) || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, reason: "invalid_progression_or_xp" };
  }
  const xp = progression.xp + amount;
  const level = Math.max(progression.level, C.heroLevelForXp(xp));
  const gainedLevels = level - progression.level;
  return {
    ok: true,
    progression: {
      ...progression,
      xp,
      level,
      ap: progression.ap + gainedLevels,
      sp: progression.sp + gainedLevels,
    },
  };
}

// SP modifies the stored classless base attributes once; combat consumers read
// combat.stats, so saves/reloads cannot compound a derived bonus.
export function allocateClasslessStat(hero, stat) {
  if (!hero || typeof hero !== "object" || hero.cls || !hero.identity?.id ||
    !hero.combat?.stats || !hero.progression || !Number.isInteger(hero.progression.sp) ||
    hero.progression.sp <= 0 || !["attack", "defense", "agility", "intelligence"].includes(stat) ||
    !Number.isInteger(hero.combat.stats[stat])) return { ok: false, reason: "invalid_allocation" };
  return {
    ok: true,
    hero: {
      ...hero,
      combat: { ...hero.combat, stats: { ...hero.combat.stats, [stat]: hero.combat.stats[stat] + 1 } },
      progression: { ...hero.progression, sp: hero.progression.sp - 1 },
    },
  };
}
