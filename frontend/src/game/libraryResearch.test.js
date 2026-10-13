import { createNewState } from "./logic";
import { createSpellBlueprint, startSpellResearch, advanceLibraryResearch, librarySuccessChance } from "./libraryResearch";

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
