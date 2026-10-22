import { createNewState } from "./logic";
import { Engine } from "./engine";
import { mergeClasslessBattleResults } from "./classlessBattleResults";
import { createHeroModel, serializeGameState } from "./heroModel";
import { normalizeState } from "../context/GameProvider";

function makeFixture(hp = 300) {
  const state = createNewState();
  state.heroes = [createHeroModel({ id: "lifecycle-hero", name: "Aster", appearanceId: "look-a" })];
  state.heroes[0].combat.hp = hp;
  state.heroes[0].progression = { level: 1, xp: 0, ap: 2, sp: 3, ownedNodeIds: ["existing-node"] };
  state.gold = 400;
  state.castleHp = 875;
  state.accountMarker = { disposable: true };
  const sim = JSON.parse(JSON.stringify(state));
  let result;
  let endCalls = 0;
  const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 }, { onEnd: (value) => { result = value; endCalls += 1; } });
  return { state, sim, engine, getResult: () => result, getEndCalls: () => endCalls };
}

describe("disposable classless battle lifecycle composition", () => {
  afterEach(() => jest.restoreAllMocks());

  test("real engine victory reward and XP survive identity merge and normalized serialization", () => {
    const { state, sim, engine, getResult, getEndCalls } = makeFixture();
    const heroId = state.heroes[0].identity.id;
    const target = {
      name: "Test target", type: "targetDummy", tier: "basic", hp: 1, maxHp: 1,
      x: engine.heroes[0].x + 20, y: engine.heroes[0].y, speed: 0, lane: -1,
      floats: true, dmgBy: {}, affinities: {},
    };
    engine.active = [target];
    engine.spawnQueue = [];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    engine._fire("H0", engine.heroes[0], target, engine.heroes[0].d, true);
    engine._applyHit(engine.projectiles[0]);
    engine.active = [];
    engine._checkEnd();

    const result = getResult();
    expect(result).toMatchObject({ victory: true, reason: "cleared", killed: 1 });
    expect(result.xpGains.heroes[0]).toBeGreaterThan(0);
    expect(engine.killed).toBe(1);
    expect(sim.gold).toBeGreaterThan(state.gold);
    const rewardedGold = sim.gold;
    engine._checkEnd();
    expect(engine.killed).toBe(1);
    expect(sim.gold).toBe(rewardedGold);
    expect(getEndCalls()).toBe(1);

    const staged = mergeClasslessBattleResults(state, {
      heroIds: [heroId], runtimeHeroes: sim.heroes, xpGains: result.xpGains.heroes,
    });
    staged.gold = sim.gold;
    staged.kills = sim.kills;
    const reloaded = normalizeState(serializeGameState(staged));
    const hero = reloaded.heroes[0];
    expect(hero.identity.id).toBe(heroId);
    expect(hero.cls).toBeUndefined();
    expect(hero.combat.hp).toBe(300);
    expect(hero.progression).toMatchObject({ ap: 2, sp: 3, ownedNodeIds: ["existing-node"] });
    expect(hero.progression.xp).toBe(result.xpGains.heroes[0]);
    expect(reloaded.gold).toBe(sim.gold);
    expect(reloaded.castleHp).toBe(state.castleHp);
    expect(reloaded.accountMarker).toEqual(state.accountMarker);
    random.mockRestore();
  });

  test("real engine defeat keeps zero nested HP through result merge and reload", () => {
    const { state, sim, engine, getResult } = makeFixture(1);
    const heroId = state.heroes[0].identity.id;
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    engine._enemyAttack({ type: "goblin", damage: 20 }, { kind: "hero", obj: engine.heroes[0] });
    engine._checkEnd();

    const result = getResult();
    expect(result).toMatchObject({ victory: false, reason: "heroes" });
    expect(sim.heroes[0].combat.hp).toBe(0);
    const staged = mergeClasslessBattleResults(state, {
      heroIds: [heroId], runtimeHeroes: sim.heroes, xpGains: result.xpGains.heroes,
    });
    const reloaded = normalizeState(serializeGameState(staged));
    expect(reloaded.heroes[0].identity.id).toBe(heroId);
    expect(reloaded.heroes[0].combat.hp).toBe(0);
    expect(reloaded.heroes[0].cls).toBeUndefined();
    random.mockRestore();
  });
});
