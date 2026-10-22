// Canonical classless active abilities whose runtime handlers are implemented.
// Node ownership is the unlock source; class/title fields never grant access.
const PRECISION_ABILITIES = Object.freeze([
  Object.freeze({
    id: "P3",
    unlockNodeId: "P3",
    name: "Execution",
    description: "Deal 180% direct weapon damage. Deals 25% more while the target is below 35% HP.",
    cooldownSeconds: 22,
    resourceCost: 0,
    targetMode: "enemy",
    rangeMode: "hero_attack_range",
    damageMultiplier: 1.8,
    conditionalTargetHpBelow: 0.35,
    conditionalDamageBonus: 0.25,
    refundCooldownOnKill: false,
  }),
  Object.freeze({
    id: "P3a",
    unlockNodeId: "P3a",
    name: "Killshot",
    description: "Deal 200% direct weapon damage to a target below 40% HP. Refreshes immediately if it kills.",
    cooldownSeconds: 18,
    resourceCost: 0,
    targetMode: "enemy",
    rangeMode: "hero_attack_range",
    damageMultiplier: 2,
    conditionalTargetHpBelow: 0.4,
    conditionalDamageBonus: 0,
    refundCooldownOnKill: true,
  }),
]);

const DEFINITIONS = new Map(PRECISION_ABILITIES.map((ability) => [ability.id, ability]));
export const IMPLEMENTED_CLASSLESS_ABILITY_NODE_IDS = Object.freeze(PRECISION_ABILITIES.map((ability) => ability.unlockNodeId));

export function getClasslessAbilityDefinition(abilityId) {
  return DEFINITIONS.get(abilityId) || null;
}

export function getUnlockedClasslessAbilities(hero) {
  const owned = new Set(hero?.progression?.ownedNodeIds || []);
  return PRECISION_ABILITIES.filter((ability) => owned.has(ability.unlockNodeId));
}

export function validateClasslessAbilityUse({
  hero,
  abilityId,
  cooldown = 0,
  battleActive = true,
  target = null,
  targetValid = false,
}) {
  const definition = DEFINITIONS.get(abilityId);
  if (!definition || !getUnlockedClasslessAbilities(hero).some((ability) => ability.id === abilityId)) {
    return { ok: false, reason: "locked", abilityId };
  }
  if (!battleActive || !hero?.alive || hero?.protect > 0 || hero?.retreating) {
    return { ok: false, reason: "unavailable", abilityId };
  }
  if (cooldown > 0) return { ok: false, reason: "cooldown", abilityId, cooldown };
  if (!target || !targetValid || !(target.maxHp > 0) || !(target.hp > 0)) {
    return { ok: false, reason: "no_target", abilityId };
  }
  if (target.hp / target.maxHp >= definition.conditionalTargetHpBelow) {
    return { ok: false, reason: "target_health", abilityId };
  }
  return { ok: true, reason: null, abilityId, definition, target };
}
