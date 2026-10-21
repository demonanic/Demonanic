import * as C from "./config";
import { Engine } from "./engine";
import { createHero, createNewState } from "./logic";
import { getPerkTree, normalizePerks, perkEffects } from "./perks";

function engineForHero(hero) {
  const sim = createNewState([hero.cls]);
  sim.heroes[0] = hero;
  return new Engine({ getContext: () => null }, sim, { enemies: [], total: 0 });
}

const damagePaths = {
  "direct melee": (engine, hero) => engine._enemyAttack(
    { type: "goblin", damage: 100, boss: false },
    { kind: "hero", obj: hero },
  ),
  "enemy projectile": (engine, hero) => engine._resolveEnemyBolt({
    target: { kind: "hero", obj: hero },
    targetKind: "hero",
    dmg: 100,
    color: "#fff",
  }),
  "area impact": (engine, hero) => engine._explodeNapalm(
    hero.x,
    hero.y,
    { dmg: 100, splash: 68 },
  ),
};

describe("Phase 0 Defense and legacy Escape Artist safety", () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(Object.entries(damagePaths))(
    "%s applies the same derived Defense for baseline and modified heroes",
    (_name, resolveDamage) => {
      jest.spyOn(Math, "random").mockReturnValue(1);

      for (const modified of [false, true]) {
        const hero = createHero("knight");
        if (modified) {
          hero.stats.defense += 3;
          hero.equipment.Chest = { stats: { defense: 5 } };
          hero.perks = ["knight_bulwark"];
        }
        const engine = engineForHero(hero);
        const runtimeHero = engine.heroes[0];
        const expectedDefense = hero.stats.defense
          + (modified ? 5 + 2 : 0);
        const hpBefore = hero.hp;

        expect(runtimeHero.d.defense).toBe(expectedDefense);
        resolveDamage(engine, runtimeHero);
        expect(hpBefore - hero.hp).toBeCloseTo(C.damageAfterDefense(100, expectedDefense));
      }
    },
  );

  test("missing legacy effects and Escape Artist stay finite while preserving the legacy perk ID", () => {
    const heroWithoutPerks = createHero("rouge");
    const emptyEffects = perkEffects(heroWithoutPerks);
    expect(Object.values(emptyEffects).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    expect(emptyEffects.lowHpDodgePct).toBe(0);

    const knight = createHero("knight");
    knight.perks = ["knight_cleave"];
    const cleaveEffects = perkEffects(knight);
    expect(cleaveEffects.cleave).toBe(2);
    expect(perkEffects(createHero("knight")).cleave).toBe(0);
    expect(Object.values(cleaveEffects).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);

    const hero = createHero("rouge");
    hero.perks = ["rouge_evasion", "rouge_escape"];
    expect(normalizePerks(hero.cls, hero.perks)).toContain("rouge_escape");
    const effects = perkEffects(hero);
    expect(effects.lowHpDodgePct).toBe(0.1);
    expect(Object.values(effects).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
  });

  test("all class perk catalogs aggregate supported numeric effects without NaN", () => {
    for (const cls of ["knight", "rouge", "mage", "archer"]) {
      const tree = getPerkTree(cls);
      const hero = createHero(cls);
      hero.perks = [...tree.roots, ...tree.children].map((perk) => perk.id);
      const effects = perkEffects(hero);
      expect(Object.values(effects).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    }
  });

  test("Escape Artist grants its documented dodge bonus only below 35% HP in combat", () => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0.15);
    const hero = createHero("rouge");
    hero.perks = ["rouge_evasion", "rouge_escape"];
    const engine = engineForHero(hero);
    const runtimeHero = engine.heroes[0];
    const baseDodge = runtimeHero.d.dodge;

    hero.hp = runtimeHero.d.maxHp * 0.35;
    expect(engine._heroDodgeChance(runtimeHero)).toBe(baseDodge);
    hero.hp = Math.floor(runtimeHero.d.maxHp * 0.34);
    expect(engine._heroDodgeChance(runtimeHero)).toBeCloseTo(baseDodge + 0.1);

    const enemy = { type: "goblin", damage: 100, boss: false };
    const hpBeforeDodge = hero.hp;
    engine._enemyAttack(enemy, { kind: "hero", obj: runtimeHero });
    expect(hero.hp).toBe(hpBeforeDodge);

    random.mockReturnValue(0.25);
    engine._enemyAttack(enemy, { kind: "hero", obj: runtimeHero });
    expect(hpBeforeDodge - hero.hp).toBeCloseTo(
      C.damageAfterDefense(100, runtimeHero.d.defense),
    );
    expect(Number.isFinite(hero.hp)).toBe(true);
  });
});
