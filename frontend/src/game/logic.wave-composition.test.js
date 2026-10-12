import { buildWave, createNewState } from "./logic";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function aggregateWaves(state, runs = 120) {
  const counts = {};
  for (let seed = 1; seed <= runs; seed++) {
    const wave = buildWave(state, seededRandom(seed));
    for (const enemy of wave.enemies) {
      counts[enemy.type] = (counts[enemy.type] || 0) + 1;
    }
  }
  return counts;
}

describe("counter-aware wave composition", () => {
  test("keeps the curated first three waves free of unintroduced specialists", () => {
    const state = createNewState(["knight", "rouge", "mage", "archer"]);
    for (const waveNumber of [1, 2, 3]) {
      state.wave = waveNumber;
      const wave = buildWave(state, seededRandom(42));
      const allowed = new Set(
        waveNumber === 1 ? ["ghost", "goblin"] :
          waveNumber === 2 ? ["ghost", "goblin", "slime"] :
            ["ghost", "goblin", "slime", "skeleton"]
      );
      expect(wave.enemies.every((enemy) => allowed.has(enemy.type))).toBe(true);
    }
  });

  test("weights Warlocks more often when the squad includes a Mage", () => {
    const withoutMage = createNewState(["knight", "rouge", "archer", "archer"]);
    const withMage = createNewState(["knight", "rouge", "mage", "archer"]);
    withoutMage.wave = withMage.wave = 20;

    const baseline = aggregateWaves(withoutMage);
    const counterAware = aggregateWaves(withMage);
    expect(counterAware.warlock || 0).toBeGreaterThan(baseline.warlock || 0);
  });

  test("weights Slimes more often when a Wizard Tower is present", () => {
    const withoutWizard = createNewState(["knight", "rouge", "archer", "archer"]);
    const withWizard = createNewState(["knight", "rouge", "archer", "archer"]);
    withoutWizard.wave = withWizard.wave = 20;
    withWizard.towers.push({ type: "wizard" });

    const baseline = aggregateWaves(withoutWizard);
    const counterAware = aggregateWaves(withWizard);
    expect(counterAware.slime || 0).toBeGreaterThan(baseline.slime || 0);
  });

  test("ignores empty tower slots when applying multi-tower counter weights", () => {
    const oneTower = createNewState(["knight", "rouge", "archer", "archer"]);
    const oneTowerWithEmptySlot = createNewState(["knight", "rouge", "archer", "archer"]);
    oneTower.wave = oneTowerWithEmptySlot.wave = 20;
    oneTower.towers.push({ id: "wizard-1", type: "wizard" });
    oneTowerWithEmptySlot.towers.push({ id: "wizard-1", type: "wizard" }, null);

    expect(buildWave(oneTower, seededRandom(123)).enemies)
      .toEqual(buildWave(oneTowerWithEmptySlot, seededRandom(123)).enemies);
  });

  test("does not mutate the saved tower or hero state while generating a wave", () => {
    const state = createNewState(["knight", "rouge", "mage", "archer"]);
    state.wave = 10;
    state.towers.push({ id: "test-wizard", type: "wizard", x: 210, y: 250 });
    const before = JSON.stringify({ heroes: state.heroes, towers: state.towers });
    buildWave(state, seededRandom(99));
    expect(JSON.stringify({ heroes: state.heroes, towers: state.towers })).toBe(before);
  });
});
