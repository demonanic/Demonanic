import { createNewState } from "./logic";
import {
  SPELL_DATABASE, createSpellBlueprint, startSpellResearch, advanceLibraryResearch,
  librarySuccessChance, ensureMageSpellData, mageCanUseSpell, unlockMageSecondaryAffinity,
  resolveLibraryCompletion, ensureResearchMageBenched,
} from "./libraryResearch";

function libraryState() {
  const state = createNewState(["mage", "knight", "archer", "rouge"]);
  state.buildings = { library: { level: 1, hp: 1000, maxHp: 1000, unlocked: true } };
  state.gold = 1000;
  state.stone = 500;
  state.heroes[0].primaryAffinity = "fire";
  state.heroes[0].secondaryAffinity = null;
  ensureMageSpellData(state.heroes[0]);
  return state;
}

test("custom discovery is assigned to a compatible mage and uses their Intelligence", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  mage.stats.intelligence = 20;
  expect(librarySuccessChance(state, 20)).toBeGreaterThan(45);
  const result = createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "area", roll: () => 0 });
  expect(result.ok).toBe(true);
  expect(result.blueprint.mageId).toBe(mage.id);
  expect(result.blueprint.element).toBe("fire");
  expect(state.gold).toBe(920);
  expect(state.stone).toBe(480);
});

test("incompatible affinity cannot discover a spell and does not charge resources", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  const before = [state.gold, state.stone];
  const result = createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "ice", effect: "area", roll: () => 0 });
  expect(result).toEqual({ ok: false, reason: "incompatible" });
  expect([state.gold, state.stone]).toEqual(before);
});

test("failed discovery consumes the attempt cost without adding a blueprint", () => {
  const state = libraryState();
  const result = createSpellBlueprint(state, { mageId: state.heroes[0].id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0.99 });
  expect(result.ok).toBe(false);
  expect(result.reason).toBe("roll");
  expect(state.libraryBlueprints).toHaveLength(0);
  expect(state.libraryFailedDesigns).toBe(1);
});

test("research removes its mage from the active squad and completion enters only that mage's spellbook", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  const found = createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0 });
  const started = startSpellResearch(state, found.blueprint.id, 2);
  expect(started.ok).toBe(true);
  expect(state.heroes.some((hero) => hero.id === mage.id)).toBe(false);
  expect(state.bench.some((hero) => hero.id === mage.id)).toBe(true);
  expect(state.libraryResearch.remainingSeconds).toBe(7200);
  expect(advanceLibraryResearch(state, 3600)).toBe(false);
  const completed = advanceLibraryResearch(state, 3600);
  expect(completed.name).toBe(found.blueprint.name);
  expect(mage.spellbook).toHaveLength(1);
  expect(state.librarySpells || []).toHaveLength(0);
  expect(state.libraryBlueprints).toHaveLength(0);
  expect(state.libraryResearch).toBe(null);
  expect(state.libraryCompletionNotice.mageId).toBe(mage.id);
});

test("completion can return the mage by replacing the lowest-level hero and sending that hero to roster", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  const found = createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0 });
  startSpellResearch(state, found.blueprint.id, 1);
  advanceLibraryResearch(state, 3600);
  state.heroes[0].level = 8;
  state.heroes[1].level = 2;
  state.heroes[2].level = 1;
  const displacedId = state.heroes[2].id;
  expect(resolveLibraryCompletion(state, "return")).toBe(true);
  expect(state.heroes.some((hero) => hero.id === mage.id)).toBe(true);
  expect(state.bench.some((hero) => hero.id === displacedId)).toBe(true);
  expect(state.libraryCompletionNotice).toBe(null);
});

test("send to roster leaves active lineup unchanged", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  const found = createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0 });
  startSpellResearch(state, found.blueprint.id, 1);
  advanceLibraryResearch(state, 3600);
  const ids = state.heroes.map((hero) => hero.id);
  expect(resolveLibraryCompletion(state, "roster")).toBe(true);
  expect(state.heroes.map((hero) => hero.id)).toEqual(ids);
  expect(state.bench.some((hero) => hero.id === mage.id)).toBe(true);
});

test("legacy active research moves its assigned mage out of the squad during save normalization", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  state.bench.push({ id: "reserve-1", cls: "knight", name: "Reserve Knight", level: 2, hp: 100 });
  state.libraryResearch = { mageId: mage.id, blueprintId: "legacy-blueprint", remainingSeconds: 1800, durationSeconds: 3600 };
  const changed = ensureResearchMageBenched(state);
  expect(changed).toBe(true);
  expect(state.heroes.some((hero) => hero.id === mage.id)).toBe(false);
  expect(state.bench.some((hero) => hero.id === mage.id)).toBe(true);
  expect(state.heroes.length).toBe(4);
});

test("secondary affinity unlocks at level ten and respects Intelligence requirements", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  expect(mageCanUseSpell(mage, SPELL_DATABASE.find((spell) => spell.element === "ice"))).toBe(false);
  expect(unlockMageSecondaryAffinity(mage, "ice")).toEqual({ ok: false, reason: "level" });
  mage.level = 10;
  expect(unlockMageSecondaryAffinity(mage, "ice")).toEqual({ ok: true, element: "ice" });
  mage.stats.intelligence = 10;
  expect(mageCanUseSpell(mage, SPELL_DATABASE.find((spell) => spell.id === "glacier_bind"))).toBe(false);
  mage.stats.intelligence = 20;
  expect(mageCanUseSpell(mage, SPELL_DATABASE.find((spell) => spell.id === "glacier_bind"))).toBe(true);
});

test("random discovery selects only spells compatible with the assigned mage", () => {
  const state = libraryState();
  const result = createSpellBlueprint(state, { mageId: state.heroes[0].id, mode: "random", roll: () => 0 });
  expect(result.ok).toBe(true);
  expect(result.blueprint.element).toBe("fire");
});

test("spellbook capacity and custom-design Intelligence gates do not charge resources", () => {
  const state = libraryState();
  const mage = state.heroes[0];
  const before = [state.gold, state.stone];
  mage.spellbook = [{ id: "known-a" }, { id: "known-b" }];
  expect(createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0 }))
    .toEqual({ ok: false, reason: "capacity", capacity: 2 });
  mage.spellbook = [];
  mage.level = 12;
  mage.stats.intelligence = 13;
  expect(createSpellBlueprint(state, { mageId: mage.id, mode: "custom", element: "fire", effect: "intensity", roll: () => 0 }))
    .toEqual({ ok: false, reason: "intelligence", requiredIntelligence: 14 });
  expect([state.gold, state.stone]).toEqual(before);
});

test("invalid mage or options are rejected without charging resources", () => {
  const state = libraryState();
  const before = [state.gold, state.stone];
  expect(createSpellBlueprint(state, { mageId: "missing", mode: "random" }).ok).toBe(false);
  expect(createSpellBlueprint(state, { mageId: state.heroes[0].id, mode: "random", element: "plasma" }).ok).toBe(false);
  expect([state.gold, state.stone]).toEqual(before);
});
