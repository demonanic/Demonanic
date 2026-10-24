import { createHeroModel } from "./heroModel";
import { createNewState, heroDerived, academyTrainingHours, enrollAcademyHero, advanceAcademyTraining } from "./logic";
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
});
