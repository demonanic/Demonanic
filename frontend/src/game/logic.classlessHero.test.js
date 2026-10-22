import { createHero, createNewState, recruitHero } from "./logic";

describe("classless hero creation adapter", () => {
  test("no-argument hero creation returns the classless baseline", () => {
    const hero = createHero();
    expect(hero).not.toHaveProperty("cls");
    expect(hero.combat.maxHp).toBe(300);
    expect(hero.progression).toMatchObject({ level: 1, xp: 0, ap: 0, sp: 0, ownedNodeIds: [] });
  });

  test("classless recruitment preserves profile economy and only charges after success", () => {
    const state = createNewState();
    const initialGold = state.gold;
    const initialEconomy = {
      stone: state.stone,
      metal: state.metal,
      workers: state.workers,
      castleHp: state.castleHp,
      castleMaxHp: state.castleMaxHp,
    };

    expect(recruitHero(state)).toBe(true);
    expect(state.heroes).toHaveLength(1);
    expect(state.heroes[0]).not.toHaveProperty("cls");
    expect(state.heroes[0].combat.hp).toBe(300);
    expect(state.gold).toBeLessThan(initialGold);
    expect({ stone: state.stone, metal: state.metal, workers: state.workers,
      castleHp: state.castleHp, castleMaxHp: state.castleMaxHp }).toEqual(initialEconomy);

    const broke = createNewState();
    broke.gold = 0;
    const before = JSON.stringify(broke);
    expect(recruitHero(broke)).toBe(false);
    expect(JSON.stringify(broke)).toBe(before);
  });

  test("legacy explicit class creation remains available for existing consumers", () => {
    const legacyHero = createHero("knight");
    expect(legacyHero.cls).toBe("knight");
    expect(legacyHero.hp).toBeGreaterThan(0);
  });
});
