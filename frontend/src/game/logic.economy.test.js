import { createNewState, productionRates, canAfford, spend } from "./logic";
import * as C from "./config";

describe("Food-free resource economy", () => {
  test("Mine ratio assigns its full output to Gold or Metal as selected", () => {
    const state = createNewState(["knight"]);
    state.workers = 1;
    state.workersGold = 1;
    state.workersStone = 0;
    state.mineGoldRatio = 1;
    state.buildings = {
      mine: { level: 1, hp: 1000, maxHp: 1000 },
      quarry: { level: 1, hp: 1000, maxHp: 1000 },
    };
    let rates = productionRates(state);
    expect(rates.gold).toBeGreaterThan(0);
    expect(rates.metal).toBe(0);
    state.mineGoldRatio = 0;
    rates = productionRates(state);
    expect(rates.gold).toBe(0);
    expect(rates.metal).toBeGreaterThan(0);
  });

  test("split ratio preserves total Mine output", () => {
    const state = createNewState(["knight"]);
    state.workers = 1;
    state.workersGold = 1;
    state.workersStone = 0;
    state.mineGoldRatio = 0.5;
    state.buildings = { mine: { level: 1, hp: 1000, maxHp: 1000 }, quarry: { level: 1, hp: 1000, maxHp: 1000 } };
    const rates = productionRates(state);
    expect(rates.gold).toBeCloseTo(rates.metal, 8);
    expect(rates.gold + rates.metal).toBeCloseTo(C.PRODUCTION.goldPerWorkerMin * C.moraleMultiplier(state.morale / 100) * C.castleEfficiency(state.castleHp / state.castleMaxHp), 8);
  });

  test("resource affordability and spending only use Gold, Stone, and Metal", () => {
    const state = createNewState(["knight"]);
    state.gold = 100;
    state.stone = 50;
    state.metal = 25;
    expect(Object.prototype.hasOwnProperty.call(state, "food")).toBe(false);
    expect(canAfford(state, { gold: 20, stone: 10, metal: 5 })).toBe(true);
    spend(state, { gold: 20, stone: 10, metal: 5 });
    expect(state.gold).toBe(80);
    expect(state.stone).toBe(40);
    expect(state.metal).toBe(20);
  });
});
