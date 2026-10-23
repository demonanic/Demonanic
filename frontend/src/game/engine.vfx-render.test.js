import { Engine } from "./engine";
import { createNewState } from "./logic";
import { createHeroModel } from "./heroModel";

function makeCanvasContext() {
  const calls = [];
  const values = { globalAlpha: 1 };
  const context = new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "drawImage") return (...args) => calls.push({ args, alpha: target.globalAlpha });
      if (key === "createLinearGradient" || key === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { context, calls };
}

function makeEnemy(x, y) {
  return { name: "VFX target", type: "targetDummy", hp: 500, maxHp: 500,
    x, y, speed: 0, lane: -1, floats: true, dmgBy: {}, affinities: {} };
}

describe("supplied combat VFX through the live Engine canvas renderer", () => {
  afterEach(() => {
    delete global.Image;
    jest.restoreAllMocks();
  });

  test("draws supplied projectile and impact PNGs for classless and legacy heroes", () => {
    class LoadedImage {
      constructor() { this.complete = true; this.naturalWidth = 192; this.naturalHeight = 128; }
      set src(value) { this.url = value; }
      get src() { return this.url; }
    }
    global.Image = LoadedImage;
    const random = jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.5).mockReturnValueOnce(0.5).mockReturnValueOnce(0);

    const classless = createHeroModel({ id: "vfx-classless" });
    classless.equipment = { PrimaryWeapon: { name: "Test Bow", weaponType: "bow" } };
    const classlessEngine = new Engine({ getContext: () => null },
      { ...createNewState(), heroes: [classless] }, { enemies: [], total: 1 });
    const classlessHero = classlessEngine.heroes[0];
    const classlessTarget = makeEnemy(classlessHero.x, classlessHero.y - 90);
    classlessEngine.active = [classlessTarget];
    classlessEngine._fire("H0", classlessHero, classlessTarget, classlessHero.d, true);
    classlessEngine._applyHit(classlessEngine.projectiles[0]);
    expect(classlessEngine.useSharedStrike(0, classlessTarget)).toBe(true);

    const legacyState = createNewState(["archer"]);
    const legacyEngine = new Engine({ getContext: () => null }, legacyState, { enemies: [], total: 1 });
    const legacyHero = legacyEngine.heroes[0];
    const legacyTarget = makeEnemy(legacyHero.x, legacyHero.y - 90);
    legacyEngine.active = [legacyTarget];
    legacyEngine._fire("H0", legacyHero, legacyTarget, legacyHero.d, true);
    legacyEngine._applyHit(legacyEngine.projectiles[0]);

    const mageEngine = new Engine({ getContext: () => null }, createNewState(["mage"]), { enemies: [], total: 1 });
    const mage = mageEngine.heroes[0];
    const spellTarget = makeEnemy(mage.x + 80, mage.y);
    mageEngine.active = [spellTarget];
    expect(mageEngine.castMageSpell(0, "fireball", { enemy: spellTarget })).toBe(true);

    const rendered = [];
    for (const engine of [classlessEngine, legacyEngine, mageEngine]) {
      const { context, calls } = makeCanvasContext();
      engine.ctx = context;
      engine.canvas = { width: 420, height: 760 };
      engine.render();
      rendered.push(...calls);
    }

    const suppliedPngDraws = rendered.filter(({ args }) => args[0]?.src?.includes("/sprites/vfx/"));
    const drawnUrls = suppliedPngDraws.map(({ args }) => args[0].src);
    expect(drawnUrls).toEqual(expect.arrayContaining([
      expect.stringContaining("/sprites/vfx/projectiles/arrow-"),
      expect.stringContaining("/sprites/vfx/impacts/star-"),
      expect.stringContaining("/sprites/vfx/impacts/burst-07.png"),
      expect.stringContaining("/sprites/vfx/impacts/crescent-08.png"),
      expect.stringContaining("/sprites/vfx/impacts/orbit-05.png"),
    ]));
    expect(suppliedPngDraws.length).toBeGreaterThanOrEqual(8);
    expect(suppliedPngDraws.every(({ alpha }) => alpha >= 0.4 && alpha <= 1)).toBe(true);
    expect(suppliedPngDraws.some(({ alpha }) => alpha > 0.68 && alpha < 0.78)).toBe(true);
    expect(suppliedPngDraws.every(({ args }) => Math.max(args[3], args[4]) >= 46)).toBe(true);
    expect(drawnUrls.every((url) => url.startsWith("/sprites/vfx/"))).toBe(true);
    random.mockRestore();
  });
});
