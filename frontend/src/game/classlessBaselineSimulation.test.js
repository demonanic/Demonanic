import { Engine } from "./engine";
import { buildWave, createHero } from "./logic";

// Audit harness: feeds the production Engine.update loop real buildWave output,
// while overriding only derived hero combat fields that have no classless path.
const FIXED = { hp: 250, attack: 16, rate: 1.05, range: 170, defense: 10, agility: 10, move: 1 };

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function runScenario({ waveNumber, squadSize = 1, pressure = "typical", seed = 1, stats = FIXED }) {
  const heroes = Array.from({ length: squadSize }, (_, i) => {
    const hero = createHero("archer");
    hero.name = `Audit ${i + 1}`;
    hero.attackConfig = ""; // Engine's nearest-target fallback
    hero.hp = stats.hp;
    return hero;
  });
  const sim = {
    heroes, towers: [], barricades: [], buildings: {}, wave: waveNumber,
    castleHp: 1000, castleMaxHp: 1000, morale: 50,
    gold: 0, metal: 0, stone: 0, vault: [], kills: { total: 0, byType: {} },
  };
  const random = rng(seed);
  const wave = buildWave(sim, random);
  if (pressure === "low") {
    wave.enemies = wave.enemies.slice(0, Math.ceil(wave.enemies.length * 0.7));
    wave.hasBoss = false;
  } else if (pressure === "high") {
    wave.enemies = wave.enemies.concat(wave.enemies.map((enemy) => ({ ...enemy, id: `extra-${enemy.id}` })));
  }
  wave.total = wave.enemies.length;
  const pressureDamage = pressure === "low" ? 0.75 : pressure === "high" ? 1.25 : 1;
  const pressureHp = pressure === "low" ? 0.85 : pressure === "high" ? 1.15 : 1;
  wave.enemies = wave.enemies.map((enemy) => ({
    ...enemy, hp: Math.round(enemy.hp * pressureHp), maxHp: Math.round(enemy.maxHp * pressureHp),
    damage: enemy.damage * pressureDamage,
  }));

  const previousRandom = Math.random;
  Math.random = rng(seed ^ 0xa5a5a5a5);
  const engine = new Engine({ getContext: () => ({}) }, sim, wave);
  engine.heroes.forEach((hero) => {
    hero.d = {
      ...hero.d, maxHp: stats.hp, attack: stats.attack, damage: stats.attack,
      rate: stats.rate, range: stats.range, defense: stats.defense, agility: stats.agility,
      moveSpeedMultiplier: stats.move, critChance: 0.05, critMult: 1.5,
      magic: false, damageType: "neutral", color: "#fff", perkEffects: {},
    };
    hero.ref.hp = stats.hp;
  });

  let dealtDamage = 0;
  let targetSearchFrames = 0;
  let outOfRangeFrames = 0;
  const originalHit = engine._applyHit.bind(engine);
  engine._applyHit = (projectile) => {
    const before = projectile.target?.hp || 0;
    originalHit(projectile);
    dealtDamage += Math.max(0, before - (projectile.target?.hp || 0));
  };
  const originalSelectTarget = engine._selectTarget.bind(engine);
  engine._selectTarget = (hero) => {
    targetSearchFrames += 1;
    const target = originalSelectTarget(hero);
    if (!target && engine.active.some((enemy) => enemy.hp > 0)) outOfRangeFrames += 1;
    return target;
  };

  const maxSeconds = 600;
  while (!engine.ended && engine.time < maxSeconds) engine.update(0.05);
  Math.random = previousRandom;
  const hpLeft = engine.heroes.reduce((sum, hero) => sum + Math.max(0, hero.ref.hp), 0);
  const completed = engine.ended && engine.spawnQueue.length === 0 && engine.active.length === 0 && engine.heroes.some((hero) => hero.alive);
  return {
    wave: waveNumber, squadSize, pressure, seed, total: wave.total, result: completed ? "clear" : "failure",
    seconds: Number(engine.time.toFixed(2)), kills: engine.killed,
    deaths: engine.heroes.filter((hero) => !hero.alive).length,
    hpRemaining: Math.round(hpLeft), hpLost: Math.round(squadSize * stats.hp - hpLeft),
    castleHp: Math.round(sim.castleHp), escaped: engine.castleEscaped,
    targetSearchFrames, outOfRangeFrames,
    dealtDamage: Math.round(dealtDamage),
  };
}

describe("classless baseline audit simulation", () => {
  test("runs deterministic wave 1 and wave 5 pressure and squad comparisons", () => {
    const results = [];
    for (const waveNumber of [1, 5]) {
      for (const squadSize of [1, 3, 5]) {
        for (const pressure of ["low", "typical", "high"]) {
          for (let replicate = 0; replicate < 5; replicate++) {
            results.push(runScenario({ waveNumber, squadSize, pressure, seed: 22026 + waveNumber * 100 + squadSize + replicate }));
          }
        }
      }
    }
    const sensitivity = [
      {},
      { hp: 200 }, { hp: 300 }, { attack: 13 }, { attack: 19 },
      { rate: 0.9 }, { rate: 1.2 }, { range: 130 }, { range: 220 },
      { move: 0.75 }, { move: 1.25 },
    ].map((change) => ({
      change: Object.keys(change)[0], value: Object.values(change)[0],
      ...runScenario({ waveNumber: 5, squadSize: 3, pressure: "typical", seed: 4242, stats: { ...FIXED, ...change } }),
    }));
    // Repeat a fixed input to catch nondeterminism in the harness.
    expect(runScenario({ waveNumber: 1, squadSize: 1, seed: 101 })).toEqual(
      runScenario({ waveNumber: 1, squadSize: 1, seed: 101 }),
    );
    const summary = [];
    for (const waveNumber of [1, 5]) for (const squadSize of [1, 3, 5]) for (const pressure of ["low", "typical", "high"]) {
      const group = results.filter((result) => result.wave === waveNumber && result.squadSize === squadSize && result.pressure === pressure);
      summary.push({ wave: waveNumber, squadSize, pressure, clears: `${group.filter((item) => item.result === "clear").length}/${group.length}`,
        avgSeconds: Number((group.reduce((sum, item) => sum + item.seconds, 0) / group.length).toFixed(1)),
        avgDeaths: Number((group.reduce((sum, item) => sum + item.deaths, 0) / group.length).toFixed(1)),
        avgHpLost: Math.round(group.reduce((sum, item) => sum + item.hpLost, 0) / group.length),
        avgDamageDealt: Math.round(group.reduce((sum, item) => sum + item.dealtDamage, 0) / group.length),
        avgOutOfRangeFrames: Math.round(group.reduce((sum, item) => sum + item.outOfRangeFrames, 0) / group.length),
      });
    }
    // Summary artifacts are emitted in the focused Jest run and copied into the handoff.
    // eslint-disable-next-line no-console
    console.log("CLASSLESS_BASELINE_SIMULATION", JSON.stringify({ summary, sensitivity }));
    expect(results).toHaveLength(90);
    expect(sensitivity).toHaveLength(11);
  });
});
