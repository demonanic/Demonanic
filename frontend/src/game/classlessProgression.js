// Bible v1.0 purchase metadata only. Effect execution belongs to combat
// systems and is intentionally not represented in this module.
const BRANCHES = [
  ["Vanguard", ["V1", "V2", "V2a", "V3", "V3a"]],
  ["Warden", ["W1", "W2", "W2a", "W3", "W3a"]],
  ["Precision", ["P1", "P2", "P2a", "P3", "P3a"]],
  ["Shadowcraft", ["S1", "S2", "S2a", "S3", "S3a"]],
  ["Arcana", ["A1", "A2", "A2a", "A3", "A3a"]],
  ["Tactics", ["T1", "T2", "T2a", "T3", "T3a"]],
  ["Conjuration", ["C1", "C2", "C2a", "C3", "C3a"]],
  ["Hemomancy", ["H1", "H2", "H3"]],
  ["Fortune", ["F1", "F2", "F3"]],
  ["Wilds", ["N1", "N2", "N3"]],
  ["Illusion", ["I1", "I2", "I3"]],
];

const PHASE_2_NODES = new Set(["C3", "C3a", "N3"]);

export const CANONICAL_NODES = Object.freeze(BRANCHES.flatMap(([branch, ids]) => ids.map((id, index) => {
  const tier = index === 0 ? 1 : index <= 2 ? 2 : 3;
  const tierTwoIds = ids.filter((_, nodeIndex) => nodeIndex === 1 || nodeIndex === 2);
  const prerequisites = tier === 1
    ? []
    : tier === 2
      ? [ids[0]]
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
