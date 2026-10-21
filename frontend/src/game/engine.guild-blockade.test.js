import * as C from "./config";
import { Engine, LAYOUT } from "./engine";
import { createNewState } from "./logic";

function engineForEnemyType(type) {
  const sim = createNewState(["knight"]);
  sim.guildBlockadeLevel = 1;
  sim.guildBlockadeActiveUntil = 2000;
  sim.barricades[0] = { hp: 1000, maxHp: 1000 };
  const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
  const base = C.ENEMIES[type] || C.BOSSES?.[type] || {};
  const enemy = {
    type,
    name: base.name || type,
    hp: 500,
    maxHp: 500,
    speed: 30,
    damage: 70,
    x: LAYOUT.W / 10,
    y: LAYOUT.WALL_Y - 2,
    lane: 0,
    atkCd: 0,
    abilityCd: 10,
    boss: !!base.boss,
    floats: !!base.floats,
    objective: "castle",
    affinities: base.affinities || {},
  };
  engine._updateEnemy(enemy, 0.1);
  return { engine, enemy };
}

describe("temporary universal Guild blockade", () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(Object.keys(C.ENEMIES))("%s is stopped at a live barricade while active", (type) => {
    jest.spyOn(Date, "now").mockReturnValue(1000);
    const { engine, enemy } = engineForEnemyType(type);
    expect(enemy.y).toBe(LAYOUT.WALL_Y - 2);
    expect(engine.sim.barricades[0].hp).toBe(1000);
  });

  test("enemies resume base behavior after expiry instead of remaining trapped", () => {
    jest.spyOn(Date, "now").mockReturnValue(3000);
    const { engine, enemy } = engineForEnemyType("ghost");
    expect(enemy.y).toBeGreaterThan(LAYOUT.WALL_Y - 2);
    expect(engine.sim.barricades[0].hp).toBe(1000);

    const goblin = { ...enemy, type: "goblin", floats: false, y: LAYOUT.WALL_Y - 2, atkCd: 0.1, speed: 30 };
    engine._updateEnemy(goblin, 0.1);
    expect(engine.sim.barricades[0].hp).toBeLessThan(1000);
  });
});

describe("one-survivor group revival", () => {
  test("charges each fallen hero once and restores only them at the configured HP", () => {
    const sim = createNewState(["knight", "rouge", "mage", "archer"]);
    sim.gold = 2000;
    sim.heroes[0].hp = 100;
    for (const hero of sim.heroes.slice(1)) hero.hp = 0;
    sim.towers = [{ hp: 123, maxHp: 500 }];
    sim.castleHp = 321;
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 0 });
    const offer = engine.getFallenHeroRevivalOffer();
    expect(offer.heroIds).toEqual(sim.heroes.slice(1).map((hero) => hero.id));
    expect(offer.cost).toBe(3 * C.paidRevivalCost(1));

    const result = engine.reviveFallenHeroes();
    expect(result).toEqual(offer);
    expect(sim.gold).toBe(2000 - offer.cost);
    expect(engine.heroes[0].ref.hp).toBe(100);
    for (const hero of engine.heroes.slice(1)) {
      expect(hero.ref.hp).toBe(Math.round(hero.d.maxHp * C.RECOVERY.reviveHpPercent / 100));
      expect(hero.alive).toBe(true);
    }
    expect(sim.towers[0].hp).toBe(123);
    expect(sim.castleHp).toBe(321);
    expect(engine.reviveFallenHeroes()).toBe(false);
  });

  test("does not offer group revival after complete squad defeat", () => {
    const sim = createNewState(["knight", "rouge"]);
    sim.heroes.forEach((hero) => { hero.hp = 0; });
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 0 });
    expect(engine.getFallenHeroRevivalOffer()).toBeNull();
    expect(engine.reviveFallenHeroes()).toBe(false);
  });
});
