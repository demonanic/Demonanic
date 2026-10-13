import { createNewState, createTower, guildRepairDefenses, guildManufactureAmmo, startGuildManufacturing, advanceGuildManufacturing, towerDerived } from "./logic";

function guildState() {
  const state = createNewState(["knight"]);
  state.gold = 10000;
  state.stone = 10000;
  state.buildings = { guild: { unlocked: true, level: 1, hp: 1000, maxHp: 1000, activity: "Idle" } };
  state.guildWorkers = 2;
  state.towers = [createTower("archer", 10, 10), createTower("wizard", 20, 20)];
  return state;
}

describe("Guild services", () => {
  test("repairs damaged towers and barricades for Gold and Stone", () => {
    const state = guildState();
    state.towers[0].hp = 100;
    state.barricades[0] = { hp: 50, maxHp: 100 };
    const goldBefore = state.gold;
    const stoneBefore = state.stone;
    const result = guildRepairDefenses(state);
    expect(result).toEqual({ goldCost: expect.any(Number), stoneCost: expect.any(Number), towers: 1, barricades: 1 });
    expect(state.towers[0].hp).toBe(towerDerived(state.towers[0]).maxHp);
    expect(state.barricades[0].hp).toBe(100);
    expect(state.gold).toBeLessThan(goldBefore);
    expect(state.stone).toBeLessThan(stoneBefore);
  });

  test("does not repair when Guild is locked or supplies are insufficient", () => {
    const state = guildState();
    state.towers[0].hp = 100;
    state.buildings.guild.unlocked = false;
    expect(guildRepairDefenses(state)).toBe(false);
    state.buildings.guild.unlocked = true;
    state.gold = 0;
    expect(guildRepairDefenses(state)).toBe(false);
    expect(state.towers[0].hp).toBe(100);
  });

  test("manufactures ammunition over time from stored Metal and Stone, then refills towers from cache", () => {
    const state = guildState(); const tower = state.towers[0]; tower.ammo = 0; state.metal = 1000; state.stone = 1000;
    const result = startGuildManufacturing(state, "archer", 30);
    expect(result.amount).toBe(30); expect(tower.ammo).toBe(0); expect(state.metal).toBe(970); expect(state.stone).toBe(992);
    advanceGuildManufacturing(state, 3600);
    expect(state.guildAmmoCache.archer).toBe(30);
    const refill = guildManufactureAmmo(state, 0);
    expect(refill.amount).toBe(30); expect(tower.ammo).toBe(30); expect(state.guildAmmoCache.archer).toBe(0);
  });

  test("does not manufacture Mana for Wizard Towers or bypass resource costs", () => {
    const state = guildState();
    state.towers[1].mana = 0;
    expect(guildManufactureAmmo(state, 1)).toBe(false);
    state.gold = 0;
    expect(guildManufactureAmmo(state, 0)).toBe(false);
  });
});
