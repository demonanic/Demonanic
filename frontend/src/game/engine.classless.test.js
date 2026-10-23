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

  test("allocated Attack and Agility feed classless damage and evasion derivation", () => {
    const allocated = createHeroModel({ id: "allocated" });
    allocated.combat.stats.attack = 11;
    allocated.combat.stats.agility = 12;
    const refreshed = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [allocated] }, { enemies: [], total: 1 });
    expect(refreshed.heroes[0].d.attack).toBe(17);
    expect(refreshed.heroes[0].d.dodge).toBeCloseTo(0.06);
  });

  test("implemented universal passive nodes change hits, crits, attack speed, and Shared Strike cooldown", () => {
    const hero = createHeroModel({ id: "passive-build" });
    hero.progression.ownedNodeIds = ["V1", "P1", "P2a", "S1", "T1", "F1"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    expect(engine.heroes[0].d.attack).toBe(16);
    expect(engine.heroes[0].d.rate).toBeCloseTo(1.05 / 1.05);
    expect(engine.heroes[0].d.critChance).toBeCloseTo(0.13);
    expect(engine.heroes[0].d.critMult).toBeCloseTo(1.85);
    expect(engine.getHeroAbilityStatus(0)[0].cooldownSeconds).toBeCloseTo(11.4);
    const target = enemy("training target", engine.heroes[0].x + 40, engine.heroes[0].y, { hp: 100, maxHp: 100 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    expect(engine._applyHit({ sourceId: "H0", target, dmg: 16, damageCategory: "weapon", classless: true, heroIndex: 0 })).toBe(true);
    expect(target.hp).toBeCloseTo(100 - 16 * 1.08);
    random.mockRestore();
  });

  test("conditional damage passives apply once through the shared direct-hit pipeline", () => {
    const hero = createHeroModel({ id: "conditional-build" });
    hero.progression.ownedNodeIds = ["V2", "V2a", "P2", "S3"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const target = enemy("conditional target", engine.heroes[0].x + 30, engine.heroes[0].y, { hp: 1000, maxHp: 1000 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    const hit = () => engine._applyHit({ sourceId: "H0", heroIndex: 0, target, dmg: 16, classless: true, damageCategory: "weapon" });

    engine.time = 3;
    hit(); // first hit marks and receives Ambush; Momentum starts at zero
    expect(target.hp).toBeCloseTo(1000 - 16 * 1.25);
    engine.time = 3.1;
    hit(); // Follow-Through, Mark and one Momentum stack
    expect(target.hp).toBeCloseTo(1000 - 20 - 16 * (1 + 0.10 + 0.10 + 0.04));
    expect(target.classlessMarks[0].expiresAt).toBe(8);
    random.mockRestore();
  });

  test("control passives apply documented slow/root cadence and boss duration", () => {
    const hero = createHeroModel({ id: "control-build" });
    hero.progression.ownedNodeIds = ["T1", "T2", "N1", "N2"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const target = enemy("boss", engine.heroes[0].x + 30, engine.heroes[0].y, { boss: true });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    engine._applyHit({ sourceId: "H0", heroIndex: 0, target, dmg: 16, classless: true, damageCategory: "weapon" });
    expect(target.slowUntil).toBe(3);
    expect(target.slowMultiplier).toBeCloseTo(0.95);
    expect(target.attackSlowMultiplier).toBeCloseTo(0.95);
    expect(target.rootUntil).toBe(0.5);
    random.mockRestore();
  });

  test("classless evasion perks do not evade area attacks", () => {
    const hero = createHeroModel({ id: "evasion-build" });
    hero.progression.ownedNodeIds = ["S1", "S2", "I1"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const runtime = engine.heroes[0];
    expect(engine._heroDodgeChance(runtime, true)).toBeCloseTo(runtime.d.dodge);
    expect(engine._heroDodgeChance(runtime, false)).toBeCloseTo(runtime.d.dodge + 0.16);
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

  test("Interpose protects the lowest-HP nearby ally for five seconds and respects shared mitigation cap", () => {
    const sim = createNewState();
    const caster = createHeroModel({ id: "interpose-caster" });
    caster.progression.ownedNodeIds = ["W3"];
    const firstAlly = createHeroModel({ id: "interpose-first" });
    firstAlly.progression.ownedNodeIds = ["W2"];
    firstAlly.combat.hp = 120;
    const secondAlly = createHeroModel({ id: "interpose-second" });
    secondAlly.combat.hp = 200;
    sim.heroes = [caster, firstAlly, secondAlly];
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });

    const status = engine.getHeroAbilityStatus(0).find((ability) => ability.id === "W3");
    expect(status).toMatchObject({ available: true, cooldownSeconds: 24, resourceCost: 0, targetMode: null });
    const result = engine.useHeroAbility(0, "W3");
    expect(result).toMatchObject({ ok: true, abilityId: "W3", cooldownRemaining: 24 });
    expect(result.affectedTargets).toEqual([engine.heroes[1]]);
    expect(engine.heroes[1].interposeUntil).toBe(5);
    // W2 (6%) + Interpose (25%) exceeds the shared 30% cap and clamps there.
    expect(engine._classlessReducedDamage(engine.heroes[1], 100)).toBeCloseTo(100 * (100 / 110) * 0.7);
    expect(engine.useHeroAbility(0, "W3")).toMatchObject({ ok: false, reason: "cooldown" });
    engine.time = 5;
    expect(engine._classlessReducedDamage(engine.heroes[1], 100)).toBeCloseTo(100 * (100 / 110) * 0.94);
  });

  test("Interpose falls back to its caster when no other living ally is in range", () => {
    const sim = createNewState();
    const caster = createHeroModel({ id: "interpose-solo" });
    caster.progression.ownedNodeIds = ["W3"];
    const distantAlly = createHeroModel({ id: "interpose-distant" });
    sim.heroes = [caster, distantAlly];
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
    engine.heroes[1].x = engine.heroes[0].x + 151;

    const result = engine.useHeroAbility(0, "W3");
    expect(result.ok).toBe(true);
    expect(result.affectedTargets).toEqual([engine.heroes[0]]);
    expect(engine.heroes[0].interposeUntil).toBe(5);
  });

  test("Blood Price charges current HP only after a successful active use and buffs its damage", () => {
    const sim = createNewState();
    const model = createHeroModel({ id: "blood-price" });
    model.progression.ownedNodeIds = ["H2"];
    sim.heroes = [model];
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
    const hero = engine.heroes[0];
    const target = enemy("Blood Price target", hero.x + 30, hero.y, { hp: 1000, maxHp: 1000 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.99);

    expect(engine.useSharedStrike(0, target)).toBe(true);
    expect(target.hp).toBeCloseTo(1000 - 16 * 1.5 * 1.12);
    expect(hero.ref.hp).toBe(285);

    const beforeHp = hero.ref.hp;
    const beforeTargetHp = target.hp;
    hero.abilityCooldowns.shared_strike = 0;
    hero.ref.hp = 1.04;
    expect(engine.getHeroAbilityStatus(0)[0]).toMatchObject({ available: false, reason: "health_cost" });
    expect(engine.useSharedStrike(0, target)).toBe(false);
    expect(hero.ref.hp).toBe(1.04);
    expect(target.hp).toBe(beforeTargetHp);
    expect(engine.heroes[0].abilityCooldowns.shared_strike).toBe(0);
    expect(beforeHp).toBe(285);
    random.mockRestore();
  });

  test("Crimson Covenant doubles weapon lifesteal and permits one lethal save per 60 seconds", () => {
    const sim = createNewState();
    const model = createHeroModel({ id: "crimson-covenant" });
    model.progression.ownedNodeIds = ["H1", "H3"];
    sim.heroes = [model];
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
    const hero = engine.heroes[0];
    expect(engine.useHeroAbility(0, "H3")).toMatchObject({ ok: true, abilityId: "H3", cooldownRemaining: 30 });
    expect(hero.classlessCombatState.covenantUntil).toBe(6);
    hero.ref.hp = 299;
    const target = enemy("Covenant target", hero.x + 30, hero.y, { hp: 1000, maxHp: 1000 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.99);
    expect(engine._applyHit({ sourceId: "H0", heroIndex: 0, target, dmg: 16, classless: true, damageCategory: "weapon" })).toBe(true);
    expect(hero.ref.hp).toBeCloseTo(299 + 16 * 0.04);

    hero.ref.hp = 20;
    expect(engine._resolveClasslessHeroDamage(hero, 25)).toBe(25);
    expect(hero.ref.hp).toBe(1);
    expect(hero.classlessCombatState.survivalReadyAt).toBe(60);
    hero.ref.hp = 2;
    expect(engine._resolveClasslessHeroDamage(hero, 3)).toBe(3);
    expect(hero.ref.hp).toBe(0);
    expect(hero.alive).toBe(false);
    random.mockRestore();
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

  test("classless Execution enforces unlock, range, health condition, pipeline, and cooldown", () => {
    const hero = createHeroModel({ id: "execution-build" });
    hero.progression.ownedNodeIds = ["P1", "P2", "P3"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const target = enemy("execution target", engine.heroes[0].x + 30, engine.heroes[0].y, { hp: 170, maxHp: 500 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === "P3")).toMatchObject({ available: true, cooldownSeconds: 22, resourceCost: 0, targetMode: "enemy" });
    const used = engine.useHeroAbility(0, "P3", target);
    expect(used).toMatchObject({ ok: true, abilityId: "P3", cooldownRemaining: 22, killedTarget: false });
    expect(target.hp).toBeCloseTo(170 - (16 * 1.8 * 1.25));
    expect(target.dmgBy.H0).toBeCloseTo(16 * 1.8 * 1.25);
    expect(engine.executeClasslessAbility(0, "P3", target)).toMatchObject({ ok: false, reason: "cooldown" });
    expect(engine.heroes[0].abilityCooldowns.P3).toBe(22);

    engine.heroes[0].abilityCooldowns.P3 = 0;
    const outside = enemy("outside", engine.heroes[0].x + 221, engine.heroes[0].y, { hp: 10, maxHp: 500 });
    expect(engine.executeClasslessAbility(0, "P3", outside)).toMatchObject({ ok: false, reason: "no_target" });
    random.mockRestore();
  });

  test("Killshot requires a target below 40 percent and refunds its cooldown on a kill", () => {
    const hero = createHeroModel({ id: "killshot-build" });
    hero.progression.ownedNodeIds = ["P1", "P2a", "P3a"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const target = enemy("killshot target", engine.heroes[0].x + 30, engine.heroes[0].y, { hp: 30, maxHp: 500 });
    engine.active = [target];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    expect(engine.getHeroAbilityStatus(0).find((ability) => ability.id === "P3a")).toMatchObject({ available: true, damage: 32 });
    const used = engine.executeClasslessAbility(0, "P3a", target);
    expect(used).toMatchObject({ ok: true, cooldownRemaining: 0, killedTarget: true });
    expect(target.hp).toBe(0);
    expect(engine.heroes[0].abilityCooldowns.P3a).toBe(0);
    expect(engine.executeClasslessAbility(0, "P3a", target)).toMatchObject({ ok: false, reason: "no_target" });
    random.mockRestore();
  });

  test("Cleaving Strike hits its selected target and nearest adjacent enemy through the weapon pipeline", () => {
    const hero = createHeroModel({ id: "cleaving-build" });
    hero.progression.ownedNodeIds = ["V1", "V2", "V3"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const runtimeHero = engine.heroes[0];
    const primary = enemy("primary", runtimeHero.x + 30, runtimeHero.y);
    const nearest = enemy("nearest adjacent", runtimeHero.x + 35, runtimeHero.y, { hp: 200, maxHp: 200 });
    const farther = enemy("far adjacent", runtimeHero.x + 40, runtimeHero.y, { hp: 200, maxHp: 200 });
    const outside = enemy("outside adjacency", runtimeHero.x + 90, runtimeHero.y);
    engine.active = [primary, nearest, farther, outside];
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(engine.getHeroAbilityStatus(0).find(({ id }) => id === "V3")).toMatchObject({
      available: true, cooldownSeconds: 20, resourceCost: 0, targetMode: "enemy", range: 220,
    });
    const result = engine.useHeroAbility(0, "V3", primary);
    expect(result).toMatchObject({ ok: true, abilityId: "V3", cooldownRemaining: 20, killedTarget: false });
    expect(result.affectedTargets).toEqual([primary, nearest]);
    expect(primary.hp).toBeCloseTo(500 - 16 * 1.6 * 1.08);
    expect(nearest.hp).toBeCloseTo(200 - 16 * 0.4 * 1.08);
    expect(farther.hp).toBe(200);
    expect(outside.hp).toBe(500);
    expect(engine.useHeroAbility(0, "V3", primary)).toMatchObject({ ok: false, reason: "cooldown" });
    random.mockRestore();
  });

  test("Rally heals living allies within eight units for ten percent max HP and respects missing health", () => {
    const hero = createHeroModel({ id: "rally-build" });
    hero.progression.ownedNodeIds = ["T1", "T2", "T2a"];
    const ally = createHeroModel({ id: "rally-ally" });
    const distant = createHeroModel({ id: "rally-distant" });
    const dead = createHeroModel({ id: "rally-dead" });
    ally.combat.hp = 200;
    distant.combat.hp = 200;
    dead.combat.hp = 0;
    const sim = { ...createNewState(), heroes: [hero, ally, distant, dead] };
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
    const [source, nearby, far, fallen] = engine.heroes;
    source.ref.hp = 250;
    nearby.x = source.x + 7;
    far.x = source.x + 9;
    const result = engine.useHeroAbility(0, "T2a");
    expect(result).toMatchObject({ ok: true, abilityId: "T2a", cooldownRemaining: 22 });
    expect(result.affectedTargets).toEqual([source, nearby]);
    expect(source.ref.hp).toBe(280);
    expect(nearby.ref.hp).toBe(230);
    expect(far.ref.hp).toBe(200);
    expect(fallen.ref.hp).toBe(0);
    expect(engine.useHeroAbility(0, "T2a")).toMatchObject({ ok: false, reason: "cooldown" });
  });

  test("War Cry buffs only living allies in eight units and accelerates their basic attack cooldown", () => {
    const hero = createHeroModel({ id: "war-cry-build" });
    hero.progression.ownedNodeIds = ["V1", "V2", "V3a", "S1"];
    const ally = createHeroModel({ id: "war-cry-ally" });
    const distant = createHeroModel({ id: "war-cry-distant" });
    const dead = createHeroModel({ id: "war-cry-dead" });
    dead.combat.hp = 0;
    const sim = { ...createNewState(), heroes: [hero, ally, distant, dead] };
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 1 });
    const [source, nearby, far, fallen] = engine.heroes;
    nearby.x = source.x + 7;
    far.x = source.x + 9;
    const status = engine.getHeroAbilityStatus(0).find(({ id }) => id === "V3a");
    expect(status).toMatchObject({ available: true, cooldownSeconds: 30, resourceCost: 0, range: 8, targetMode: null });

    const result = engine.useHeroAbility(0, "V3a");
    expect(result).toMatchObject({ ok: true, abilityId: "V3a", cooldownRemaining: 30 });
    expect(result.affectedTargets).toEqual([source, nearby]);
    expect(source.warCryUntil).toBe(6);
    expect(nearby.warCryUntil).toBe(6);
    expect(far.warCryUntil).toBe(0);
    expect(fallen.warCryUntil).toBe(0);
    expect(engine.getHeroAbilityStatus(0).find(({ id }) => id === "V3a")).toMatchObject({ active: true, activeRemaining: 6 });
    expect(engine.useHeroAbility(0, "V3a")).toMatchObject({ ok: false, reason: "cooldown" });

    engine.spawnQueue = [];
    engine.active = [];
    source.manual = true;
    source.cd = 1;
    engine.update(0.5);
    expect(source.cd).toBeCloseTo(1 - 0.5 * (1.2 / 1.05));
    expect(nearby.warCryUntil).toBe(6);
    expect(nearby.warCryAttackSpeedBonus).toBe(0.15);
  });

  test("classless active ability failure does not charge cooldown, HP, or resource", () => {
    const hero = createHeroModel({ id: "failed-ability-build" });
    hero.progression.ownedNodeIds = ["P1", "P2", "P3"];
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [hero] }, { enemies: [], total: 1 });
    const target = enemy("healthy target", engine.heroes[0].x + 30, engine.heroes[0].y, { hp: 200, maxHp: 500 });
    engine.active = [target];
    expect(engine.getHeroAbilityStatus(0).find(({ id }) => id === "P3")).toMatchObject({ available: false, reason: "target_health" });
    const result = engine.executeClasslessAbility(0, "P3", target);
    expect(result).toMatchObject({ ok: false, reason: "target_health" });
    expect(target.hp).toBe(200);
    expect(engine.heroes[0].abilityCooldowns.P3).toBeUndefined();
    expect(engine.heroes[0].ref.hp).toBe(300);
    expect(engine.heroes[0].mana).toBe(0);
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
