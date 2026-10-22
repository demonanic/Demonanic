// Runtime support for the currently implemented Phase 1 classless passives.
// Keep this list explicit: catalog ownership alone never implies an effect.
const IMPLEMENTED_PASSIVES = Object.freeze({
  V1: { weaponDamage: 0.08 },
  P1: { critChance: 0.08 },
  P2a: { critDamage: 0.20 },
  S1: { attackSpeed: 0.05 },
  T1: { cooldownReduction: 0.05 },
  F1: { critDamage: 0.15 },
});

export const IMPLEMENTED_CLASSLESS_PASSIVES = Object.freeze(Object.keys(IMPLEMENTED_PASSIVES));

export function classlessCombatEffects(ownedNodeIds = []) {
  const totals = { weaponDamage: 0, critChance: 0, critDamage: 0, attackSpeed: 0, cooldownReduction: 0 };
  for (const id of new Set(ownedNodeIds)) {
    const effect = IMPLEMENTED_PASSIVES[id];
    if (!effect) continue;
    for (const [key, value] of Object.entries(effect)) totals[key] += value;
  }
  totals.weaponDamage = Math.min(0.5, totals.weaponDamage);
  totals.attackSpeed = Math.min(0.2, totals.attackSpeed);
  totals.critChance = Math.min(0.5, totals.critChance);
  totals.critDamage = Math.min(1, totals.critDamage);
  totals.cooldownReduction = Math.min(0.3, totals.cooldownReduction);
  return totals;
}
