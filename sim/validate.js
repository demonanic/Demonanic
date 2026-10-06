import { slotCapacity } from './state.js';
import { EQUIPMENT_CATALOG, describeEquipment } from './equipment.js';
import * as C from './constants.js';

export function validateScenario(state, intendedCP, wave, boss) {
  const failures = [];

  const heroCP = state.heroes.reduce((s, h) => s + h.level, 0);
  const towerCP = state.towers.reduce((s, t) => s + t.level, 0);
  const actualCP = heroCP + towerCP;

  if (actualCP !== intendedCP)
    failures.push({ check: 'cp_equality', expected: intendedCP, actual: actualCP });

  const cap = slotCapacity(intendedCP);
  if (state.towers.length > cap)
    failures.push({ check: 'tower_capacity', cap, actual: state.towers.length });

  for (const [i, h] of state.heroes.entries()) {
    if (!['Knight','Rouge','Mage','Archer'].includes(h.cls))
      failures.push({ check: 'hero_class', index: i, value: h.cls });
    if (!Number.isInteger(h.level) || h.level < 1)
      failures.push({ check: 'hero_level', index: i, value: h.level });
    if (!(h.maxHP > 0))
      failures.push({ check: 'hero_maxHP', index: i, value: h.maxHP });
    if (!(h.hp > 0 && h.hp <= h.maxHP))
      failures.push({ check: 'hero_hp_range', index: i, hp: h.hp, maxHP: h.maxHP });
  }

  for (const [i, t] of state.towers.entries()) {
    if (!t.type) failures.push({ check: 'tower_type', index: i });
    if (!Number.isInteger(t.level) || t.level < 1)
      failures.push({ check: 'tower_level', index: i, value: t.level });
    if (!(t.maxHP > 0))
      failures.push({ check: 'tower_maxHP', index: i, value: t.maxHP });
    if (t.slotIndex !== i)
      failures.push({ check: 'tower_slot_index', index: i, expected: i, actual: t.slotIndex });
  }

  if (heroCP < 0) failures.push({ check: 'negative_hero_cp', value: heroCP });
  if (towerCP < 0) failures.push({ check: 'negative_tower_cp', value: towerCP });

  const indices = state.towers.map(t => t.slotIndex);
  if (new Set(indices).size !== indices.length)
    failures.push({ check: 'duplicate_tower_slot' });

  if (wave !== null && wave !== undefined)
    validateWaveComposition(wave, intendedCP, failures);

  if (boss) validateBossStats(boss, wave, intendedCP, failures);

  return { pass: failures.length === 0, failures };
}

export function validateEquipment(equipmentScenario, state) {
  const failures = [];
  const isE0 = equipmentScenario === 'E0';

  if (isE0) {
    for (const [i, h] of state.heroes.entries()) {
      const g = h.gear ?? {};
      const hasAny = Object.values(g).some(v => typeof v === 'number' && v !== 0);
      if (hasAny) failures.push({ check: 'e0_has_gear', index: i });
    }
  } else {
    const pkg = EQUIPMENT_CATALOG[equipmentScenario];

    if (!pkg) {
      failures.push({ check: 'unknown_scenario', scenario: equipmentScenario });
    } else {
      const slotCount = Object.keys(pkg).length;
      if (slotCount !== 11)
        failures.push({ check: 'equipment_slot_count', expected: 11, actual: slotCount });

      const allowed = new Set([
        'attack','defense','agility','intelligence',
        'maxHP','critChance','critDamage'
      ]);

      for (const [slot, stats] of Object.entries(pkg)) {
        for (const [k, v] of Object.entries(stats)) {
          if (!allowed.has(k))
            failures.push({ check: 'equipment_unknown_stat', slot, stat: k });
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
            failures.push({ check: 'equipment_invalid_value', slot, stat: k, value: v });
        }
      }
    }
  }

  for (const [i, h] of state.heroes.entries()) {
    const g = h.gear ?? {};
    if ('quickSlots' in g || 'Q1' in g || 'Q2' in g || 'Q3' in g)
      failures.push({ check: 'quick_slot_leaked_into_gear', index: i });
  }

  if (C.QUICK_SLOT_COUNT !== 3)
    failures.push({ check: 'quick_slot_count', expected: 3, actual: C.QUICK_SLOT_COUNT });

  for (const h of state.heroes) {
    const g = h.gear ?? {};
    if ('level' in g)
      failures.push({ check: 'equipment_contains_level_field', cls: h.cls });
  }

  if (!isE0) {
    for (const cls of ['Knight','Rouge','Mage','Archer']) {
      const desc = describeEquipment(equipmentScenario, cls);
      if (!desc.secondary || !desc.secondary.identityStatus)
        failures.push({ check: 'secondary_proxy_not_disclosed', cls });
    }
  }

  return { pass: failures.length === 0, failures };
}

function validateWaveComposition(wave, cp, failures) {
  // Combat construction is intentionally not part of this pass.
}

function validateBossStats(bossKey, wave, cp, failures) {
  // Combat construction is intentionally not part of this pass.
}
