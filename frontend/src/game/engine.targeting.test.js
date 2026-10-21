import { createNewState } from "./logic";
import { Engine } from "./engine";

function makeEngine(cls, callbacks = {}) {
  const sim = createNewState([cls]);
  const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 0 }, callbacks);
  return engine;
}

function makeEnemy(overrides = {}) {
  return {
    name: "Goblin",
    type: "goblin",
    hp: 40,
    maxHp: 60,
    x: 210,
    y: 500,
    dmgBy: {},
    affinities: {},
    ...overrides,
  };
}

describe("ranged battlefield target selection", () => {
  test("lists only living, damageable enemies within the Archer's range", () => {
    const engine = makeEngine("archer");
    const inRange = makeEnemy();
    const immune = makeEnemy({ type: "immune", y: 480, affinities: { archer_ranged: "immune" } });
    const dead = makeEnemy({ type: "dead", y: 470, hp: 0 });
    const outOfRange = makeEnemy({ type: "far", y: 250 });
    engine.active = [inRange, immune, dead, outOfRange];

    const status = engine.getRangedTargetStatus(0);
    expect(status).toMatchObject({ heroName: expect.any(String), range: 340 });
    expect(status.targets.map((target) => target.name)).toEqual(["Goblin"]);
    expect(engine.getRangedTargetAt(0, inRange.x, inRange.y).enemy).toBe(inRange);
    expect(engine.getRangedTargetAt(0, outOfRange.x, outOfRange.y)).toBeNull();
    expect(engine.setTargetSelection(0)).toBe(true);
    engine.setTargetSelection(null);
    expect(engine.targetingHero).toBeNull();
  });

  test("Mage selection excludes Arcane-immune and magic-immune targets", () => {
    const engine = makeEngine("mage");
    const valid = makeEnemy({ name: "Skeleton" });
    const arcaneImmune = makeEnemy({ name: "Slime", type: "slime", x: 310, y: 490, magicImmune: true });
    const arcaneAffinityImmune = makeEnemy({ name: "Ward", x: 310, y: 470, affinities: { arcane: "immune" } });
    engine.active = [valid, arcaneImmune, arcaneAffinityImmune];

    expect(engine.getRangedTargetStatus(0).targets.map((target) => target.name)).toEqual(["Skeleton"]);
    expect(engine.getRangedTargetAt(0, arcaneImmune.x, arcaneImmune.y)).toBeNull();
  });

  test("valid ranged taps assign the target; invalid and out-of-range taps do not enable manual mode", () => {
    const engine = makeEngine("archer");
    const valid = makeEnemy();
    const outOfRange = makeEnemy({ name: "Far Goblin", x: 210, y: 250 });
    engine.active = [valid, outOfRange];

    expect(engine.commandHeroAttackAt(0, outOfRange.x, outOfRange.y)).toBe(false);
    expect(engine.heroes[0].manual).toBe(false);
    expect(engine.heroes[0].manualTarget).toBeNull();

    expect(engine.commandHeroAttackAt(0, valid.x, valid.y)).toBe(true);
    expect(engine.heroes[0].manual).toBe(true);
    expect(engine.heroes[0].manualTarget).toBe(valid);
  });

  test("a manually selected ranged target cannot be fired on after leaving range", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("archer", { onActionResolved });
    engine.wave.total = 100;
    const hero = engine.heroes[0];
    hero.protect = 0;
    const enemy = makeEnemy({
      x: hero.x + hero.d.range - 10,
      y: hero.y,
      speed: 0,
      lane: -1,
      floats: true,
    });
    engine.active = [enemy];
    expect(engine.commandHeroAttack(0, enemy)).toBe(true);
    enemy.x = hero.x + hero.d.range + 10;

    engine.update(0.016);

    expect(engine.projectiles).toHaveLength(0);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "cancelled" });
  });

  test("accepted ranged attacks resolve only after the attack projectile hits", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("archer", { onActionResolved });
    engine.wave.total = 100;
    const hero = engine.heroes[0];
    hero.protect = 0;
    hero.cd = 0;
    const enemy = makeEnemy({
      x: hero.x + 10,
      y: hero.y,
      speed: 0,
      lane: -1,
      floats: true,
    });
    engine.active = [enemy];

    expect(engine.commandHeroAttack(0, enemy)).toBe(true);
    engine.update(0.016);
    expect(onActionResolved).not.toHaveBeenCalled();

    engine.update(0.1);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "completed" });
  });

  test("movement resolves on arrival and can be canceled without consuming an action", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("archer", { onActionResolved });
    engine.wave.total = 100;
    const hero = engine.heroes[0];

    expect(engine.commandHeroMoveTo(0, hero.x + 1, hero.y)).toBe(true);
    engine.update(0.016);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "completed" });

    onActionResolved.mockClear();
    expect(engine.commandHeroMoveTo(0, hero.x + 50, hero.y)).toBe(true);
    expect(engine.cancelTacticalAction(0)).toBe(true);
    engine.update(0.016);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "cancelled" });
  });

  test("retreat and rally commands report completion through the action callback", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("archer", { onActionResolved });
    engine.wave.total = 100;
    const hero = engine.heroes[0];
    hero.x = hero.home.x + 1;

    expect(engine.retreatHero(0)).toBe(true);
    engine.update(0.016);
    expect(onActionResolved).toHaveBeenLastCalledWith({ index: 0, result: "completed" });

    onActionResolved.mockClear();
    expect(engine.rallyHeroes(0)).toBe(true);
    engine.update(0.016);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "completed" });
  });

  test("Mage spell resolution waits for its visual effects without changing resource costs or cooldowns", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("mage", { onActionResolved });
    engine.wave.total = 100;
    const enemy = makeEnemy({ speed: 0, lane: -1, floats: true });
    engine.active = [enemy];
    const hero = engine.heroes[0];
    const manaBefore = hero.mana;
    const status = engine.getHeroSpellStatus(0).find((spell) => spell.id === "fireball");

    expect(engine.castMageSpell(0, "fireball")).toBe(true);
    expect(hero.mana).toBe(manaBefore - status.cost);
    expect(hero.spellCooldowns.fireball).toBeGreaterThan(0);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(onActionResolved).not.toHaveBeenCalled();

    for (let i = 0; i < 4; i++) engine.update(0.1);
    expect(onActionResolved).not.toHaveBeenCalled();
    expect(engine.effects.some((effect) => effect.color === "#FF6600")).toBe(true);

    engine.update(0.1);
    expect(engine.effects.some((effect) => effect.color === "#FF6600")).toBe(false);
    expect(onActionResolved).toHaveBeenCalledWith({ index: 0, result: "completed" });
  });

  test("failed spell casts neither spend mana nor enqueue menu completion", () => {
    const onActionResolved = jest.fn();
    const engine = makeEngine("mage", { onActionResolved });
    const hero = engine.heroes[0];
    const manaBefore = hero.mana;

    expect(engine.castMageSpell(0, "fireball")).toBe(false);
    engine.update(0.1);

    expect(hero.mana).toBe(manaBefore);
    expect(hero.spellCooldowns.fireball).toBeUndefined();
    expect(onActionResolved).not.toHaveBeenCalled();
  });

  test("melee targeting keeps its existing close-tap interaction; melee heroes do not enter ranged selection", () => {
    const engine = makeEngine("knight");
    const hero = engine.heroes[0];
    const enemy = makeEnemy({ x: hero.x + 20, y: hero.y });
    engine.active = [enemy];

    expect(engine.getRangedTargetStatus(0)).toBeNull();
    expect(engine.setTargetSelection(0)).toBe(false);
    expect(engine.commandHeroAttackAt(0, enemy.x, enemy.y)).toBe(true);
    expect(hero.manualTarget).toBe(enemy);
  });

  test("selection and manual target commands do not bypass ability cooldowns", () => {
    const engine = makeEngine("archer");
    engine.active = [makeEnemy()];
    const abilityId = "archer_focus_volley";
    expect(engine.useHeroAbility(0, abilityId)).toBe(true);
    const remaining = engine.heroes[0].abilityCooldowns[abilityId];
    expect(engine.setTargetSelection(0)).toBe(true);
    expect(engine.commandHeroAttackAt(0, engine.active[0].x, engine.active[0].y)).toBe(true);
    expect(engine.heroes[0].abilityCooldowns[abilityId]).toBe(remaining);
    expect(engine.useHeroAbility(0, abilityId)).toBe(false);
  });

  test("an explicitly selected ability target is hit once and cooldown prevents repeat damage", () => {
    const engine = makeEngine("knight");
    const hero = engine.heroes[0];
    const nearer = makeEnemy({ name: "Nearer", x: hero.x + 25, y: hero.y });
    const selected = makeEnemy({ name: "Selected", x: hero.x + 110, y: hero.y });
    const nearerHp = nearer.hp;
    engine.active = [nearer, selected];
    const abilityId = "knight_shield_bash";

    expect(engine.getHeroAbilityTargetAt(0, abilityId, selected.x, selected.y)?.enemy).toBe(selected);
    expect(engine.useHeroAbility(0, abilityId, { enemy: selected })).toBe(true);
    expect(nearer.hp).toBe(nearerHp);
    expect(selected.hp).toBeLessThan(selected.maxHp);
    const selectedHp = selected.hp;

    expect(engine.useHeroAbility(0, abilityId, { enemy: selected })).toBe(false);
    expect(selected.hp).toBe(selectedHp);
  });

  test("an area spell uses the chosen location and spends mana only once", () => {
    const engine = makeEngine("mage");
    const hero = engine.heroes[0];
    const spellId = "test-area-spell";
    hero.ref.equippedSpells = [spellId];
    hero.ref.spellbook = [{
      id: spellId, name: "Test Area", element: "fire", effect: "area",
      strength: 1, manaCost: 20, baseMana: 20,
    }];
    const center = { x: hero.x + 120, y: hero.y - 10 };
    const inside = makeEnemy({ x: center.x + 5, y: center.y + 5 });
    const outside = makeEnemy({ x: center.x + 120, y: center.y });
    const outsideHp = outside.hp;
    engine.active = [inside, outside];
    const status = engine.getHeroSpellStatus(0).find((spell) => spell.id === spellId);
    const manaBefore = hero.mana;
    const insideHp = inside.hp;

    expect(engine.getMageSpellAreaPreview(0, spellId, center.x, center.y).valid).toBe(true);
    expect(engine.castMageSpell(0, spellId, center)).toBe(true);
    expect(inside.hp).toBeLessThan(insideHp);
    expect(outside.hp).toBe(outsideHp);
    expect(hero.mana).toBe(manaBefore - status.cost);
    expect(hero.spellCooldowns[spellId]).toBeGreaterThan(0);
    const afterCastHp = inside.hp;
    const afterCastMana = hero.mana;

    expect(engine.castMageSpell(0, spellId, center)).toBe(false);
    expect(inside.hp).toBe(afterCastHp);
    expect(hero.mana).toBe(afterCastMana);
  });
});
