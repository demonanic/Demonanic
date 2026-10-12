import { createNewState, createTower, guildRepairDefenses, guildManufactureAmmo, towerDerived } from "./logic";

function guildState() {
  const state = createNewState(["knight"]);
  state.gold = 10000;
  state.stone = 10000;
  state.food = 10000;
  state.buildings = { guild: { unlocked: true, level: 1, hp: 1000, maxHp: 1000, activity: "Idle" } };
  state.towers = [createTower("archer", 10, 10), createTower("wizard", 20, 20)];
  return state;
}

describe("Guild services", () => {
  test("repairs damaged towers and barricades for Food", () => {
    const state = guildState();
    state.towers[0].hp = 100;
    state.barricades[0] = { hp: 50, maxHp: 100 };
    const foodBefore = state.food;
    const result = guildRepairDefenses(state);
    expect(result).toEqual({ foodCost: expect.any(Number), towers: 1, barricades: 1 });
    expect(state.towers[0].hp).toBe(towerDerived(state.towers[0]).maxHp);
    expect(state.barricades[0].hp).toBe(100);
    expect(state.food).toBeLessThan(foodBefore);
  });

  test("does not repair when Guild is locked or supplies are insufficient", () => {
    const state = guildState();
    state.towers[0].hp = 100;
    state.buildings.guild.unlocked = false;
    expect(guildRepairDefenses(state)).toBe(false);
    state.buildings.guild.unlocked = true;
    state.food = 0;
    expect(guildRepairDefenses(state)).toBe(false);
    expect(state.towers[0].hp).toBe(100);
  });

  test("manufactures a level-scaled ammo batch and charges Gold and Stone", () => {
    const state = guildState();
    const tower = state.towers[0];
    tower.ammo = 0;
    const goldBefore = state.gold;
    const stoneBefore = state.stone;
    const result = guildManufactureAmmo(state, 0);
    expect(result.amount).toBeGreaterThan(0);
    expect(tower.ammo).toBe(result.amount);
    expect(tower.ammo).toBeLessThan(towerDerived(tower).maxAmmo);
    expect(state.gold).toBe(goldBefore - result.goldCost);
    expect(state.stone).toBe(stoneBefore - result.stoneCost);
  });

  test("does not manufacture Mana for Wizard Towers or bypass resource costs", () => {
    const state = guildState();
    state.towers[1].mana = 0;
    expect(guildManufactureAmmo(state, 1)).toBe(false);
    state.gold = 0;
    expect(guildManufactureAmmo(state, 0)).toBe(false);
  });
});
