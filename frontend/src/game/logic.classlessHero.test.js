import { createHero, createNewState, recruitHero, setClasslessSquad } from "./logic";

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

  test("new profile classless squad uses four shared models and preserves profile economy", () => {
    const state = createNewState();
    const economy = { gold: state.gold, stone: state.stone, metal: state.metal, castleHp: state.castleHp };
    expect(setClasslessSquad(state)).toBe(true);
    expect(state.heroes).toHaveLength(4);
    expect(state.heroes.every((hero) => !hero.cls && hero.combat.maxHp === 300)).toBe(true);
    expect(new Set(state.heroes.map((hero) => hero.identity.id)).size).toBe(4);
    expect(state.needsSquad).toBe(false);
    expect({ gold: state.gold, stone: state.stone, metal: state.metal, castleHp: state.castleHp }).toEqual(economy);
  });

  test("classless squad setup rejects occupied profiles without mutation", () => {
    const state = createNewState(["knight"]);
    const before = JSON.stringify(state);
    expect(setClasslessSquad(state)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
});
