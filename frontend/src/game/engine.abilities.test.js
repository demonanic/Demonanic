import { createNewState } from "./logic";
import { Engine } from "./engine";
import { unlockedAbilities } from "./perks";

const STARTER_ABILITIES = {
  knight: "knight_shield_bash",
  rouge: "rouge_backstab_ability",
  mage: "mage_mend_ability",
  archer: "archer_focus_volley",
};

function makeEngine(classes, callbacks = {}) {
  const sim = createNewState(classes);
  const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 0 }, callbacks);
  return { sim, engine };
}

function makeEnemy(overrides = {}) {
  return {
    hp: 2000,
    maxHp: 2000,
    x: 210,
    y: 500,
    dmgBy: {},
    affinities: {},
    ...overrides,
  };
}

describe("starter hero abilities", () => {
  test.each(Object.entries(STARTER_ABILITIES))("%s has a distinct ability available without perks", (cls, abilityId) => {
    const { sim, engine } = makeEngine(cls === "mage" ? [cls, "knight"] : [cls]);
    const enemy = makeEnemy();
    engine.active = [enemy];
    if (cls === "mage") {
      const ally = sim.heroes[1];
      ally.hp = ally.maxHp / 2;
    }

    expect(unlockedAbilities(sim.heroes[0]).map((ability) => ability.id)).toContain(abilityId);
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === abilityId).available).toBe(true);
    const beforeHp = enemy.hp;
    const beforeAllyHp = sim.heroes[1]?.hp;

    expect(engine.useHeroAbility(0, abilityId)).toBe(true);

    if (cls === "knight") {
      expect(enemy.hp).toBeLessThan(beforeHp);
      expect(enemy.stunUntil).toBe(2);
    } else if (cls === "rouge") {
      expect(enemy.hp).toBeLessThan(beforeHp);
    } else if (cls === "mage") {
      expect(sim.heroes[1].hp).toBeGreaterThan(beforeAllyHp);
      expect(enemy.hp).toBe(beforeHp);
    } else {
      expect(beforeHp - enemy.hp).toBeCloseTo(engine.heroes[0].d.attack * 0.75 * 3);
    }
    expect(engine.heroes[0].abilityCooldowns[abilityId]).toBeGreaterThan(0);
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === abilityId)).toMatchObject({
      available: false,
      reason: "cooldown",
    });
    expect(engine.useHeroAbility(0, abilityId)).toBe(false);
  });

  test("does not consume Shield Bash when no enemy is in range or the target is immune", () => {
    const { engine } = makeEngine(["knight"]);
    const abilityId = STARTER_ABILITIES.knight;
    engine.active = [makeEnemy({ y: 300 })];
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === abilityId)).toMatchObject({
      available: false,
      reason: "no_target",
    });
    expect(engine.useHeroAbility(0, abilityId)).toBe(false);

    engine.active = [makeEnemy({ affinities: { knight_melee: "immune" } })];
    expect(engine.useHeroAbility(0, abilityId)).toBe(false);
    expect(engine.heroes[0].abilityCooldowns[abilityId]).toBeUndefined();
  });

  test("Mend is unavailable until another living hero is wounded", () => {
    const { engine } = makeEngine(["mage", "knight"]);
    const abilityId = STARTER_ABILITIES.mage;
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === abilityId)).toMatchObject({
      available: false,
      reason: "no_target",
    });
    expect(engine.useHeroAbility(0, abilityId)).toBe(false);
    expect(engine.heroes[0].abilityCooldowns[abilityId]).toBeUndefined();

    engine.heroes[1].ref.hp -= 20;
    expect(engine.useHeroAbility(0, abilityId)).toBe(true);
  });

  test("dead heroes cannot use their starter ability", () => {
    const { engine } = makeEngine(["archer"]);
    engine.heroes[0].alive = false;
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === STARTER_ABILITIES.archer)).toMatchObject({
      available: false,
      reason: "unavailable",
    });
    expect(engine.useHeroAbility(0, STARTER_ABILITIES.archer)).toBe(false);
  });

  test("Speed Rush increases movement by 1.5x for five seconds without changing attack tempo", () => {
    const { engine } = makeEngine(["rouge"]);
    const hero = engine.heroes[0];
    hero.ref.perks = ["rouge_flurry", "rouge_evasion"];
    const enemy = makeEnemy({ x: hero.x + 220, y: hero.y });
    engine.active = [enemy];
    engine._updateEnemy = jest.fn();
    engine.spawnQueue = [];
    hero.cd = 1;
    const attackRate = hero.d.rate;

    expect(engine.useHeroAbility(0, "rouge_speed_rush")).toBe(true);
    expect(hero.speedRushUntil).toBe(5);
    expect(hero.abilityCooldowns.rouge_speed_rush).toBe(10);
    expect(hero.cd).toBe(1);

    const start = { x: hero.x, y: hero.y };
    engine.update(0.1);
    expect(Math.hypot(hero.x - start.x, hero.y - start.y)).toBeCloseTo(155 * 0.1 * 1.5);
    expect(hero.cd).toBeCloseTo(0.9);
    expect(hero.abilityCooldowns.rouge_speed_rush).toBeCloseTo(9.9);
    expect(hero.d.rate).toBe(attackRate);

    hero.x = enemy.x - 220;
    hero.y = enemy.y;
    engine.time = hero.speedRushUntil - 0.05;
    const atDeadlineStart = { x: hero.x, y: hero.y };
    engine.update(0.05);
    expect(engine.time).toBe(hero.speedRushUntil);
    expect(Math.hypot(hero.x - atDeadlineStart.x, hero.y - atDeadlineStart.y)).toBeCloseTo(155 * 0.05);
    expect(hero.cd).toBeCloseTo(0.85);
    expect(hero.abilityCooldowns.rouge_speed_rush).toBeCloseTo(9.85);
    expect(hero.d.rate).toBe(attackRate);
  });

  test("successful abilities notify the tactical menu after the engine resolves the frame", () => {
    const onActionResolved = jest.fn();
    const { engine } = makeEngine(["knight"], { onActionResolved });
    engine.wave.total = 100;
    engine.active = [makeEnemy()];

    expect(engine.useHeroAbility(0, STARTER_ABILITIES.knight)).toBe(true);
    expect(onActionResolved).not.toHaveBeenCalled();
    engine.update(0.016);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "completed" });
  });
});
