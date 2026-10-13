import { createNewState, hostTavernFeast } from "./logic";
import { TAVERN_FEAST } from "./config";

function stateWithTavern() {
  const state = createNewState(["knight", "rouge", "mage", "archer"]);
  state.buildings = {
    tavern: { unlocked: true, level: 1, hp: 1000, maxHp: 1000, activity: "Idle" },
  };
  state.morale = 50;
  return state;
}

describe("Tavern morale service", () => {
  test("feast spends resources and raises morale by the configured amount", () => {
    const state = stateWithTavern();
    const before = { gold: state.gold, stone: state.stone };

    expect(hostTavernFeast(state)).toBe(true);
    expect(state.gold).toBe(before.gold - TAVERN_FEAST.gold);
    expect(state.stone).toBe(before.stone - TAVERN_FEAST.stone);
    expect(state.morale).toBe(50 + TAVERN_FEAST.morale);
    expect(state.buildings.tavern.activity).toBe("Hosted a Feast");
  });

  test("morale cannot exceed 100", () => {
    const state = stateWithTavern();
    state.morale = 96;

    expect(hostTavernFeast(state)).toBe(true);
    expect(state.morale).toBe(100);
  });

  test("does not charge resources when morale is already full", () => {
    const state = stateWithTavern();
    state.morale = 100;
    const before = { gold: state.gold, food: state.food };

    expect(hostTavernFeast(state)).toBe(false);
    expect(state.gold).toBe(before.gold);
    expect(state.stone).toBe(before.stone);
  });

  test("rejects unaffordable feasts without charging either resource", () => {
    const state = stateWithTavern();
    state.gold = TAVERN_FEAST.gold - 1;
    const beforeStone = state.stone;

    expect(hostTavernFeast(state)).toBe(false);
    expect(state.gold).toBe(TAVERN_FEAST.gold - 1);
    expect(state.stone).toBe(beforeStone);
  });

  test("a destroyed or locked Tavern cannot host a feast", () => {
    const state = stateWithTavern();
    const before = { gold: state.gold, food: state.food };
    state.buildings.tavern.hp = 0;

    expect(hostTavernFeast(state)).toBe(false);
    expect(state.gold).toBe(before.gold);
    expect(state.food).toBe(before.food);
  });
});
