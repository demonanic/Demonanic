import { HERO_SPRITE_ATLAS, selectHeroSpriteFrame } from "./heroSprite";
import { Engine } from "./engine";
import { createHeroModel } from "./heroModel";
import { createNewState } from "./logic";

describe("classless hero sprite animation selection", () => {
  test.each([
    [{ alive: true }, "idle"],
    [{ alive: true, moving: true }, "walk"],
    [{ alive: true, moving: true, running: true }, "run"],
    [{ alive: true, action: "attack" }, "attack"],
    [{ alive: true, action: "sharedStrike" }, "sharedStrike"],
    [{ alive: true, hit: true, action: "attack" }, "hit"],
    [{ alive: false }, "death"],
  ])("selects %s as %s", (state, animation) => {
    expect(selectHeroSpriteFrame(state, 0.1).animation).toBe(animation);
  });

  test("cycles frames inside the correct transparent atlas row", () => {
    const first = selectHeroSpriteFrame({ alive: true, action: "sharedStrike" }, 0);
    const later = selectHeroSpriteFrame({ alive: true, action: "sharedStrike" }, 0.13);
    expect(first.sy).toBe(HERO_SPRITE_ATLAS.animations.sharedStrike * 48);
    expect(first.sx).not.toBe(later.sx);
    expect(first.sw).toBe(48);
    expect(first.sh).toBe(48);
    expect(selectHeroSpriteFrame({ alive: false }, 1).sx).toBeLessThan(144);
  });

  test("Engine draws the shared transparent atlas frame for a classless hero", () => {
    const previousImage = global.Image;
    const image = { complete: true, naturalWidth: 144, set src(value) { this.path = value; } };
    global.Image = class { constructor() { return image; } };
    const context = { save: jest.fn(), translate: jest.fn(), rotate: jest.fn(), drawImage: jest.fn(), restore: jest.fn() };
    const model = createHeroModel({ id: "sprite-draw" });
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [model] }, { enemies: [], total: 1 });
    engine.ctx = context;
    try {
      engine._drawHeroSprite(engine.heroes[0]);
      expect(image.path).toContain(HERO_SPRITE_ATLAS.path);
      expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 48, 48, -24, -44, 48, 48);
    } finally { global.Image = previousImage; }
  });
});
