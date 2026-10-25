import { createHeroModel, serializeGameState } from "./heroModel";
import { createNewState, heroDerived, academyTrainingHours, enrollAcademyHero, advanceAcademyTraining, equipHeroItem, unequipHeroItem } from "./logic";
import { normalizeState } from "../context/GameProvider";

describe("classless shared screen compatibility", () => {
  test("heroDerived reads nested combat data and preserves classless baseline", () => {
    const hero = createHeroModel({ id: "shared-hero", name: "Neon" });
    expect(heroDerived(hero)).toMatchObject({ maxHp: 300, attack: 10, range: 220, color: hero.appearance.identityColor });
    expect(hero).not.toHaveProperty("cls");
    expect(hero).not.toHaveProperty("stats");
  });

  test("classless Academy training looks up stable identity and writes nested stats/progression", () => {
    const state = createNewState();
    state.bench = [createHeroModel({ id: "academy-classless", name: "Reserve" })];
    state.buildings = { academy: { unlocked: true, level: 1, hp: 1000, activity: "Idle" } };
    const hero = state.bench[0];
    const start = 1000000;
    expect(academyTrainingHours(state, hero, "attack")).toBeGreaterThan(0);
    expect(enrollAcademyHero(state, "academy-classless", "attack", start)).toBe(true);
    expect(state.academyTraining[0].heroId).toBe("academy-classless");
    state.academyTraining[0].durationMs = 1000;
    state.academyTraining[0].startedAt = start - 2000;
    advanceAcademyTraining(state, 1, start);
    expect(hero.combat.stats.attack).toBe(11);
    expect(hero.progression.academyTrainingCounts.attack).toBe(1);
    expect(hero).not.toHaveProperty("stats");
    expect(state.bench[0].identity.id).toBe("academy-classless");
  });

  test("normalization keeps classless Academy training linked by identity ID", () => {
    const state = createNewState();
    const hero = createHeroModel({ id: "academy-reload" });
    state.academyHeroes = [hero];
    state.academyTraining = [{ heroId: "academy-reload", stat: "defense", paused: false, durationMs: 1000, elapsedMs: 10 }];
    const normalized = normalizeState(state);
    expect(normalized.academyTraining).toHaveLength(1);
    expect(normalized.academyTraining[0].heroId).toBe(hero.identity.id);
  });

  test("legacy Knight derived stats remain class-based", () => {
    const state = createNewState(["knight"]);
    expect(heroDerived(state.heroes[0]).maxHp).toBe(state.heroes[0].maxHp);
    expect(heroDerived(state.heroes[0]).color).toBeTruthy();
  });

  test("classless equipment adds derived stats without changing base stats or compounding", () => {
    const state = createNewState();
    const hero = createHeroModel({ id: "equipment-classless" });
    state.heroes = [hero];
    state.vault = [{ id: "gear-1", name: "Field Blade", slot: "PrimaryWeapon", rarity: "E1", stats: { attack: 2, critDamage: 1 } }];

    expect(equipHeroItem(state, 0, "gear-1")).toBe(true);
    expect(hero.combat.stats.attack).toBe(10);
    expect(heroDerived(hero)).toMatchObject({ attack: 12, critMult: 1.51 });
    expect(state.vault).toHaveLength(0);
    expect(equipHeroItem(state, 0, "gear-1")).toBe(false);

    expect(unequipHeroItem(state, 0, "PrimaryWeapon")).toBe(true);
    expect(heroDerived(hero)).toMatchObject({ attack: 10, critMult: 1.5 });
    expect(state.vault[0].id).toBe("gear-1");
  });

  test("classless heroes can equip a neutral secondary item without class identity modifiers", () => {
    const state = createNewState();
    state.heroes = [createHeroModel({ id: "universal-secondary" })];
    state.vault = [{ id: "shield-1", slot: "SecondaryWeapon", secondaryType: "Shield", stats: { defense: 2 } }];

    expect(equipHeroItem(state, 0, "shield-1")).toBe(true);
    expect(heroDerived(state.heroes[0]).defense).toBe(12);
  });

  test("classless equipped items survive profile serialization and normalization", () => {
    const state = createNewState();
    const hero = createHeroModel({ id: "equipment-reload" });
    state.heroes = [hero];
    state.vault = [{ id: "armor-reload", slot: "Chest", stats: { defense: 4, maxHP: 20 } }];
    expect(equipHeroItem(state, 0, "armor-reload")).toBe(true);

    const reloaded = normalizeState(serializeGameState(state));
    expect(reloaded.heroes[0].equipment.Chest.id).toBe("armor-reload");
    expect(reloaded.heroes[0].combat.hp).toBe(300);
    expect(heroDerived(reloaded.heroes[0])).toMatchObject({ maxHp: 320, defense: 14 });
    expect(reloaded.heroes[0]).not.toHaveProperty("cls");
  });

  test("legacy class equipment derivation remains unchanged", () => {
    const state = createNewState(["knight"]);
    const hero = state.heroes[0];
    const originalAttack = heroDerived(hero).attack;
    state.vault = [{ id: "legacy-weapon", slot: "PrimaryWeapon", stats: { attack: 2 } }];
    expect(equipHeroItem(state, 0, "legacy-weapon")).toBe(true);
    expect(heroDerived(hero).attack).toBe(originalAttack + 2);
    expect(hero.cls).toBe("knight");
  });
});
