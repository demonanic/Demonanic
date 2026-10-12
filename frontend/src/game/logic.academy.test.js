import { createNewState, createHero, academySeats, academyTrainingHours, enrollAcademyHero, recallAcademyHero, advanceAcademyTraining, recoverOverTime } from "./logic";

function heroDerivedForTest(hero) { return heroDerived(hero).maxHp; }\n\nfunction academyState() {
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
    const hero = state.bench[0];
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

  test("recall preserves progress and resume continues the same course", () => {
    const state = academyState();
    const hero = state.bench[0];
    const start = Date.now();
    expect(enrollAcademyHero(state, hero.id, "agility", start)).toBe(true);
    const training = state.academyTraining[0];
    training.elapsedMs = 90 * 60 * 1000;
    training.startedAt = start - training.elapsedMs;
    expect(recallAcademyHero(state, hero.id, start)).toBe(true);
    expect(state.academyHeroes).toHaveLength(0);
    expect(state.bench.some((h) => h.id === hero.id)).toBe(true);
    expect(training.paused).toBe(true);
    const duration = training.durationMs;
    expect(enrollAcademyHero(state, hero.id, "agility", start + 1000)).toBe(true);
    expect(training.durationMs).toBe(duration);
    expect(training.paused).toBe(false);
    expect(training.elapsedMs).toBe(90 * 60 * 1000);
  });

  test("benched heroes recover HP and mana over time", () => {
    const state = academyState();
    const hero = state.bench[0];
    hero.hp = Math.floor(heroDerivedForTest(hero) / 2);
    hero.mana = 0;
    const maxHp = heroDerivedForTest(hero);
    recoverOverTime(state, 3600);
    expect(hero.hp).toBeGreaterThan(Math.floor(maxHp / 2));
    expect(hero.mana).toBeGreaterThan(0);
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
