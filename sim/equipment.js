// ============================================================
// Equipment catalog — VERIFIED against equipment1.docx Section 3.
// Neutral materials only. Material tilt excluded from first pass.
// ============================================================

export const EQUIPMENT_VERIFICATION_STATUS = {
  perSlotTemplates: 'VERIFIED — equipment1.docx Section 3',
  ringEffects: 'VERIFIED — stat-only',
  necklaceEffects: 'VERIFIED — stat-only',
  quickSlots: {
    count: 3,
    status: 'EXCLUDED from E0–E5 combat power',
    unresolved: ['per-hero vs per-party', 'cooldown', 'turn cost',
                 'stacking', 'loss-on-death'],
  },
  secondaryWeapon: {
    status: 'TYPES LOCKED, IDENTITY STATS UNRESOLVED',
    proxyUsed: 'Shield-template stat proxy for all classes during construction validation',
    unresolved: ['KiteShield', 'SecondSword', 'SecondDagger', 'Wand', 'Arrows'],
    note: 'identity modifiers are [TUNE] in equipment1.docx and NOT invented here',
  },
};

export const EQUIPMENT_CATALOG = {
  E0: null,

  E1: {
    Helm: { defense: 2 },
    Chest: { defense: 2 },
    Legs: { defense: 1, maxHP: 5 },
    Arms: { defense: 1, maxHP: 5 },
    Boots: { agility: 2 },
    PrimaryWeapon: { attack: 2, critDamage: 1 },
    SecondaryWeapon: { defense: 2 },
    Cloak: { agility: 2 },
    Ring1: { critDamage: 5 },
    Ring2: { critDamage: 5 },
    Necklace: { intelligence: 2 },
  },

  E2: {
    Helm: { defense: 4, maxHP: 10 },
    Chest: { defense: 5, maxHP: 10 },
    Legs: { defense: 3, maxHP: 10 },
    Arms: { attack: 2, critDamage: 5 },
    Boots: { agility: 5 },
    PrimaryWeapon: { attack: 5, critDamage: 2 },
    SecondaryWeapon: { defense: 4, maxHP: 10 },
    Cloak: { agility: 5, maxHP: 5 },
    Ring1: { critChance: 3, critDamage: 6 },
    Ring2: { critChance: 3, critDamage: 6 },
    Necklace: { intelligence: 4, maxHP: 10 },
  },

  E3: {
    Helm: { defense: 7, maxHP: 30 },
    Chest: { defense: 8, maxHP: 40 },
    Legs: { defense: 5, maxHP: 30 },
    Arms: { attack: 4, critDamage: 10 },
    Boots: { agility: 10 },
    PrimaryWeapon: { attack: 9, critDamage: 7 },
    SecondaryWeapon: { defense: 7, maxHP: 30 },
    Cloak: { agility: 8, maxHP: 20 },
    Ring1: { critChance: 6, critDamage: 12 },
    Ring2: { critChance: 6, critDamage: 12 },
    Necklace: { intelligence: 6, maxHP: 30 },
  },

  E4: {
    Helm: { defense: 11, maxHP: 50 },
    Chest: { defense: 12, maxHP: 60 },
    Legs: { defense: 8, maxHP: 40 },
    Arms: { attack: 6, critDamage: 15 },
    Boots: { agility: 15 },
    PrimaryWeapon: { attack: 14, critDamage: 12 },
    SecondaryWeapon: { defense: 10, maxHP: 50 },
    Cloak: { agility: 12, maxHP: 40 },
    Ring1: { critChance: 9, critDamage: 18 },
    Ring2: { critChance: 9, critDamage: 18 },
    Necklace: { intelligence: 10, maxHP: 50 },
  },

  E5: {
    Helm: { defense: 16, maxHP: 90 },
    Chest: { defense: 18, maxHP: 100 },
    Legs: { defense: 12, maxHP: 60 },
    Arms: { attack: 9, critDamage: 22 },
    Boots: { agility: 22 },
    PrimaryWeapon: { attack: 22, critDamage: 17 },
    SecondaryWeapon: { defense: 15, maxHP: 80 },
    Cloak: { agility: 18, maxHP: 70 },
    Ring1: { critChance: 14, critDamage: 30 },
    Ring2: { critChance: 14, critDamage: 30 },
    Necklace: { intelligence: 15, maxHP: 80 },
  },
};

export const CLASS_SECONDARY_TYPE = {
  Knight: 'Shield',
  Rouge: 'SecondDagger',
  Mage: 'Wand',
  Archer: 'Arrows',
};

export const SECONDARY_IDENTITY_TEMPLATES = {
  Shield: { status: 'VERIFIED', template: 'see EQUIPMENT_CATALOG.SecondaryWeapon' },
  KiteShield: { status: 'UNRESOLVED [TUNE]', identity: '+Def, +HP, blocks 2H' },
  SecondSword: { status: 'UNRESOLVED [TUNE]', identity: 'melee off-hand' },
  SecondDagger: { status: 'UNRESOLVED [TUNE]', identity: 'fast off-hand, +Atk' },
  Wand: { status: 'UNRESOLVED [TUNE]', identity: 'spell off-hand' },
  Arrows: { status: 'UNRESOLVED [TUNE]', identity: '+Crit, +Range' },
};

export function loadEquipment(scenario, cls) {
  if (scenario === 'E0') return null;
  const catalog = EQUIPMENT_CATALOG[scenario];
  if (!catalog) throw new Error(`unknown equipment scenario: ${scenario}`);
  if (!(cls in CLASS_SECONDARY_TYPE)) throw new Error(`unknown hero class: ${cls}`);
  return { ...catalog };
}

export function describeEquipment(scenario, cls) {
  if (scenario === 'E0') {
    return { scenario, cls, secondary: { type: null, source: 'none' } };
  }
  const type = CLASS_SECONDARY_TYPE[cls];
  const identity = SECONDARY_IDENTITY_TEMPLATES[type];
  return {
    scenario,
    cls,
    secondary: {
      type,
      identityStatus: identity.status,
      identityNotes: identity.identity ?? identity.template,
      statSource: identity.status === 'VERIFIED'
        ? 'equipment1.docx'
        : 'PROXY:shield (identity unresolved)',
    },
  };
}

export function aggregateGearStats(gearPackage) {
  if (!gearPackage) {
    return { attack: 0, defense: 0, agility: 0, intelligence: 0,
             maxHP: 0, critChance: 0, critDamage: 0 };
  }
  const total = { attack: 0, defense: 0, agility: 0, intelligence: 0,
                  maxHP: 0, critChance: 0, critDamage: 0 };
  for (const slotStats of Object.values(gearPackage)) {
    if (!slotStats) continue;
    for (const [k, v] of Object.entries(slotStats)) {
      if (k in total) total[k] += v;
    }
  }
  return total;
}
