import * as C from "./config";
import { Engine } from "./engine";
import { allocateSp, createHero, createNewState } from "./logic";
import { createSpellBlueprint, librarySuccessChance } from "./libraryResearch";
import { getPerkTree } from "./perks";

function makeEngine(classes, perks = {}) {
  const sim = createNewState(classes);
  sim.heroes.forEach((hero, index) => {
    hero.perks = perks[index] || [];
  });
  return { sim, engine: new Engine({ getContext: () => null }, sim, { enemies: [], total: 10 }) };
}

function enemy(overrides = {}) {
  return {
    name: "Test Enemy",
    type: "goblin",
    hp: 10000,
    maxHp: 10000,
    x: 210,
    y: 500,
    dmgBy: {},
    affinities: {},
    ...overrides,
  };
}

describe("approved combat perk behavior", () => {
  afterEach(() => jest.restoreAllMocks());

  test("derived Defense includes allocated SP, gear, and Bulwark once for each enemy damage path", () => {
    jest.spyOn(Math, "random").mockReturnValue(1);
    const hero = createHero("knight");
    hero.sp = 1;
    expect(allocateSp(hero, "defense")).toBe(true);
    hero.equipment.Chest = { stats: { defense: 5 } };
    hero.perks = ["knight_bulwark"];
    const sim = createNewState(["knight"]);
    sim.heroes[0] = hero;
    const engine = new Engine({ getContext: () => null }, sim, { enemies: [], total: 10 });
    const runtimeHero = engine.heroes[0];
    const expectedDefense = hero.stats.defense + 5 + 2;

    expect(runtimeHero.d.defense).toBe(expectedDefense);
    for (const damagePath of [
      () => engine._enemyAttack({ type: "goblin", damage: 100 }, { kind: "hero", obj: runtimeHero }),
      () => engine._resolveEnemyBolt({
        target: { kind: "hero", obj: runtimeHero },
        targetKind: "hero",
        dmg: 100,
        color: "#fff",
      }),
      () => engine._explodeNapalm(runtimeHero.x, runtimeHero.y, { dmg: 100, splash: 68 }),
    ]) {
      const hpBefore = hero.hp;
      damagePath();
      expect(hpBefore - hero.hp).toBeCloseTo(C.damageAfterDefense(100, expectedDefense));
      hero.hp = hpBefore;
    }
  });

  test.each([
    { hp: 249, expected: 1.45 },
    { hp: 250, expected: 1.2 },
    { hp: 251, expected: 1.2 },
  ])("Archer Execution activates strictly below 25% HP ($hp / 1000)", ({ hp, expected }) => {
    const { engine } = makeEngine(["archer"], { 0: ["archer_focus_fire", "archer_execution"] });
    const hero = engine.heroes[0];
    const target = enemy({ hp, maxHp: 1000 });
    const hpBefore = target.hp;
    const baseAttack = hero.d.attack;

    engine._applyAbilityDamage(hero, target, 1, "TEST");

    expect(hpBefore - target.hp).toBeCloseTo(baseAttack * expected);
  });

  test.each([
    { hp: 349, expected: 1.2 },
    { hp: 350, expected: 1 },
    { hp: 351, expected: 1 },
  ])("Focus Fire retains its strict 35% threshold without Execution ($hp / 1000)", ({ hp, expected }) => {
    const { engine } = makeEngine(["archer"], { 0: ["archer_focus_fire"] });
    const hero = engine.heroes[0];
    const target = enemy({ hp, maxHp: 1000 });
    const hpBefore = target.hp;

    engine._applyAbilityDamage(hero, target, 1, "TEST");

    expect(hpBefore - target.hp).toBeCloseTo(hero.d.attack * expected);
  });

  test.each([
    { hp: 349, expected: 1.25 },
    { hp: 350, expected: 1 },
    { hp: 351, expected: 1 },
  ])("Knight Executioner retains its existing 35% threshold ($hp / 1000)", ({ hp, expected }) => {
    const { engine } = makeEngine(["knight"], { 0: ["knight_cleave", "knight_executioner"] });
    const hero = engine.heroes[0];
    const target = enemy({ hp, maxHp: 1000 });
    const hpBefore = target.hp;

    engine._applyAbilityDamage(hero, target, 1, "TEST");

    expect(hpBefore - target.hp).toBeCloseTo(hero.d.attack * expected);
  });

  test("Focus Fire and Execution stack additively only below their respective thresholds", () => {
    const { engine } = makeEngine(["archer"], { 0: ["archer_focus_fire", "archer_execution"] });
    const hero = engine.heroes[0];
    const belowExecution = enemy({ hp: 249, maxHp: 1000 });
    const focusFireOnly = enemy({ hp: 300, maxHp: 1000 });
    const belowExecutionHpBefore = belowExecution.hp;
    const focusFireHpBefore = focusFireOnly.hp;

    engine._applyAbilityDamage(hero, belowExecution, 1, "TEST");
    engine._applyAbilityDamage(hero, focusFireOnly, 1, "TEST");

    expect(belowExecutionHpBefore - belowExecution.hp).toBeCloseTo(hero.d.attack * 1.45);
    expect(focusFireHpBefore - focusFireOnly.hp).toBeCloseTo(hero.d.attack * 1.2);
    expect(hero.d.lowHpDamage).toBe(0.2);
    expect(hero.d.executionDamage).toBe(0.25);
  });

  test("Shield Mastery boosts Shield Bash only; Rogue Backstab and basic attacks remain unchanged", () => {
    jest.spyOn(Math, "random").mockReturnValue(1);
    const { engine } = makeEngine(
      ["knight", "rouge"],
      { 0: ["knight_shield_mastery"] },
    );
    const knight = engine.heroes[0];
    const rogue = engine.heroes[1];
    const shieldTarget = enemy({ x: knight.x, y: knight.y - 140 });
    const rogueTarget = enemy({ x: rogue.x, y: rogue.y - 140 });
    engine.active = [shieldTarget, rogueTarget];

    expect(engine.useHeroAbility(knight.i, "knight_shield_bash")).toBe(true);
    expect(10000 - shieldTarget.hp).toBeCloseTo(knight.d.attack * 2 * 1.2);

    expect(engine.useHeroAbility(rogue.i, "rouge_backstab_ability")).toBe(true);
    expect(10000 - rogueTarget.hp).toBeCloseTo(rogue.d.attack * 2.4);

    const basicTarget = enemy();
    engine._applyHit({
      sourceId: "H0",
      target: basicTarget,
      damageType: C.DAMAGE_TYPES.KNIGHT_MELEE,
      dmg: 100,
      critChance: 0,
      critMult: 1,
      perkData: knight.d,
    });
    expect(10000 - basicTarget.hp).toBe(100);
    expect(knight.d.perkEffects.abilityDamagePct).toBe(0);
    expect(knight.d.shieldAbilityDamageMultiplier).toBe(1.2);
    expect(rogue.d.abilityDamageMultiplier).toBe(1);
  });

  test("Archer Multishot keeps its basic-projectile secondary-target policy", () => {
    jest.spyOn(Math, "random").mockReturnValue(1);
    const { engine } = makeEngine(
      ["archer"],
      { 0: ["archer_rapid_draw", "archer_multishot"] },
    );
    const runtimeHero = engine.heroes[0];
    const primary = enemy({ x: runtimeHero.x, y: runtimeHero.y - 140 });
    const deadNearest = enemy({ x: runtimeHero.x + 10, y: runtimeHero.y - 140, hp: 0 });
    const nearest = enemy({ x: runtimeHero.x + 20, y: runtimeHero.y - 140 });
    const farther = enemy({ x: runtimeHero.x + 35, y: runtimeHero.y - 140 });
    const tooFar = enemy({ x: runtimeHero.x + 56, y: runtimeHero.y - 140 });
    engine.active = [primary, deadNearest, farther, nearest, tooFar];

    engine._applyHit({
      sourceId: "H0",
      target: primary,
      damageType: C.DAMAGE_TYPES.ARCHER_RANGED,
      dmg: 100,
      critChance: 0,
      critMult: 1,
      perkData: runtimeHero.d,
    });
    expect(deadNearest.hp).toBe(0);
    expect(nearest.hp).toBe(10000 - 55);
    expect(farther.hp).toBe(10000);
    expect(tooFar.hp).toBe(10000);

    const volleyTarget = enemy({ x: runtimeHero.x, y: runtimeHero.y - 140 });
    const volleySecondary = enemy({ x: runtimeHero.x + 20, y: runtimeHero.y - 140 });
    engine.active = [volleyTarget, volleySecondary];
    const secondaryHpBeforeAbility = volleySecondary.hp;
    const expectedVolleyDamage = runtimeHero.d.attack * 0.75 * 3;
    expect(engine.useHeroAbility(0, "archer_focus_volley")).toBe(true);
    expect(volleyTarget.hp).toBeCloseTo(10000 - expectedVolleyDamage);
    expect(volleySecondary.hp).toBe(secondaryHpBeforeAbility);
  });

  test.each([false, true])("Knight Cleave applies only one normal melee hit to a nearby secondary target (owns perk: %s)", (ownsCleave) => {
    jest.spyOn(Math, "random").mockReturnValue(1);
    const { engine } = makeEngine(
      ["knight"],
      { 0: ownsCleave ? ["knight_cleave"] : [] },
    );
    const knight = engine.heroes[0];
    const primary = enemy({ x: knight.x, y: knight.y - 70 });
    const secondary = enemy({ x: knight.x + 40, y: knight.y - 70 });
    const tertiary = enemy({ x: knight.x + 50, y: knight.y - 70 });
    engine.active = [primary, secondary, tertiary];
    const attack = {
      sourceId: "H0",
      damageType: C.DAMAGE_TYPES.KNIGHT_MELEE,
      dmg: knight.d.attack,
      critChance: 0,
      critMult: 1,
      perkData: knight.d,
    };

    engine._applyHit({ ...attack, target: primary });

    expect(10000 - primary.hp).toBeCloseTo(knight.d.attack);
    expect(10000 - secondary.hp).toBeCloseTo(ownsCleave ? knight.d.attack : 0);
    expect(10000 - tertiary.hp).toBe(0);
  });

  test("Knight Cleave does not hit a secondary target outside the existing 55-unit neighbor radius", () => {
    jest.spyOn(Math, "random").mockReturnValue(1);
    const { engine } = makeEngine(["knight"], { 0: ["knight_cleave"] });
    const knight = engine.heroes[0];
    const primary = enemy({ x: knight.x, y: knight.y - 70 });
    const tooFar = enemy({ x: knight.x + 56, y: knight.y - 70 });
    engine.active = [primary, tooFar];

    engine._applyHit({
      sourceId: "H0",
      target: primary,
      damageType: C.DAMAGE_TYPES.KNIGHT_MELEE,
      dmg: knight.d.attack,
      critChance: 0,
      critMult: 1,
      perkData: knight.d,
    });

    expect(10000 - primary.hp).toBeCloseTo(knight.d.attack);
    expect(tooFar.hp).toBe(10000);
  });

  test("Archer Multishot coexists with native Piercing Shot; Firestorm keeps its native area", () => {
    expect(getPerkTree("archer").abilities.map((ability) => ability.effect))
      .toEqual(["piercing_shot", "focus_volley"]);
    const { engine } = makeEngine(
      ["archer", "mage"],
      { 0: ["archer_rapid_draw", "archer_multishot", "archer_eagle_eye"] },
    );
    const archer = engine.heroes[0];
    const primary = enemy({ x: archer.x, y: archer.y - 140 });
    const nativeSecondary = enemy({ x: archer.x + 35, y: archer.y - 140 });
    const outsidePierce = enemy({ x: archer.x + 70, y: archer.y - 140 });
    engine.active = [primary, nativeSecondary, outsidePierce];

    expect(engine.useHeroAbility(0, "archer_piercing_shot")).toBe(true);
    expect(primary.hp).toBeLessThan(10000);
    expect(nativeSecondary.hp).toBeLessThan(10000);
    const outsideAfterPierce = outsidePierce.hp;

    const { engine: mageEngine } = makeEngine(
      ["mage"],
      { 0: ["mage_firestorm", "mage_overload"] },
    );
    const mage = mageEngine.heroes[0];
    const firestormPrimary = enemy({ x: mage.x, y: mage.y - 140 });
    const firestormSecondary = enemy({ x: mage.x + 35, y: mage.y - 140 });
    const firestormOutside = enemy({ x: mage.x + 75, y: mage.y - 140 });
    mageEngine.active = [firestormPrimary, firestormSecondary, firestormOutside];
    expect(mageEngine.useHeroAbility(0, "mage_firestorm_ability")).toBe(true);
    expect(firestormPrimary.hp).toBeLessThan(10000);
    expect(firestormSecondary.hp).toBeLessThan(10000);
    expect(firestormOutside.hp).toBe(10000);
    expect(outsideAfterPierce).toBe(10000);
  });

  function mageEngineWithOverload(ownsOverload, spell = null) {
    const perks = ownsOverload ? ["mage_firestorm", "mage_overload"] : [];
    const { sim, engine } = makeEngine(["mage", "knight"], { 0: perks });
    if (spell) {
      sim.heroes[0].spellbook = [spell];
      sim.heroes[0].equippedSpells = [spell.id];
    }
    return { sim, engine };
  }

  test("Mage Overload scales Firestorm at combat resolution; basic attacks and research chance stay unchanged", () => {
    const base = mageEngineWithOverload(false);
    const boosted = mageEngineWithOverload(true);
    const baseHero = base.engine.heroes[0];
    const boostedHero = boosted.engine.heroes[0];

    // Firestorm currently requires Overload, so compare the same damage
    // resolution with its multiplier neutralized for the control.
    const boostedAbilityTarget = enemy({ x: boostedHero.x, y: boostedHero.y - 140 });
    boosted.engine.active = [boostedAbilityTarget];
    expect(boosted.engine.useHeroAbility(0, "mage_firestorm_ability")).toBe(true);
    expect(10000 - boostedAbilityTarget.hp).toBeCloseTo(boostedHero.d.attack * 1.35 * 1.2);

    const baseAbilityTarget = enemy({ x: baseHero.x, y: baseHero.y - 140 });
    base.engine.active = [baseAbilityTarget];
    expect(base.engine._applyAbilityDamage(baseHero, baseAbilityTarget, 1.35, "FIRESTORM")).toBe(true);
    expect(10000 - boostedAbilityTarget.hp).toBeCloseTo((10000 - baseAbilityTarget.hp) * 1.2);

    const baseAttackTarget = enemy();
    const boostedAttackTarget = enemy();
    jest.spyOn(Math, "random").mockReturnValue(1);
    base.engine._applyHit({
      sourceId: "H0", target: baseAttackTarget, dmg: 100, critChance: 0, critMult: 1,
      damageType: C.DAMAGE_TYPES.ARCANE, perkData: baseHero.d,
    });
    boosted.engine._applyHit({
      sourceId: "H0", target: boostedAttackTarget, dmg: 100, critChance: 0, critMult: 1,
      damageType: C.DAMAGE_TYPES.ARCANE, perkData: boostedHero.d,
    });
    expect(baseAttackTarget.hp).toBe(boostedAttackTarget.hp);
    expect(librarySuccessChance(base.sim)).toBe(librarySuccessChance(boosted.sim));
  });

  test.each([
    { id: "research-intensity", element: "fire", effect: "intensity", strength: 1 },
    { id: "research-area", element: "fire", effect: "area", strength: 1 },
    { id: "research-time", element: "fire", effect: "time", strength: 1 },
  ])("Mage Overload scales researched $effect spell damage exactly once", (spell) => {
    const learnedSpell = {
      id: spell.id,
      name: "Test " + spell.effect,
      element: spell.element,
      effect: spell.effect,
      strength: spell.strength,
      baseMana: 10,
      manaCost: 10,
    };
    const base = mageEngineWithOverload(false, learnedSpell);
    const boosted = mageEngineWithOverload(true, learnedSpell);
    const baseMage = base.engine.heroes[0];
    const boostedMage = boosted.engine.heroes[0];
    const baseTargets = [
      enemy({ x: baseMage.x, y: baseMage.y - 140 }),
      enemy({ x: baseMage.x + 25, y: baseMage.y - 140 }),
    ];
    const boostedTargets = [
      enemy({ x: boostedMage.x, y: boostedMage.y - 140 }),
      enemy({ x: boostedMage.x + 25, y: boostedMage.y - 140 }),
    ];
    base.engine.active = baseTargets;
    boosted.engine.active = boostedTargets;
    const baseStatus = base.engine.getHeroSpellStatus(0).find((item) => item.id === spell.id);
    const boostedStatus = boosted.engine.getHeroSpellStatus(0).find((item) => item.id === spell.id);
    expect(baseStatus.damage).toBe(boostedStatus.damage);

    expect(base.engine.castMageSpell(0, spell.id)).toBe(true);
    expect(boosted.engine.castMageSpell(0, spell.id)).toBe(true);

    const effectScale = spell.effect === "area" ? 0.72 : spell.effect === "time" ? 0.82 : 1;
    for (let index = 0; index < baseTargets.length; index++) {
      const baseDamage = 10000 - baseTargets[index].hp;
      const boostedDamage = 10000 - boostedTargets[index].hp;
      const isHit = spell.effect === "area" || index === 0;
      expect(boostedDamage).toBeCloseTo(baseDamage * 1.2);
      expect(boostedDamage).toBeCloseTo(isHit ? boostedStatus.damage * effectScale * 1.2 : 0);
    }
  });

  test("Mage Overload scales baseline combat spells without changing their status preview", () => {
    const base = mageEngineWithOverload(false);
    const boosted = mageEngineWithOverload(true);
    const baseMage = base.engine.heroes[0];
    const boostedMage = boosted.engine.heroes[0];
    const baseTarget = enemy({ x: baseMage.x, y: baseMage.y - 140 });
    const boostedTarget = enemy({ x: boostedMage.x, y: boostedMage.y - 140 });
    base.engine.active = [baseTarget];
    boosted.engine.active = [boostedTarget];
    const baseStatus = base.engine.getHeroSpellStatus(0).find((spell) => spell.id === "fireball");
    const boostedStatus = boosted.engine.getHeroSpellStatus(0).find((spell) => spell.id === "fireball");
    expect(baseStatus.damage).toBe(boostedStatus.damage);

    expect(base.engine.castMageSpell(0, "fireball")).toBe(true);
    expect(boosted.engine.castMageSpell(0, "fireball")).toBe(true);

    expect(10000 - boostedTarget.hp).toBeCloseTo((10000 - baseTarget.hp) * 1.2);
  });

  test.each(["frost_nova", "chain_lightning"])(
    "Mage Overload scales baseline multi-target spell %s exactly once per hit",
    (spellId) => {
      const base = mageEngineWithOverload(false);
      const boosted = mageEngineWithOverload(true);
      const baseMage = base.engine.heroes[0];
      const boostedMage = boosted.engine.heroes[0];
      const targetX = baseMage.x;
      const targetY = baseMage.y - 90;
      const baseTargets = [0, 25, 50].map((offset) => enemy({ x: targetX + offset, y: targetY }));
      const boostedTargets = [0, 25, 50].map((offset) => enemy({
        x: boostedMage.x + offset,
        y: boostedMage.y - 90,
      }));
      base.engine.active = baseTargets;
      boosted.engine.active = boostedTargets;
      const baseStatus = base.engine.getHeroSpellStatus(0).find((spell) => spell.id === spellId);
      const boostedStatus = boosted.engine.getHeroSpellStatus(0).find((spell) => spell.id === spellId);
      expect(baseStatus.damage).toBe(boostedStatus.damage);

      expect(base.engine.castMageSpell(0, spellId)).toBe(true);
      expect(boosted.engine.castMageSpell(0, spellId)).toBe(true);

      for (let index = 0; index < baseTargets.length; index++) {
        const baseDamage = 10000 - baseTargets[index].hp;
        const boostedDamage = 10000 - boostedTargets[index].hp;
        expect(baseDamage).toBeGreaterThan(0);
        expect(boostedDamage).toBeCloseTo(baseDamage * 1.2);
      }
    },
  );

  test("Mage Overload does not alter Library discovery output, chance, or costs", () => {
    const makeLibraryState = (ownsOverload) => {
      const { sim } = mageEngineWithOverload(ownsOverload);
      sim.buildings = { library: { level: 1, hp: 1000, maxHp: 1000, unlocked: true } };
      sim.gold = 1000;
      sim.stone = 500;
      sim.heroes[0].primaryAffinity = "fire";
      return sim;
    };
    const base = makeLibraryState(false);
    const boosted = makeLibraryState(true);
    const baseChance = librarySuccessChance(base);
    const boostedChance = librarySuccessChance(boosted);
    const baseResult = createSpellBlueprint(base, {
      mageId: base.heroes[0].id, mode: "custom", element: "fire", effect: "area", roll: () => 0,
    });
    const boostedResult = createSpellBlueprint(boosted, {
      mageId: boosted.heroes[0].id, mode: "custom", element: "fire", effect: "area", roll: () => 0,
    });

    expect(boostedChance).toBe(baseChance);
    expect(baseResult.ok).toBe(true);
    expect(boostedResult.ok).toBe(true);
    expect(boostedResult.blueprint).toMatchObject({
      name: baseResult.blueprint.name,
      element: baseResult.blueprint.element,
      effect: baseResult.blueprint.effect,
      basePower: baseResult.blueprint.basePower,
      baseMana: baseResult.blueprint.baseMana,
    });
    expect([boosted.gold, boosted.stone]).toEqual([base.gold, base.stone]);
  });

  test.each([false, true])(
    "reactive support target priority is unchanged when reactiveSupport is %s (characterization)",
    (ownsReactiveSupport) => {
      const magePerks = ownsReactiveSupport
        ? ["mage_barrier", "mage_reactive_barrier"]
        : [];
      const { engine } = makeEngine(
        ["mage", "knight", "archer"],
        { 0: magePerks },
      );
      const [mage, preferredAlly, lowerHpAlly] = engine.heroes;
      mage.ref.attackConfig = "Support / Heal";
      lowerHpAlly.x = mage.x + 60;
      lowerHpAlly.y = mage.y;
      preferredAlly.ref.hp = preferredAlly.d.maxHp * 0.6;
      lowerHpAlly.ref.hp = lowerHpAlly.d.maxHp * 0.2;
      mage.reactiveUntil = 5;
      mage.reactiveAlly = preferredAlly;
      const preferredHpBefore = preferredAlly.ref.hp;
      const lowerHpBefore = lowerHpAlly.ref.hp;

      engine.update(0.1);

      expect(preferredAlly.ref.hp).toBeGreaterThan(preferredHpBefore);
      expect(lowerHpAlly.ref.hp).toBe(lowerHpBefore);
    },
  );

  test("without a reactive alert, support selects the weakest eligible ally", () => {
    const { engine } = makeEngine(["mage", "knight", "archer"]);
    const [mage, higherHpAlly, lowerHpAlly] = engine.heroes;
    mage.ref.attackConfig = "Support / Heal";
    lowerHpAlly.x = mage.x + 60;
    lowerHpAlly.y = mage.y;
    higherHpAlly.ref.hp = higherHpAlly.d.maxHp * 0.6;
    lowerHpAlly.ref.hp = lowerHpAlly.d.maxHp * 0.2;
    const higherHpBefore = higherHpAlly.ref.hp;
    const lowerHpBefore = lowerHpAlly.ref.hp;

    expect(engine._support(mage, "Support / Heal")).toBe(true);

    expect(higherHpAlly.ref.hp).toBe(higherHpBefore);
    expect(lowerHpAlly.ref.hp).toBeGreaterThan(lowerHpBefore);
  });

  test.each(["dead", "out_of_range"])(
    "invalid preferred support target falls back to the weakest eligible ally (%s)",
    (invalidity) => {
      const { engine } = makeEngine(["mage", "knight", "archer"]);
      const [mage, preferredAlly, weakestAlly] = engine.heroes;
      mage.ref.attackConfig = "Support / Heal";
      weakestAlly.x = mage.x + 60;
      weakestAlly.y = mage.y;
      preferredAlly.ref.hp = preferredAlly.d.maxHp * 0.7;
      weakestAlly.ref.hp = weakestAlly.d.maxHp * 0.2;
      if (invalidity === "dead") {
        preferredAlly.alive = false;
        preferredAlly.ref.hp = 0;
      } else {
        preferredAlly.x = mage.x + 221;
      }
      const preferredHpBefore = preferredAlly.ref.hp;
      const weakestHpBefore = weakestAlly.ref.hp;

      expect(engine._support(mage, "Support / Heal", preferredAlly)).toBe(true);

      expect(preferredAlly.ref.hp).toBe(preferredHpBefore);
      expect(weakestAlly.ref.hp).toBeGreaterThan(weakestHpBefore);
    },
  );

  test("update prioritizes a valid reactive ally and falls back after the threat expires", () => {
    const { engine } = makeEngine(["mage", "knight", "archer"]);
    const [mage, preferredAlly, weakestAlly] = engine.heroes;
    mage.ref.attackConfig = "Support / Heal";
    weakestAlly.x = mage.x + 60;
    weakestAlly.y = mage.y;
    preferredAlly.ref.hp = preferredAlly.d.maxHp * 0.7;
    weakestAlly.ref.hp = weakestAlly.d.maxHp * 0.2;
    mage.reactiveUntil = 5;
    mage.reactiveAlly = preferredAlly;
    const preferredBeforeReactive = preferredAlly.ref.hp;
    const weakestBeforeReactive = weakestAlly.ref.hp;

    engine.update(0.1);

    expect(preferredAlly.ref.hp).toBeGreaterThan(preferredBeforeReactive);
    expect(weakestAlly.ref.hp).toBe(weakestBeforeReactive);

    preferredAlly.ref.hp = preferredAlly.d.maxHp * 0.7;
    weakestAlly.ref.hp = weakestAlly.d.maxHp * 0.2;
    engine.time = 5;
    mage.reactiveUntil = 5;
    mage.cd = 0;
    const preferredBeforeExpiry = preferredAlly.ref.hp;
    const weakestBeforeExpiry = weakestAlly.ref.hp;

    engine.update(0.1);

    expect(mage.reactiveUntil).toBe(0);
    expect(preferredAlly.ref.hp).toBe(preferredBeforeExpiry);
    expect(weakestAlly.ref.hp).toBeGreaterThan(weakestBeforeExpiry);
  });
});
