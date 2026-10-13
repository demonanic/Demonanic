// Data-driven Library spell research. All progress and unlocked spells live in the saved game state.
export const SPELL_ELEMENTS = ["fire", "ice", "poison", "electric", "mind"];
export const SPELL_EFFECTS = ["area", "time", "intensity"];

export const SPELL_DATABASE = [
  { id: "ember_bolt", name: "Ember Bolt", element: "fire", effect: "intensity", basePower: 1.15, baseMana: 12, description: "A focused burst of fire." },
  { id: "cinder_field", name: "Cinder Field", element: "fire", effect: "area", basePower: 0.75, baseMana: 20, description: "Burns enemies across a small area." },
  { id: "glacier_bind", name: "Glacier Bind", element: "ice", effect: "time", basePower: 0.65, baseMana: 18, description: "Slows a target for a sustained duration." },
  { id: "shard_burst", name: "Shard Burst", element: "ice", effect: "area", basePower: 0.9, baseMana: 22, description: "Scatters frost shards across an area." },
  { id: "venom_mark", name: "Venom Mark", element: "poison", effect: "time", basePower: 0.8, baseMana: 19, description: "Applies lingering poison." },
  { id: "toxic_cloud", name: "Toxic Cloud", element: "poison", effect: "area", basePower: 0.65, baseMana: 24, description: "Fills an area with toxic fumes." },
  { id: "arc_surge", name: "Arc Surge", element: "electric", effect: "intensity", basePower: 1.3, baseMana: 24, description: "A high-intensity electrical strike." },
  { id: "chain_pulse", name: "Chain Pulse", element: "electric", effect: "area", basePower: 0.85, baseMana: 27, description: "Arcs between nearby targets." },
  { id: "thought_lance", name: "Thought Lance", element: "mind", effect: "intensity", basePower: 1.05, baseMana: 17, description: "Pierces a target's mental defenses." },
  { id: "dread_haze", name: "Dread Haze", element: "mind", effect: "time", basePower: 0.55, baseMana: 21, description: "Weakens foes over time." },
];

export const LIBRARY_RULES = {
  discoveryGold: 80,
  discoveryStone: 20,
  researchGoldPerHour: 20,
  researchStonePerHour: 8,
  baseSuccessPercent: 45,
  intelligencePercentPerPoint: 1.5,
  levelPercentPerLevel: 8,
  maxSuccessPercent: 92,
  minResearchHours: 1,
  maxResearchHours: 24,
};

export function librarySuccessChance(state, intelligence = null) {
  const level = Math.max(1, Number(state.buildings?.library?.level) || 1);
  const bestInt = intelligence == null
    ? Math.max(10, ...(state.heroes || []).map((hero) => Number(hero.stats?.intelligence) || 10))
    : Math.max(1, Number(intelligence) || 10);
  return Math.max(5, Math.min(LIBRARY_RULES.maxSuccessPercent,
    LIBRARY_RULES.baseSuccessPercent +
    (bestInt - 10) * LIBRARY_RULES.intelligencePercentPerPoint +
    (level - 1) * LIBRARY_RULES.levelPercentPerLevel));
}

function libraryReady(state) {
  const library = state.buildings?.library;
  return !!library && library.unlocked !== false && Number(library.hp) > 0;
}

function spellName(element, effect) {
  const a = { fire: "Cinder", ice: "Glacial", poison: "Venom", electric: "Volt", mind: "Psyche" };
  const b = { area: "Nova", time: "Bind", intensity: "Lance" };
  return `${a[element] || "Arcane"} ${b[effect] || "Pulse"}`;
}

export function createSpellBlueprint(state, { mode = "custom", element = "fire", effect = "intensity", roll = Math.random } = {}) {
  if (!libraryReady(state) || !SPELL_ELEMENTS.includes(element) || !SPELL_EFFECTS.includes(effect)) return { ok: false, reason: "library" };
  const costGold = LIBRARY_RULES.discoveryGold;
  const costStone = LIBRARY_RULES.discoveryStone;
  if ((Number(state.gold) || 0) < costGold || (Number(state.stone) || 0) < costStone) return { ok: false, reason: "resources" };
  state.gold -= costGold;
  state.stone -= costStone;
  const chance = librarySuccessChance(state);
  const success = roll() * 100 < chance;
  state.libraryBlueprints = Array.isArray(state.libraryBlueprints) ? state.libraryBlueprints : [];
  if (!success) {
    state.libraryFailedDesigns = (Number(state.libraryFailedDesigns) || 0) + 1;
    state.buildings.library.activity = "Design failed";
    return { ok: false, reason: "roll", chance };
  }
  let spell;
  if (mode === "random") {
    const catalog = SPELL_DATABASE.filter((candidate) => !(state.librarySpells || []).some((known) => known.id === candidate.id) && !state.libraryBlueprints.some((known) => known.catalogId === candidate.id));
    if (!catalog.length) {
      state.gold += costGold;
      state.stone += costStone;
      return { ok: false, reason: "catalog" };
    }
    spell = catalog[Math.floor(roll() * catalog.length)];
  } else {
    const id = `custom_${Date.now().toString(36)}_${Math.floor(roll() * 0xffffff).toString(36)}`;
    spell = { id, name: spellName(element, effect), element, effect, basePower: 0.7, baseMana: 15, description: `Custom ${element} spell focused on ${effect}.` };
  }
  const blueprint = {
    id: `blueprint_${Date.now().toString(36)}_${Math.floor(roll() * 0xffffff).toString(36)}`,
    catalogId: spell.id, name: spell.name, element: spell.element, effect: spell.effect,
    basePower: spell.basePower, baseMana: spell.baseMana, description: spell.description,
    createdAt: Date.now(),
  };
  state.libraryBlueprints.push(blueprint);
  state.buildings.library.activity = `Blueprint found: ${blueprint.name}`;
  return { ok: true, blueprint, chance };
}

export function startSpellResearch(state, blueprintId, hours) {
  if (!libraryReady(state) || state.libraryResearch) return { ok: false, reason: "busy" };
  const blueprint = (state.libraryBlueprints || []).find((item) => item.id === blueprintId);
  if (!blueprint) return { ok: false, reason: "blueprint" };
  const durationHours = Math.max(LIBRARY_RULES.minResearchHours, Math.min(LIBRARY_RULES.maxResearchHours, Number(hours) || 1));
  const costGold = Math.ceil(durationHours * LIBRARY_RULES.researchGoldPerHour);
  const costStone = Math.ceil(durationHours * LIBRARY_RULES.researchStonePerHour);
  if ((Number(state.gold) || 0) < costGold || (Number(state.stone) || 0) < costStone) return { ok: false, reason: "resources" };
  state.gold -= costGold;
  state.stone -= costStone;
  state.libraryResearch = {
    blueprintId, startedAt: Date.now(), durationSeconds: durationHours * 3600,
    remainingSeconds: durationHours * 3600, elapsedSeconds: 0, chosenHours: durationHours,
  };
  state.buildings.library.activity = `Researching ${blueprint.name}`;
  return { ok: true, durationHours, costGold, costStone };
}

export function advanceLibraryResearch(state, dtSeconds) {
  const order = state.libraryResearch;
  if (!order || !(Number(order.remainingSeconds) > 0) || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return false;
  if (!libraryReady(state)) return false;
  order.remainingSeconds = Math.max(0, order.remainingSeconds - dtSeconds);
  order.elapsedSeconds = (Number(order.elapsedSeconds) || 0) + dtSeconds;
  if (order.remainingSeconds > 0.0001) return false;
  const index = (state.libraryBlueprints || []).findIndex((item) => item.id === order.blueprintId);
  if (index < 0) { state.libraryResearch = null; return false; }
  const blueprint = state.libraryBlueprints[index];
  const durationScale = 0.75 + Math.max(1, Number(order.chosenHours) || 1) / 12;
  const libraryLevel = Math.max(1, Number(state.buildings?.library?.level) || 1);
  const spell = {
    ...blueprint, unlockedAt: Date.now(), researchHours: order.chosenHours,
    strength: Math.round(blueprint.basePower * durationScale * (1 + (libraryLevel - 1) * 0.08) * 100) / 100,
    manaCost: Math.max(1, Math.ceil(blueprint.baseMana * (0.8 + durationScale * 0.2))),
  };
  state.librarySpells = Array.isArray(state.librarySpells) ? state.librarySpells : [];
  if (!state.librarySpells.some((known) => known.id === spell.id)) state.librarySpells.push(spell);
  state.libraryBlueprints.splice(index, 1);
  state.libraryResearch = null;
  if (state.buildings?.library) state.buildings.library.activity = `Research complete: ${spell.name}`;
  return spell;
}
