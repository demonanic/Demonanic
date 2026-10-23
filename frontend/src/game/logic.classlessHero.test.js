import { createHero, createNewState, freeLife, healHero, recruitHero, recoverOverTime, reviveHero, setClasslessSquad } from "./logic";
import { classlessRecruitCost, recruitCost } from "./config";

describe("classless hero creation adapter", () => {
  test("no-argument hero creation returns the classless baseline", () => {
    const hero = createHero();
    expect(hero).not.toHaveProperty("cls");
    expect(hero.combat.maxHp).toBe(300);
    expect(hero.progression).toMatchObject({ level: 1, xp: 0, ap: 0, sp: 0, ownedNodeIds: [] });
  });

  test("classless recruitment preserves profile economy and only charges after success", () => {
    const fresh = createNewState();
    setClasslessSquad(fresh);
    expect(classlessRecruitCost(1)).toBe(1100);
    expect(recruitCost(4)).toBe(550); // Legacy recruitment economy is unchanged.
    const freshBefore = JSON.stringify(fresh);
    expect(recruitHero(fresh)).toBe(false); // 500 starting gold cannot immediately buy a costly second hero.
    expect(JSON.stringify(fresh)).toBe(freshBefore);

    const state = createNewState();
    expect(setClasslessSquad(state)).toBe(true);
    state.gold = 2000;
    const initialGold = state.gold;
    const initialEconomy = {
      stone: state.stone,
      metal: state.metal,
      workers: state.workers,
      castleHp: state.castleHp,
      castleMaxHp: state.castleMaxHp,
    };

    expect(recruitHero(state)).toBe(true);
    expect(state.heroes).toHaveLength(2);
    expect(state.heroes[1]).not.toHaveProperty("cls");
    expect(state.heroes[1].combat.hp).toBe(300);
    expect(state.gold).toBeLessThan(initialGold);
    expect({ stone: state.stone, metal: state.metal, workers: state.workers,
      castleHp: state.castleHp, castleMaxHp: state.castleMaxHp }).toEqual(initialEconomy);

    const broke = createNewState();
    setClasslessSquad(broke);
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

  test("new profile classless squad uses one shared model and preserves profile economy", () => {
    const state = createNewState();
    const economy = { gold: state.gold, stone: state.stone, metal: state.metal, castleHp: state.castleHp };
    expect(setClasslessSquad(state)).toBe(true);
    expect(state.heroes).toHaveLength(1);
    expect(state.heroes.every((hero) => !hero.cls && hero.combat.maxHp === 300)).toBe(true);
    expect(new Set(state.heroes.map((hero) => hero.identity.id)).size).toBe(1);
    expect(state.needsSquad).toBe(false);
    expect({ gold: state.gold, stone: state.stone, metal: state.metal, castleHp: state.castleHp }).toEqual(economy);
  });

  test("classless recruitment enforces six owned heroes and six active slots atomically", () => {
    const state = createNewState();
    expect(setClasslessSquad(state)).toBe(true);
    state.gold = 100000;
    for (let i = 0; i < 5; i += 1) expect(recruitHero(state)).toBe(true);
    expect(state.heroes).toHaveLength(6);
    expect(state.bench).toHaveLength(0);
    const before = JSON.stringify(state);
    expect(recruitHero(state)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.heroes.every((hero) => !hero.cls && hero.combat)).toBe(true);
    expect(new Set(state.heroes.map((hero) => hero.identity.id)).size).toBe(6);
  });

  test("heroes in Academy training count toward the six-owned recruitment limit", () => {
    const state = createNewState();
    setClasslessSquad(state);
    state.academyHeroes = Array.from({ length: 5 }, (_, index) => createHero());
    state.gold = 100000;
    const before = JSON.stringify(state);
    expect(recruitHero(state)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  test("classless squad setup rejects occupied profiles without mutation", () => {
    const state = createNewState(["knight"]);
    const before = JSON.stringify(state);
    expect(setClasslessSquad(state)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  test("classless healing, revival, and defeat free-life actions update nested HP", () => {
    const state = createNewState();
    const hero = createHero();
    state.heroes = [hero];
    hero.combat.hp = 250;
    expect(healHero(state, hero)).toBe(true);
    expect(hero.combat.hp).toBe(300);
    expect(hero.hp).toBeUndefined();

    hero.combat.hp = 0;
    expect(reviveHero(state, hero)).toBe(true);
    expect(hero.combat.hp).toBeGreaterThan(0);
    expect(hero.hp).toBeUndefined();

    hero.combat.hp = 10;
    expect(freeLife(state)).toBe(true);
    expect(hero.combat.hp).toBe(300);
    expect(hero.hp).toBeUndefined();
  });

  test("preparation recovery heals wounded nested HP without reviving the dead", () => {
    const state = createNewState();
    const wounded = createHero();
    const dead = createHero();
    wounded.combat.hp = 150;
    dead.combat.hp = 0;
    state.heroes = [wounded, dead];
    recoverOverTime(state, 3600);
    expect(wounded.combat.hp).toBe(174);
    expect(dead.combat.hp).toBe(0);
    expect(wounded.hp).toBeUndefined();
    expect(dead.hp).toBeUndefined();
  });
});
