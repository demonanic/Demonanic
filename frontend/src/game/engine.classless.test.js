import { createHeroModel, HERO_BASELINE } from "./heroModel";
import { createNewState } from "./logic";
import { Engine } from "./engine";

function makeEngine(options = {}) {
  const sim = createNewState();
  sim.heroes = [createHeroModel({ id: "shared-hero", name: "Aster" })];
  const onEnd = jest.fn();
  const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 100 }, { onEnd, ...options });
  return { sim, engine, onEnd, hero: engine.heroes[0] };
}

function enemy(name, x, y, overrides = {}) {
  return { name, type: "targetDummy", hp: 500, maxHp: 500, x, y, speed: 0, lane: -1, floats: true, dmgBy: {}, affinities: {}, ...overrides };
}

describe("bounded classless combat adapter", () => {
  test("uses the approved shared profile without a legacy class or resource pool", () => {
    const { engine, hero } = makeEngine();
    expect(hero.ref.cls).toBeUndefined();
    expect(hero.d).toMatchObject({ maxHp: 300, attack: 16, range: 220, rangeMode: "midline", rate: 1.05, movementSpeed: 155, defense: 10, agility: 10, critChance: 0.05, critMult: 1.5, dodge: 0.05, damageType: null });
    expect(hero.mana).toBe(0);
    expect(engine.getRangedTargetStatus(0)).toMatchObject({ heroName: "Aster", range: 220 });
  });

  test("basic direct weapon hits deal 16 neutral damage and use the baseline interval", () => {
    const { engine, hero } = makeEngine();
    const target = enemy("Neutral", hero.x + 100, hero.y, {
      affinities: { archer_ranged: "immune", knight_melee: "immune", arcane: "immune" },
    });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

    engine._fire("H0", hero, target, hero.d, true);
    engine._applyHit(engine.projectiles[0]);
    expect(target.hp).toBe(484);
    expect(target.dmgBy.H0).toBe(16);

    engine.projectiles = [];
    engine.update(0.01);
    expect(engine.projectiles).toHaveLength(1);
    engine.update(1.03);
    expect(engine.projectiles).toHaveLength(0);
    engine.update(0.03);
    expect(engine.projectiles).toHaveLength(1);
    random.mockRestore();
  });

  test("midline uses its explicit mode even below the legacy numeric threshold and holds position", () => {
    const { engine, hero } = makeEngine();
    hero.d.range = 120;
    const target = enemy("Inside", hero.x + 110, hero.y);
    engine.active = [target];
    expect(engine.setTargetSelection(0)).toBe(true);
    expect(engine.getRangedTargetStatus(0).targets[0].enemy).toBe(target);

    const start = { x: hero.x, y: hero.y };
    engine.active = [enemy("Outside", hero.x + 121, hero.y)];
    engine.update(0.5);
    expect({ x: hero.x, y: hero.y }).toEqual(start);
    expect(hero.currentTarget).toBeNull();
  });

  test("explicit movement uses the approved 155 world units per second", () => {
    const { engine, hero } = makeEngine();
    const startX = hero.x;
    expect(engine.commandHeroMoveTo(0, startX + 40, hero.y)).toBe(true);
    engine.update(0.1);
    expect(hero.x - startX).toBeCloseTo(15.5, 5);
  });

  test("selects nearest valid target, retains it, and reacquires by stable active order", () => {
    const { engine, hero } = makeEngine();
    const firstSpawn = enemy("first", hero.x - 50, hero.y);
    const equalDistanceSecond = enemy("second", hero.x + 50, hero.y);
    engine.active = [firstSpawn, equalDistanceSecond];
    expect(engine._selectTarget(hero)).toBe(firstSpawn);

    const closerLater = enemy("closer", hero.x + 10, hero.y);
    engine.active.unshift(closerLater);
    expect(engine._selectTarget(hero)).toBe(firstSpawn);

    firstSpawn.hp = 0;
    expect(engine._selectTarget(hero)).toBe(closerLater);
    closerLater.x = hero.x + HERO_BASELINE.basicAttack.range + 1;
    expect(engine._selectTarget(hero)).toBe(equalDistanceSecond);
    equalDistanceSecond.x = hero.x + HERO_BASELINE.basicAttack.range + 2;
    expect(engine._selectTarget(hero)).toBeNull();
  });

  test("ignores dead, out-of-range, and non-active targets without partial tactical mutation", () => {
    const { engine, hero } = makeEngine();
    const dead = enemy("dead", hero.x + 10, hero.y, { hp: 0 });
    const far = enemy("far", hero.x + 221, hero.y);
    engine.active = [dead, far];
    expect(engine._selectTarget(hero)).toBeNull();
    expect(engine.commandHeroAttack(0, far)).toBe(false);
    expect(hero.manual).toBe(false);
    expect(hero.manualTarget).toBeNull();
  });

  test("Shared Strike deals one 24 raw neutral hit, costs no resource, and enforces 12 seconds", () => {
    const { engine, sim, hero } = makeEngine();
    const target = enemy("primary", hero.x + 80, hero.y);
    const adjacent = enemy("adjacent", hero.x + 90, hero.y);
    engine.active = [target, adjacent];
    const goldBefore = sim.gold;
    const hpBefore = hero.ref.hp;
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(engine.getHeroAbilityStatus(0)[0]).toMatchObject({
      id: "shared_strike", available: true, cooldown: 0, damage: 24, cooldownSeconds: 12,
      resourceCost: 0, desc: expect.stringContaining("24 raw direct-hit weapon damage at baseline"),
    });
    expect(engine.useHeroAbility(0, "shared_strike")).toBe(true);
    expect(target.hp).toBe(476);
    expect(adjacent.hp).toBe(500);
    expect(target.dmgBy.H0).toBe(24);
    expect(target.stunUntil).toBeUndefined();
    expect(target.slowUntil).toBeUndefined();
    expect(hero.ref.hp).toBe(hpBefore);
    expect(hero.mana).toBe(0);
    expect(sim.gold).toBe(goldBefore);
    expect(engine.getHeroAbilityStatus(0)[0]).toMatchObject({ available: false, cooldown: 12 });
    expect(engine.useSharedStrike(0, target)).toBe(false);
    expect(target.hp).toBe(476);

    engine.active = [];
    engine.update(6);
    expect(engine.heroes[0].abilityCooldowns.shared_strike).toBe(6);
    engine.update(6.01);
    expect(engine.heroes[0].abilityCooldowns.shared_strike).toBe(0);
    random.mockRestore();
  });

  test("Shared Strike applies the approved critical multiplier and rejects invalid targets atomically", () => {
    const { engine, hero } = makeEngine();
    const target = enemy("target", hero.x + 40, hero.y);
    const outside = enemy("outside", hero.x + 221, hero.y);
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    expect(engine.useSharedStrike(0, outside)).toBe(false);
    expect(engine.heroes[0].abilityCooldowns.shared_strike).toBeUndefined();
    expect(target.hp).toBe(500);
    expect(engine.useSharedStrike(0, target)).toBe(true);
    expect(target.hp).toBe(464);
    random.mockRestore();
  });

  test("classless death writes nested HP and triggers the existing defeat lifecycle", () => {
    const { engine, sim, onEnd, hero } = makeEngine();
    sim.heroes[0].combat.hp = 1;
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    engine._enemyAttack({ type: "goblin", damage: 10 }, { kind: "hero", obj: hero });
    expect(sim.heroes[0].combat.hp).toBe(0);
    expect(hero.alive).toBe(false);
    engine._checkEnd();
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ victory: false, reason: "heroes" }));
    random.mockRestore();
  });

  test("enemy deaths use the normal kill, reward, and attribution lifecycle", () => {
    const { engine, sim, hero } = makeEngine();
    const target = enemy("fragile", hero.x + 20, hero.y, { hp: 16, maxHp: 16, tier: "basic" });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    engine._fire("H0", hero, target, hero.d, true);
    engine._applyHit(engine.projectiles[0]);
    expect(target._dead).toBe(true);
    expect(engine.killed).toBe(1);
    expect(sim.kills.total).toBe(1);
    expect(engine.xpGains.heroes[0]).toBeGreaterThan(0);
    random.mockRestore();
  });
});
