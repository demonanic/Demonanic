import { createNewState } from "./logic";
import { SPELL_DATABASE, createSpellBlueprint, startSpellResearch, advanceLibraryResearch, librarySuccessChance } from "./libraryResearch";

function libraryState() {
  const state = createNewState(["mage"]);
  state.buildings = {
    library: { level: 1, hp: 1000, maxHp: 1000, unlocked: true },
  };
  state.gold = 1000;
  state.stone = 500;
  return state;
}

test("custom spell discovery uses Intelligence and creates a persistent blueprint", () => {
  const state = libraryState();
  state.heroes[0].stats.intelligence = 20;
  expect(librarySuccessChance(state)).toBeGreaterThan(45);
  const result = createSpellBlueprint(state, { mode: "custom", element: "ice", effect: "area", roll: () => 0 });
  expect(result.ok).toBe(true);
  expect(result.blueprint.element).toBe("ice");
  expect(result.blueprint.effect).toBe("area");
  expect(state.gold).toBe(920);
  expect(state.stone).toBe(480);
});

test("failed discovery consumes its attempt cost without adding a blueprint", () => {
  const state = libraryState();
  const result = createSpellBlueprint(state, { mode: "custom", element: "fire", effect: "time", roll: () => 0.99 });
  expect(result.ok).toBe(false);
  expect(result.reason).toBe("roll");
  expect(state.libraryBlueprints).toHaveLength(0);
  expect(state.libraryFailedDesigns).toBe(1);
});

test("research duration sets strength and completion unlocks the spell", () => {
  const state = libraryState();
  const found = createSpellBlueprint(state, { mode: "custom", element: "electric", effect: "intensity", roll: () => 0 });
  const started = startSpellResearch(state, found.blueprint.id, 2);
  expect(started.ok).toBe(true);
  expect(state.libraryResearch.remainingSeconds).toBe(7200);
  expect(advanceLibraryResearch(state, 3600)).toBe(false);
  expect(state.librarySpells).toHaveLength(0);
  const completed = advanceLibraryResearch(state, 3600);
  expect(completed.name).toBe(found.blueprint.name);
  expect(completed.researchHours).toBe(2);
  expect(state.librarySpells).toHaveLength(1);
  expect(state.libraryBlueprints).toHaveLength(0);
  expect(state.libraryResearch).toBe(null);
});

test("random discovery selects an entry from the catalog", () => {
  const state = libraryState();
  const result = createSpellBlueprint(state, { mode: "random", element: "fire", effect: "intensity", roll: () => 0 });
  expect(result.ok).toBe(true);
  expect(result.blueprint.catalogId).toBe("ember_bolt");
  expect(result.blueprint.element).toBe("fire");
});


test("random discovery with an exhausted catalog costs nothing and does not roll", () => {
  const state = libraryState();
  state.librarySpells = SPELL_DATABASE.map((spell) => ({ ...spell }));
  const roll = jest.fn(() => 0);
  const goldBefore = state.gold;
  const stoneBefore = state.stone;
  const result = createSpellBlueprint(state, { mode: "random", roll });
  expect(result).toEqual({ ok: false, reason: "catalog" });
  expect(state.gold).toBe(goldBefore);
  expect(state.stone).toBe(stoneBefore);
  expect(roll).not.toHaveBeenCalled();
});

test("invalid discovery options are rejected without charging resources", () => {
  const state = libraryState();
  const goldBefore = state.gold;
  const stoneBefore = state.stone;
  const result = createSpellBlueprint(state, { mode: "random", element: "plasma", effect: "area" });
  expect(result.ok).toBe(false);
  expect(state.gold).toBe(goldBefore);
  expect(state.stone).toBe(stoneBefore);
});
