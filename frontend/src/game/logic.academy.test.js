import { createNewState, createHero, academySeats, academyTrainingHours, enrollAcademyHero, advanceAcademyTraining } from "./logic";

function academyState() {
  const state = createNewState(["knight"]);
  state.bench = [createHero("archer")];
  state.buildings = { academy: { unlocked: true, level: 1, hp: 1000, maxHp: 1000, activity: "Idle" } };
  return state;
}

describe("Academy training", () => {
  test("starts with two seats and adds one seat every three levels after level 1", () => {
    const state = academyState();
    expect(academySeats(state)).toBe(2);
    state.buildings.academy.level = 4;
    expect(academySeats(state)).toBe(3);
    state.buildings.academy.level = 7;
    expect(academySeats(state)).toBe(4);
  });

  test("Intelligence alone reduces learning time, capped at 50 percent", () => {
    const state = academyState();
    const hero = state.bench[0];
    hero.stats.intelligence = 10;
    const base = academyTrainingHours(state, hero, "attack");
    hero.stats.intelligence = 20;
    expect(academyTrainingHours(state, hero, "attack")).toBeCloseTo(base * 0.8);
    hero.stats.intelligence = 100;
    expect(academyTrainingHours(state, hero, "attack")).toBeCloseTo(base * 0.5);
  });

  test("enrollment occupies a seat and completion grants exactly one permanent stat point", () => {
    const state = academyState();
    const hero = state.heroes[0];
    const now = Date.now();
    expect(enrollAcademyHero(state, hero.id, "attack", now)).toBe(true);
    expect(state.bench.some((h) => h.id === hero.id)).toBe(false);
    expect(state.academyHeroes.some((h) => h.id === hero.id)).toBe(true);
    expect(enrollAcademyHero(state, hero.id, "defense", now)).toBe(false);
    const before = hero.stats.attack;
    state.academyTraining[0].durationMs = 1000;
    state.academyTraining[0].startedAt = now - 2000;
    advanceAcademyTraining(state, 1, now);
    expect(hero.stats.attack).toBe(before + 1);
    expect(state.academyTraining).toHaveLength(0);
    expect(hero.academyTrainingCounts.attack).toBe(1);
    expect(state.academyHeroes.some((h) => h.id === hero.id)).toBe(false);
    expect(state.bench.some((h) => h.id === hero.id)).toBe(true);
  });

  test("rejects training for a locked or destroyed Academy", () => {
    const state = academyState();
    state.buildings.academy.unlocked = false;
    expect(enrollAcademyHero(state, state.bench[0].id, "agility")).toBe(false);
    state.buildings.academy.unlocked = true;
    state.buildings.academy.hp = 0;
    expect(enrollAcademyHero(state, state.bench[0].id, "agility")).toBe(false);
  });
});
